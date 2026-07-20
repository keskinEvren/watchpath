'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  type Node,
  type Edge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';

import type {
  RoadmapNode,
  RoadmapEdge,
  Video,
  Level,
  NodeType,
} from '@/types';

import RootNode from './RootNode';
import ChapterNode from './ChapterNode';
import VideoNode from './VideoNode';
import MilestoneNode from './MilestoneNode';
import SkeletonVideoNode from './SkeletonVideoNode';
import NoteNode from './NoteNode';
import ConceptNode from './ConceptNode';
import CustomEdge from './CustomEdge';
import CanvasControls from './CanvasControls';
import VideoPanel from './VideoPanel';
import styles from './RoadmapCanvas.module.css';
import { getProgress, setNodeComplete, getCategoryProgress } from '@/lib/progress';
import type { RoadmapStatus } from '@/types';

// ---------- dagre layout ----------

const NODE_DIMENSIONS: Record<NodeType | 'skeletonVideo', { width: number; height: number }> = {
  root: { width: 320, height: 100 },
  category: { width: 240, height: 80 },
  video: { width: 280, height: 100 },
  milestone: { width: 220, height: 60 },
  series: { width: 300, height: 110 },
  skeletonVideo: { width: 280, height: 100 },
  note: { width: 260, height: 120 },
  concept: { width: 220, height: 60 },
};

function layoutNodes(
  nodes: Node[],
  edges: Edge[],
): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80 });

  for (const node of nodes) {
    const dim = NODE_DIMENSIONS[(node.type as NodeType | 'skeletonVideo') ?? 'video'] || { width: 280, height: 100 };
    g.setNode(node.id, { width: dim.width, height: dim.height });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    const dim = NODE_DIMENSIONS[(node.type as NodeType | 'skeletonVideo') ?? 'video'] || { width: 280, height: 100 };
    return {
      ...node,
      position: {
        x: pos.x - dim.width / 2,
        y: pos.y - dim.height / 2,
      },
    };
  });
}

// ---------- Node type registry ----------

