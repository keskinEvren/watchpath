import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  Video,
  Level,
  GeminiSearchTermsResponse,
  GeminiRoadmapResponse,
  TranscriptSegment,
  EdgeType,
  InterviewQuestion,
  CurriculumTree,
  CurriculumNode,
  UserProfile,
} from '@/types';
import { condenseTranscript } from '@/lib/transcript';

const MODEL_NAME = 'gemini-2.0-flash';
const TIMEOUT_MS = 45_000;

function getClient(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Missing GEMINI_API_KEY env var');
  return new GoogleGenerativeAI(key);
}

const MAX_RETRIES = 3;
const MAX_RETRY_DELAY_MS = 60_000; // Allow longer waits for rate limits

/**
 * Parse retryDelay from Gemini 429 error (e.g. "8s" → 8000ms).
 * Falls back to 10s if unparseable.
 */
function parseRetryDelay(err: unknown): number {
  try {
    const msg = err instanceof Error ? err.message : String(err);
    const match = msg.match(/retry in (\d+(?:\.\d+)?)s/i);
    if (match) return Math.min(Math.ceil(parseFloat(match[1]) * 1000), MAX_RETRY_DELAY_MS);
    const matchMs = msg.match(/retryDelay.*?(\d+)s/i);
    if (matchMs) return Math.min(parseInt(matchMs[1], 10) * 1000, MAX_RETRY_DELAY_MS);
  } catch { /* ignore */ }
  return 10_000; // default 10s
}

