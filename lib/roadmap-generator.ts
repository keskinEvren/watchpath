import { supabaseAdmin } from '@/lib/supabase/server';
import { generateSlug } from '@/lib/utils';
import { generateSearchTerms, generateCurriculumTree } from '@/lib/gemini';
import { searchVideos, getVideoDetails } from '@/lib/youtube';
import { getTranscript, condenseTranscript } from '@/lib/transcript';
import { calculateQualityScore, extractKeywords } from '@/lib/engine/quality';
import { deduplicateVideos } from '@/lib/engine/dedup';
import { classifyBloomLevel } from '@/lib/engine/ordering';
import { buildProfileFromAnswers } from '@/lib/interview';
import type {
  Level,
  Video,
  RoadmapEdge,
  ScoredVideo,
  CurriculumNode,
  CurriculumTree,
  CurriculumNodeWithVideos,
  ProcessedCurriculum,
  UserProfile,
} from '@/types';

const NODE_Y_GAP = 150;
const BRANCH_X_GAP = 350;

// ---- Public API ----

/**
 * Creates the roadmap DB record and returns the slug.
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
 * Runs the full pipeline. Fire-and-forget from the API route.
 */
export async function runFullPipeline(
  slug: string,
  topic: string,
  level: Level,
  language: string = 'tr',
  answers: Record<string, string> = {},
): Promise<void> {
  try {
    await runCurriculumPipeline(slug, topic, level, language, answers);
  } catch (err) {
    console.error('[pipeline] Pipeline failed:', err);
    await supabaseAdmin
      .from('roadmaps')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('slug', slug);
  }
}

// ---- Curriculum-First Pipeline ----

/**
 * v3 Pipeline: Curriculum-first, roadmap.sh style.
 *
 * 1. Build user profile from interview
 * 2. Gemini generates curriculum tree (4-8 categories, 20-40 topic nodes)
 * 3. For each topic node, search YouTube with specific terms
 * 4. Score and pick best 1-3 videos per node
 * 5. Save tree + videos to DB
 */
async function runCurriculumPipeline(
  slug: string,
  topic: string,
  level: Level,
  language: string,
  answers: Record<string, string>,
): Promise<void> {
  // Step 1: Build profile
  const profile = buildProfileFromAnswers(topic, answers);
  console.log(`[pipeline] Profile: level=${profile.level}, goal=${profile.goal}`);

  // Step 2: Generate curriculum tree
  console.log('[pipeline] Generating curriculum tree...');
  const tree = await generateCurriculumTree(topic, profile, language);
  const categories = tree.nodes.filter((n) => n.nodeType === 'category');
  const topics = tree.nodes.filter((n) => n.nodeType === 'topic');
  console.log(`[pipeline] Tree: ${categories.length} categories, ${topics.length} topics`);

  // Step 3: Search YouTube for each topic node (batch by search terms)
  console.log('[pipeline] Searching videos for each topic node...');
  const nodeVideos = new Map<string, Video[]>();
  const allVideoIds = new Set<string>();

  // Collect all unique search terms, grouped by node
  for (const node of topics) {
    const term = node.searchTerms[0] ?? `${topic} ${node.name} ${language === 'tr' ? 'ders' : 'tutorial'}`;

    try {
      const results = await searchVideos(term, 8, language);
      const newIds = results
        .map((r) => r.videoId)
        .filter((id) => !allVideoIds.has(id));

      if (newIds.length > 0) {
        const details = await getVideoDetails(newIds);
        nodeVideos.set(node.id, details);
        for (const id of newIds) allVideoIds.add(id);
      }
    } catch (err) {
      console.log(`[pipeline] Search failed for "${node.name}":`, err);
    }
  }

  console.log(`[pipeline] Found videos for ${nodeVideos.size}/${topics.length} topics, ${allVideoIds.size} unique videos`);

  // Step 4: Upsert all videos to DB
  const allVideos = [...nodeVideos.values()].flat();
  const uniqueVideos = Array.from(
    new Map(allVideos.map((v) => [v.youtube_id, v])).values(),
  );
  const upsertedMap = await upsertVideos(uniqueVideos);

  // Step 5: Fetch transcripts (parallel, best effort)
  console.log('[pipeline] Fetching transcripts...');
  const transcripts = new Map<string, string>();
  const transcriptResults = await Promise.allSettled(
    uniqueVideos.map(async (v) => {
      const segments = await getTranscript(v.youtube_id);
      if (segments && segments.length > 0) {
        return { youtubeId: v.youtube_id, text: condenseTranscript(segments, 5000) };
      }
      return null;
    }),
  );
  for (const r of transcriptResults) {
    if (r.status === 'fulfilled' && r.value) {
      transcripts.set(r.value.youtubeId, r.value.text);
    }
  }
  console.log(`[pipeline] Transcripts: ${transcripts.size}/${uniqueVideos.length}`);

  // Step 6: Score and match best videos per node
  console.log('[pipeline] Matching videos to nodes...');
  const nodesWithVideos: CurriculumNodeWithVideos[] = tree.nodes.map((node) => {
    if (node.nodeType === 'category') {
      return { ...node, videos: [] };
    }

    const candidates = nodeVideos.get(node.id) ?? [];
    const scored = scoreAndRank(candidates, transcripts);
    const best = scored.slice(0, 3); // top 3 per node

    return { ...node, videos: best };
  });

  const totalVideos = nodesWithVideos.reduce((sum, n) => sum + n.videos.length, 0);
  const totalMinutes = Math.round(
    nodesWithVideos
      .flatMap((n) => n.videos)
      .reduce((sum, sv) => sum + (sv.video.duration_seconds ?? 0) / 60, 0),
  );

  console.log(`[pipeline] Matched ${totalVideos} videos across ${topics.length} topics`);

  const processed: ProcessedCurriculum = {
    tree,
    nodesWithVideos,
    profile,
    totalVideos,
    totalMinutes,
  };

  // Step 7: Save to DB
  await saveCurriculumRoadmap(slug, topic, level, processed, upsertedMap);
  console.log(`[pipeline] Roadmap "${slug}" is ready`);
}

