# WatchPath - Implementation Plan

## Hedef

YouTube videolarından interaktif öğrenme yol haritaları oluşturan web uygulaması. Kullanıcı konu + seviye seçer, uygulama YouTube'dan video bulur, AI ile yapılandırır, React Flow ile görsel roadmap sunar.

## Kesilmiş MVP Kapsamı

Review sonrası kesilmiş kapsam:

- **3 tablo**: `search_cache`, `videos`, `roadmaps` + `roadmap_nodes`
- **4 endpoint**: generate, roadmap/[slug], video/[youtubeId], ai/questions (statik)
- **3 ekran**: Landing page, Roadmap canvas, Video side panel
- **Auth yok**, **progress tracking yok**, **AI soru modalı yok** (v2)

---

## Proposed Changes

### Altyapı Kurulumu

#### [NEW] Next.js Projesi
- `npx create-next-app@latest` ile App Router projesi oluştur
- React Flow, Supabase client, Google Generative AI SDK, nanoid bağımlılıkları ekle

#### [NEW] Supabase Kurulumu
- Supabase projesi oluştur (free tier)
- 3+1 tablo migration'ı çalıştır (search_cache, videos, roadmaps, roadmap_nodes)
- RLS politikaları uygula

#### [NEW] `.env.local`
- YOUTUBE_API_KEY, GEMINI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

---

### Backend Servisleri

#### [NEW] `lib/youtube.ts`
- `searchVideos(query, language, maxResults)`: YouTube search.list wrapper
- `getVideoDetails(videoIds[])`: videos.list batch wrapper
- Cache-first: search_cache tablosundan bak, yoksa API çağır ve cache'le

#### [NEW] `lib/transcript.ts`
- `getTranscript(youtubeId)`: youtube-transcript kütüphanesi wrapper
- try/catch ile sarılmış, hata durumunda null dön
- Transkript in-memory işlenir, DB'ye yazılmaz

#### [NEW] `lib/gemini.ts`
- `generateRoadmapStructure(videos, topic, level)`: Gemini'ye video listesi gönder, roadmap yapısı al
- `generateSearchTerms(topic, level)`: Konudan 3-5 arama terimi türet
- 30sn timeout, JSON parse retry, fallback (view_count sıralama)

#### [NEW] `lib/roadmap-generator.ts`
- Ana pipeline: topic → search terms → YouTube search → transcript → Gemini → roadmap
- Async: roadmap status generating → ready | failed
- Tüm error handling burada

#### [NEW] `lib/supabase/server.ts` ve `lib/supabase/client.ts`
- Supabase client oluşturma

#### [NEW] `lib/cache.ts`
- search_cache CRUD
- Expired cache temizleme

#### [NEW] `lib/utils.ts`
- Slug oluşturma (slugify + nanoid)
- Süre formatlama
- YouTube URL parse

---

### API Endpoints

#### [NEW] `app/api/roadmap/generate/route.ts`
- POST: topic, level, language, youtubeUrl? alır
- Async polling: hemen slug döner, arka planda roadmap oluşturur
- Rate limit: IP başına günde 2 (anonim)
- Response: `{ slug, status: "generating" }`

#### [NEW] `app/api/roadmap/[slug]/route.ts`
- GET: slug ile roadmap getir
- status: generating → loading, ready → data, failed → error
- Her görüntülemede view_count++
- SSR için metadata döner

#### [NEW] `app/api/video/[youtubeId]/route.ts`
- GET: video detay (cache-first)

#### [NEW] `app/api/ai/questions/route.ts`
- POST: statik seviye seçenekleri döndür (Gemini çağırmaz)

---

### Frontend Bileşenleri

#### [NEW] `app/page.tsx` - Landing Page
- Hero section: başlık + açıklama
- Arama kutusu (konu veya YouTube URL)
- Seviye dropdown (Başlangıç / Orta / İleri)
- "Yol Haritası Oluştur" butonu
- Hardcode popüler roadmap kartları (5-6 adet)

#### [NEW] `app/r/[slug]/page.tsx` - Roadmap Sayfası
- SSR: meta taglar, OG image
- Status polling: generating → spinner, ready → canvas, failed → hata
- React Flow canvas
- Video side panel (node tıklama)
- URL kopyala butonu

#### [NEW] `components/roadmap/RoadmapCanvas.tsx`
- React Flow wrapper
- Custom node tipleri: RootNode, CategoryNode, VideoNode, MilestoneNode
- Zoom, pan, touch desteği

#### [NEW] `components/roadmap/VideoNode.tsx`
- Thumbnail, başlık, kanal, süre, izlenme
- Tıklanınca VideoPanel açılır

#### [NEW] `components/roadmap/CategoryNode.tsx`
- Kategori başlığı + ikon

#### [NEW] `components/roadmap/VideoPanel.tsx`
- Side panel: video detay
- YouTube'da İzle butonu
- AI özeti (varsa)

#### [NEW] `components/landing/SearchBar.tsx`
- Konu/URL giriş + seviye dropdown + submit

#### [NEW] `components/shared/LoadingOverlay.tsx`
- Roadmap oluşturulurken animasyonlu yükleme ekranı

#### [NEW] `app/globals.css`
- Design system: renkler, tipografi, spacing

#### [NEW] `app/layout.tsx`
- Root layout, fontlar (Inter), meta taglar

---

## Verification Plan

### Otomatik Testler
```bash
# Henüz test framework yok, v2'de eklenecek
# MVP doğrulaması manuel
```

### Manuel Doğrulama
| Test | Başarı Kriteri |
|------|----------------|
| "React" konusu gir, roadmap oluştur | 15sn içinde 10+ video ile roadmap |
| Roadmap node'una tıkla | Video panel açılsın, YouTube linki çalışsın |
| Slug ile roadmap paylaş | Başka tarayıcıda aynı roadmap açılsın |
| Mobil görünüm (375px) | Responsive, touch zoom/pan çalışsın |
| Rate limit (3. roadmap dene) | Hata mesajı göster |
| Gemini timeout simüle et | Fallback roadmap oluşsun |
| Altyazısız video ile dene | Metadata-only roadmap oluşsun |
| Lighthouse SEO testi | Skor > 90 |