function is429Error(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.message.includes('429') || err.message.includes('Too Many Requests');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run a Gemini call with timeout per attempt.
 * Uses gemini-2.0-flash: standard fast model.
 */
async function callGemini(
  prompt: string,
  jsonSchema?: boolean
): Promise<string> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: jsonSchema
      ? { responseMimeType: 'application/json' }
      : undefined,
  });

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const result = await model.generateContent(
        { contents: [{ role: 'user', parts: [{ text: prompt }] }] },
        { signal: controller.signal as AbortSignal }
      );
      clearTimeout(timer);
      return result.response.text();
    } catch (err) {
      clearTimeout(timer);
      lastError = err;

      if (is429Error(err) && attempt < MAX_RETRIES) {
        const delay = parseRetryDelay(err);
        console.log(`[gemini] 429 rate limited. Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})...`);
        await sleep(delay);
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}

/**
 * Generate 3-5 YouTube search terms for a topic.
 */
export async function generateSearchTerms(
  topic: string,
  level: Level,
  language: string
): Promise<string[]> {
  const langLabel = language === 'tr' ? 'Türkçe' : 'English';

  const prompt = `You are a learning path designer. Given the topic "${topic}" at ${level} level, generate 3-5 YouTube search queries that would find the best tutorial and educational videos in ${langLabel}.

Return JSON:
{
  "terms": ["search term 1", "search term 2", ...]
}

Rules:
- Terms should cover different aspects: fundamentals, practical projects, common patterns
- Include the language preference in terms (e.g. "türkçe" or "tutorial")
- For beginner level, include "nedir", "başlangıç", "introduction", "for beginners" type terms
- For advanced level, include "ileri seviye", "advanced", "deep dive" type terms
- Return ONLY valid JSON, no markdown fences`;

  try {
    const raw = await callGemini(prompt, true);
    const parsed: GeminiSearchTermsResponse = JSON.parse(raw);

    if (!parsed.terms || parsed.terms.length === 0) {
      return getFallbackSearchTerms(topic, level, language);
    }

    return parsed.terms.slice(0, 5);
  } catch (err) {
    console.error('[gemini] generateSearchTerms failed:', err);
    return getFallbackSearchTerms(topic, level, language);
  }
}

function getFallbackSearchTerms(
  topic: string,
  level: Level,
  language: string
): string[] {
  const lang = language === 'tr' ? 'türkçe' : '';
  const levelMap: Record<Level, string> = {
    beginner: language === 'tr' ? 'başlangıç' : 'beginner',
    intermediate: language === 'tr' ? 'orta seviye' : 'intermediate',
    advanced: language === 'tr' ? 'ileri seviye' : 'advanced',
  };

  return [
    `${topic} ${levelMap[level]} ${lang}`.trim(),
    `${topic} tutorial ${lang}`.trim(),
    `${topic} ders ${lang}`.trim(),
  ];
}

/**
 * Generate roadmap structure from videos and transcripts using Gemini.
 * Falls back to a simple linear roadmap sorted by view count if Gemini fails.
 */
export async function generateRoadmapStructure(
  topic: string,
  level: Level,
  videos: Video[],
  transcripts: Map<string, TranscriptSegment[]>
): Promise<GeminiRoadmapResponse> {
  // Build the video list with metadata and transcript previews
  const videoDescriptions = videos
    .map((v) => {
      const transcript = transcripts.get(v.youtube_id);
      const transcriptPreview = transcript
        ? `\nTranscript preview: ${condenseTranscript(transcript, 500)}`
        : '';

      return `- ID: ${v.youtube_id}
  Title: ${v.title}
  Channel: ${v.channel_name}
  Duration: ${v.duration_seconds ?? 0}s
  Views: ${v.view_count}
  Description: ${(v.description ?? '').slice(0, 200)}${transcriptPreview}`;
    })
    .join('\n\n');

  const prompt = `You are an expert learning path designer. Analyze these YouTube videos and create a structured learning roadmap for "${topic}" at ${level} level.

Videos:
${videoDescriptions}

Create a structured roadmap following these rules:
1. Select the best 8-20 videos (skip duplicates, low quality, or irrelevant ones)
2. Group videos into 2-5 categories (e.g., "Fundamentals", "Practical Projects", "Advanced Concepts")
3. Order videos from foundational to advanced within each category
4. Define edges between videos (prerequisite = must watch first, related = helpful, optional = can skip)
5. Add milestone nodes after each category
6. Calculate estimated total duration in minutes

Return JSON matching this exact structure:
{
  "categories": [
    { "name": "Category Name", "description": "Brief description", "order": 0 }
  ],
  "nodes": [
    { "youtube_id": "...", "category": "Category Name", "order": 0, "label": "Video title or custom label", "description": "Why watch this", "level": "beginner" }
  ],
  "edges": [
    { "source_youtube_id": "...", "target_youtube_id": "...", "type": "prerequisite", "label": "Watch this first" }
  ],
  "milestones": [
    { "after_category": "Category Name", "label": "Fundamentals completed!" }
  ],
  "estimated_total_minutes": 180
}

IMPORTANT:
- youtube_id values MUST exactly match the IDs from the video list above
- type must be one of: "prerequisite", "related", "optional"
- level must be one of: "beginner", "intermediate", "advanced"
- Return ONLY valid JSON, no markdown fences`;

  try {
    const raw = await callGemini(prompt, true);
    const parsed: GeminiRoadmapResponse = JSON.parse(raw);

    // Validate basic structure
    if (
      !parsed.categories ||
      !parsed.nodes ||
      parsed.nodes.length === 0
    ) {
      console.warn('[gemini] Invalid roadmap structure, using fallback');
      return buildFallbackRoadmap(topic, level, videos);
    }

    // Filter out nodes referencing videos we don't have
    const videoIdSet = new Set(videos.map((v) => v.youtube_id));
    parsed.nodes = parsed.nodes.filter((n) => videoIdSet.has(n.youtube_id));
    parsed.edges = (parsed.edges ?? []).filter(
      (e) => videoIdSet.has(e.source_youtube_id) && videoIdSet.has(e.target_youtube_id)
    );

    if (parsed.nodes.length === 0) {
      return buildFallbackRoadmap(topic, level, videos);
    }

    return parsed;
  } catch (err) {
    console.error('[gemini] generateRoadmapStructure failed:', err);
    return buildFallbackRoadmap(topic, level, videos);
  }
}

/**
 * Fallback: sort videos by view_count, create a simple linear roadmap.
 * Used when Gemini fails or times out.
 */
function buildFallbackRoadmap(
  topic: string,
  level: Level,
  videos: Video[]
): GeminiRoadmapResponse {
  // Sort by view count descending, take top 15
  const sorted = [...videos]
    .sort((a, b) => b.view_count - a.view_count)
    .slice(0, 15);

  const categoryName = `${topic} Videos`;

  const nodes = sorted.map((v, i) => ({
    youtube_id: v.youtube_id,
    category: categoryName,
    order: i,
    label: v.title,
    description: '',
    level: level,
  }));

  // Linear prerequisite chain
  const edges: GeminiRoadmapResponse['edges'] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    edges.push({
      source_youtube_id: sorted[i].youtube_id,
      target_youtube_id: sorted[i + 1].youtube_id,
      type: 'prerequisite' as EdgeType,
    });
  }

  const totalMinutes = sorted.reduce(
    (sum, v) => sum + Math.floor((v.duration_seconds ?? 0) / 60),
    0
  );

  return {
    categories: [
      { name: categoryName, description: `${topic} learning content`, order: 0 },
    ],
    nodes,
    edges,
    milestones: [
      { after_category: categoryName, label: `${topic} completed!` },
    ],
    estimated_total_minutes: totalMinutes,
  };
}

