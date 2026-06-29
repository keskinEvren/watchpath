// ============================================================
// WatchPath v2 Engine — Video Quality Scoring
// 6 weighted signals → 0-100 score
// ============================================================

import type { Video } from '@/types';

// ---- Signal Weights ----

const WEIGHTS = {
  transcript_density: 25,
  duration_fit: 15,
  freshness: 15,
  views_per_day: 20,
  educational_density: 15,
  clickbait_penalty: 10,
} as const;

// ---- Emoji regex (covers most common emoji blocks) ----

const emojiRegex =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;

// ---- Clickbait trigger words (uppercase for comparison) ----

const CLICKBAIT_WORDS = ['SOK', 'INANILMAZ', 'KESINLIKLE', 'HERKESI'];

// ---- Educational keywords ----

const EDUCATIONAL_KEYWORDS_TR = [
  'ogrenelim',
  'bakalim',
  'ornek',
  'dikkat',
  'adim adim',
  'nasil',
  'nedir',
  'bu konuda',
  'anlatayim',
];

const EDUCATIONAL_KEYWORDS_EN = [
  "let's learn",
  'step by step',
  'for example',
  'tutorial',
];

const ALL_EDUCATIONAL_KEYWORDS = [
  ...EDUCATIONAL_KEYWORDS_TR,
  ...EDUCATIONAL_KEYWORDS_EN,
];

// ---- Signal Calculators ----

function signalTranscriptDensity(
  video: Video,
  transcript: string | null
): number {
  if (!transcript) return 0.3;

  const durationSec = video.duration_seconds;
  if (!durationSec || durationSec <= 0) return 0.3;

  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
  const wpm = (wordCount / durationSec) * 60;

  if (wpm >= 100 && wpm <= 200) return 1.0;
  if (wpm < 50) return 0.3;
  if (wpm > 300) return 0.5;

  // 50-100 range: linear interpolation 0.3 → 1.0
  if (wpm < 100) return 0.3 + ((wpm - 50) / 50) * 0.7;

  // 200-300 range: linear interpolation 1.0 → 0.5
  return 1.0 - ((wpm - 200) / 100) * 0.5;
}

function signalDurationFit(video: Video): number {
  const sec = video.duration_seconds;
  if (sec == null) return 0.5;

  const min = sec / 60;

  if (min >= 8 && min <= 30) return 1.0;
  if (min >= 3 && min < 8) return 0.6;
  if (min > 30 && min <= 60) return 0.7;
  if (min < 3) return 0.2;
  if (min > 90) return 0.3;

  // 60-90 min: linear interpolation 0.7 → 0.3
  return 0.7 - ((min - 60) / 30) * 0.4;
}

function signalFreshness(video: Video): number {
  if (!video.published_at) return 0.5;

  const publishedDate = new Date(video.published_at);
  const now = new Date();
  const daysSince = (now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSince <= 365) return 1.0;
  if (daysSince <= 1095) return 0.7;
  if (daysSince <= 1825) return 0.5;
  return 0.3;
}

function signalViewsPerDay(video: Video): number {
  if (!video.published_at) return 0.5;

  const publishedDate = new Date(video.published_at);
  const now = new Date();
  const days = Math.max(
    1,
    (now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const vpd = video.view_count / days;

  if (vpd <= 0) return 0.1;
  if (vpd >= 1000) return 1.0;

  // log10 normalize: vpd=1 → 0.2, vpd=10 → 0.5, vpd=100 → 0.8, vpd=1000 → 1.0
  // log10(1)=0, log10(10)=1, log10(100)=2, log10(1000)=3
  // score = 0.2 + (log10(vpd) / 3) * 0.8
  const score = 0.2 + (Math.log10(Math.max(1, vpd)) / 3) * 0.8;
  return Math.min(1.0, Math.max(0, score));
}

function signalEducationalDensity(transcript: string | null): number {
  if (!transcript) return 0.4;

  const lowerText = transcript.toLowerCase();
  const totalWords = lowerText.split(/\s+/).filter(Boolean).length;

  if (totalWords === 0) return 0.4;

  let matches = 0;
  for (const keyword of ALL_EDUCATIONAL_KEYWORDS) {
    // Count all occurrences of multi-word and single-word keywords
    let startIdx = 0;
    while (true) {
      const idx = lowerText.indexOf(keyword, startIdx);
      if (idx === -1) break;
      matches++;
      startIdx = idx + keyword.length;
    }
  }

  const score = (matches / totalWords) * 500;
  return Math.min(1.0, score);
}

function signalClickbaitPenalty(video: Video): number {
  const title = video.title;
  let score = 1.0;

  // Emoji penalty: -0.15 per emoji
  const emojis = title.match(emojiRegex);
  if (emojis) {
    score -= emojis.length * 0.15;
  }

  // Uppercase penalty: -0.3 if > 30% uppercase letters
  const letters = title.replace(/[^a-zA-ZçÇğĞıİöÖşŞüÜ]/g, '');
  if (letters.length > 0) {
    const uppercaseLetters = letters.replace(/[^A-ZÇĞİÖŞÜ]/g, '');
    if (uppercaseLetters.length / letters.length > 0.3) {
      score -= 0.3;
    }
  }

  // Clickbait word penalty: -0.2 per match
  const upperTitle = title.toUpperCase();
  for (const word of CLICKBAIT_WORDS) {
    if (upperTitle.includes(word)) {
      score -= 0.2;
    }
  }

  return Math.max(0, score);
}

// ---- Main Scoring Function ----

export function calculateQualityScore(
  video: Video,
  transcript: string | null
): number {
  const signals: Record<string, number> = {
    transcript_density: signalTranscriptDensity(video, transcript),
    duration_fit: signalDurationFit(video),
    freshness: signalFreshness(video),
    views_per_day: signalViewsPerDay(video),
    educational_density: signalEducationalDensity(transcript),
    clickbait_penalty: signalClickbaitPenalty(video),
  };

  let total = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    total += signals[key] * weight;
  }

  return Math.round(Math.min(100, Math.max(0, total)));
}

// ---- Keyword Extraction ----

const STOPWORDS = new Set([
  // Turkish stopwords
  'bir', 've', 'bu', 'da', 'de', 'ile', 'için', 'icin', 'ama', 'çok', 'cok',
  'daha', 'en', 'her', 'ben', 'sen', 'biz', 'siz', 'onu', 'ona', 'gibi',
  'var', 'yok', 'olan', 'olarak', 'kadar', 'sonra', 'önce', 'once', 'şey',
  'sey', 'ne', 'neden', 'nasıl', 'nasil', 'bunu', 'şu', 'su', 'o', 'ya',
  'veya', 'ise', 'hem', 'böyle', 'boyle', 'ama', 'fakat', 'ancak', 'hep',
  'zaten', 'sadece', 'aslında', 'aslinda', 'bile', 'mi', 'mu', 'mü', 'mı',
  'ki', 'diğer', 'diger', 'bazı', 'bazi', 'tüm', 'tum', 'hiç', 'hic',
  'benim', 'senin', 'bizim', 'sizin', 'onun', 'onların', 'onlarin',
  // English stopwords
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
  'how', 'also', 'its', 'was', 'is', 'are', 'been', 'has', 'had', 'were',
  'did', 'does', 'than', 'very', 'then', 'into', 'some', 'could', 'them',
]);

export function extractKeywords(text: string, topN: number = 20): string[] {
  const tokens = text
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));

  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word);
}
