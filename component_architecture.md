# WatchPath - Component Mimarisi

> **Tema:** Toprak Bahçe 🌿
> **Layout:** Nehir Akışı (yukarıdan aşağıya, dagre auto-layout)

---

## Canvas Yaklaşımı

React Flow canvas "nehir akışı" layout kullanıyor. Yukarıdan aşağıya akan ağaç yapısı, chapter'lar dallanıyor. dagre layout engine ile otomatik yerleşim, kullanıcı node'ları sürükleyebilir.

```
         ┌─────────────┐
         │  🌱 ROOT    │
         └──────┬──────┘
                │
       ┌────────┼────────┐
       ▼                 ▼
 ┌───────────┐    ┌───────────┐
 │ 📖 CHAPTER│    │ 📖 CHAPTER│  ← Collapse/expand
 └─────┬─────┘    └─────┬─────┘
       │                 │
  ┌────┼────┐       ┌────┼────┐
  ▼    ▼    ▼       ▼         ▼
┌──┐ ┌──┐ ┌──┐   ┌──┐      ┌──┐
│🎬│ │🎬│ │🎬│   │🎬│      │🎬│  ← Video Node
└──┘ └──┘ └──┘   └──┘      └──┘
                    │
                    ▼
              ┌──────────┐
              │ 🏁 MILE  │  ← Milestone
              └──────────┘
```

---

## Node Tipleri (MVP)

### 1. 🌱 Root Node
- Roadmap giriş noktası
- Konu adı (Playfair Display 24px), seviye, video sayısı, tahmini süre
- Sage sol border (4px)
- Tıklama: roadmap metadata paneli