const nodeTypes = {
  root: RootNode,
  category: ChapterNode,
  video: VideoNode,
  milestone: MilestoneNode,
  skeletonVideo: SkeletonVideoNode,
  note: NoteNode,
  concept: ConceptNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

// ---------- Props ----------

interface RoadmapCanvasProps {
  nodes: RoadmapNode[];
  edges: RoadmapEdge[];
  videos: Video[];
  topic: string;
  level: Level;
  status?: RoadmapStatus | 'revealing' | 'loading' | 'not_found';
  revealedCount?: number;
  skeletonRevealedCount?: number;
  slug: string;
}

// ---------- Component ----------

export default function RoadmapCanvas({
  nodes: roadmapNodes,
  edges: roadmapEdges,
  videos,
  topic,
  level,
  status,
  revealedCount = 0,
  skeletonRevealedCount = Infinity,
  slug,
}: RoadmapCanvasProps) {
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [progress, setProgress] = useState<Record<string, boolean>>(() =>
    getProgress(slug),
  );
  const [collapsedChapters, setCollapsedChapters] = useState<Set<string>>(
    new Set(),
  );

  const toggleComplete = useCallback((nodeId: string) => {
    setProgress((prev) => {
      const isCurrentlyDone = !!prev[nodeId];
      const updated = setNodeComplete(slug, nodeId, !isCurrentlyDone);
      return { ...updated };
    });
  }, [slug]);

  const videoMap = useMemo(() => {
    const map = new Map<string, Video>();
    for (const v of videos) {
      map.set(v.id, v);
      map.set(v.youtube_id, v);
    }
    return map;
  }, [videos]);

  const toggleCollapse = useCallback((chapterId: string) => {
    setCollapsedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  }, []);

  // Build the set of hidden node IDs (children of collapsed chapters)
  const hiddenNodeIds = useMemo(() => {
    const hidden = new Set<string>();
    const edgesBySource = new Map<string, string[]>();
    for (const e of roadmapEdges) {
      const list = edgesBySource.get(e.source) ?? [];
      list.push(e.target);
      edgesBySource.set(e.source, list);
    }

    // BFS: for each collapsed chapter, hide its descendants until we hit another category or root
    for (const chapterId of collapsedChapters) {
      const queue = edgesBySource.get(chapterId) ?? [];
      for (const childId of queue) {
        const childNode = roadmapNodes.find((n) => n.id === childId);
        if (!childNode) continue;
        // Don't collapse other chapters or root nodes, just videos and milestones under this chapter
        if (childNode.node_type === 'category' || childNode.node_type === 'root') continue;
        hidden.add(childId);
        const grandchildren = edgesBySource.get(childId) ?? [];
        for (const gc of grandchildren) {
          queue.push(gc);
        }
      }
    }
    return hidden;
  }, [collapsedChapters, roadmapEdges, roadmapNodes]);

  // Map to React Flow nodes
  const rfNodes = useMemo((): Node[] => {
    const totalMinutes =
      roadmapNodes.find((n) => n.node_type === 'root')?.metadata
        .total_duration_minutes ?? 0;
    const totalVideos =
      roadmapNodes.find((n) => n.node_type === 'root')?.metadata.total_videos ??
      videos.length;

    const videoNodes = roadmapNodes.filter(
      (n) => n.node_type === 'video' && !hiddenNodeIds.has(n.id),
    );

    // During tree_ready, progressively reveal nodes
    const visibleNodes = status === 'tree_ready'
      ? roadmapNodes.filter((n) => !hiddenNodeIds.has(n.id)).slice(0, skeletonRevealedCount)
      : roadmapNodes.filter((n) => !hiddenNodeIds.has(n.id));

    const baseNodes = visibleNodes
      .map((node): Node => {
        const base = {
          id: node.id,
          position: { x: node.position_x, y: node.position_y },
        };

        switch (node.node_type) {
          case 'root':
            return {
              ...base,
              type: 'root',
              data: {
                topic,
                level,
                videoCount: totalVideos,
                totalMinutes,
              },
            };
          case 'category': {
            const catProgress = getCategoryProgress(slug, node.id, roadmapNodes, roadmapEdges);
            return {
              ...base,
              type: 'category',
              data: {
                name: node.metadata.category_name ?? node.label,
                videoCount: node.metadata.video_count ?? 0,
                estimatedMinutes: node.metadata.estimated_minutes ?? 0,
                isCollapsed: collapsedChapters.has(node.id),
                onToggleCollapse: () => toggleCollapse(node.id),
                progress: catProgress,
              },
            };
          }
          case 'video': {
            const videoIndex = videoNodes.findIndex((vn) => vn.id === node.id);
            const isRevealed = status !== 'revealing' || videoIndex < revealedCount;

            if (!isRevealed) {
              return {
                ...base,
                type: 'skeletonVideo',
                data: {},
              };
            }

            const vid =
              videoMap.get(node.video_id ?? '') ??
              videoMap.get(node.metadata.youtube_id ?? '');
            
            const isComplete = !!progress[node.id];
            
            if (!vid) {
              const stub: Video = {
                id: node.video_id ?? node.id,
                youtube_id: node.metadata.youtube_id ?? '',
                title: node.label,
                channel_name: node.metadata.channel_name ?? '',
                channel_id: '',
                thumbnail_url: node.metadata.thumbnail_url ?? null,
                duration_seconds: node.metadata.duration_seconds ?? null,
                view_count: node.metadata.view_count ?? 0,
                description: node.description,
                tags: [],
                language: node.metadata.language as string ?? 'tr',
                published_at: null,
                fetched_at: new Date().toISOString(),
              };
              return {
                ...base,
                type: 'video',
                data: {
                  video: stub,
                  aiSummary: node.metadata.ai_summary,
                  onClick: () => setSelectedVideo(stub),
                  isComplete,
                  onToggleComplete: () => toggleComplete(node.id),
                },
              };
            }
            return {
              ...base,
              type: 'video',
              data: {
                video: vid,
                aiSummary: node.metadata.ai_summary,
                onClick: () => setSelectedVideo(vid),
                isComplete,
                onToggleComplete: () => toggleComplete(node.id),
                importance: node.metadata.importance,
              },
            };
          }
          case 'milestone': {
            const isComplete = !!progress[node.id];
            const originalType = node.metadata.original_type;

            if (originalType === 'note' || node.metadata.note_text) {
              return {
                ...base,
                type: 'note',
                data: {
                  label: node.label,
                  noteText: node.metadata.note_text as string,
                  importance: node.metadata.importance as any,
                },
              };
            }

            if (originalType === 'concept' || node.metadata.concept_url) {
              return {
                ...base,
                type: 'concept',
                data: {
                  label: node.label,
                  conceptUrl: node.metadata.concept_url as string,
                  importance: node.metadata.importance as any,
                },
              };
            }

            return {
              ...base,
              type: 'milestone',
              data: {
                label: node.metadata.milestone_label ?? node.label,
                nextChapter: node.metadata.next_chapter,
                status: status,
                isComplete,
                onToggleComplete: () => toggleComplete(node.id),
              },
            };
          }
          default:
            return {
              ...base,
              type: 'video',
              data: { video: null, onClick: () => {} },
            };
        }
      });

    if (status === 'tree_ready') {
      const skelNodes: Node[] = [];
      const milestones = roadmapNodes.filter((n) => n.node_type === 'milestone');
      for (const m of milestones) {
        if (hiddenNodeIds.has(m.id)) continue;
        skelNodes.push({
          id: `${m.id}-skel-1`,
          position: { x: m.position_x, y: m.position_y + 120 },
          type: 'skeletonVideo',
          data: {},
        });
        skelNodes.push({
          id: `${m.id}-skel-2`,
          position: { x: m.position_x, y: m.position_y + 220 },
          type: 'skeletonVideo',
          data: {},
        });
      }
      return [...baseNodes, ...skelNodes];
    }

    return baseNodes;
  }, [
    roadmapNodes,
    hiddenNodeIds,
    topic,
    level,
    videos.length,
    videoMap,
    collapsedChapters,
    toggleCollapse,
    status,
    progress,
    toggleComplete,
    roadmapEdges,
    slug,
    revealedCount,
    skeletonRevealedCount,
  ]);

  // Map to React Flow edges
  const rfEdges = useMemo((): Edge[] => {
    // Build set of node IDs that are actually in the graph
    const visibleNodeIds = new Set(rfNodes.map((n) => n.id));

    const baseEdges = roadmapEdges
      .filter((e) =>
        !hiddenNodeIds.has(e.source) &&
        !hiddenNodeIds.has(e.target) &&
        visibleNodeIds.has(e.source) &&
        visibleNodeIds.has(e.target)
      )
      .map((edge): Edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'custom',
        label: edge.label,
        data: { edgeType: edge.type },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
          color: edge.type === 'prerequisite' ? '#a8a29e' : '#d6d3d1',
        },
      }));

    if (status === 'tree_ready') {
      const milestones = roadmapNodes.filter((n) => n.node_type === 'milestone');
      const skelEdges: Edge[] = [];
      for (const m of milestones) {
        if (hiddenNodeIds.has(m.id)) continue;
        if (!visibleNodeIds.has(m.id)) continue;
        if (!visibleNodeIds.has(`${m.id}-skel-1`)) continue;
        skelEdges.push({
          id: `e-${m.id}-${m.id}-skel-1`,
          source: m.id,
          target: `${m.id}-skel-1`,
          type: 'custom',
          data: { edgeType: 'prerequisite' },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 16,
            height: 16,
            color: '#d6d3d1',
          },
        });
        if (visibleNodeIds.has(`${m.id}-skel-2`)) {
          skelEdges.push({
            id: `e-${m.id}-skel-1-skel-2`,
            source: `${m.id}-skel-1`,
            target: `${m.id}-skel-2`,
            type: 'custom',
            data: { edgeType: 'prerequisite' },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 16,
              height: 16,
              color: '#d6d3d1',
            },
          });
        }
      }
      return [...baseEdges, ...skelEdges];
    }

    return baseEdges;
  }, [roadmapEdges, hiddenNodeIds, status, roadmapNodes, rfNodes]);

  // Apply dagre layout
  const layoutedNodes = useMemo(() => {
    return layoutNodes(rfNodes, rfEdges);
  }, [rfNodes, rfEdges]);

  const selectedNode = useMemo(() => {
    if (!selectedVideo) return null;
    return roadmapNodes.find(
      (n) =>
        n.video_id === selectedVideo.id ||
        n.metadata.youtube_id === selectedVideo.youtube_id,
    );
  }, [selectedVideo, roadmapNodes]);

  // Related nodes for the selected video
  const relatedNodes = useMemo(() => {
    if (!selectedVideo) return [];
    const selectedNodeId = selectedNode?.id;
    if (!selectedNodeId) return [];

    const relatedIds = new Set<string>();
    for (const e of roadmapEdges) {
      if (e.source === selectedNodeId) relatedIds.add(e.target);
      if (e.target === selectedNodeId) relatedIds.add(e.source);
    }
    return roadmapNodes.filter(
      (n) => relatedIds.has(n.id) && n.node_type === 'video',
    );
  }, [selectedVideo, selectedNode, roadmapNodes, roadmapEdges]);

  return (
    <div className={styles.canvasWrap}>
      <ReactFlow
        nodes={layoutedNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d6d3d1" />
        <MiniMap
          nodeColor={(node) => {
            switch (node.type) {
              case 'root':
                return '#4d7c0f';
              case 'category':
                return '#ecfccb';
              case 'video':
                return '#ffffff';
              case 'milestone':
                return '#d6d3d1';
              default:
                return '#ffffff';
            }
          }}
          maskColor="rgba(247, 247, 243, 0.7)"
          style={{ borderRadius: 12 }}
        />
        <CanvasControls />
      </ReactFlow>
      <VideoPanel
        video={selectedVideo}
        onClose={() => setSelectedVideo(null)}
        relatedNodes={relatedNodes}
        aiSummary={selectedNode?.metadata?.ai_summary}
      />
      {/* SVG defs for arrowhead marker */}
      <svg className={styles.arrowDefs}>
        <defs>
          <marker
            id="arrowhead"
            markerWidth="16"
            markerHeight="16"
            refX="8"
            refY="4"
            orient="auto"
          >
            <path d="M 0 0 L 8 4 L 0 8 z" fill="#a8a29e" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}
