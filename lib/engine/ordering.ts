import type { ScoredVideo, BloomLevel, OrderedVideo } from '@/types';

// ---- Bloom keyword dictionaries ----

const BLOOM_KEYWORDS: Record<BloomLevel, RegExp[]> = {
  1: [/\bnedir\b/i, /\bne\s+demek\b/i, /\btanim\b/i, /\bwhat\s+is\b/i, /\bdefinition\b/i],
  2: [/\bnasil\s+calisir\b/i, /\bneden\b/i, /\bwhy\b/i, /\bhow\s+does\b/i, /\baciklama\b/i],
  3: [/\byapalim\b/i, /\bkodlayalim\b/i, /\bproje\b/i, /\btutorial\b/i, /\bpratik\b/i],
  4: [/\bkarsilastir\b/i, /\bfark\b/i, /\bvs\b/i, /\bcompare\b/i, /\banaliz\b/i],
  5: [/\bbest\s+practice\b/i, /\banti[\s-]?pattern\b/i, /\bhata\b/i, /\bmistake\b/i, /\bileri\s+seviye\b/i],
};

const DEFAULT_BLOOM: BloomLevel = 3;

/**
 * Classify a video's Bloom level by scanning its transcript and title
 * for Turkish/English keywords. Returns the *highest* matching level,
 * falling back to 3 (Apply) when nothing matches.
 */
export function classifyBloomLevel(
  transcript: string | null,
  title: string,
): BloomLevel {
  const corpus = `${title} ${transcript ?? ''}`;

  let highest: BloomLevel | null = null;

  for (const [levelStr, patterns] of Object.entries(BLOOM_KEYWORDS)) {
    const level = Number(levelStr) as BloomLevel;
    const matched = patterns.some((re) => re.test(corpus));
    if (matched && (highest === null || level > highest)) {
      highest = level;
    }
  }

  return highest ?? DEFAULT_BLOOM;
}

/**
 * Order videos inside a single cluster by Bloom level (ascending) then
 * quality score (descending). Builds prerequisite edges: every video at
 * level N depends on the highest-quality video at level N-1.
 */
export function orderVideosInCluster(videos: ScoredVideo[]): OrderedVideo[] {
  if (videos.length === 0) return [];

  // Sort: bloom asc, quality desc
  const sorted = [...videos].sort((a, b) => {
    if (a.bloomLevel !== b.bloomLevel) return a.bloomLevel - b.bloomLevel;
    return b.qualityScore - a.qualityScore;
  });

  // Group by bloom level to find the best video per level
  const bestByLevel = new Map<BloomLevel, ScoredVideo>();
  for (const v of sorted) {
    // First entry per level is the best (already sorted quality-desc within level)
    if (!bestByLevel.has(v.bloomLevel)) {
      bestByLevel.set(v.bloomLevel, v);
    }
  }

  // Build ordered list with prerequisite edges
  const ordered: OrderedVideo[] = sorted.map((v, idx) => {
    const prerequisiteIds: string[] = [];

    // Depends on best video at level N-1
    const prevLevel = (v.bloomLevel - 1) as BloomLevel;
    if (prevLevel >= 1) {
      const prereq = bestByLevel.get(prevLevel);
      if (prereq) {
        prerequisiteIds.push(prereq.video.youtube_id);
      }
    }

    return {
      ...v,
      orderIndex: idx,
      prerequisiteIds,
    };
  });

  return ordered;
}
