# WatchPath 🌿

YouTube videolarından interaktif öğrenme yol haritaları oluşturan web uygulaması.

## Ne Yapıyor?

1. Kullanıcı bir konu veya YouTube linki girer
2. Seviye seçer (Başlangıç / Orta / İleri)
3. AI YouTube'dan videoları bulur, analiz eder, yapılandırır
4. İnteraktif bir zihin haritası / roadmap oluşturur

## Tech Stack

- **Frontend**: Next.js 14+ (App Router, TypeScript)
- **Visualization**: React Flow (@xyflow/react) + dagre layout
- **AI**: Gemini API
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Vercel
- **Design**: Toprak Bahçe 🌿 (Sage + Terracotta)

## Dokümanlar

| Dosya | İçerik |
|-------|--------|
| [product_brief.md](./product_brief.md) | Ürün özeti, problem, hedef kullanıcı |
| [spec.md](./spec.md) | Teknik şartname (DB, API, pipeline) |
| [design_system.md](./design_system.md) | Toprak Bahçe renk, tipografi, bileşen tanımları |
| [component_architecture.md](./component_architecture.md) | Node tipleri, canvas deneyimi, component ağacı |
| [implementation_plan.md](./implementation_plan.md) | 5 günlük sprint planı |
| [task.md](./task.md) | Görev listesi (TODO) |

## Başlangıç

```bash
npm install
npm run dev
```

## Lisans

MIT
