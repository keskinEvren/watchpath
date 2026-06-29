// ============================================================
// WatchPath v2 Engine - Orchestrator
// Chains all engine modules: score → series → dedup → cluster → order → profile
// ============================================================

import type {
  Video,
  ProcessedRoadmap,
  UserProfile,
  ScoredVideo,
  VideoCluster,
} from '@/types';

import { calculateQualityScore, extractKeywords } from './quality';
import { deduplicateVideos } from './dedup';
import { detectSeries, calculateSeriesHealth } from './series';
import { clusterVideos } from './cluster';
import { classifyBloomLevel, orderVideosInCluster } from './ordering';
import { buildUserProfile, applyProfileWeights } from './profile';

// Re-export for convenience
export { buildUserProfile } from './profile';
export { extractKeywords } from './quality';

/**
 * Full v2 processing pipeline. Takes raw videos + transcripts + user profile,
 * returns a ProcessedRoadmap ready for DAG layout and rendering.
 *
 * All processing is local (zero API calls). Gemini is NOT used here.
 */
export function processVideos(
  videos: Video[],
  transcripts: Map<string, string>,
  profile: UserProfile,
): ProcessedRoadmap {
  // 1. Score every video and extract metadata
  const scored: ScoredVideo[] = videos.map((video) => {
    const transcript = transcripts.get(video.youtube_id) ?? null;
    const qualityScore = calculateQualityScore(video, transcript);
    const keywords = extractKeywords(
      transcript ?? `${video.title} ${video.description ?? ''}`,
      20,
    );
    const bloomLevel = classifyBloomLevel(transcript, video.title);

    return {
      video,
      transcript,
      qualityScore,
      bloomLevel,
      keywords,
      seriesKey: null,
      episodeNumber: null,
    };
  });

  console.log(`[engine] Scored ${scored.length} videos`);

  // 2. Detect series and annotate matching videos
  const detectedSeries = detectSeries(scored);
  for (const series of detectedSeries) {
    series.health = calculateSeriesHealth(series);
  }
  const healthySeries = detectedSeries.filter((s) => s.health > 0.5);
  console.log(
    `[engine] Found ${detectedSeries.length} series (${healthySeries.length} healthy)`,
  );

  // 3. Deduplicate
  const deduped = deduplicateVideos(scored);
  console.log(`[engine] Dedup: ${scored.length} → ${deduped.length} videos`);

  // 4. Cluster by topic similarity
  const clusters = clusterVideos(deduped);
  console.log(
    `[engine] Clustered into ${clusters.length} groups: ${clusters.map((c) => `${c.name} (${c.videos.length})`).join(', ')}`,
  );

  // 5. Order videos within each cluster (Bloom + toposort)
  const orderedClusters: VideoCluster[] = clusters.map((c) => ({
    ...c,
    videos: orderVideosInCluster(c.videos),
  }));

  // 6. Apply profile weights (recommended / optional / neutral)
  const weighted = applyProfileWeights(orderedClusters, profile);
  console.log(
    `[engine] Profile weights: ${weighted.map((c) => `${c.name}=${c.weight}`).join(', ')}`,
  );

  // 7. Calculate totals
  const allClusterVideos = weighted.flatMap((c) => c.videos);
  const seriesVideos = healthySeries.flatMap((s) => [...s.episodes.values()]);
  const allVideos = [...allClusterVideos, ...seriesVideos];
  const totalMinutes = Math.round(
    allVideos.reduce(
      (sum, v) => sum + (v.video.duration_seconds ?? 0) / 60,
      0,
    ),
  );

  return {
    clusters: weighted,
    series: healthySeries,
    profile,
    totalVideos: allVideos.length,
    totalMinutes,
  };
}