// ============================================================
// v2 Gemini Functions
// ============================================================

/**
 * Generate topic-specific interview questions using Gemini.
 * Returns 3 questions with 4 options each.
 */
export async function generateDynamicQuestions(
  topic: string,
): Promise<InterviewQuestion[]> {
  const prompt = `Bir kullanıcı "${topic}" konusunu öğrenmek istiyor. Bu kullanıcıya en uygun öğrenme yolunu belirlemek için 3 soru oluştur.

Her soru için:
- id: "level", "goal", "weakness" (sırayla)
- question: Türkçe, samimi ton
- options: 4 seçenek, her birinde value (İngilizce, kısa) ve label (Türkçe)

JSON formatında döndür:
[
  {
    "id": "level",
    "question": "...",
    "options": [{"value": "...", "label": "..."}]
  }
]

Sadece JSON döndür, başka metin ekleme.`;

  const text = await callGemini(prompt);
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned) as InterviewQuestion[];

  // Validate structure
  if (!Array.isArray(parsed) || parsed.length < 2) {
    throw new Error('Invalid interview questions format');
  }

  for (const q of parsed) {
    if (!q.id || !q.question || !Array.isArray(q.options) || q.options.length < 2) {
      throw new Error('Invalid question structure');
    }
  }

  return parsed;
}

/**
 * Generate human-readable names for video clusters.
 * Cheap Gemini call: just keyword lists -> 2-3 word names.
 */
export async function generateClusterNames(
  clusters: { keywords: string[] }[],
): Promise<string[]> {
  const prompt = `Aşağıdaki anahtar kelime gruplarına Türkçe isimler ver. Her grup için 2-3 kelimelik kısa bir başlık.

${clusters.map((c, i) => `Grup ${i + 1}: ${c.keywords.join(', ')}`).join('\n')}

JSON formatında döndür: ["isim1", "isim2", ...]
Sadece JSON döndür.`;

  try {
    const text = await callGemini(prompt);
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const names = JSON.parse(cleaned) as string[];
    if (Array.isArray(names) && names.length === clusters.length) {
      return names;
    }
  } catch {
    // Fallback: use keywords directly
  }

  return clusters.map((c) => c.keywords.slice(0, 3).join(' / ') || 'Genel');
}

/**
 * Generate a curriculum tree (roadmap.sh style) for a topic.
 * Returns a hierarchical tree of categories and topics with YouTube search terms.
 */
