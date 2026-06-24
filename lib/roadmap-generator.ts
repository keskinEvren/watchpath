import { supabaseAdmin } from '@/lib/supabase/server';
import { generateSlug } from '@/lib/utils';
import { generateSearchTerms, generateRoadmapStructure } from '@/lib/gemini';
import { searchVideos, getVideoDetails } from '@/lib/youtube';
import { getTranscript } from '@/lib/transcript';
import type {
  Level,
  Video,
  TranscriptSegment,
  RoadmapEdge,
  GeminiRoadmapResponse,
} from '@/types';

const NODE_X_START = 0;
const NODE_Y_GAP = 150;
const CATEGORY_X_OFFSET = 0;
const VIDEO_X_OFFSET = 50;

/**
 * Main pipeline orchestrator.
 * Creates roadmap record, runs the full pipeline, writes results to DB.
 * Returns the slug for client polling.
 *
 * This runs synchronously inside a single serverless function call.
 * The client polls GET /api/roadmap/[slug] to see when status flips to "ready".
 */
export async function generateRoadmap(
  topic: string,
  level: Level,
  language: string = 'tr'
): Promise<string> {
  const slug = generateSlug(topic);

  // Step 1: Create roadmap record with status: generating
  const { error: insertError } = await supabaseAdmin
    .from('roadmaps')
    .insert({
      slug,
      topic,
      level,
      status: 'generating',
      is_public: true,
    });

  if (insertError) {
    console.error('[pipeline] Failed to create roadmap:', insertError.message);
    throw new Error('Failed to create roadmap record');
  }

  // Run the rest of the pipeline. If anything fails, mark as "failed".
  try {
    await runPipeline(slug, topic, level, language);
  } catch (err) {
    console.error('[pipeline] Pipeline failed:', err);
    await supabaseAdmin
      .from('roadmaps')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('slug', slug);
  }

  return slug;
}

async function runPipeline(
  slug: string,
  topic: string,
  level: Level,
  language: string
): Promise<void> {
  // Step 2: Get search terms from Gemini
  console.log('[pipeline] Generating search terms...');
  const searchTerms = await generateSearchTerms(topic, level, language);
  console.log(`[pipeline] Got ${searchTerms.length} search terms:`, searchTerms);

  // Step 3: Search YouTube for each term
  console.log('[pipeline] Searching YouTube...');
  const allSearchResults = [];
  for (const term of searchTerms) {
    const results = await searchVideos(term, 10, language);
    allSearchResults.push(...results);
  }

  // Deduplicate by videoId
  const seenIds = new Set<string>();
  const uniqueResults = allSearchResults.filter((r) => {
    if (seenIds.has(r.videoId)) return false;
    seenIds.add(r.videoId);
    return true;
  });

  console.log(
    `[pipeline] Found ${allSearchResults.length} results, ${uniqueResults.length} unique`
  );

  if (uniqueResults.length === 0) {
    throw new Error('No videos found for this topic');
  }

  // Step 4: Get video details from YouTube
  const videoIds = uniqueResults.map((r) => r.videoId);
  const videos = await getVideoDetails(videoIds);
  console.log(`[pipeline] Got details for ${videos.length} videos`);

  // Step 5: Upsert videos into DB (cache them)
  const upsertedVideos = await upsertVideos(videos);

  // Step 6: Fetch transcripts for top videos (by view count, limit to 10 to save time)
  console.log('[pipeline] Fetching transcripts...');
  const topVideos = [...videos]
    .sort((a, b) => b.view_count - a.view_count)
    .slice(0, 10);

  const transcripts = new Map<string, TranscriptSegment[]>();
  const transcriptPromises = topVideos.map(async (v) => {
    const segments = await getTranscript(v.youtube_id);
    if (segments) {
      transcripts.set(v.youtube_id, segments);
    }
  });
  await Promise.all(transcriptPromises);
  console.log(`[pipeline] Got transcripts for ${transcripts.size} videos`);

  // Step 7: Generate roadmap structure with Gemini
  console.log('[pipeline] Generating roadmap structure with Gemini...');
  const structure = await generateRoadmapStructure(
    topic,
    level,
    videos,
    transcripts
  );
  console.log(
    `[pipeline] Roadmap: ${structure.categories.length} categories, ${structure.nodes.length} nodes`
  );

  // Step 8: Save nodes and edges to DB
  await saveRoadmapData(slug, topic, level, structure, upsertedVideos);

  console.log(`[pipeline] Roadmap "${slug}" is ready`);
}

