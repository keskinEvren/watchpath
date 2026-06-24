# WatchPath - Design System: Toprak Bahçe 🌿

> **Temel:** Granola editorial yapısı, farklılaştırılmış palet
> **Karakter:** Akdeniz bahçesinde ağaç gölgesinde ders çalışmak
> **Çift aksan:** Sage (yapısal) + Terracotta (içerik)

---

## Renkler

### Yüzeyler

| Token | Değer | Rol |
|-------|-------|-----|
| `--color-canvas` | `#f7f7f3` | Sayfa arkaplanı, sıcak krem. Asla saf beyaz kullanma |
| `--color-surface` | `#ffffff` | Kart yüzeyleri, panel arkaplanları |
| `--color-hover` | `#f0eeeb` | Hover dolgusu, subtle inset yüzeyler |

### Metin

| Token | Değer | Rol |
|-------|-------|-----|
| `--color-ink` | `#1c1917` | Birincil metin, başlıklar. Toprak siyahı |
| `--color-secondary` | `#57534e` | İkincil metin, kanal adları, açıklamalar |
| `--color-muted` | `#a8a29e` | Yardımcı metin, placeholder, metadata |

### Çizgiler

| Token | Değer | Rol |
|-------|-------|-----|
| `--color-border` | `#e7e5e4` | Hairline kart border, divider. Dominant yapısal çizgi |
| `--color-border-strong` | `#d6d3d1` | Buton border, input border |

### Sage (Yapısal Aksan)

| Token | Değer | Rol |
|-------|-------|-----|
| `--color-sage-cta` | `#4d7c0f` | Birincil CTA dolgusu, chapter text |
| `--color-sage-accent` | `#65a30d` | Dekoratif aksan, başarı state |
| `--color-sage-tint` | `#ecfccb` | Chapter node BG, badge/pill arkaplanı |
| `--color-sage-border` | `#84cc16` | Aksan border, focus ring |

### Terracotta (İçerik Aksan)

| Token | Değer | Rol |
|-------|-------|-----|
| `--color-terra` | `#c2410c` | Video node sol kenar, izlenme badge text |
| `--color-terra-tint` | `#fff7ed` | Video node hover tint |
| `--color-terra-border` | `#ea580c` | Terracotta border aksan |

### Utility

| Token | Değer | Rol |
|-------|-------|-----|
| `--color-link` | `#006fd6` | Inline text linkleri |
| `--color-error` | `#dc2626` | Hata mesajları |
| `--color-success` | `#16a34a` | Başarı mesajları |

### State

| Token | Değer | Rol |
|-------|-------|-----|
| `--color-disabled-bg` | `#f0eeeb` | Disabled buton/input arkaplanı |
| `--color-disabled-text` | `#a8a29e` | Disabled buton/input metni |
| `--color-skeleton` | `#e7e5e4` | Skeleton loading placeholder |
| `--color-skeleton-shine` | `#f0eeeb` | Skeleton pulse animasyonu peak rengi |

---

## Tipografi

### Font Aileleri

| Token | Font | Fallback | Rol |
|-------|------|----------|-----|
| `--font-display` | Playfair Display | Georgia, serif | Tüm display başlıklar ve hero text |
| `--font-ui` | DM Sans | system-ui, sans-serif | Tüm UI: nav, body, buton, label, kart |

### Type Scale

| Token | Size | Line Height | Letter Spacing | Font | Weight | Kullanım |
|-------|------|-------------|----------------|------|--------|----------|
| `--text-display` | 56px | 1.05 | -0.02em | Display | 400 | Hero başlık |
| `--text-heading-lg` | 36px | 1.2 | -0.015em | Display | 400 | Sayfa başlıkları |
| `--text-heading` | 24px | 1.3 | -0.01em | Display | 400 | Section başlıkları |
| `--text-heading-sm` | 20px | 1.3 | 0.01em | Display | 400 | Kart başlıkları |
| `--text-body-lg` | 18px | 1.5 | 0.01em | UI | 400 | Hero alt metin |
| `--text-body` | 15px | 1.5 | 0.01em | UI | 400 | Standart body |
| `--text-body-sm` | 14px | 1.5 | 0.01em | UI | 400 | Kart body |
| `--text-caption` | 13px | 1.3 | 0.01em | UI | 400 | Metadata, badge |
| `--text-label` | 12px | 1.3 | 0.02em | UI | 500 | Küçük etiketler |

### Kurallar
- Playfair Display **sadece** başlıklar için. Butonda, label'da, body'de kullanma
- DM Sans tracking her zaman `0.01em` (UI boyutlarında)
- Playfair Display tracking: negatif büyük boyutlarda (-0.02em), pozitif küçük boyutlarda (+0.01em)
- Weight 400 Playfair Display'de yeterli. 700 kullanma, editorial hissini bozar

---

## Spacing

**Base unit:** 4px

