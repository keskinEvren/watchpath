// ============================================================
// WatchPath v2 Engine — Deduplication via N-gram Jaccard
// Removes near-duplicate videos, keeping higher-scored ones
// ============================================================

import type { ScoredVideo } from '@/types';

// ---- N-gram Jaccard Similarity ----

/**
 * Compute Jaccard similarity between two texts using character n-grams.
 * Returns 0-1 where 1 = identical n-gram sets.
 */
export function ngramJaccard(
  textA: string,
  textB: string,
  n: number = 2
): number {
  const gramsA = buildNgramSet(textA, n);
  const gramsB = buildNgramSet(textB, n);

  if (gramsA.size === 0 && gramsB.size === 0) return 1.0;
  if (gramsA.size === 0 || gramsB.size === 0) return 0.0;

  let intersection = 0;
  for (const gram of gramsA) {
    if (gramsB.has(gram)) intersection++;
  }

  const union = gramsA.size + gramsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function buildNgramSet(text: string, n: number): Set<string> {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  const grams = new Set<string>();

  for (let i = 0; i <= normalized.length - n; i++) {
    grams.add(normalized.slice(i, i + n));
  }

  return grams;
}

// ---- Text extraction for comparison ----

function getComparisonText(sv: ScoredVideo): string {
  if (sv.transcript) return sv.transcript;
  const parts = [sv.video.title];
  if (sv.video.description) parts.push(sv.video.description);
  return parts.join(' ');
}

// ---- Deduplication ----

/**
 * Remove near-duplicate videos from a scored list.
 * Compares all pairs O(n^2) using 2-gram Jaccard on transcript
 * (or title+description fallback). When two videos exceed the
 * similarity threshold, the lower-scoring one is dropped.
 */
export function deduplicateVideos(
  videos: ScoredVideo[],
  similarityThreshold: number = 0.55
): ScoredVideo[] {
  if (videos.length <= 1) return [...videos];

  // Sort by qualityScore descending so the first video in each
  // duplicate pair is the one we keep.
  const sorted = [...videos].sort(
    (a, b) => b.qualityScore - a.qualityScore
  );

  const removed = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    if (removed.has(i)) continue;

    const textA = getComparisonText(sorted[i]);

    for (let j = i + 1; j < sorted.length; j++) {
      if (removed.has(j)) continue;

      const textB = getComparisonText(sorted[j]);
      const similarity = ngramJaccard(textA, textB);

      if (similarity > similarityThreshold) {
        // Remove the lower-scored video (j, since sorted desc)
        removed.add(j);
      }
    }
  }

  return sorted.filter((_, idx) => !removed.has(idx));
}