/**
 * Score, dedup, and rank videos for a single node.
 */
function scoreAndRank(
  videos: Video[],
  transcripts: Map<string, string>,
): ScoredVideo[] {
  if (videos.length === 0) return [];

  const scored: ScoredVideo[] = videos.map((video) => {
    const transcript = transcripts.get(video.youtube_id) ?? null;
    const qualityScore = calculateQualityScore(video, transcript);
    const keywords = extractKeywords(
      transcript ?? `${video.title} ${video.description ?? ''}`,
      15,
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

  // Dedup within this node's candidates
  const deduped = deduplicateVideos(scored, 0.5);

  // Sort by quality descending
  return deduped.sort((a, b) => b.qualityScore - a.qualityScore);
}

// ---- DB Operations ----

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
      console.error(`[pipeline] Failed to upsert video ${video.youtube_id}:`, error.message);
      continue;
    }
    if (data) {
      videoMap.set(data.youtube_id, data.id);
    }
  }

  return videoMap;
}

/**
 * Save curriculum tree as a multi-branch DAG.
 *
 * Layout (roadmap.sh style):
 *   Root node at top center
 *   Categories branch out horizontally
 *   Topics chain vertically under each category
 *   Videos attach as children under each topic
 */
async function saveCurriculumRoadmap(
  slug: string,
  topic: string,
  level: Level,
  processed: ProcessedCurriculum,
  videoMap: Map<string, string>,
): Promise<void> {
  const { data: roadmap } = await supabaseAdmin
    .from('roadmaps')
    .select('id')
    .eq('slug', slug)
    .single();

  if (!roadmap) throw new Error('Roadmap not found');

  const roadmapId = roadmap.id;
  const { nodesWithVideos, tree } = processed;

  // Separate categories and topics
  const categories = nodesWithVideos.filter((n) => n.nodeType === 'category');
  const topicsByParent = new Map<string, CurriculumNodeWithVideos[]>();
  for (const node of nodesWithVideos) {
    if (node.nodeType === 'topic' && node.parentId) {
      const list = topicsByParent.get(node.parentId) ?? [];
      list.push(node);
      topicsByParent.set(node.parentId, list);
    }
  }

  const dbNodes: Array<{
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
  dbNodes.push({
    roadmap_id: roadmapId,
    video_id: null,
    node_type: 'root',
    label: topic,
    description: `${processed.totalVideos} video · ${processed.totalMinutes} dk`,
    position_x: 0,
    position_y: 0,
    order_index: orderIndex++,
    metadata: {
      total_duration_minutes: processed.totalMinutes,
      total_videos: processed.totalVideos,
      estimated_hours: tree.totalEstimatedHours,
    },
  });

  // Layout: categories spread horizontally, topics vertically
  const totalCats = categories.length;
  const startX = -((totalCats - 1) * BRANCH_X_GAP) / 2;

  // Track the order: root, then for each category: category -> topics -> videos
  for (let catIdx = 0; catIdx < categories.length; catIdx++) {
    const cat = categories[catIdx];
    const branchX = startX + catIdx * BRANCH_X_GAP;
    let yPos = NODE_Y_GAP;

    // Category node
    const catTopics = topicsByParent.get(cat.id) ?? [];
    const catVideoCount = catTopics.reduce((s, t) => s + t.videos.length, 0);

    dbNodes.push({
      roadmap_id: roadmapId,
      video_id: null,
      node_type: 'category',
      label: cat.name,
      description: cat.description,
      position_x: branchX,
      position_y: yPos,
      order_index: orderIndex++,
      metadata: {
        category_name: cat.name,
        curriculum_id: cat.id,
        video_count: catVideoCount,
        topic_count: catTopics.length,
        importance: cat.importance,
        is_collapsed: false,
      },
    });
    yPos += NODE_Y_GAP;

    // Topic nodes under this category
    for (const topicNode of catTopics.sort((a, b) => a.order - b.order)) {
      // Topic node (shows as a sub-heading)
      dbNodes.push({
        roadmap_id: roadmapId,
        video_id: null,
        node_type: 'milestone', // reuse milestone as topic label node
        label: topicNode.name,
        description: topicNode.description,
        position_x: branchX,
        position_y: yPos,
        order_index: orderIndex++,
        metadata: {
          curriculum_id: topicNode.id,
          importance: topicNode.importance,
          milestone_label: topicNode.name,
          video_count: topicNode.videos.length,
        },
      });
      yPos += NODE_Y_GAP * 0.8;

      // Video nodes under this topic
      for (const sv of topicNode.videos) {
        const dbVideoId = videoMap.get(sv.video.youtube_id) ?? null;
        dbNodes.push({
          roadmap_id: roadmapId,
          video_id: dbVideoId,
          node_type: 'video',
          label: sv.video.title,
          description: sv.video.channel_name,
          position_x: branchX + 40,
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
        yPos += NODE_Y_GAP * 0.7;
      }

      yPos += NODE_Y_GAP * 0.3; // extra gap between topics
    }
  }

  // Insert all nodes
  const { data: insertedNodes, error: nodesError } = await supabaseAdmin
    .from('roadmap_nodes')
    .insert(dbNodes)
    .select('id, order_index, metadata');

  if (nodesError) {
    console.error('[pipeline] Failed to insert nodes:', nodesError.message);
    throw new Error('Failed to save nodes');
  }

  // Build edges from the tree structure
  const edges: RoadmapEdge[] = [];

  if (insertedNodes) {
    const nodeById = new Map<number, string>();
    for (const node of insertedNodes) {
      nodeById.set(node.order_index, node.id);
    }

    const rootId = nodeById.get(0)!;
    let idx = 1;

    for (const cat of categories) {
      const catId = nodeById.get(idx)!;
      idx++;

      // Root -> category
      edges.push({
        id: `e-${rootId}-${catId}`,
        source: rootId,
        target: catId,
        type: cat.importance === 'optional' ? 'optional' : 'prerequisite',
      });

      const catTopics = topicsByParent.get(cat.id) ?? [];
      let prevTopicId = catId;

      for (const topicNode of catTopics.sort((a, b) => a.order - b.order)) {
        const topicId = nodeById.get(idx)!;
        idx++;

        // Category/prev topic -> this topic
        edges.push({
          id: `e-${prevTopicId}-${topicId}`,
          source: prevTopicId,
          target: topicId,
          type: topicNode.importance === 'optional' ? 'optional' : 'prerequisite',
        });

        // Topic -> videos (chain)
        let prevId = topicId;
        for (const sv of topicNode.videos) {
          const videoId = nodeById.get(idx)!;
          idx++;

          edges.push({
            id: `e-${prevId}-${videoId}`,
            source: prevId,
            target: videoId,
            type: 'prerequisite',
          });
          prevId = videoId;
        }

        prevTopicId = prevId; // last video or topic node
      }
    }
  }

  // Finalize
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