| Token | Değer |
|-------|-------|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-10` | 40px |
| `--space-12` | 48px |
| `--space-16` | 64px |
| `--space-24` | 96px |

### Layout

| Token | Değer |
|-------|-------|
| `--page-max-width` | 1200px |
| `--section-gap` | 64px |
| `--card-padding` | 24px |
| `--card-padding-compact` | 16px |
| `--element-gap` | 16px |

---

## Border Radius

| Eleman | Değer | Token |
|--------|-------|-------|
| Kartlar | 12px | `--radius-card` |
| Inputlar | 8px | `--radius-input` |
| Butonlar (pill) | 9999px | `--radius-pill` |
| Butonlar (rect) | 8px | `--radius-button` |
| Badge/Chip | 9999px | `--radius-badge` |
| Tooltip | 4px | `--radius-tooltip` |
| Thumbnail | 8px | `--radius-thumb` |
| Node (büyük) | 16px | `--radius-node-lg` |
| Node (normal) | 12px | `--radius-node` |

---

## Shadows

| Token | Değer | Kullanım |
|-------|-------|----------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.04)` | Default kart |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.06)` | Hover kart, video panel |
| `--shadow-lg` | `0 8px 32px rgba(0,0,0,0.08)` | Modal, floating panel |
| `--shadow-nav` | `0 0 24px rgba(0,0,0,0.03)` | Sticky nav |

Granola gibi flat-first. Shadow'lar çok hafif, sadece elevation hissi için.

---

## Bileşenler

### Nav Bar

```
BG: #ffffff, backdrop-filter: blur(16px)
Border-bottom: 0.5px solid #d6d3d1
Shadow: --shadow-nav
Height: 56px
Logo: sol, DM Sans 18px 600 #1c1917 "WatchPath"
Nav links: orta, DM Sans 15px 400 #57534e, 16px gap
CTA: sağ, sage CTA filled pill
```

### Primary CTA Button

```
BG: #4d7c0f (sage-cta)
Text: #ffffff
Font: DM Sans 15px 500
Radius: 9999px
Padding: 10px 24px
Hover: #3f6212
Transition: background 0.15s ease
```

### Secondary Button

```
BG: #ffffff
Text: #1c1917
Border: 1px solid #d6d3d1
Font: DM Sans 14px 400
Radius: 9999px
Padding: 8px 20px
Hover BG: #f0eeeb
```

### Ghost Button

```
BG: transparent
Text: #006fd6
Font: DM Sans 14px 400
Padding: 4px 8px
Hover: underline
```

### Input Field

```
BG: #ffffff
Border: 1px solid #d6d3d1
Radius: 8px
Padding: 12px 16px
Font: DM Sans 15px 400 #1c1917
Placeholder: #a8a29e
Focus border: #84cc16 (sage-border)
Focus shadow: 0 0 0 3px rgba(132, 204, 22, 0.15)
```

### Card (Landing Page)

```
BG: #ffffff
Border: 1px solid #e7e5e4
Radius: 12px
Padding: 24px
Shadow: --shadow-sm
Hover shadow: --shadow-md
Transition: box-shadow 0.15s ease
```

### Badge / Pill

```
BG: #ecfccb (sage-tint)
Text: #4d7c0f (sage-cta)
Font: DM Sans 13px 500
Radius: 9999px
Padding: 4px 12px
Border: none
```

### Toast / Notification

```
BG: #1c1917
Text: #ffffff
Font: DM Sans 14px 400
Radius: 8px
Padding: 12px 20px
Shadow: --shadow-lg
Position: bottom-center, 32px from bottom
Animation: slide-up 0.2s ease
Auto-dismiss: 3s
```

### Disabled Button

```
BG: #f0eeeb (disabled-bg)
Text: #a8a29e (disabled-text)
Border: 1px solid #e7e5e4
Cursor: not-allowed
Opacity: 1 (renğini kullan, opacity düşürme)
```

### Skeleton Loading

```
BG: #e7e5e4 (skeleton)
Radius: eşleşen elemanın radius'ü
Animation: pulse 1.5s ease-in-out infinite
Keyframes: #e7e5e4 → #f0eeeb → #e7e5e4
```

---

## Node Bileşenleri (React Flow)

### Root Node

```
BG: #ffffff
Border: 1px solid #e7e5e4
Border-left: 4px solid #4d7c0f (sage)
Radius: 16px
Padding: 24px 32px
Shadow: --shadow-sm
Başlık: Playfair Display 24px 400 #1c1917
Meta: DM Sans 14px 400 #a8a29e
```

### Chapter Node

```
BG: #ecfccb (sage-tint)
Border: 1px solid #d6d3d1
Radius: 12px
Padding: 16px 20px
Başlık: DM Sans 16px 600 #1c1917
Meta: DM Sans 13px 400 #57534e
Collapse toggle: ▼/▶ DM Sans 12px #a8a29e
Hover BG: #e2f5b5
```

### Video Node

```
BG: #ffffff
Border: 1px solid #e7e5e4
Border-left: 3px solid #ea580c (terra-border)
Radius: 12px
Padding: 12px
Shadow: --shadow-sm

Thumbnail: 120x68px, radius 8px, object-fit cover
  Duration overlay: BG rgba(0,0,0,0.75), text #fff, DM Sans 11px 500
  Position: bottom-right, 4px offset

