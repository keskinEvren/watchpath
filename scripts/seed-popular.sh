#!/bin/bash
# WatchPath - Popüler konuları ön-cache'le
# Kullanım: ./scripts/seed-popular.sh [BASE_URL]
# Örnek:   ./scripts/seed-popular.sh http://localhost:3000
#          ./scripts/seed-popular.sh https://watchpath.space

BASE_URL="${1:-http://localhost:3000}"
DELAY=45  # Gemini rate limit: her istek arası 45sn

TOPICS=(
  '{"topic": "React öğrenme", "level": "beginner"}'
  '{"topic": "Python programlama", "level": "beginner"}'
  '{"topic": "JavaScript temelleri", "level": "beginner"}'
  '{"topic": "Next.js öğrenme", "level": "intermediate"}'
  '{"topic": "TypeScript öğrenme", "level": "beginner"}'
  '{"topic": "CSS ve modern web tasarım", "level": "beginner"}'
)

echo "🌱 WatchPath Seed Script"
echo "   Base URL: $BASE_URL"
echo "   Toplam konu: ${#TOPICS[@]}"
echo "   İstek arası bekleme: ${DELAY}sn"
echo ""

for i in "${!TOPICS[@]}"; do
  TOPIC="${TOPICS[$i]}"
  NUM=$((i + 1))
  
  echo "[$NUM/${#TOPICS[@]}] Oluşturuluyor: $TOPIC"
  
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/roadmap/generate" \
    -H "Content-Type: application/json" \
    -d "$TOPIC")
  
  SLUG=$(echo "$RESPONSE" | grep -o '"slug":"[^"]*"' | cut -d'"' -f4)
  STATUS=$(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  ERROR=$(echo "$RESPONSE" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
  
  if [ -n "$SLUG" ]; then
    echo "   ✅ Slug: $SLUG (status: $STATUS)"
    echo "   🔗 $BASE_URL/r/$SLUG"
  else
    echo "   ❌ Hata: $ERROR"
  fi
  
  # Son istek değilse bekle
  if [ "$NUM" -lt "${#TOPICS[@]}" ]; then
    echo "   ⏳ ${DELAY}sn bekleniyor (Gemini rate limit)..."
    sleep $DELAY
  fi
  
  echo ""
done

echo "🎉 Seed tamamlandı!"
