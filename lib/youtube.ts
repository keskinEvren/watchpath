import type { YouTubeSearchResult, Video } from '@/types';
import { getCachedSearch, setCachedSearch } from '@/lib/cache';
import { Innertube } from 'youtubei.js';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

let innertubeInstance: Innertube | null = null;

async function getInnertube(): Promise<Innertube> {
  if (!innertubeInstance) {
    innertubeInstance = await Innertube.create();
  }
  return innertubeInstance;
}

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('Missing YOUTUBE_API_KEY env var');
  return key;
}

/**
 * Search YouTube videos. Cache-first: checks search_cache before hitting the API.
 * Each search.list call costs 100 quota units.
 */
export async function searchVideos(
  query: string,
  maxResults: number = 20,
  language: string = 'tr'
): Promise<YouTubeSearchResult[]> {
  // Check cache first
  const cached = await getCachedSearch(query, language);
  if (cached) {
    console.log(`[youtube] Cache hit for "${query}"`);
    return cached;
  }

  console.log(`[youtube] Cache miss, searching YouTube for "${query}"`);
  let results: YouTubeSearchResult[] = [];

  try {
    console.log(`[youtube] Attempting free search via youtubei.js for "${query}"`);
    const yt = await getInnertube();
    const search = await yt.search(query, { type: 'video' });
    
    const videos = search.videos || [];
    if (videos.length > 0) {
      results = videos.slice(0, maxResults).map((v: any) => ({
        videoId: v.id || v.video_id,
        title: v.title?.text || String(v.title || ''),
        channelTitle: v.author?.name || String(v.author || ''),
        channelId: v.author?.id || '',
        description: v.description?.text || (typeof v.description === 'string' ? v.description : '') || '',
        publishedAt: v.published?.text || String(v.published || ''),
        thumbnailUrl: v.thumbnails?.[0]?.url || '',
      }));
      console.log(`[youtube] Successfully retrieved ${results.length} videos via youtubei.js`);
    } else {
      console.log(`[youtube] No videos returned by youtubei.js, falling back to official API`);
      throw new Error('No videos returned by youtubei.js');
    }
  } catch (err) {
    console.warn(`[youtube] youtubei.js failed:`, err, `. Falling back to official YouTube API.`);
    
    const params = new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: String(maxResults),
      relevanceLanguage: language,
      videoEmbeddable: 'true',
      key: getApiKey(),
    });

    const res = await fetch(`${YOUTUBE_API_BASE}/search?${params}`);

    if (!res.ok) {
      const body = await res.text();
      console.error(`[youtube] Official Search fallback failed (${res.status}):`, body);
      throw new Error(`YouTube search failed: ${res.status}`);
    }

    const data = await res.json();

    results = (data.items ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (item: any) => ({
        videoId: item.id?.videoId,
        title: item.snippet?.title ?? '',
        channelTitle: item.snippet?.channelTitle ?? '',
        channelId: item.snippet?.channelId ?? '',
        description: item.snippet?.description ?? '',
        publishedAt: item.snippet?.publishedAt ?? '',
        thumbnailUrl:
          item.snippet?.thumbnails?.high?.url ??
          item.snippet?.thumbnails?.medium?.url ??
          item.snippet?.thumbnails?.default?.url ??
          '',
      })
    );
  }

  // Cache the results (fire-and-forget)
  if (results.length > 0) {
    setCachedSearch(query, language, results).catch((err) =>
      console.error('[youtube] Failed to cache results:', err)
    );
  }

  return results;
}

/**
 * Get detailed video info via videos.list (batch).
 * Costs 1 quota unit per call (up to 50 IDs per call).
 * Returns Video[] shaped for DB insertion.
 */
export async function getVideoDetails(videoIds: string[]): Promise<Video[]> {
  if (videoIds.length === 0) return [];

  const videos: Video[] = [];

  // YouTube allows max 50 IDs per request
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const params = new URLSearchParams({
      part: 'snippet,contentDetails,statistics',
      id: batch.join(','),
      key: getApiKey(),
    });

    const res = await fetch(`${YOUTUBE_API_BASE}/videos?${params}`);

    if (!res.ok) {
      const body = await res.text();
      console.error(`[youtube] videos.list failed (${res.status}):`, body);
      continue;
    }

    const data = await res.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const item of data.items ?? []) {
      videos.push({
        id: '', // Will be assigned by DB
        youtube_id: item.id,
        title: item.snippet?.title ?? '',
        channel_name: item.snippet?.channelTitle ?? '',
        channel_id: item.snippet?.channelId ?? '',
        thumbnail_url:
          item.snippet?.thumbnails?.high?.url ??
          item.snippet?.thumbnails?.medium?.url ??
          '',
        duration_seconds: parseDuration(item.contentDetails?.duration),
        view_count: parseInt(item.statistics?.viewCount ?? '0', 10),
        description: item.snippet?.description ?? '',
        tags: item.snippet?.tags ?? [],
        language:
          item.snippet?.defaultAudioLanguage ??
          item.snippet?.defaultLanguage ??
          'tr',
        published_at: item.snippet?.publishedAt ?? null,
        fetched_at: new Date().toISOString(),
      });
    }
  }

  return videos;
}

/**
 * Parse ISO 8601 duration (PT1H24M30S) to seconds.
 */
function parseDuration(iso: string | undefined): number | null {
  if (!iso) return null;

  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;

  const hours = parseInt(match[1] ?? '0', 10);
  const minutes = parseInt(match[2] ?? '0', 10);
  const seconds = parseInt(match[3] ?? '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
}
