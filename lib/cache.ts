import { supabaseAdmin } from '@/lib/supabase/server';
import type { YouTubeSearchResult } from '@/types';

/**
 * Check cache for a previous YouTube search.
 * Returns null if not found or expired.
 */
export async function getCachedSearch(
  query: string,
  language: string
): Promise<YouTubeSearchResult[] | null> {
  const { data, error } = await supabaseAdmin
    .from('search_cache')
    .select('results, expires_at')
    .eq('query', query)
    .eq('language', language)
    .single();

  if (error || !data) return null;

  // Check if expired
  if (new Date(data.expires_at) < new Date()) {
    // Delete expired entry
    await supabaseAdmin
      .from('search_cache')
      .delete()
      .eq('query', query)
      .eq('language', language);
    return null;
  }

  return data.results as YouTubeSearchResult[];
}

/**
 * Upsert search results into cache with 7-day TTL.
 */
export async function setCachedSearch(
  query: string,
  language: string,
  results: YouTubeSearchResult[]
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { error } = await supabaseAdmin
    .from('search_cache')
    .upsert(
      {
        query,
        language,
        max_results: results.length,
        results,
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: 'query,language' }
    );

  if (error) {
    console.error('[cache] Failed to set search cache:', error.message);
  }
}

/**
 * Delete all expired cache entries.
 * Call this periodically or before heavy operations.
 */
export async function clearExpiredCache(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('search_cache')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id');

  if (error) {
    console.error('[cache] Failed to clear expired cache:', error.message);
    return 0;
  }

  return data?.length ?? 0;
}
