// ============================================================
// WatchPath v2 - Video Clustering Engine
// Threshold-based connected components via keyword Jaccard.
// ============================================================

import type { ScoredVideo, VideoCluster } from '@/types';

const DEFAULT_OVERLAP_THRESHOLD = 0.3;

// ---- Public API ----

/**
 * Jaccard similarity between two keyword arrays.
 * Returns 0 when both are empty.
 */
export function keywordJaccard(keywordsA: string[], keywordsB: string[]): number {
  if (keywordsA.length === 0 && keywordsB.length === 0) return 0;

  const setA = new Set(keywordsA.map((k) => k.toLowerCase()));
  const setB = new Set(keywordsB.map((k) => k.toLowerCase()));

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  if (union === 0) return 0;

  return intersection / union;
}

/**
 * Cluster videos using threshold-based connected components.
 *
 * 1. Build adjacency: edge between i,j if keywordJaccard > threshold
 * 2. BFS to find connected components
 * 3. Singletons merge into nearest cluster (highest Jaccard to any member)
 * 4. Remaining singletons go into a catch-all 'Diger' cluster
 * 5. Name each cluster from its top 3 keywords by frequency
 *
 * All clusters get weight = 'neutral'.
 */
export function clusterVideos(
  videos: ScoredVideo[],
  overlapThreshold: number = DEFAULT_OVERLAP_THRESHOLD,
): VideoCluster[] {
  const n = videos.length;
  if (n === 0) return [];

  // ---- Step 1: Build adjacency list ----
  const adj: Set<number>[] = Array.from({ length: n }, () => new Set<number>());

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = keywordJaccard(videos[i].keywords, videos[j].keywords);
      if (sim > overlapThreshold) {
        adj[i].add(j);
        adj[j].add(i);
      }
    }
  }

  // ---- Step 2: BFS connected components ----
  const visited = new Array<boolean>(n).fill(false);
  const components: number[][] = [];

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;

    const component: number[] = [];
    const queue: number[] = [i];
    visited[i] = true;

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);

      for (const neighbor of adj[current]) {
        if (!visited[neighbor]) {
          visited[neighbor] = true;
          queue.push(neighbor);
        }
      }
    }

    components.push(component);
  }

  // ---- Step 3: Separate singletons from real clusters ----
  const realClusters: number[][] = [];
  const singletons: number[] = [];

  for (const comp of components) {
    if (comp.length >= 2) {
      realClusters.push(comp);
    } else {
      singletons.push(comp[0]);
    }
  }

  // ---- Step 4: Merge singletons into nearest cluster ----
  const unmerged: number[] = [];

  for (const idx of singletons) {
    let bestCluster = -1;
    let bestSim = 0;

    for (let c = 0; c < realClusters.length; c++) {
      for (const memberIdx of realClusters[c]) {
        const sim = keywordJaccard(videos[idx].keywords, videos[memberIdx].keywords);
        if (sim > bestSim) {
          bestSim = sim;
          bestCluster = c;
        }
      }
    }

    // Only merge if there's any overlap at all
    if (bestCluster >= 0 && bestSim > 0) {
      realClusters[bestCluster].push(idx);
    } else {
      unmerged.push(idx);
    }
  }

  // ---- Step 5: Build VideoCluster objects ----
  const results: VideoCluster[] = [];
  let clusterCounter = 0;

  for (const memberIndices of realClusters) {
    const clusterVideos = memberIndices.map((i) => videos[i]);
    const topKeywords = extractTopKeywords(clusterVideos, 3);

    results.push({
      id: `cluster-${clusterCounter++}`,
      name: topKeywords.length > 0 ? topKeywords.join(', ') : `Cluster ${clusterCounter}`,
      keywords: topKeywords,
      videos: clusterVideos,
      weight: 'neutral',
    });
  }

  // Catch-all for videos that couldn't be placed anywhere
  if (unmerged.length > 0) {
    const digerVideos = unmerged.map((i) => videos[i]);
    const digerKeywords = extractTopKeywords(digerVideos, 3);

    results.push({
      id: `cluster-${clusterCounter}`,
      name: 'Diger',
      keywords: digerKeywords,
      videos: digerVideos,
      weight: 'neutral',
    });
  }

  return results;
}

// ---- Helpers ----

/**
 * Aggregate keyword frequencies across cluster videos and return
 * the top N keywords.
 */
function extractTopKeywords(videos: ScoredVideo[], topN: number): string[] {
  const freq = new Map<string, number>();

  for (const sv of videos) {
    for (const kw of sv.keywords) {
      const lower = kw.toLowerCase();
      freq.set(lower, (freq.get(lower) ?? 0) + 1);
    }
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([keyword]) => keyword);
}