export async function generateCurriculumTree(
  topic: string,
  profile: UserProfile,
  language: string = 'tr',
): Promise<CurriculumTree> {
  const levelDesc = profile.level < 0.3 ? 'başlangıç'
    : profile.level < 0.6 ? 'orta'
    : 'ileri';

  const answersText = Object.entries(profile.answers || {})
    .map(([key, val]) => `- ${key}: ${val}`)
    .join('\n');

  const prompt = `"${topic}" konusu için detaylı bir öğrenme yol haritası (roadmap) oluştur.

Kullanıcı Profili ve Anket Cevapları:
- Genel Seviye: ${levelDesc}
- Hedef: ${profile.goal}
- Zorlandığı Alan: ${profile.weakness}
Cevap detayları:
${answersText}

Dallanma (Branching) ve Özelleştirme Kuralları:
1. Seviyeye Göre Dallanma: 
   - Seviye başlangıçsa ("beginner"/"elementary"), ilk kategorileri çok detaylı tut ve "required" yap. İleri düzey konuları en sona at ve "optional" olarak işaretle.
   - Seviye ileri ise ("advanced"/"expert"), giriş ve temel konuları ya hiç ekleme ya da tek bir "required" kategori altında çok hızlı özet olarak geç. Zamanının çoğunu ileri düzey konulara, mimari kararlara ayır.
2. Hedefe Göre Önceliklendirme:
   - Kullanıcının hedefi "career" (iş bulmak/kariyer) ise, endüstri standartları, test yazımı, CI/CD ve mülakatlarda sorulan konuları ekle.
   - Hedef "project" (proje yapmak) ise, pratik yapabileceği bağımsız proje adımlarını haritaya dallandır.
3. Zorlanılan Alana Göre İpuçları (Weakness-driven Notes):
   - Kullanıcı neyde zorlandığını belirttiyse (örn: "practice", "fundamentals", "staying-consistent"), bu zorluğu aşması için ona özel rehberlik eden, motivasyon sağlayan ve pratik yapma yöntemleri öneren en az 2-3 adet kapsamlı "note" (tavsiye) düğümü ekle.

Genel Kurallar:
1. 4-8 ana kategori (dal) oluştur. Her kategori bir öğrenme alanını temsil eder. Her kategorinin adını ("name"), kullanıcının amacına (Hedef: ${profile.goal}) ve ilgi alanına göre ilgi çekici, kancalı (hook-driven) ve merak uyandırıcı hale getir (örn: "Giriş" yerine "İlk Adım: Sektör Standartları", "Kariyer Hedefiniz için Temeller" gibi).
2. Her kategorinin altında 2-6 alt konu (yaprak node) olsun.
3. Toplam 20-40 node hedefle.
4. Sadece video izlenecek konuları değil, aralara kullanıcının dikkat etmesi gereken önemli tavsiyeleri ("note" tipinde) ve sadece okuyarak anlaşılabilecek kısa kavramları ("concept" tipinde) BOLCA ekle. Her ana kategori (category) altında EN AZ 1 adet "note" ve EN AZ 1-2 adet "concept" düğümü bulunması ZORUNLUDUR. Toplam yol haritasındaki düğümlerin en az %30-40'ı "note" ve "concept" düğümlerinden oluşmalıdır (sadece video listesi olmaktan çıkıp zengin bir rehber olmalı).
5. Her node için şu alanları dön:
   - id: kebab-case benzersiz ID (örn: "hooks-usestate")
   - name: Kısa başlık (örn: "useState")
   - description: 1 cümlelik açıklama
   - parentId: üst kategori ID'si (ana kategoriler için null)
   - order: sıra numarası (0'dan başla)
   - importance: "required" (olmazsa olmaz), "recommended" (önerilen), "optional" (isteğe bağlı)
   - searchTerms: "topic" veya "category" ise YouTube araması için 2-3 arama terimi (${language === 'tr' ? 'Türkçe' : 'İngilizce'}). Diğerlerinde boş liste.
   - nodeType: "category" (ana dal), "topic" (video konusu), "note" (tavsiye/ipucu), veya "concept" (okuma materyali).
   - groupId: (opsiyonel) Birbiriyle çok yakından ilişkili düğümleri aynı şeffaf kutu içinde gruplamak istersen onlara aynı groupId'yi ver (örn: "db-group").
   - noteText: (sadece nodeType="note" ise) Tavsiye metninin kendisi (en az 2-3 cümlelik kapsamlı ve samimi bir tavsiye yaz).
   - conceptUrl: (sadece nodeType="concept" ise) Okuma materyali için MDN, Wikipedia, dev.to, resmi dokümanlar vb. linki.
6. ${levelDesc} seviyesi için ileri konuları "optional" yap.
7. Konular mantıklı sırada olsun (temelden ileriye).

Örnek yapı (React için):
- Components (category) -> JSX (topic), Props (topic), "Componentleri küçük tutun" (note), State (topic)
- "db-group" adında groupId'ye sahip: MySQL (topic), PostgreSQL (topic)

JSON formatında döndür:
{
  "topic": "${topic}",
  "nodes": [...],
  "totalEstimatedHours": <sayı>
}

Sadece JSON döndür, başka metin ekleme.`;

  const text = await callGemini(prompt);
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned) as CurriculumTree;

  // Validate
  if (!parsed.nodes || !Array.isArray(parsed.nodes) || parsed.nodes.length < 5) {
    throw new Error(`Invalid curriculum tree: got ${parsed.nodes?.length ?? 0} nodes, need at least 5`);
  }

  // Ensure all nodes have required fields
  for (const node of parsed.nodes) {
    if (!node.id || !node.name || !node.nodeType) {
      throw new Error(`Invalid node: missing id, name, or nodeType`);
    }
    if ((node.nodeType === 'category' || node.nodeType === 'topic') && (!node.searchTerms || node.searchTerms.length === 0)) {
      node.searchTerms = [`${topic} ${node.name} ${language === 'tr' ? 'ders' : 'tutorial'}`];
    } else if (node.nodeType === 'note' || node.nodeType === 'concept') {
      node.searchTerms = []; // Notes and concepts don't need search terms
    }
    if (!node.importance) {
      node.importance = 'recommended';
    }
  }

  parsed.topic = topic;
  return parsed;
}

