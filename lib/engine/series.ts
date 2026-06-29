// ============================================================
// WatchPath v2 - Series Detection Engine
// Detects episodic series from scored videos, groups by
// channel + normalized series name, and scores health.
// ============================================================

import type { ScoredVideo, DetectedSeries } from '@/types';

// ---- Episode Number Patterns ----
// Each pattern captures the episode number in group 1.

const EPISODE_PATTERNS: RegExp[] = [
  /#(\d+)/i,                   // #5, #12
  /(\d+)\)/,                   // 3), 12)
  /Bolum\s*(\d+)/i,            // Bolum 5, bolum12
  /Part\s*(\d+)/i,             // Part 3
  /Ders\s*(\d+)/i,             // Ders 7
  /Episode\s*(\d+)/i,          // Episode 1
  /^(\d+)\.\s/,                // "1. Introduction" - must be at start
];

const ABANDONMENT_DAYS = 180;
const ABANDONMENT_COMPLETENESS_THRESHOLD = 0.8;

// ---- Helpers ----

/**
 * Try each regex against the title and return the first matched
 * episode number, or null if nothing matches.
 */
function extractEpisodeNumber(title: string): number | null {
  for (const pattern of EPISODE_PATTERNS) {
    const match = pattern.exec(title);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return null;
}

/**
 * Strip the episode marker from the title to get the raw series name,
 * then normalize whitespace and lowercase it.
 */
function normalizeName(title: string): string {
  let name = title;

  // Remove matched episode markers
  for (const pattern of EPISODE_PATTERNS) {
    name = name.replace(pattern, '');
  }

  // Strip common separators left behind
  name = name
    .replace(/[-|:–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  return name;
}

// ---- Public API ----

/**
 * Scan scored videos for episodic series.
 * Groups by channel_id + normalized series name.
 * Only returns groups with 2+ distinct episodes.
 */
export function detectSeries(videos: ScoredVideo[]): DetectedSeries[] {
  // Map: compositeKey -> { name, channelName, episodes }
  const groups = new Map<
    string,
    {
      name: string;
      channelName: string;
      channelId: string;
      episodes: Map<number, ScoredVideo>;
      latestPublished: string | null;
    }
  >();

  for (const sv of videos) {
    const epNum = sv.episodeNumber ?? extractEpisodeNumber(sv.video.title);
    if (epNum === null) continue;

    const seriesName = normalizeName(sv.video.title);
    if (!seriesName) continue;

    const compositeKey = `${sv.video.channel_id}:${seriesName}`;

    let group = groups.get(compositeKey);
    if (!group) {
      group = {
        name: seriesName,
        channelName: sv.video.channel_name,
        channelId: sv.video.channel_id,
        episodes: new Map(),
        latestPublished: null,
      };
      groups.set(compositeKey, group);
    }

    // Keep the higher quality video if duplicates exist for same episode
    const existing = group.episodes.get(epNum);
    if (!existing || sv.qualityScore > existing.qualityScore) {
      group.episodes.set(epNum, sv);
    }

    // Track latest publish date for abandonment detection
    if (sv.video.published_at) {
      if (!group.latestPublished || sv.video.published_at > group.latestPublished) {
        group.latestPublished = sv.video.published_at;
      }
    }
  }

  // Filter to 2+ episodes and build DetectedSeries
  const results: DetectedSeries[] = [];

  for (const [key, group] of groups) {
    if (group.episodes.size < 2) continue;

    let totalSeconds = 0;
    for (const sv of group.episodes.values()) {
      totalSeconds += sv.video.duration_seconds ?? 0;
    }

    const series: DetectedSeries = {
      key,
      name: group.name,
      channelName: group.channelName,
      episodes: group.episodes,
      health: 0, // calculated below
      totalMinutes: Math.round(totalSeconds / 60),
    };

    series.health = calculateSeriesHealth(series, group.latestPublished);
    results.push(series);
  }

  // Sort by health descending so the best series surface first
  results.sort((a, b) => b.health - a.health);

  return results;
}

/**
 * Series health = found episodes / max episode number.
 * Penalized if the series looks abandoned:
 *   last upload > 180 days ago AND completeness < 0.8
 */
export function calculateSeriesHealth(
  series: DetectedSeries,
  latestPublished?: string | null,
): number {
  const episodeNumbers = Array.from(series.episodes.keys());
  if (episodeNumbers.length === 0) return 0;

  const maxEp = Math.max(...episodeNumbers);
  const completeness = episodeNumbers.length / maxEp;

  let health = completeness;

  // Abandonment penalty
  if (latestPublished) {
    const daysSinceLastUpload =
      (Date.now() - new Date(latestPublished).getTime()) / (1000 * 60 * 60 * 24);

    if (
      daysSinceLastUpload > ABANDONMENT_DAYS &&
      completeness < ABANDONMENT_COMPLETENESS_THRESHOLD
    ) {
      // Scale penalty by how incomplete and how stale it is
      const staleness = Math.min(daysSinceLastUpload / 365, 1);
      health *= 1 - staleness * 0.5;
    }
  }

  return Math.max(0, Math.min(1, health));
}
