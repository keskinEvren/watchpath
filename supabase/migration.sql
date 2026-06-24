-- ============================================================
-- WatchPath - Supabase Migration
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Videos table (YouTube video cache)
CREATE TABLE IF NOT EXISTS videos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_id    TEXT UNIQUE NOT NULL,
  title         TEXT NOT NULL,
  channel_name  TEXT NOT NULL,
  channel_id    TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  view_count    BIGINT DEFAULT 0,
  description   TEXT,
  tags          TEXT[] DEFAULT '{}',
  language      TEXT DEFAULT 'tr',
  published_at  TIMESTAMPTZ,
  fetched_at    TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_youtube_id CHECK (char_length(youtube_id) >= 8 AND char_length(youtube_id) <= 20)
);

-- 2. Search cache table (7-day TTL)
CREATE TABLE IF NOT EXISTS search_cache (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query       TEXT NOT NULL,
  language    TEXT DEFAULT 'tr',
  max_results INTEGER DEFAULT 20,
  results     JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),

  UNIQUE(query, language)
);

CREATE INDEX IF NOT EXISTS idx_search_cache_query ON search_cache(query, language);
CREATE INDEX IF NOT EXISTS idx_search_cache_expires ON search_cache(expires_at);

-- 3. Roadmaps table
CREATE TYPE roadmap_status AS ENUM ('generating', 'ready', 'failed');

CREATE TABLE IF NOT EXISTS roadmaps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,
  topic         TEXT NOT NULL,
  sub_topic     TEXT,
  level         TEXT CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  status        roadmap_status DEFAULT 'generating',
  video_count   INTEGER DEFAULT 0,
  view_count    INTEGER DEFAULT 0,
  edges_data    JSONB DEFAULT '[]',
  is_public     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roadmaps_slug ON roadmaps(slug);
CREATE INDEX IF NOT EXISTS idx_roadmaps_topic ON roadmaps(topic);

-- 4. Roadmap nodes table
CREATE TYPE node_type AS ENUM ('root', 'category', 'video', 'milestone');

CREATE TABLE IF NOT EXISTS roadmap_nodes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id    UUID REFERENCES roadmaps(id) ON DELETE CASCADE,
  video_id      UUID REFERENCES videos(id) ON DELETE SET NULL,
  node_type     node_type NOT NULL,
  label         TEXT NOT NULL,
  description   TEXT,
  position_x    FLOAT NOT NULL,
  position_y    FLOAT NOT NULL,
  order_index   INTEGER NOT NULL,
  metadata      JSONB DEFAULT '{}',

  UNIQUE(roadmap_id, order_index)
);

CREATE INDEX IF NOT EXISTS idx_nodes_roadmap ON roadmap_nodes(roadmap_id);

-- 5. RLS policies
ALTER TABLE roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_cache ENABLE ROW LEVEL SECURITY;

-- Public read access for roadmaps
CREATE POLICY "Public roadmaps readable by all"
  ON roadmaps FOR SELECT
  USING (is_public = true);

-- Service role handles all writes (via API routes)
-- Allow service role full access to all tables
CREATE POLICY "Service role full access on roadmaps"
  ON roadmaps FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on roadmap_nodes"
  ON roadmap_nodes FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on videos"
  ON videos FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on search_cache"
  ON search_cache FOR ALL
  USING (auth.role() = 'service_role');

-- Public read for nodes (needed for roadmap detail page)
CREATE POLICY "Public nodes readable via roadmap"
  ON roadmap_nodes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM roadmaps
      WHERE roadmaps.id = roadmap_nodes.roadmap_id
      AND roadmaps.is_public = true
    )
  );

-- Public read for videos (referenced from nodes)
CREATE POLICY "Public videos readable"
  ON videos FOR SELECT
  USING (true);