Başlık: DM Sans 14px 500 #1c1917
Kanal: DM Sans 13px 400 #57534e
İzlenme: DM Sans 12px 400 #a8a29e

Hover: scale(1.02), shadow --shadow-md
Transition: transform 0.15s ease, box-shadow 0.15s ease
Selected: border-color #ea580c, shadow 0 0 0 3px rgba(234,88,12,0.15)
```

### Milestone Node

```
BG: transparent
Border: 1.5px dashed #d6d3d1
Radius: 9999px
Padding: 12px 24px
Text: DM Sans 14px 500 #4d7c0f
İcon: 🏁 16px
```

### Edge Stilleri

```
Prerequisite: stroke #a8a29e, strokeWidth 2, animated false, markerEnd arrow
Related: stroke #d6d3d1, strokeWidth 1, animated false, markerEnd arrow
Optional: stroke #d6d3d1, strokeWidth 1, strokeDasharray "6 4", markerEnd arrow

Label: DM Sans 11px 400, fill #a8a29e, BG #f7f7f3 (canvas)
```

---

## Renk Kodlama Kuralları

| Eleman | Sage Kullan | Terracotta Kullan | Nötr Kullan |
|--------|:----------:|:-----------------:|:-----------:|
| Root node border | ✅ | | |
| Chapter node BG | ✅ | | |
| Video node sol kenar | | ✅ | |
| Milestone text | ✅ | | |
| Edge çizgileri | | | ✅ |
| CTA butonları | ✅ | | |
| Seviye badge | ✅ | | |
| Süre badge | | | ✅ |
| İzlenme badge | | ✅ | |
| Canvas BG | | | ✅ |
| Input focus | ✅ | | |
| Link text | | | ✅ cobalt |
| Error state | | | ✅ red |

**Kural:** Sage = navigasyon ve yapı. Terracotta = video ve içerik. Asla birbirinin yerine kullanma.

---

## Animasyon Kuralları

| Tür | Süre | Easing | Not |
|-----|------|--------|-----|
| Hover (renk, border) | 0.15s | ease | Hızlı, anında tepki |
| Layout shift (panel, collapse) | 0.2s | ease-out | Smooth ama hızlı |
| Loading spinner | 1.2s | linear | Sürekli dönüş |
| Toast giriş | 0.2s | ease-out | Aşağıdan yukarı slide |
| Toast çıkış | 0.15s | ease-in | Fade out |
| Node scale (hover) | 0.15s | ease | Subtle, 1.02x |

**Yapma:** Scroll-triggered animasyon, giriş animasyonları, parallax. Tasarım statik ve belge-gibi. Hareket sadece state değişimlerinde.

---

## Responsive Breakpoints

| Token | Değer | Hedef |
|-------|-------|-------|
| `--bp-mobile` | 375px | Küçük telefon |
| `--bp-tablet` | 768px | Tablet / büyük telefon |
| `--bp-desktop` | 1024px | Laptop |
| `--bp-wide` | 1200px | Geniş ekran |

### Mobil Uyarlamalar
- Video Panel: full-width bottom sheet (slide-up)
- Nav: hamburger menu
- Canvas: pinch-to-zoom, tek kolon layout
- Hero başlık: 36px (56px yerine)
- Card grid: tek kolon

---

## CSS Custom Properties (Tam Liste)

```css
:root {
  /* Surfaces */
  --color-canvas: #f7f7f3;
  --color-surface: #ffffff;
  --color-hover: #f0eeeb;

  /* Text */
  --color-ink: #1c1917;
  --color-secondary: #57534e;
  --color-muted: #a8a29e;

  /* Borders */
  --color-border: #e7e5e4;
  --color-border-strong: #d6d3d1;

  /* Sage (structural) */
  --color-sage-cta: #4d7c0f;
  --color-sage-cta-hover: #3f6212;
  --color-sage-accent: #65a30d;
  --color-sage-tint: #ecfccb;
  --color-sage-border: #84cc16;

  /* Terracotta (content) */
  --color-terra: #c2410c;
  --color-terra-tint: #fff7ed;
  --color-terra-border: #ea580c;

  /* Utility */
  --color-link: #006fd6;
  --color-error: #dc2626;
  --color-success: #16a34a;

  /* State */
  --color-disabled-bg: #f0eeeb;
  --color-disabled-text: #a8a29e;
  --color-skeleton: #e7e5e4;
  --color-skeleton-shine: #f0eeeb;

  /* Typography */
  --font-display: 'Playfair Display', Georgia, 'Times New Roman', serif;
  --font-ui: 'DM Sans', system-ui, -apple-system, sans-serif;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-24: 96px;

  /* Layout */
  --page-max-width: 1200px;
  --section-gap: 64px;
  --card-padding: 24px;
  --element-gap: 16px;

  /* Radius */
  --radius-card: 12px;
  --radius-input: 8px;
  --radius-pill: 9999px;
  --radius-button: 8px;
  --radius-badge: 9999px;
  --radius-tooltip: 4px;
  --radius-thumb: 8px;
  --radius-node-lg: 16px;
  --radius-node: 12px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.08);
  --shadow-nav: 0 0 24px rgba(0, 0, 0, 0.03);
}
```
