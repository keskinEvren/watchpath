# WatchPath - Task List

## Gün 1: Proje Kurulumu + Veritabanı

- [ ] Next.js projesi oluştur (App Router, TypeScript)
- [ ] Bağımlılıkları kur (reactflow, @supabase/supabase-js, @google/generative-ai, nanoid, youtube-transcript)
- [ ] Supabase projesi oluştur (free tier)
- [ ] DB migration: search_cache tablosu
- [ ] DB migration: videos tablosu (youtube_id check gevşetilmiş)
- [ ] DB migration: roadmaps tablosu (edges_data JSONB eklendi)
- [ ] DB migration: roadmap_nodes tablosu (parent_node_id yok)
- [ ] RLS politikaları uygula
- [ ] .env.local dosyası oluştur (API key'ler)
- [ ] lib/supabase/server.ts ve client.ts oluştur
- [ ] types/index.ts - tüm TypeScript tipleri

## Gün 2: Backend Servisleri + Pipeline

- [ ] lib/youtube.ts - YouTube API wrapper (search + video details + cache)
- [ ] lib/transcript.ts - Transkript çekme (try/catch, null fallback)
- [ ] lib/gemini.ts - Gemini wrapper (search terms + roadmap structure + timeout + fallback)
- [ ] lib/cache.ts - search_cache CRUD
- [ ] lib/utils.ts - slug, süre, URL parse
- [ ] lib/roadmap-generator.ts - Ana pipeline (async, status yönetimi)
- [ ] app/api/roadmap/generate/route.ts - POST endpoint (rate limit dahil)
- [ ] app/api/roadmap/[slug]/route.ts - GET endpoint
- [ ] app/api/video/[youtubeId]/route.ts - GET endpoint (cache-first)

## Gün 3: Frontend - Roadmap Canvas

- [ ] app/globals.css - Design system (dark theme, renkler, tipografi)
- [ ] app/layout.tsx - Root layout, Inter font, meta
- [ ] components/roadmap/RoadmapCanvas.tsx - React Flow wrapper
- [ ] components/roadmap/VideoNode.tsx - Video custom node
- [ ] components/roadmap/CategoryNode.tsx - Kategori custom node
- [ ] components/roadmap/RootNode.tsx - Kök node
- [ ] components/roadmap/MilestoneNode.tsx - Milestone node
- [ ] components/roadmap/VideoPanel.tsx - Side panel (video detay + YouTube linki)
- [ ] app/r/[slug]/page.tsx - Roadmap sayfası (SSR + polling + canvas)

## Gün 4: Landing Page + Polish

- [ ] components/landing/SearchBar.tsx - Arama + seviye dropdown
- [ ] components/landing/Hero.tsx - Hero section
- [ ] components/landing/PopularRoadmaps.tsx - Hardcode kartlar
- [ ] app/page.tsx - Landing page
- [ ] components/shared/LoadingOverlay.tsx - Yükleme animasyonu
- [ ] Rate limiting middleware
- [ ] Hata yönetimi (error boundary, toast mesajları)
- [ ] Responsive tasarım kontrolü (375px, 768px, 1024px)

## Gün 5: Test + Deploy

- [ ] Manuel test: tüm akışlar
- [ ] Ön-cache: 5-6 popüler konuyu aratıp cache'le
- [ ] Vercel'e deploy
- [ ] Domain bağlantısı (watchpath.space)
- [ ] Lighthouse SEO/Performance kontrolü