/**
 * Generate 1-sentence explanations for selected videos in bulk.
 * Returns a record mapping youtube_id -> reason.
 */
export async function generateVideoReasons(
  topic: string,
  videos: { youtube_id: string; title: string; nodeName: string }[],
): Promise<Record<string, string>> {
  if (videos.length === 0) return {};

  const videoList = videos
    .map((v) => `- ID: ${v.youtube_id}\n  Title: ${v.title}\n  Topic Node: ${v.nodeName}`)
    .join('\n\n');

  const prompt = `Kullanıcı "${topic}" konusunu öğreniyor. Bu kapsamda seçilen aşağıdaki YouTube videoları için, o videonun neden o konuyu (Topic Node) öğrenmek için seçildiğini açıklayan 1 cümlelik Türkçe, samimi ve ikna edici açıklamalar ("ai_reason") yaz.

Videolar:
${videoList}

JSON formatında döndür, anahtarlar video ID'leri olsun:
{
  "youtube_id_1": "Bu video, konunun temellerini basit örneklerle anlattığı için seçildi.",
  "youtube_id_2": "..."
}

Sadece geçerli JSON döndür, markdown biçimlendirmesi (fences) kullanma.`;

  try {
    const text = await callGemini(prompt, true);
    const cleaned = text.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
    const parsed = JSON.parse(cleaned) as Record<string, string>;
    return parsed;
  } catch (err) {
    console.error('[gemini] generateVideoReasons failed:', err);
    return {};
  }
}
