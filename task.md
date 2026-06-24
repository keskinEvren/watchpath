# WatchPath - Task List

## Gün 1: Proje Kurulumu + Design System + Veritabanı

### Proje İskeleti
- [ ] Next.js projesi oluştur (App Router, TypeScript)
- [ ] Bağımlılıkları kur (@xyflow/react, @supabase/supabase-js, @google/generative-ai, nanoid, youtube-transcript, dagre, @types/dagre)
- [ ] Google Fonts ekle (Playfair Display + DM Sans)

### Design System
- [ ] app/globals.css: tüm CSS custom properties (design_system.md'den)
- [ ] Base tipografi kuralları (Playfair Display başlıklar, DM Sans UI)
- [ ] Responsive breakpoint'ler

### Veritabanı
- [ ] Supabase projesi oluştur (free tier)
- [ ] DB migration: search_cache tablosu (7 gün TTL)
- [ ] DB migration: videos tablosu (youtube_id check gevşetilmiş 8-20 char)
- [ ] DB migration: roadmaps tablosu (edges_data JSONB dahil)
- [ ] DB migration: roadmap_nodes tablosu (parent_node_id yok)
- [ ] RLS politikaları uygula

### Yapılandırma
- [ ] .env.local dosyası (API key'ler, Supabase URL'ler)
- [ ] lib/supabase/server.ts ve client.ts
- [ ] types/index.ts (tüm TypeScript tipleri: node, edge, roadmap, video)

## Gün 2: Backend Servisleri + Pipeline

### Servisler
- [ ] lib/youtube.ts (searchVideos + getVideoDetails, cache-first)
- [ ] lib/transcript.ts (getTranscript, try/catch, null fallback)
- [ ] lib/gemini.ts (generateSearchTerms + generateRoadmapStructure, 30sn timeout, retry, fallback)
- [ ] lib/cache.ts (search_cache CRUD, expired temizleme)
- [ ] lib/utils.ts (slug: slugify + nanoid, süre formatlama, YouTube URL parse)

### Pipeline
- [ ] lib/roadmap-generator.ts (topic → terms → search → transcript → AI → roadmap)
- [ ] Async status yönetimi (searching → found_videos → fetching_transcripts → analyzing → ready/failed)

### API Routes
- [ ] app/api/roadmap/generate/route.ts (POST, rate limit, async polling)
- [ ] app/api/roadmap/[slug]/route.ts (GET, SSR metadata, view_count++)
- [ ] app/api/video/[youtubeId]/route.ts (GET, cache-first)

## Gün 3: Frontend - Roadmap Canvas + Video Panel

### Node Bileşenleri
- [ ] components/roadmap/RootNode.tsx (sage sol border, Playfair başlık, meta)
- [ ] components/roadmap/ChapterNode.tsx (sage tint BG, collapse/expand toggle)
- [ ] components/roadmap/VideoNode.tsx (terra sol kenar, thumbnail, hover scale)
- [ ] components/roadmap/MilestoneNode.tsx (dashed pill, sage text)
- [ ] components/roadmap/CustomEdge.tsx (prerequisite/related/optional stilleri)

### Canvas
- [ ] components/roadmap/RoadmapCanvas.tsx (dagre auto-layout, TB yönü)
- [ ] components/roadmap/CanvasControls.tsx (zoom +/-, fit-to-screen)
- [ ] Minimap entegrasyonu (sağ alt)
- [ ] Chapter collapse/expand mantığı

### Video Panel
- [ ] components/roadmap/VideoPanel.tsx (400px slide-in, desktop)
- [ ] Mobil: full-width bottom sheet uyarlaması
- [ ] VideoThumbnail, VideoMeta, VideoSummary, WatchOnYouTube, RelatedNodes

### Roadmap Sayfası
- [ ] app/r/[slug]/page.tsx (SSR metadata, status polling, canvas + panel)

## Gün 4: Landing Page + Shared + Polish

### Landing Page
- [ ] components/landing/Hero.tsx (Playfair 56px başlık, DM Sans alt metin)
- [ ] components/landing/SearchSection.tsx (TopicInput + LevelSelect + GenerateButton)
- [ ] components/landing/HowItWorks.tsx (3 adım: gir, bekle, keşfet)
- [ ] components/landing/PopularRoadmaps.tsx (hardcode 5-6 kart)
- [ ] app/page.tsx (tüm landing bileşenlerini birleştir)

### Shared
- [ ] components/shared/NavBar.tsx (sticky, blur backdrop, design system'e uygun)
- [ ] components/shared/LoadingOverlay.tsx (polling status mesajları, progress bar)
- [ ] components/shared/ErrorState.tsx (hata gösterimi + tekrar dene)
- [ ] components/shared/Toast.tsx (link kopyalandı bildirimi)

### Polish
- [ ] Rate limiting middleware (IP bazlı, anonim 2/gün)
- [ ] Error boundary
- [ ] Responsive kontrol (375px, 768px, 1024px)
- [ ] Design system tutarlılık kontrolü (tüm renkler, fontlar, spacing)

## Gün 5: Test + Deploy

### Manuel Test
- [ ] "React" konusu → roadmap oluştur (15sn içinde, 10+ video)
- [ ] Node tıkla → Video panel açılsın
- [ ] Chapter collapse/expand çalışsın
- [ ] Slug paylaşımı → başka tarayıcıda aynı roadmap
- [ ] Mobil responsive (375px, pinch zoom)
- [ ] Rate limit test (3. roadmap → hata)
- [ ] Gemini timeout → fallback roadmap
- [ ] Altyazısız video → metadata-only roadmap

### Deploy
- [ ] 5-6 popüler konuyu ön-cache'le
- [ ] Vercel'e deploy
- [ ] Domain bağlantısı (watchpath.space)
- [ ] Lighthouse: SEO > 90, Performance > 80
