import { supabaseAdmin } from '@/lib/supabase/server';
import { generateSlug } from '@/lib/utils';
import { generateSearchTerms, generateClusterNames } from '@/lib/gemini';
import { searchVideos, getVideoDetails } from '@/lib/youtube';
import { getTranscript, condenseTranscript } from '@/lib/transcript';
import { processVideos } from '@/lib/engine';
import { buildProfileFromAnswers } from '@/lib/interview';
import type {
  Level,
  Video,
  RoadmapEdge,
  ProcessedRoadmap,
  UserProfile,
} from '@/types';

const NODE_X_START = 0;
const NODE_Y_GAP = 150;
const CATEGORY_X_OFFSET = 0;
const VIDEO_X_OFFSET = 50;
const BRANCH_X_GAP = 400; // Horizontal gap between branches

/**
 * Creates the roadmap DB record and returns the slug.
 * Call this first, then fire runFullPipeline() without awaiting.
 */
export async function createRoadmapRecord(
  topic: string,
  level: Level,
): Promise<string> {
  const slug = generateSlug(topic);

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

  return slug;
}

/**
 * Runs the full pipeline for a roadmap.
 * Should be called without await (fire-and-forget) so the API responds instantly.
 * On failure, marks the roadmap as "failed" in the DB.
 */
export async function runFullPipeline(
  slug: string,
  topic: string,
  level: Level,
  language: string = 'tr',
  answers: Record<string, string> = {},
): Promise<void> {
  try {
    await runPipelineV2(slug, topic, level, language, answers);
  } catch (err) {
    console.error('[pipeline] Pipeline failed:', err);
    await supabaseAdmin
      .from('roadmaps')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('slug', slug);
  }
}

/**
 * v2 Pipeline: Interview-driven, engine-processed, multi-branch roadmaps.
 *
 * Flow:
 * 1. Build user profile from interview answers
 * 2. Generate search terms (Gemini)
 * 3. Search YouTube (15 per term, more coverage)
 * 4. Get video details + transcripts
 * 5. Run local engine (score, dedup, cluster, order, profile)
 * 6. Name clusters (Gemini, cheap)
 * 7. Save multi-branch DAG to DB
 */
