import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { RoadmapDetailResponse, ErrorResponse, Video, RoadmapNode, Roadmap } from '@/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug || typeof slug !== 'string') {
      const res: ErrorResponse = { error: 'Invalid slug', code: 'VALIDATION' };
      return NextResponse.json(res, { status: 400 });
    }

    // Fetch roadmap by slug
    const { data: roadmap, error: roadmapError } = await supabaseAdmin
      .from('roadmaps')
      .select('*')
      .eq('slug', slug)
      .single();

    if (roadmapError || !roadmap) {
      const res: ErrorResponse = { error: 'Roadmap not found', code: 'NOT_FOUND' };
      return NextResponse.json(res, { status: 404 });
    }

    const typedRoadmap = roadmap as Roadmap;

    // If still generating, return the roadmap with empty nodes/videos
    // Client polls this endpoint until status changes
    if (typedRoadmap.status === 'generating') {
      const response: RoadmapDetailResponse = {
        roadmap: typedRoadmap,
        nodes: [],
        videos: [],
      };
      return NextResponse.json(response);
    }

    // If failed, return the roadmap with empty data so client can show error
    if (typedRoadmap.status === 'failed') {
      const response: RoadmapDetailResponse = {
        roadmap: typedRoadmap,
        nodes: [],
        videos: [],
      };
      return NextResponse.json(response);
    }

    // Status is "ready" - fetch nodes and associated videos
    const { data: nodes, error: nodesError } = await supabaseAdmin
      .from('roadmap_nodes')
      .select('*')
      .eq('roadmap_id', typedRoadmap.id)
      .order('order_index', { ascending: true });

    if (nodesError) {
      console.error('[api/roadmap] Failed to fetch nodes:', nodesError.message);
      const res: ErrorResponse = { error: 'Failed to fetch roadmap data' };
      return NextResponse.json(res, { status: 500 });
    }

    const typedNodes = (nodes ?? []) as RoadmapNode[];

    // Get unique video IDs from nodes
    const videoIds = [
      ...new Set(
        typedNodes
          .map((n) => n.video_id)
          .filter((id): id is string => id !== null)
      ),
    ];

    let videos: Video[] = [];
    if (videoIds.length > 0) {
      const { data: videoData, error: videoError } = await supabaseAdmin
        .from('videos')
        .select('*')
        .in('id', videoIds);

      if (videoError) {
        console.error('[api/roadmap] Failed to fetch videos:', videoError.message);
      } else {
        videos = (videoData ?? []) as Video[];
      }
    }

    // Increment view_count (fire-and-forget)
    supabaseAdmin
      .from('roadmaps')
      .update({ view_count: typedRoadmap.view_count + 1 })
      .eq('slug', slug)
      .then(({ error }) => {
        if (error) console.error('[api/roadmap] Failed to increment view_count:', error.message);
      });

    const response: RoadmapDetailResponse = {
      roadmap: typedRoadmap,
      nodes: typedNodes,
      videos,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('[api/roadmap/slug] Error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    const res: ErrorResponse = { error: message };
    return NextResponse.json(res, { status: 500 });
  }
}
