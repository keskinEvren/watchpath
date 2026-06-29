// ============================================================
// WatchPath - TypeScript Type Definitions
// Spec: spec.md, Component Architecture: component_architecture.md
// ============================================================

// ---- Database Models ----

export type RoadmapStatus = 'generating' | 'ready' | 'failed';
export type NodeType = 'root' | 'category' | 'video' | 'milestone' | 'series';
export type EdgeType = 'prerequisite' | 'related' | 'optional';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type BranchWeight = 'recommended' | 'optional' | 'neutral';
export type BloomLevel = 1 | 2 | 3 | 4 | 5;

export interface Video {
  id: string;
  youtube_id: string;
  title: string;
  channel_name: string;
  channel_id: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  view_count: number;
  description: string | null;
  tags: string[];
  language: string;
  published_at: string | null;
  fetched_at: string;
}

export interface SearchCache {
  id: string;
  query: string;
  language: string;
  max_results: number;
  results: YouTubeSearchResult[];
  created_at: string;
  expires_at: string;
}

export interface Roadmap {
  id: string;
  slug: string;
  topic: string;
  sub_topic: string | null;
  level: Level;
  user_goal: string | null;
  status: RoadmapStatus;
  video_count: number;
  view_count: number;
  edges_data: RoadmapEdge[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoadmapNode {
  id: string;
  roadmap_id: string;
  video_id: string | null;
  node_type: NodeType;
  label: string;
  description: string | null;
  position_x: number;
  position_y: number;
  order_index: number;
  metadata: NodeMetadata;
}

// ---- React Flow Types ----

export interface NodeMetadata {
  // Root node
  total_duration_minutes?: number;
  total_videos?: number;
  // Category/Chapter node
  category_name?: string;
  video_count?: number;
  estimated_minutes?: number;
  is_collapsed?: boolean;
  // Video node
  youtube_id?: string;
  channel_name?: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  view_count?: number;
  ai_summary?: string;
  // Milestone node
  milestone_label?: string;
  next_chapter?: string;
}

export interface RoadmapEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
}

// ---- API Request/Response Types ----

export interface GenerateRequest {
  topic: string;
  level: Level;
  language?: string;
  answers?: Record<string, string>; // interview answers
}

export interface GenerateResponse {
  slug: string;
  status: RoadmapStatus;
}

export interface RoadmapDetailResponse {
  roadmap: Roadmap;
  nodes: RoadmapNode[];
  videos: Video[];
}

export interface VideoDetailResponse {
  video: Video;
}

export interface ErrorResponse {
  error: string;
  code?: string;
}

// ---- Pipeline Types ----

export type PipelineStatus =
  | 'interviewing'
  | 'searching'
  | 'found_videos'
  | 'fetching_transcripts'
  | 'processing'
  | 'analyzing'
  | 'ready'
  | 'failed';

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  channelId: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
}

export interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
}

export interface GeminiSearchTermsResponse {
  terms: string[];
}

export interface GeminiRoadmapResponse {
  categories: {
    name: string;
    description: string;
    order: number;
  }[];
  nodes: {
    youtube_id: string;
    category: string;
    order: number;
    label: string;
    description: string;
    level: Level;
  }[];
  edges: {
    source_youtube_id: string;
    target_youtube_id: string;
    type: EdgeType;
    label?: string;
  }[];
  milestones: {
    after_category: string;
    label: string;
  }[];
  estimated_total_minutes: number;
}

// ---- Component Props ----

export interface RootNodeData {
  topic: string;
  level: Level;
  videoCount: number;
  totalMinutes: number;
}

export interface ChapterNodeData {
  name: string;
  videoCount: number;
  estimatedMinutes: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export interface VideoNodeData {
  video: Video;
  onClick: () => void;
}

export interface MilestoneNodeData {
  label: string;
  nextChapter?: string;
}

export interface SeriesNodeData {
  seriesName: string;
  channelName: string;
  episodeCount: number;
  totalMinutes: number;
  health: number;
  videos: Video[];
  isExpanded: boolean;
  onToggleExpand: () => void;
}

// ---- Interview Types ----

export interface InterviewQuestion {
  id: string;
  question: string;
  options: { value: string; label: string }[];
}

export interface InterviewResponse {
  questions: InterviewQuestion[];
}

export interface UserProfile {
  topic: string;
  level: number;           // 0-1 (0=sıfır, 1=ileri)
  goal: string;            // interview'dan gelen hedef
  weakness: string;        // interview'dan gelen zayıf alan
  answers: Record<string, string>;
}

// ---- Engine Types (v2 Processing Pipeline) ----

export interface ScoredVideo {
  video: Video;
  transcript: string | null;  // condensed transcript text
  qualityScore: number;       // 0-100
  bloomLevel: BloomLevel;     // 1-5
  keywords: string[];         // top extracted keywords
  seriesKey: string | null;   // channel:series_name if part of series
  episodeNumber: number | null;
}

export interface DetectedSeries {
  key: string;                // channel_id:series_name
  name: string;
  channelName: string;
  episodes: Map<number, ScoredVideo>;
  health: number;             // 0-1
  totalMinutes: number;
}

export interface VideoCluster {
  id: string;
  name: string;               // auto-generated or Gemini-named
  keywords: string[];          // top cluster keywords
  videos: ScoredVideo[];
  weight: BranchWeight;        // recommended / optional / neutral
}

export interface OrderedVideo extends ScoredVideo {
  orderIndex: number;
  prerequisiteIds: string[];   // youtube_ids this video depends on
}

export interface ProcessedRoadmap {
  clusters: VideoCluster[];
  series: DetectedSeries[];
  profile: UserProfile;
  totalVideos: number;
  totalMinutes: number;
}

// ---- Curriculum-First Types (v3) ----

export type CurriculumNodeType = 'category' | 'topic';
export type CurriculumImportance = 'required' | 'recommended' | 'optional';

export interface CurriculumNode {
  id: string;                          // "hooks-usestate"
  name: string;                        // "useState"
  description: string;                 // "React'te state yönetimi"
  parentId: string | null;             // null = root child, "hooks" = sub-node
  order: number;
  importance: CurriculumImportance;
  searchTerms: string[];               // YouTube search terms for this node
  nodeType: CurriculumNodeType;        // category = branch head, topic = leaf
}

export interface CurriculumTree {
  topic: string;
  nodes: CurriculumNode[];
  totalEstimatedHours: number;
}

export interface CurriculumNodeWithVideos extends CurriculumNode {
  videos: ScoredVideo[];               // best 1-3 matched videos
}

export interface ProcessedCurriculum {
  tree: CurriculumTree;
  nodesWithVideos: CurriculumNodeWithVideos[];
  profile: UserProfile;
  totalVideos: number;
  totalMinutes: number;
}