async function runPipelineV2(
  slug: string,
  topic: string,
  level: Level,
  language: string,
  answers: Record<string, string>,
): Promise<void> {
  // Step 1: Build user profile from interview answers
  const profile = buildProfileFromAnswers(topic, answers);
  console.log(`[pipeline] Profile: level=${profile.level}, goal=${profile.goal}, weakness=${profile.weakness}`);

  // Step 2: Generate search terms from Gemini
  console.log('[pipeline] Generating search terms...');
  const searchTerms = await generateSearchTerms(topic, level, language);
  console.log(`[pipeline] Got ${searchTerms.length} search terms:`, searchTerms);

  // Step 3: Search YouTube for each term (more results for better coverage)
  console.log('[pipeline] Searching YouTube...');
  const allSearchResults = [];
  for (const term of searchTerms) {
    const results = await searchVideos(term, 15, language);
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
    `[pipeline] Found ${allSearchResults.length} results, ${uniqueResults.length} unique`,
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

  // Step 6: Fetch transcripts for ALL videos (parallel, with error tolerance)
  console.log('[pipeline] Fetching transcripts for all videos...');
  const transcripts = new Map<string, string>();

  const transcriptResults = await Promise.allSettled(
    videos.map(async (v) => {
      const segments = await getTranscript(v.youtube_id);
      if (segments && segments.length > 0) {
        const text = condenseTranscript(segments, 5000);
        return { youtubeId: v.youtube_id, text };
      }
      return null;
    }),
  );

  for (const result of transcriptResults) {
    if (result.status === 'fulfilled' && result.value) {
      transcripts.set(result.value.youtubeId, result.value.text);
    }
  }
  console.log(`[pipeline] Got transcripts for ${transcripts.size}/${videos.length} videos`);

  // Step 7: Run local engine (zero Gemini calls)
  console.log('[pipeline] Running v2 engine...');
  const processed = processVideos(videos, transcripts, profile);
  console.log(
    `[pipeline] Engine: ${processed.clusters.length} clusters, ${processed.totalVideos} videos, ${processed.totalMinutes} min`,
  );

  // Step 8: Name clusters with Gemini (cheap call, just keywords -> names)
  try {
    const clusterNames = await generateClusterNames(processed.clusters);
    processed.clusters.forEach((c, i) => {
      c.name = clusterNames[i] ?? c.name;
    });
    console.log(`[pipeline] Cluster names: ${processed.clusters.map((c) => c.name).join(', ')}`);
  } catch (err) {
    console.log('[pipeline] Cluster naming failed, using keyword names:', err);
  }

  // Step 9: Save multi-branch DAG to DB
  await saveRoadmapDataV2(slug, topic, level, processed, upsertedVideos);
  console.log(`[pipeline] Roadmap "${slug}" is ready`);
}

/**
 * Upsert videos into the videos table. Returns a map of youtube_id -> db uuid.
 */
async function upsertVideos(
  videos: Video[],
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
        { onConflict: 'youtube_id' },
      )
      .select('id, youtube_id')
      .single();

    if (error) {
      console.error(
        `[pipeline] Failed to upsert video ${video.youtube_id}:`,
        error.message,
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
 * Save the v2 ProcessedRoadmap as a multi-branch DAG to the database.
 *
 * Layout:
 * - Root node at center top
 * - Each cluster branches out horizontally as a category node
 * - Videos chain vertically within each branch
 * - Series are grouped as series nodes
 */
async function saveRoadmapDataV2(
  slug: string,
  topic: string,
  level: Level,
  processed: ProcessedRoadmap,
  videoMap: Map<string, string>,
): Promise<void> {
  // Get roadmap ID
  const { data: roadmap } = await supabaseAdmin
    .from('roadmaps')
    .select('id')
    .eq('slug', slug)
    .single();

  if (!roadmap) throw new Error('Roadmap not found after insert');

  const roadmapId = roadmap.id;

  const nodes: Array<{
    roadmap_id: string;
    video_id: string | null;
    node_type: string;
    label: string;
    description: string | null;
    position_x: number;
    position_y: number;
    order_index: number;
    metadata: Record<string, unknown>;
  }> = [];

  let orderIndex = 0;

  // Root node
  nodes.push({
    roadmap_id: roadmapId,
    video_id: null,
    node_type: 'root',
    label: topic,
    description: `${processed.profile.goal} - ${level}`,
    position_x: NODE_X_START,
    position_y: 0,
    order_index: orderIndex++,
    metadata: {
      total_duration_minutes: processed.totalMinutes,
      total_videos: processed.totalVideos,
    },
  });

  // Each cluster becomes a category (branch) node
  const totalBranches = processed.clusters.length;
  const startX = -((totalBranches - 1) * BRANCH_X_GAP) / 2;

  for (let branchIdx = 0; branchIdx < processed.clusters.length; branchIdx++) {
    const cluster = processed.clusters[branchIdx];
    const branchX = startX + branchIdx * BRANCH_X_GAP;
    let yPos = NODE_Y_GAP;

    // Category (branch) node
    const clusterMinutes = cluster.videos.reduce(
      (sum, sv) => sum + (sv.video.duration_seconds ?? 0) / 60,
      0,
    );

    nodes.push({
      roadmap_id: roadmapId,
      video_id: null,
      node_type: 'category',
      label: cluster.name,
      description: `${cluster.videos.length} video · ${Math.round(clusterMinutes)} dk`,
      position_x: branchX + CATEGORY_X_OFFSET,
      position_y: yPos,
      order_index: orderIndex++,
      metadata: {
        category_name: cluster.name,
        video_count: cluster.videos.length,
        estimated_minutes: Math.round(clusterMinutes),
        is_collapsed: false,
        branch_weight: cluster.weight,
        cluster_keywords: cluster.keywords,
      },
    });
    yPos += NODE_Y_GAP;

    // Video nodes in this cluster
    for (const sv of cluster.videos) {
      const dbVideoId = videoMap.get(sv.video.youtube_id) ?? null;

      nodes.push({
        roadmap_id: roadmapId,
        video_id: dbVideoId,
        node_type: 'video',
        label: sv.video.title,
        description: sv.video.channel_name,
        position_x: branchX + VIDEO_X_OFFSET,
        position_y: yPos,
        order_index: orderIndex++,
        metadata: {
          youtube_id: sv.video.youtube_id,
          channel_name: sv.video.channel_name,
          thumbnail_url: sv.video.thumbnail_url,
          duration_seconds: sv.video.duration_seconds,
          view_count: sv.video.view_count,
          quality_score: sv.qualityScore,
          bloom_level: sv.bloomLevel,
        },
      });
      yPos += NODE_Y_GAP;
    }

    // Milestone at end of branch
    nodes.push({
      roadmap_id: roadmapId,
      video_id: null,
      node_type: 'milestone',
      label: `${cluster.name} tamamlandı!`,
      description: null,
      position_x: branchX + CATEGORY_X_OFFSET,
      position_y: yPos,
      order_index: orderIndex++,
      metadata: {
        milestone_label: `${cluster.name} tamamlandı!`,
      },
    });
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

  // Build edges
  const edges: RoadmapEdge[] = [];

  if (insertedNodes) {
    // Map order_index -> node id for edge building
    const nodeById = new Map<number, string>();
    for (const node of insertedNodes) {
      nodeById.set(node.order_index, node.id);
    }

    const rootId = nodeById.get(0)!;
    let nodeIdx = 1; // skip root

    for (const cluster of processed.clusters) {
      const categoryId = nodeById.get(nodeIdx)!;
      nodeIdx++;

      // Root -> category edge
      edges.push({
        id: `e-${rootId}-${categoryId}`,
        source: rootId,
        target: categoryId,
        type: cluster.weight === 'optional' ? 'optional' : 'prerequisite',
      });

      // Category -> first video, then video chain
      let prevId = categoryId;
      for (let i = 0; i < cluster.videos.length; i++) {
        const videoNodeId = nodeById.get(nodeIdx)!;
        nodeIdx++;

        edges.push({
          id: `e-${prevId}-${videoNodeId}`,
          source: prevId,
          target: videoNodeId,
          type: 'prerequisite',
        });

        prevId = videoNodeId;
      }

      // Last video -> milestone
      const milestoneId = nodeById.get(nodeIdx)!;
      nodeIdx++;

      edges.push({
        id: `e-${prevId}-${milestoneId}`,
        source: prevId,
        target: milestoneId,
        type: 'prerequisite',
      });
    }
  }

  // Update roadmap with edges and final status
  const { error: updateError } = await supabaseAdmin
    .from('roadmaps')
    .update({
      status: 'ready',
      edges_data: edges,
      video_count: processed.totalVideos,
      updated_at: new Date().toISOString(),
    })
    .eq('slug', slug);

  if (updateError) {
    console.error('[pipeline] Failed to update roadmap:', updateError.message);
    throw new Error('Failed to finalize roadmap');
  }
}