### 2. 📖 Chapter Node
- Video grubu / kategori
- Sage tint arkaplan (#ecfccb)
- Collapse/expand toggle (▼/▶)
- Video sayısı + tahmini süre
- Default: ilk chapter açık, diğerleri kapalı

### 3. 🎬 Video Node
- YouTube video kartı
- Thumbnail (120x68px) + süre overlay
- Başlık, kanal, izlenme
- Terracotta sol kenar (3px)
- Tıklama: Video Panel açılır
- Hover: scale(1.02) + shadow artışı

### 4. 🏁 Milestone Node
- Bölüm sonu işareti
- Dashed border, pill shape
- Sage text, tıklanamaz
- Sadece görsel işaret

---

## Node Tipleri (v2)

### 5. 🔀 Branch Node
- Dallanma noktası: "Nereye gitmek istersin?"
- İki veya daha fazla yol sunar

### 6. 📎 Resource Node
- Harici kaynak: döküman, blog, GitHub
- Compact boyut, dashed border

---

## Edge Tipleri

| Tip | Çizgi | Kalınlık | Anlamı |
|-----|-------|----------|--------|
| prerequisite | Düz | 2px, #a8a29e | Önce bunu izle |
| related | Düz | 1px, #d6d3d1 | İlgili içerik |
| optional | Kesik | 1px dashed, #d6d3d1 | İstersen bak |

---

## Canvas Özellikleri

| Özellik | MVP | Detay |
|---------|-----|-------|
| Auto-layout (dagre) | ✅ | TB yönünde otomatik yerleşim |
| Minimap | ✅ | Sağ alt, React Flow built-in |
| Zoom controls | ✅ | Sol alt: +, -, fit-to-screen |
| Chapter collapse | ✅ | Tıkla → altındaki node'lar gizlenir |
| Pan & zoom | ✅ | Mouse drag + scroll, mobilde pinch |
| Node drag | ✅ | Kullanıcı pozisyon değiştirebilir |
| Progress bar | ❌ v2 | Auth gerekli |

---

## Sayfa & Component Ağacı

```
app/
├── layout.tsx ─────────── RootLayout
│   └── NavBar
│       ├── Logo
│       └── NavLinks
│
├── page.tsx ───────────── LandingPage
│   ├── Hero
│   ├── SearchSection
│   │   ├── TopicInput
│   │   ├── LevelSelect
│   │   └── GenerateButton
│   ├── HowItWorks
│   └── PopularRoadmaps
│       └── RoadmapCard
│
├── r/[slug]/page.tsx ──── RoadmapPage (SSR)
│   ├── RoadmapHeader
│   ├── RoadmapCanvas
│   │   ├── RootNode
│   │   ├── ChapterNode
│   │   ├── VideoNode
│   │   ├── MilestoneNode
│   │   ├── CustomEdge
│   │   ├── CanvasControls
│   │   └── Minimap
│   ├── VideoPanel
│   │   ├── VideoThumbnail
│   │   ├── VideoMeta
│   │   ├── VideoSummary
│   │   ├── WatchOnYouTube
│   │   └── RelatedNodes
│   └── ShareButton
│
└── components/shared/
    ├── LoadingOverlay
    ├── ErrorState
    ├── EmptyState
    └── Toast
```

---

## Video Panel

Sağdan slide-in side panel. Canvas arkada görünüyor.

- **Desktop:** 400px genişlik, sağdan slide-in
- **Mobil:** full-width bottom sheet, slide-up
- **Animasyon:** 0.2s ease-out
- **Kapatma:** ✕ butonu veya canvas'a tıklama
- **İçerik:** Thumbnail, başlık, kanal, süre, izlenme, AI özet, YouTube'da İzle CTA, bağlı node'lar

---

## Loading Deneyimi

Generate 10-20sn sürer. Polling ile adım adım güncellenen durum mesajları:

| Status | Mesaj |
|--------|-------|
| `searching` | YouTube'da aranıyor... |
| `found_videos` | 12 video bulundu ✓ |
| `fetching_transcripts` | Transkriptler çekiliyor... |
| `analyzing` | AI yol haritasını yapılandırıyor... |
| `ready` | → Canvas'a yönlendir |
| `failed` | Hata + "Tekrar dene" butonu |

---

## Hata & Boş State'ler

### Empty State (Sonuç Bulunamadı)

YouTube'da hiç sonuç bulunamazsa veya Gemini roadmap oluştuamazsa:

- İkon: 🔍 (64px, muted renk)
- Başlık: "Bu konuda video bulamadık" (DM Sans 20px 500 ink)
- Alt metin: "Farklı bir konu veya daha genel bir terim deneyin" (DM Sans 15px 400 secondary)
- CTA: "Tekrar Dene" (secondary button)

### Error State (Hata)

Network hatası, API limiti aşıldı, beklenmeyen hata:

- İkon: ⚠️ (64px, terra renk)
- Başlık: "Bir şeyler ters gitti" (DM Sans 20px 500 ink)
- Alt metin: Hataya özel mesaj (DM Sans 15px 400 secondary)
- CTA: "Tekrar Dene" (primary button)
- Rate limit aşıldığında: inline hata mesajı, SearchSection altında gösterilir (toast değil)

---

## Generate Mekanizması

Backend **senkron** çalışır (Vercel serverless 60sn timeout yeterli). Client deneyimi **async hissettirir**:

```
1. Client POST /api/roadmap/generate → { topic, level }
2. Server slug oluşturur, DB'ye roadmap kaydı yazar (status: "generating")
3. Server slug'ı client'a döner → { slug }
4. Client /r/[slug] sayfasına redirect olur
5. /r/[slug] sayfası GET /api/roadmap/[slug] ile poll eder (2sn interval)
6. Backend pipeline tamamlanınca DB'de status → "ready" + node/edge data yazılır
7. Client status: "ready" görünce polling durur, canvas render eder
```

Pipeline sırası (senkron, tek request içinde):
- Supabase'e roadmap kaydı yaz (generating)
- Gemini'den search term'leri al
- YouTube'da ara (cache-first)
- Transkriptleri çek (try/catch, null OK)
- Gemini'ye videoları gönder, roadmap yapısı al
- Node'ları ve edge'leri DB'ye yaz
- Status → "ready"

**Timeout durumu:** 55sn'de hala bitmezse status → "failed", client'a hata göster.

---

## Renk Kodlama Kuralları

- **Sage** = yapısal, navigasyon (root, chapter, milestone, CTA, focus ring)
- **Terracotta** = içerik, video (video node kenar, izlenme, hover)
- Asla birbirinin yerine kullanma
- Nötr renkler edge'ler, divider'lar, body text için