/**
 * Upsert videos into the videos table. Returns a map of youtube_id -> db uuid.
 */
async function upsertVideos(
  videos: Video[]
): Promise<Map<string, string>> {
  const videoMap = new Map<string, string>();

  for (const video of videos) {
    const { data, error } = await supabaseAdmin
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
      .select('id, youtube_id')
      .single();

    if (error) {
      console.error(
        `[pipeline] Failed to upsert video ${video.youtube_id}:`,
        error.message
      );
      continue;
    }

    if (data) {
      videoMap.set(data.youtube_id, data.id);
    }
  }

  return videoMap;
}

/**
 * Convert Gemini's roadmap structure into DB rows (roadmap_nodes + edges_data).
 */
async function saveRoadmapData(
  slug: string,
  topic: string,
  level: Level,
  structure: GeminiRoadmapResponse,
  videoMap: Map<string, string>
): Promise<void> {
  const nodes: Array<{
    roadmap_id?: string;
    video_id: string | null;
    node_type: string;
    label: string;
    description: string | null;
    position_x: number;
    position_y: number;
    order_index: number;
    metadata: Record<string, unknown>;
  }> = [];

  // We need the roadmap ID
  const { data: roadmap } = await supabaseAdmin
    .from('roadmaps')
    .select('id')
    .eq('slug', slug)
    .single();

  if (!roadmap) throw new Error('Roadmap not found after insert');

  const roadmapId = roadmap.id;
  let yPos = 0;
  let orderIndex = 0;

  // Node ID map: youtube_id -> generated node uuid (for edges)
  // We'll use a temp ID scheme and let DB assign real UUIDs
  const nodeIdMap = new Map<string, string>(); // youtube_id -> temp_id

  // Root node
  nodes.push({
    roadmap_id: roadmapId,
    video_id: null,
    node_type: 'root',
    label: topic,
    description: `${level} level learning path`,
    position_x: NODE_X_START,
    position_y: yPos,
    order_index: orderIndex++,
    metadata: {
      total_duration_minutes: structure.estimated_total_minutes,
      total_videos: structure.nodes.length,
    },
  });
  yPos += NODE_Y_GAP;

  // Process each category
  for (const category of structure.categories.sort(
    (a, b) => a.order - b.order
  )) {
    // Category node
    const categoryVideos = structure.nodes.filter(
      (n) => n.category === category.name
    );
    const categoryMinutes = categoryVideos.reduce((sum, n) => {
      const vid = Array.from(videoMap.entries()).find(
        ([ytId]) => ytId === n.youtube_id
      );
      return sum + (vid ? 0 : 0); // Will be calculated from actual video data
    }, 0);

    nodes.push({
      roadmap_id: roadmapId,
      video_id: null,
      node_type: 'category',
      label: category.name,
      description: category.description,
      position_x: NODE_X_START + CATEGORY_X_OFFSET,
      position_y: yPos,
      order_index: orderIndex++,
      metadata: {
        category_name: category.name,
        video_count: categoryVideos.length,
        estimated_minutes: categoryMinutes,
        is_collapsed: false,
      },
    });
    yPos += NODE_Y_GAP;

    // Video nodes in this category
    const sortedVideos = categoryVideos.sort((a, b) => a.order - b.order);
    for (const videoNode of sortedVideos) {
      const dbVideoId = videoMap.get(videoNode.youtube_id) ?? null;

      nodes.push({
        roadmap_id: roadmapId,
        video_id: dbVideoId,
        node_type: 'video',
        label: videoNode.label,
        description: videoNode.description,
        position_x: NODE_X_START + VIDEO_X_OFFSET,
        position_y: yPos,
        order_index: orderIndex++,
        metadata: {
          youtube_id: videoNode.youtube_id,
          channel_name: '',
          thumbnail_url: '',
          duration_seconds: 0,
          view_count: 0,
        },
      });
      yPos += NODE_Y_GAP;
    }

    // Milestone after category
    const milestone = structure.milestones?.find(
      (m) => m.after_category === category.name
    );
    if (milestone) {
      nodes.push({
        roadmap_id: roadmapId,
        video_id: null,
        node_type: 'milestone',
        label: milestone.label,
        description: null,
        position_x: NODE_X_START + CATEGORY_X_OFFSET,
        position_y: yPos,
        order_index: orderIndex++,
        metadata: {
          milestone_label: milestone.label,
        },
      });
      yPos += NODE_Y_GAP;
    }
  }

  // Insert nodes
  const { data: insertedNodes, error: nodesError } = await supabaseAdmin
    .from('roadmap_nodes')
    .insert(nodes)
    .select('id, order_index, metadata');

  if (nodesError) {
    console.error('[pipeline] Failed to insert nodes:', nodesError.message);
    throw new Error('Failed to save roadmap nodes');
  }

  // Build edge data. Map youtube_id -> inserted node DB id.
  if (insertedNodes) {
    for (const node of insertedNodes) {
      const ytId = (node.metadata as Record<string, unknown>)?.youtube_id as
        | string
        | undefined;
      if (ytId) {
        nodeIdMap.set(ytId, node.id);
      }
    }
  }

  // Build edges from Gemini's edge list
  const edges: RoadmapEdge[] = [];
  for (const e of structure.edges ?? []) {
    const sourceId = nodeIdMap.get(e.source_youtube_id);
    const targetId = nodeIdMap.get(e.target_youtube_id);
    if (!sourceId || !targetId) continue;

    const edge: RoadmapEdge = {
      id: `e-${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      type: e.type,
    };
    if (e.label) edge.label = e.label;
    edges.push(edge);
  }

  // Also add structural edges: root -> categories, categories -> first video, video chain
  const rootNode = insertedNodes?.find(
    (n) => nodes[n.order_index]?.node_type === 'root'
  );
  if (rootNode) {
    // Add root -> category edges
    const categoryNodes =
      insertedNodes?.filter(
        (n) => nodes[n.order_index]?.node_type === 'category'
      ) ?? [];
    for (const cat of categoryNodes) {
      edges.push({
        id: `e-${rootNode.id}-${cat.id}`,
        source: rootNode.id,
        target: cat.id,
        type: 'prerequisite',
      });
    }

    // Add category -> first video edges, and sequential video edges
    let prevNodeInCategory: string | null = null;
    let currentCategory: string | null = null;

    for (const node of insertedNodes ?? []) {
      const nodeData = nodes[node.order_index];
      if (!nodeData) continue;

      if (nodeData.node_type === 'category') {
        currentCategory = node.id;
        prevNodeInCategory = null;
      } else if (nodeData.node_type === 'video') {
        if (currentCategory && !prevNodeInCategory) {
          // Category -> first video
          edges.push({
            id: `e-${currentCategory}-${node.id}`,
            source: currentCategory,
            target: node.id,
            type: 'prerequisite',
          });
        } else if (prevNodeInCategory) {
          // Sequential: prev video -> this video (only if no Gemini edge exists)
          const hasGeminiEdge = edges.some(
            (e) => e.source === prevNodeInCategory && e.target === node.id
          );
          if (!hasGeminiEdge) {
            edges.push({
              id: `e-${prevNodeInCategory}-${node.id}`,
              source: prevNodeInCategory,
              target: node.id,
              type: 'prerequisite',
            });
          }
        }
        prevNodeInCategory = node.id;
      } else if (nodeData.node_type === 'milestone' && prevNodeInCategory) {
        // Last video -> milestone
        edges.push({
          id: `e-${prevNodeInCategory}-${node.id}`,
          source: prevNodeInCategory,
          target: node.id,
          type: 'prerequisite',
        });
        prevNodeInCategory = null;
        currentCategory = null;
      }
    }
  }

  // Update roadmap with edges and final status
  const { error: updateError } = await supabaseAdmin
    .from('roadmaps')
    .update({
      status: 'ready',
      edges_data: edges,
      video_count: structure.nodes.length,
      updated_at: new Date().toISOString(),
    })
    .eq('slug', slug);

  if (updateError) {
    console.error('[pipeline] Failed to update roadmap:', updateError.message);
    throw new Error('Failed to finalize roadmap');
  }
}
