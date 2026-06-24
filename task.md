# WatchPath - Task List

## ✅ Gün 1: Proje Kurulumu + Design System + Veritabanı

### Proje İskeleti
- [x] Next.js projesi oluştur (App Router, TypeScript)
- [x] Bağımlılıkları kur (@xyflow/react, @supabase/supabase-js, @google/generative-ai, nanoid, youtube-transcript, dagre, @types/dagre)
- [x] Google Fonts ekle (Playfair Display + DM Sans)

### Design System
- [x] app/globals.css: tüm CSS custom properties (design_system.md'den)
- [x] Base tipografi kuralları (Playfair Display başlıklar, DM Sans UI)
- [x] Responsive breakpoint'ler

### Veritabanı
- [x] Supabase projesi oluştur (free tier)
- [x] DB migration: search_cache, videos, roadmaps, roadmap_nodes
- [x] RLS politikaları uygula

### Yapılandırma
- [x] .env.local dosyası (API key'ler, Supabase URL'ler)
- [x] lib/supabase/server.ts ve client.ts (lazy init)
- [x] types/index.ts (tüm TypeScript tipleri)

## ✅ Gün 2: Backend Servisleri + Pipeline

### Servisler
- [x] lib/youtube.ts (searchVideos + getVideoDetails, cache-first)
- [x] lib/transcript.ts (getTranscript, try/catch, null fallback)
- [x] lib/gemini.ts (generateSearchTerms + generateRoadmapStructure, 30sn timeout, fallback)
- [x] lib/cache.ts (search_cache CRUD, expired temizleme)
- [x] lib/utils.ts (slug: slugify + nanoid, süre formatlama, YouTube URL parse)

### Pipeline
- [x] lib/roadmap-generator.ts (topic → terms → search → transcript → AI → roadmap)
- [x] Senkron generate + client polling mekanizması

### API Routes
- [x] app/api/roadmap/generate/route.ts (POST, rate limit, senkron pipeline)
- [x] app/api/roadmap/[slug]/route.ts (GET, view_count++)
- [x] app/api/video/[youtubeId]/route.ts (GET, cache-first)

## ✅ Gün 3: Frontend - Roadmap Canvas + Video Panel

### Node Bileşenleri
- [x] components/roadmap/RootNode.tsx (sage sol border, Playfair başlık, meta)
- [x] components/roadmap/ChapterNode.tsx (sage tint BG, collapse/expand toggle)
- [x] components/roadmap/VideoNode.tsx (terra sol kenar, thumbnail, hover scale)
- [x] components/roadmap/MilestoneNode.tsx (dashed pill, sage text)
- [x] components/roadmap/CustomEdge.tsx (prerequisite/related/optional stilleri)

### Canvas
- [x] components/roadmap/RoadmapCanvas.tsx (dagre auto-layout, TB yönü)
- [x] components/roadmap/CanvasControls.tsx (zoom +/-, fit-to-screen)
- [x] Minimap entegrasyonu (sağ alt)
- [x] Chapter collapse/expand mantığı (BFS)

### Video Panel
- [x] components/roadmap/VideoPanel.tsx (400px slide-in, desktop)
- [x] Mobil: full-width bottom sheet uyarlaması
- [x] Thumbnail, meta, özet, YouTube'da İzle CTA, bağlı node'lar

### Roadmap Sayfası
- [x] app/r/[slug]/page.tsx (SSR metadata)
- [x] app/r/[slug]/RoadmapPageClient.tsx (polling + canvas render)

## ✅ Gün 4: Landing Page + Shared

### Landing Page
- [x] components/landing/Hero.tsx (Playfair 56px başlık, DM Sans alt metin)
- [x] components/landing/SearchSection.tsx (TopicInput + LevelSelect + GenerateButton)
- [x] components/landing/HowItWorks.tsx (3 adım: gir, bekle, keşfet)
- [x] components/landing/PopularRoadmaps.tsx (hardcode 6 kart)
- [x] app/page.tsx (tüm landing bileşenlerini birleştir)

### Shared
- [x] components/shared/NavBar.tsx (sticky, blur backdrop)
- [x] components/shared/LoadingOverlay.tsx (polling status mesajları)
- [x] components/shared/ErrorState.tsx (hata + boş state)
- [x] components/shared/Toast.tsx (useToast hook, 3s auto-dismiss)
- [x] Rate limiting (IP bazlı, anonim 2/gün, in-memory)

---

## 🔲 Gün 5: Polish + Test + Deploy

### 🔴 Kritik
- [ ] Gemini retry mekanizması: 429 alınca retryDelay kadar bekle, tekrar dene (şu an fallback'e düşüyor)
- [ ] Error boundary (app genelinde)

### 🟡 Polish
- [ ] Responsive test (375px, 768px, 1024px)
- [ ] Design system tutarlılık kontrolü (renkler, fontlar, spacing)
- [ ] Gemini'li roadmap test (çoklu kategori, akıllı sıralama)
- [ ] Loading overlay'de adım adım status gösterimi test

### 🟢 Deploy
- [ ] Vercel'e deploy
- [ ] Domain bağlantısı (watchpath.space)
- [ ] 5-6 popüler konuyu ön-cache'le
- [ ] Lighthouse: SEO > 90, Performance > 80

### 📝 Bilinen Sorunlar
- Gemini free tier dakikada 15 istek limiti. Ardışık roadmap oluşturmada 429 hatası alınıyor, fallback (tek kategori, izlenme sıralı) devreye giriyor. Retry eklenince çözülecek.
