import { nanoid } from 'nanoid';

/**
 * Slugify a string. Handles Turkish characters.
 * "React Başlangıç" → "react-baslangic"
 */
export function slugify(text: string): string {
  const turkishMap: Record<string, string> = {
    ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u',
    Ç: 'c', Ğ: 'g', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u',
  };

  return text
    .split('')
    .map((char) => turkishMap[char] || char)
    .join('')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

/**
 * Generate a unique slug: "react-baslangic-a8xK3m"
 */
export function generateSlug(topic: string): string {
  const base = slugify(topic);
  const id = nanoid(7);
  return `${base}-${id}`;
}

/**
 * Format seconds into "MM:SS" or "H:MM:SS".
 * 1470 → "24:30", 3661 → "1:01:01"
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Format total minutes into a human string.
 * 270 → "~4.5 saat"
 */
export function formatTotalDuration(minutes: number): string {
  if (minutes < 60) return `~${minutes} dk`;
  const hours = (minutes / 60).toFixed(1);
  return `~${hours} saat`;
}

/**
 * Extract YouTube video ID from various URL formats.
 * Returns null if no valid ID found.
 *
 * Handles:
 * - https://www.youtube.com/watch?v=dQw4w9WgXcQ
 * - https://youtu.be/dQw4w9WgXcQ
 * - https://www.youtube.com/embed/dQw4w9WgXcQ
 * - https://www.youtube.com/v/dQw4w9WgXcQ
 * - https://www.youtube.com/shorts/dQw4w9WgXcQ
 */
export function parseYouTubeUrl(url: string): string | null {
  if (!url) return null;

  const patterns = [
    /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}
