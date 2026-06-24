import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  Video,
  Level,
  GeminiSearchTermsResponse,
  GeminiRoadmapResponse,
  TranscriptSegment,
  EdgeType,
} from '@/types';
import { condenseTranscript } from '@/lib/transcript';

const MODEL_NAME = 'gemini-2.0-flash';
const TIMEOUT_MS = 30_000;

function getClient(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Missing GEMINI_API_KEY env var');
  return new GoogleGenerativeAI(key);
}

const MAX_RETRIES = 2;

/**
 * Parse retryDelay from Gemini 429 error (e.g. "8s" → 8000ms).
 * Falls back to 10s if unparseable.
 */
function parseRetryDelay(err: unknown): number {
  try {
    const msg = err instanceof Error ? err.message : String(err);
    const match = msg.match(/retry in (\d+(?:\.\d+)?)s/i);
    if (match) return Math.ceil(parseFloat(match[1]) * 1000);
    const matchMs = msg.match(/retryDelay.*?(\d+)s/i);
    if (matchMs) return parseInt(matchMs[1], 10) * 1000;
  } catch { /* ignore */ }
  return 10_000; // default 10s
}

function is429Error(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.message.includes('429') || err.message.includes('Too Many Requests');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run a Gemini call with 30s timeout per attempt.
 * Retries up to MAX_RETRIES times on 429 rate limit errors,
 * waiting the server-suggested retryDelay between attempts.
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
