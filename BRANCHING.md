# WatchPath - Branching Stratejisi

## Model: GitHub Flow (Solo/Küçük Ekip)

Bu proje solo geliştirme yapıldığı için **GitHub Flow** kullanılır. GitFlow'daki `develop`, `release`, `hotfix` branch'leri gereksiz katman yaratır.

## Branch Yapısı

```
main (production - Vercel buradan deploy eder)
 ├── feature/auth        ← yeni özellik
 ├── feature/analytics   ← yeni özellik
 ├── fix/gemini-timeout  ← bug fix
 └── v0.1.0              ← tag (release)
```

## Kurallar

### `main` (tek kalıcı branch)
- Her zaman deploy edilebilir durumda
- Vercel otomatik deploy bu branch'ten çalışır
- Direkt push **sadece** tek dosya hotfix'leri için (typo, config)

### `feature/*` branch'leri
- Her yeni özellik için `main`'den açılır
- İsimlendirme: `feature/kisa-aciklama` (örn: `feature/auth`, `feature/playlist-import`)
- İş bitince PR açılır, review sonrası `main`'e merge

### `fix/*` branch'leri
- Bug fix'ler için `main`'den açılır
- İsimlendirme: `fix/kisa-aciklama` (örn: `fix/gemini-timeout`, `fix/mobile-scroll`)
- Acil fix ise direkt `main`'e push kabul edilebilir

### Tag'ler (Release)
- Her anlamlı milestone'da semantic version tag'i: `v0.1.0`, `v0.2.0`, `v1.0.0`
- `v0.1.0` = MVP (şu an)
- `v0.2.0` = Auth + kullanıcı profili
- `v1.0.0` = Public launch

## Örnek Workflow

```bash
# Yeni özellik başlat
git checkout main
git pull origin main
git checkout -b feature/user-auth

# Geliştir, commit'le
git add -A && git commit -m "feat: add Google OAuth login"

# Push ve PR aç
git push origin feature/user-auth
# GitHub'da PR aç → review → merge

# Merge sonrası temizle
git checkout main
git pull origin main
git branch -d feature/user-auth
```

## Mevcut Tag'ler

| Tag | Açıklama |
|-----|----------|
| `v0.1.0` | MVP: Pipeline, Canvas, Landing, Polish |
