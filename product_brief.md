# Product Brief: YouTube Learning Roadmap (WatchPath)

## Problem
YouTube'da bir konu öğrenmek isteyen kişiler lineer video listesiyle karşılaşıyor.
Hangi videoyu önce izlemeli, hangi kanaldan, hangi sırayla ilerlemeli - belli değil.
"Tutorial hell"e düşüyorlar: sonsuz video, sıfır ilerleme hissi.

## Çözüm
Kullanıcı bir konu veya YouTube linki girer → AI birkaç soru sorar (seviye, alt konu, hedef) →
Birden fazla YouTube videosunu keşfedip aralarında yapısal bir **interaktif zihin haritası / roadmap** oluşturur.

## Hedef Kullanıcı
- Kendi kendine öğrenen öğrenciler (programlama, matematik, dil, sınav hazırlık)
- Bootcamp/kurs alternatifi arayan kişiler
- İlk pazar: Türkiye (Türkçe), sonra global

## Temel Farklar
1. **Multi-video roadmap**: Tek video özeti değil, birden fazla videoyu birbirine bağlayan graf
2. **Otomatik keşif**: Kullanıcı playlist getirmek zorunda değil, konu yeterli
3. **Önkoşul sıralaması**: AI hangi videonun önce izlenmesi gerektiğini belirler
4. **Çapraz kanal**: Farklı kanallardan en iyi videoları tek haritada birleştirir

## Kısıtlar
- Bütçe: $0 başlangıç (tüm free tier'lar)
- YouTube API: Günde 100 arama (10K kota)
- `relatedToVideoId` API'si kaldırılmış - kendi keşif motoru gerekli
- Platform: Sadece web (Next.js + React Flow), mobil PWA ile

## Başarı Metrikleri
- MVP'de 50+ kullanıcıdan feedback
- Günlük 10+ roadmap oluşturulması
- Kullanıcı geri dönüş oranı > %20

## Rakip Özeti
- Mapify (5M kullanıcı): Tek video mind map, multi-video yok
- LectureHall: Playlist reorder, keşif yok
- SabLearning: Playlist → kurs, ücretsiz, graf yok
- roadmap.sh (2.8M kullanıcı): Statik roadmap, YouTube entegrasyonu yok
- **Hiçbiri multi-video keşif + görsel roadmap yapmıyor**

## Tech Stack
- Frontend: Next.js 14+ (App Router)
- Görselleştirme: React Flow
- AI: Gemini API (free tier)
- Backend: Next.js API Routes
- Database: Supabase (PostgreSQL + Auth)
- Hosting: Vercel (free tier)
- Domain: watchpath.space (MVP) → watchpath.app veya watchpath.com (büyüme)
- Transkript: youtube-transcript kütüphanesi
