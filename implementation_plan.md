# WatchPath - Implementation Plan

## Hedef

YouTube videolarından interaktif öğrenme yol haritaları oluşturan web uygulaması. Kullanıcı konu + seviye seçer, uygulama YouTube'dan video bulur, AI ile yapılandırır, React Flow ile görsel roadmap sunar.

## Kesilmiş MVP Kapsamı (Autoplan Review Sonrası)

- **3+1 tablo**: `search_cache`, `videos`, `roadmaps`, `roadmap_nodes`
- **4 endpoint**: generate, roadmap/[slug], video/[youtubeId], ai/questions (statik)
- **3 ekran**: Landing page, Roadmap canvas, Video side panel
- **4 node tipi**: Root, Chapter, Video, Milestone
- **Tema**: Toprak Bahçe 🌿 (Sage + Terracotta)
- **Auth yok**, **progress tracking yok**, **AI soru modalı yok** (v2)

---

## Referans Dokümanlar

- [spec.md](./spec.md) - Teknik şartname (DB şeması, API endpoint'leri)
- [design_system.md](./design_system.md) - Toprak Bahçe renk, tipografi, bileşen tanımları
- [component_architecture.md](./component_architecture.md) - Node tipleri, canvas deneyimi, component ağacı

---

## Proposed Changes

### Gün 1: Altyapı Kurulumu

#### [NEW] Next.js Projesi
- `npx create-next-app@latest` ile App Router + TypeScript
- Bağımlılıklar: `@xyflow/react`, `@supabase/supabase-js`, `@google/generative-ai`, `nanoid`, `youtube-transcript`, `dagre`
- Google Fonts: Playfair Display + DM Sans

#### [NEW] Design System CSS
- `app/globals.css` içinde tüm CSS custom properties (`design_system.md`'den)
- Base reset ve tipografi kuralları
- Responsive breakpoint'ler

#### [NEW] Supabase Kurulumu
- Supabase projesi oluştur (free tier)
- 4 tablo migration'ı: `search_cache`, `videos`, `roadmaps`, `roadmap_nodes`
- `edges_data JSONB` kolonu roadmaps tablosunda
- RLS politikaları

#### [NEW] Proje yapılandırması
- `.env.local` (API key'ler)
- `lib/supabase/server.ts` ve `lib/supabase/client.ts`
- `types/index.ts` (tüm TypeScript tipleri)

---

### Gün 2: Backend Servisleri + Pipeline

#### [NEW] `lib/youtube.ts`
- `searchVideos()`: search.list wrapper, cache-first
- `getVideoDetails()`: videos.list batch wrapper

#### [NEW] `lib/transcript.ts`
- `getTranscript()`: youtube-transcript wrapper, try/catch, null fallback

#### [NEW] `lib/gemini.ts`
- `generateSearchTerms()`: konudan 3-5 arama terimi
- `generateRoadmapStructure()`: video listesinden roadmap yapısı
- 30sn timeout, JSON retry, fallback (view_count sıralama)

#### [NEW] `lib/roadmap-generator.ts`
- Ana pipeline: topic → terms → search → transcript → AI → roadmap
- Async status yönetimi (generating → ready | failed)
- Detaylı status: searching, found_videos, fetching_transcripts, analyzing

#### [NEW] `lib/cache.ts` + `lib/utils.ts`
- Cache CRUD, slug oluşturma (slugify + nanoid), süre formatlama

#### [NEW] API Routes
- `POST /api/roadmap/generate` (rate limit, async polling)
- `GET /api/roadmap/[slug]` (SSR metadata)
- `GET /api/video/[youtubeId]` (cache-first)

---

### Gün 3: Frontend - Roadmap Canvas

#### [NEW] React Flow Node Bileşenleri
- `components/roadmap/RootNode.tsx` - Sage sol border, konu + meta
- `components/roadmap/ChapterNode.tsx` - Sage tint BG, collapse/expand
- `components/roadmap/VideoNode.tsx` - Terracotta sol kenar, thumbnail
- `components/roadmap/MilestoneNode.tsx` - Dashed pill, sage text

#### [NEW] Canvas Wrapper
- `components/roadmap/RoadmapCanvas.tsx` - dagre auto-layout, minimap, zoom controls
- `components/roadmap/CustomEdge.tsx` - 3 edge tipi (prerequisite, related, optional)
- `components/roadmap/CanvasControls.tsx` - Zoom +/-, fit-to-screen

#### [NEW] Video Panel
- `components/roadmap/VideoPanel.tsx` - 400px slide-in side panel
- Thumbnail, meta, AI özet, YouTube'da İzle, bağlı node'lar
- Mobil: full-width bottom sheet

#### [NEW] Roadmap Sayfası
- `app/r/[slug]/page.tsx` - SSR, status polling, canvas + panel

---

### Gün 4: Landing Page + Polish

#### [NEW] Landing Page Bileşenleri
- `components/landing/Hero.tsx` - Playfair Display başlık + DM Sans alt metin
- `components/landing/SearchSection.tsx` - TopicInput + LevelSelect + GenerateButton
- `components/landing/HowItWorks.tsx` - 3 adım açıklama
- `components/landing/PopularRoadmaps.tsx` - Hardcode kart grid

#### [NEW] Shared Bileşenler
- `components/shared/LoadingOverlay.tsx` - Polling status mesajları
- `components/shared/ErrorState.tsx` - Hata gösterimi
- `components/shared/Toast.tsx` - Bildirim (link kopyalandı)
- `components/shared/NavBar.tsx` - Sticky nav, blur backdrop

#### [MOD] Rate limiting + hata yönetimi
- IP bazlı rate limit middleware
- Error boundary
- Responsive kontrol (375px, 768px, 1024px)

---

### Gün 5: Test + Deploy

#### Manuel test senaryoları
- "React" konusu ile roadmap oluştur → 15sn içinde 10+ video
- Node tıkla → Video panel açılsın
- Chapter collapse/expand çalışsın
- Slug ile paylaş → başka tarayıcıda aynı roadmap
- Rate limit test (3. roadmap dene → hata)
- Mobil responsive test (375px)
- Lighthouse SEO > 90

#### [NEW] Ön-cache + Deploy
- 5-6 popüler konuyu önceden aratıp cache'le
- Vercel'e deploy
- Domain bağlantısı (watchpath.space)

---

## Verification Plan

### Manuel Doğrulama

| Test | Başarı Kriteri |
|------|----------------|
| Roadmap generate | 15sn içinde 10+ video ile roadmap |
| Node tıklama | Video panel açılsın, YouTube linki çalışsın |
| Chapter collapse | Altındaki node'lar gizlensin/gösterilsin |
| Slug paylaşımı | Başka tarayıcıda aynı roadmap açılsın |
| Mobil (375px) | Responsive, pinch zoom çalışsın |
| Rate limit | 3. roadmap'te hata mesajı |
| Gemini timeout | Fallback roadmap oluşsun |
| Altyazısız video | Metadata-only roadmap çalışsın |
| Lighthouse SEO | Skor > 90 |
| Design system | Tüm renkler design_system.md ile tutarlı |
