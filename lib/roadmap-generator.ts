import { supabaseAdmin } from '@/lib/supabase/server';
import { generateSlug } from '@/lib/utils';
import { generateCurriculumTree } from '@/lib/gemini';
import { getCachedCurriculum, setCachedCurriculum } from '@/lib/cache';
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

  // Step 2: Generate curriculum tree (cache-first)
  const levelBucket = profile.level < 0.3 ? 'beginner'
    : profile.level < 0.6 ? 'intermediate'
    : 'advanced';

  let tree = await getCachedCurriculum(topic, levelBucket);
  if (tree) {
    console.log('[pipeline] Using cached curriculum tree');
  } else {
    console.log('[pipeline] Generating curriculum tree via Gemini...');
    tree = await generateCurriculumTree(topic, profile, language);
    // Cache for next time (fire-and-forget)
    setCachedCurriculum(topic, levelBucket, tree).catch((err) =>
      console.error('[pipeline] Failed to cache curriculum:', err)
    );
  }
  const categories = tree.nodes.filter((n) => n.nodeType === 'category');
  const topics = tree.nodes.filter((n) => n.nodeType === 'topic');
  console.log(`[pipeline] Tree: ${categories.length} categories, ${topics.length} topics`);

  // --- Phase 1A: Save Skeleton & Set status to tree_ready ---
  console.log('[pipeline] Saving curriculum skeleton (tree_ready)...');
  const { dbNodes, initialEdges, roadmapId } = await saveSkeletonRoadmap(slug, topic, level, tree, profile);

  // --- Phase 1B: Background video fetching, bilingual search, scoring, and matching ---
  
  console.log('[pipeline] Starting background video matching...');
  const nodeVideos = new Map<string, Video[]>();
  const allVideoIds = new Set<string>();

  const eduSuffixTr = 'ders eğitim anlatım';
  const eduSuffixEn = 'tutorial course lesson';

  for (const node of topics) {
    // 1. Search in primary language (TR or EN)
    const primarySuffix = language === 'tr' ? eduSuffixTr : eduSuffixEn;
    const rawTerm = node.searchTerms[0] ?? `${topic} ${node.name}`;
    const term = `${rawTerm} ${primarySuffix}`;

    try {
      const results = await searchVideos(term, 8, language);
      const newIds = results
        .map((r) => r.videoId)
        .filter((id) => !allVideoIds.has(id));

      let trFiltered: Video[] = [];
      if (newIds.length > 0) {
        const details = await getVideoDetails(newIds);
        trFiltered = details.filter(
          (v) => v.duration_seconds !== null && v.duration_seconds >= 120,
        );
      }

      // 2. Bilingual Fallback: If not enough high quality videos and primary is TR, search English
      if (trFiltered.length < 2 && language === 'tr') {
        const enTerm = `${node.name} ${topic} ${eduSuffixEn}`;
        console.log(`[pipeline] Low Turkish results for "${node.name}". Trying English fallback: "${enTerm}"`);
        const enResults = await searchVideos(enTerm, 6, 'en');
        const enIds = enResults
          .map((r) => r.videoId)
          .filter((id) => !allVideoIds.has(id));

        if (enIds.length > 0) {
          const enDetails = await getVideoDetails(enIds);
          const enFiltered = enDetails.filter(
            (v) => v.duration_seconds !== null && v.duration_seconds >= 120,
          );
          trFiltered = [...trFiltered, ...enFiltered];
        }
      }

      if (trFiltered.length > 0) {
        nodeVideos.set(node.id, trFiltered);
        for (const v of trFiltered) allVideoIds.add(v.youtube_id);
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

  // Step 6: Score and match best videos per node (with relevance filtering)
  console.log('[pipeline] Matching videos to nodes...');
  const nodesWithVideos: CurriculumNodeWithVideos[] = tree.nodes.map((node) => {
    if (node.nodeType === 'category') {
      return { ...node, videos: [] };
    }

    const candidates = nodeVideos.get(node.id) ?? [];
    const scored = scoreAndRank(candidates, transcripts, node.name, topic);
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

  // Step 7: Update and finalize DB nodes & edges
  await finalizeRoadmapWithVideos(slug, roadmapId, processed, upsertedMap, dbNodes, initialEdges);
  console.log(`[pipeline] Roadmap "${slug}" is ready`);
}

/**
 * Score, dedup, and rank videos for a single node.
 */
function scoreAndRank(
  videos: Video[],
  transcripts: Map<string, string>,
  nodeName: string = '',
  rootTopic: string = '',
): ScoredVideo[] {
  if (videos.length === 0) return [];

  // Build relevance keywords from node name + root topic
  const relevanceWords = `${nodeName} ${rootTopic}`
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const scored: ScoredVideo[] = videos.map((video) => {
    const transcript = transcripts.get(video.youtube_id) ?? null;
    let qualityScore = calculateQualityScore(video, transcript);
    const keywords = extractKeywords(
      transcript ?? `${video.title} ${video.description ?? ''}`,
      15,
    );
    const bloomLevel = classifyBloomLevel(transcript, video.title);

    // Title relevance bonus/penalty
    const titleLower = video.title.toLowerCase();
    const descLower = (video.description ?? '').toLowerCase();
    const titleAndDesc = `${titleLower} ${descLower}`;

    // Count how many relevance words appear in title+description
    const matchCount = relevanceWords.filter((w) => titleAndDesc.includes(w)).length;
    const relevanceRatio = relevanceWords.length > 0 ? matchCount / relevanceWords.length : 0;

    // Penalty for low relevance (< 30% match = halve score)
    if (relevanceRatio < 0.3) {
      qualityScore *= 0.3;
    } else if (relevanceRatio < 0.5) {
      qualityScore *= 0.6;
    } else {
      qualityScore *= (0.7 + relevanceRatio * 0.3); // bonus for high relevance
    }

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
interface SkeletonResult {
  dbNodes: Array<{
    id?: string;
    roadmap_id: string;
    video_id: string | null;
    node_type: string;
    label: string;
    description: string | null;
    position_x: number;
    position_y: number;
    order_index: number;
    metadata: Record<string, unknown>;
  }>;
  initialEdges: RoadmapEdge[];
  roadmapId: string;
}

/**
 * Saves initial curriculum skeleton (Categories & Topics) without videos.
 * Status is set to 'tree_ready'.
 */
async function saveSkeletonRoadmap(
  slug: string,
  topic: string,
  level: Level,
  tree: CurriculumTree,
  profile: UserProfile,
): Promise<SkeletonResult> {
  const { data: roadmap } = await supabaseAdmin
    .from('roadmaps')
    .select('id')
    .eq('slug', slug)
    .single();

  if (!roadmap) throw new Error('Roadmap not found');
  const roadmapId = roadmap.id;

  const categories = tree.nodes.filter((n) => n.nodeType === 'category');
  const topics = tree.nodes.filter((n) => n.nodeType === 'topic');

  const topicsByParent = new Map<string, typeof topics>();
  for (const node of topics) {
    if (node.parentId) {
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

  // 1. Root Node
  dbNodes.push({
    roadmap_id: roadmapId,
    video_id: null,
    node_type: 'root',
    label: topic,
    description: `Müfredat yükleniyor...`,
    position_x: 0,
    position_y: 0,
    order_index: orderIndex++,
    metadata: {
      total_duration_minutes: 0,
      total_videos: 0,
      estimated_hours: tree.totalEstimatedHours,
    },
  });

  const totalCats = categories.length;
  const startX = -((totalCats - 1) * BRANCH_X_GAP) / 2;

  // Build nodes structure
  for (let catIdx = 0; catIdx < categories.length; catIdx++) {
    const cat = categories[catIdx];
    const branchX = startX + catIdx * BRANCH_X_GAP;
    let yPos = NODE_Y_GAP;

    const catTopics = topicsByParent.get(cat.id) ?? [];

    // 2. Category Node
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
        video_count: 0,
        topic_count: catTopics.length,
        importance: cat.importance,
        is_collapsed: false,
      },
    });
    yPos += NODE_Y_GAP;

    // 3. Topic (Milestone) Nodes under this category
    for (const topicNode of catTopics.sort((a, b) => a.order - b.order)) {
      dbNodes.push({
        roadmap_id: roadmapId,
        video_id: null,
        node_type: 'milestone',
        label: topicNode.name,
        description: topicNode.description,
        position_x: branchX,
        position_y: yPos,
        order_index: orderIndex++,
        metadata: {
          curriculum_id: topicNode.id,
          importance: topicNode.importance,
          milestone_label: topicNode.name,
          video_count: 0,
        },
      });
      // Leave space for video chain under this topic in the layout
      yPos += NODE_Y_GAP * 0.8;
      // We reserve coordinates but video nodes are added in Phase 1B
      yPos += NODE_Y_GAP * 0.7 * 3; // reserve space for up to 3 videos
      yPos += NODE_Y_GAP * 0.3; // extra gap between topics
    }
  }

  // Save skeleton nodes to DB
  const { data: insertedNodes, error: nodesError } = await supabaseAdmin
    .from('roadmap_nodes')
    .insert(dbNodes)
    .select('id, order_index, metadata');

  if (nodesError || !insertedNodes) {
    console.error('[pipeline] Failed to insert skeleton nodes:', nodesError?.message);
    throw new Error('Failed to save skeleton nodes');
  }

  // Link DB node IDs back to categories and topics
  const nodeById = new Map<number, string>();
  for (const node of insertedNodes) {
    nodeById.set(node.order_index, node.id);
  }

  // Build initial edges list
  const initialEdges: RoadmapEdge[] = [];
  const rootId = nodeById.get(0)!;
  let idx = 1;

  for (const cat of categories) {
    const catId = nodeById.get(idx)!;
    idx++;

    // Root -> Category
    initialEdges.push({
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

      // Category / prev topic -> this topic node
      initialEdges.push({
        id: `e-${prevTopicId}-${topicId}`,
        source: prevTopicId,
        target: topicId,
        type: topicNode.importance === 'optional' ? 'optional' : 'prerequisite',
      });

      prevTopicId = topicId;
    }
  }

  // Update roadmap status to 'tree_ready'
  const { error: updateError } = await supabaseAdmin
    .from('roadmaps')
    .update({
      status: 'tree_ready',
      edges_data: initialEdges,
      video_count: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', roadmapId);

  if (updateError) {
    console.error('[pipeline] Failed to update skeleton status:', updateError.message);
  }

  // Re-map dbNodes with generated IDs from database
  const mappedDbNodes = dbNodes.map((node, i) => ({
    ...node,
    id: insertedNodes.find(n => n.order_index === node.order_index)?.id
  }));

  return {
    dbNodes: mappedDbNodes,
    initialEdges,
    roadmapId,
  };
}

/**
 * Appends video nodes to the roadmap nodes and updates status to 'ready'.
 */
async function finalizeRoadmapWithVideos(
  slug: string,
  roadmapId: string,
  processed: ProcessedCurriculum,
  videoMap: Map<string, string>,
  skeletonNodes: SkeletonResult['dbNodes'],
  initialEdges: RoadmapEdge[],
): Promise<void> {
  const { nodesWithVideos } = processed;
  const topics = nodesWithVideos.filter((n) => n.nodeType === 'topic');

  const videoDbNodes: Array<{
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

  const finalEdges = [...initialEdges];
  let orderIndex = skeletonNodes.length + 10; // Start video order index offset from skeleton

  // Helper map to find the node database ID from skeleton metadata
  const findSkeletonNodeId = (curriculumId: string): string | undefined => {
    return skeletonNodes.find(n => n.metadata?.curriculum_id === curriculumId)?.id;
  };

  for (const topicNode of topics) {
    const topicDbId = findSkeletonNodeId(topicNode.id);
    if (!topicDbId) continue;

    // Get the topic node's position and details from skeleton
    const topicNodeData = skeletonNodes.find(n => n.id === topicDbId);
    if (!topicNodeData) continue;

    const branchX = topicNodeData.position_x;
    let yPos = topicNodeData.position_y + NODE_Y_GAP * 0.8;

    let prevId = topicDbId;

    // Map videos to nodes
    const videoNodeIds: string[] = [];

    for (const sv of topicNode.videos) {
      const dbVideoId = videoMap.get(sv.video.youtube_id) ?? null;
      const order = orderIndex++;

      // Create a unique temporary id that next step will resolve, or generate a uuid
      // Since we insert video node directly, we can get its ID after insert
      const videoNodeData = {
        roadmap_id: roadmapId,
        video_id: dbVideoId,
        node_type: 'video' as const,
        label: sv.video.title,
        description: sv.video.channel_name,
        position_x: branchX + 40,
        position_y: yPos,
        order_index: order,
        metadata: {
          youtube_id: sv.video.youtube_id,
          channel_name: sv.video.channel_name,
          thumbnail_url: sv.video.thumbnail_url,
          duration_seconds: sv.video.duration_seconds,
          view_count: sv.video.view_count,
          quality_score: sv.qualityScore,
          bloom_level: sv.bloomLevel,
          language: sv.video.language,
          parent_topic_curriculum_id: topicNode.id,
        },
      };

      videoDbNodes.push(videoNodeData);
      yPos += NODE_Y_GAP * 0.7;
    }
  }

  // Insert video nodes
  let insertedVideos: Array<{ id: string; order_index: number }> = [];
  if (videoDbNodes.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('roadmap_nodes')
      .insert(videoDbNodes)
      .select('id, order_index');

    if (error) {
      console.error('[pipeline] Failed to insert video nodes:', error.message);
    } else if (data) {
      insertedVideos = data;
    }
  }

  // Build connection edges for the newly inserted videos
  const videoNodeByOrder = new Map<number, string>();
  for (const iv of insertedVideos) {
    videoNodeByOrder.set(iv.order_index, iv.id);
  }

  // Link videos into topic nodes in finalEdges
  for (const topicNode of topics) {
    const topicDbId = findSkeletonNodeId(topicNode.id);
    if (!topicDbId) continue;

    // Find the matching video nodes in dbNodes array we built using curriculum_id
    const matchingVideosInDb = videoDbNodes
      .filter(v => v.metadata?.parent_topic_curriculum_id === topicNode.id)
      .sort((a, b) => a.order_index - b.order_index);

    let prevId = topicDbId;

    for (const vDb of matchingVideosInDb) {
      const videoDbId = videoNodeByOrder.get(vDb.order_index);
      if (!videoDbId) continue;

      finalEdges.push({
        id: `e-${prevId}-${videoDbId}`,
        source: prevId,
        target: videoDbId,
        type: 'prerequisite',
      });
      prevId = videoDbId;
    }
  }

  // Update root node description
  const rootNode = skeletonNodes.find(n => n.node_type === 'root');
  if (rootNode && rootNode.id) {
    await supabaseAdmin
      .from('roadmap_nodes')
      .update({
        description: `${processed.totalVideos} video · ${processed.totalMinutes} dk`,
        metadata: {
          ...rootNode.metadata,
          total_duration_minutes: processed.totalMinutes,
          total_videos: processed.totalVideos,
        }
      })
      .eq('id', rootNode.id);
  }

  // Finalize roadmap status & metadata
  const { error: updateError } = await supabaseAdmin
    .from('roadmaps')
    .update({
      status: 'ready',
      edges_data: finalEdges,
      video_count: processed.totalVideos,
      updated_at: new Date().toISOString(),
    })
    .eq('id', roadmapId);

  if (updateError) {
    console.error('[pipeline] Failed to finalize roadmap status:', updateError.message);
    throw new Error('Failed to finalize roadmap');
  }
}
