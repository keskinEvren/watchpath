import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getVideoDetails } from '@/lib/youtube';
import type { VideoDetailResponse, ErrorResponse, Video } from '@/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ youtubeId: string }> }
) {
  try {
    const { youtubeId } = await params;

    if (!youtubeId || typeof youtubeId !== 'string') {
      const res: ErrorResponse = { error: 'Invalid youtubeId', code: 'VALIDATION' };
      return NextResponse.json(res, { status: 400 });
    }

    // Cache-first: check DB
    const { data: cached, error: cacheError } = await supabaseAdmin
      .from('videos')
      .select('*')
      .eq('youtube_id', youtubeId)
      .single();

    if (!cacheError && cached) {
      const response: VideoDetailResponse = { video: cached as Video };
      return NextResponse.json(response);
    }

    // Not in DB - fetch from YouTube API
    const videos = await getVideoDetails([youtubeId]);

    if (videos.length === 0) {
      const res: ErrorResponse = { error: 'Video not found', code: 'NOT_FOUND' };
      return NextResponse.json(res, { status: 404 });
    }

    const video = videos[0];

    // Cache in DB (fire-and-forget)
    supabaseAdmin
      .from('videos')
      .upsert(
        {
          youtube_id: video.youtube_id,
          title: video.title,
          channel_name: video.channel_name,
          channel_id: video.channel_id,
          thumbnail_url: video.thumbnail_url,
          duration_seconds: video.duration_seconds,
          view_count: video.view_count,
          description: video.description,
          tags: video.tags,
          language: video.language,
          published_at: video.published_at,
          fetched_at: video.fetched_at,
        },
        { onConflict: 'youtube_id' }
      )
      .then(({ error }) => {
        if (error) console.error('[api/video] Failed to cache video:', error.message);
      });

    // Return with the youtube_id-based response
    const response: VideoDetailResponse = { video };
    return NextResponse.json(response);
  } catch (err) {
    console.error('[api/video] Error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    const res: ErrorResponse = { error: message };
    return NextResponse.json(res, { status: 500 });
  }
}
