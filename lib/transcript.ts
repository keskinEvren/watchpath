import { YoutubeTranscript } from 'youtube-transcript';
import type { TranscriptSegment } from '@/types';

/**
 * Fetch transcript for a YouTube video.
 * Returns null on any failure (no transcript available, language mismatch, etc).
 * Never throws.
 */
export async function getTranscript(
  videoId: string
): Promise<TranscriptSegment[] | null> {
  try {
    const raw = await YoutubeTranscript.fetchTranscript(videoId);

    if (!raw || raw.length === 0) return null;

    const segments: TranscriptSegment[] = raw.map((item) => ({
      text: item.text,
      offset: item.offset,
      duration: item.duration,
    }));

    return segments;
  } catch (err) {
    // Expected for many videos (disabled captions, live streams, etc).
    // This is normal, not an error worth escalating.
    console.log(
      `[transcript] No transcript for ${videoId}:`,
      err instanceof Error ? err.message : 'unknown error'
    );
    return null;
  }
}

/**
 * Get a condensed text-only version of the transcript.
 * Useful for passing to Gemini (cuts token count vs. full segments).
 */
export function condenseTranscript(
  segments: TranscriptSegment[],
  maxChars: number = 3000
): string {
  const fullText = segments.map((s) => s.text).join(' ');
  if (fullText.length <= maxChars) return fullText;
  return fullText.slice(0, maxChars) + '...';
}
