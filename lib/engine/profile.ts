import type { UserProfile, VideoCluster, BranchWeight, BloomLevel } from '@/types';

/**
 * Build a UserProfile from interview answers.
 *
 * Expected answer keys:
 *   - "level"    → string parseable as a number 0-1
 *   - "goal"     → free-text learning goal
 *   - "weakness" → free-text weak area
 *
 * Falls back to safe defaults when keys are missing or unparseable.
 */
export function buildUserProfile(
  topic: string,
  answers: Record<string, string>,
): UserProfile {
  const rawLevel = parseFloat(answers.level ?? '');
  const level = Number.isFinite(rawLevel)
    ? Math.max(0, Math.min(1, rawLevel))
    : 0.5;

  const goal = (answers.goal ?? '').trim() || 'general';
  const weakness = (answers.weakness ?? '').trim() || 'general';

  return {
    topic,
    level,
    goal,
    weakness,
    answers,
  };
}

// ---- Internal helpers ----

/** Check if any keyword in `keywords` appears inside `text`. */
function keywordsMatch(keywords: string[], text: string): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

/** Returns the dominant bloom level of a cluster (mode of its videos). */
function dominantBloom(cluster: VideoCluster): BloomLevel {
  const counts = new Map<BloomLevel, number>();
  for (const v of cluster.videos) {
    counts.set(v.bloomLevel, (counts.get(v.bloomLevel) ?? 0) + 1);
  }
  let best: BloomLevel = 3;
  let bestCount = 0;
  for (const [level, count] of counts) {
    if (count > bestCount) {
      best = level;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Assign a BranchWeight to each cluster based on how well it matches
 * the user's profile (goal, weakness, level).
 *
 * Rules:
 *   1. Keyword overlap with goal or weakness → 'recommended'
 *   2. Beginner (level < 0.3) + cluster dominated by Bloom 4-5 → 'optional'
 *   3. Advanced (level > 0.7) + cluster dominated by Bloom 1-2 → 'optional'
 *   4. Otherwise → 'neutral'
 */
export function applyProfileWeights(
  clusters: VideoCluster[],
  profile: UserProfile,
): VideoCluster[] {
  return clusters.map((cluster) => {
    const weight = computeWeight(cluster, profile);
    return { ...cluster, weight };
  });
}

function computeWeight(
  cluster: VideoCluster,
  profile: UserProfile,
): BranchWeight {
  const { keywords } = cluster;
  const { goal, weakness, level } = profile;

  // Rule 1: keyword match against goal or weakness
  if (
    keywordsMatch(keywords, goal) ||
    keywordsMatch(keywords, weakness)
  ) {
    return 'recommended';
  }

  const bloom = dominantBloom(cluster);

  // Rule 2: beginner + advanced content
  if (level < 0.3 && bloom >= 4) {
    return 'optional';
  }

  // Rule 3: advanced + introductory content
  if (level > 0.7 && bloom <= 2) {
    return 'optional';
  }

  return 'neutral';
}
