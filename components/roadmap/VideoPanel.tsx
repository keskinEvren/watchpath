'use client';

import { useEffect, useCallback } from 'react';
import type { Video, RoadmapNode } from '@/types';
import styles from './VideoPanel.module.css';

interface VideoPanelProps {
  video: Video | null;
  onClose: () => void;
  relatedNodes?: RoadmapNode[];
  aiSummary?: string;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h} sa ${m} dk`;
  return `${m} dk ${s} sn`;
}

function formatViews(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M görüntülenme`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}B görüntülenme`;
  return `${count} görüntülenme`;
}

function cleanYoutubeDescription(desc: string): string {
  if (!desc) return '';
  const lines = desc.split('\n');
  const cleanedLines: string[] = [];

  for (const line of lines) {
    const lowerLine = line.toLowerCase().trim();
    if (
      lowerLine.includes('http://') ||
      lowerLine.includes('https://') ||
      lowerLine.includes('www.') ||
      lowerLine.includes('discord') ||
      lowerLine.includes('telegram') ||
      lowerLine.includes('instagram') ||
      lowerLine.includes('twitter') ||
      lowerLine.includes('facebook') ||
      lowerLine.includes('abone') ||
      lowerLine.includes('katıl') ||
      lowerLine.includes('patreon') ||
      lowerLine.includes('turan') || // Specific creator junk
      lowerLine.startsWith('**') ||
      lowerLine.includes('sosyal medya') ||
      lowerLine.includes('udemy') ||
      lowerLine.includes('sponsor') ||
      lowerLine.includes('kodlar') ||
      lowerLine.includes('github.com')
    ) {
      continue;
    }
    if (line.trim().length > 0) {
      cleanedLines.push(line.trim());
    }
  }

  const result = cleanedLines.slice(0, 4).join('\n');
  return result.length > 0 ? result : 'Video hakkında detaylı açıklama bulunmuyor.';
}

export default function VideoPanel({ video, onClose, relatedNodes, aiSummary }: VideoPanelProps) {
  const isOpen = video !== null;

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, handleEscape]);

  // Clean description
  const displayDescription = video ? cleanYoutubeDescription(video.description || '') : '';

  return (
    <div className={styles.overlay} data-open={isOpen}>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.panel} role="dialog" aria-label="Video detayı">
        {video && (
          <>
            <div className={styles.header}>
              <button
                className={styles.closeBtn}
                onClick={onClose}
                aria-label="Kapat"
              >
                ✕
              </button>
            </div>
            <div className={styles.body}>
              {/* Thumbnail */}
              <div className={styles.thumbnailWrap}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className={styles.thumbnailImg}
                  src={
                    video.thumbnail_url ??
                    `https://i.ytimg.com/vi/${video.youtube_id}/hqdefault.jpg`
                  }
                  alt={video.title}
                />
              </div>

              {/* Title + channel */}
              <h2 className={styles.title}>{video.title}</h2>
              <span className={styles.channelName}>{video.channel_name}</span>

              {/* Meta badges */}
              <div className={styles.metaRow}>
                {video.duration_seconds && (
                  <span className={`${styles.badge} ${styles.badgeDuration}`}>
                    {formatDuration(video.duration_seconds)}
                  </span>
                )}
                {video.view_count > 0 && (
                  <span className={`${styles.badge} ${styles.badgeViews}`}>
                    {formatViews(video.view_count)}
                  </span>
                )}
              </div>

              {/* AI Summary (Why Watch This?) */}
              {aiSummary && (
                <div className={styles.aiSummaryBox}>
                  <div className={styles.aiSummaryLabel}>
                    <span className={styles.aiSparkle}>✨</span> Neden bu video?
                  </div>
                  <p className={styles.aiSummaryText}>{aiSummary}</p>
                </div>
              )}

              {/* YouTube Description */}
              {displayDescription && (
                <div>
                  <div className={styles.summaryLabel}>Video Özeti</div>
                  <p className={styles.summary}>{displayDescription}</p>
                </div>
              )}

              {/* YouTube CTA */}
              <a
                className={styles.ctaLink}
                href={`https://youtube.com/watch?v=${video.youtube_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                YouTube&apos;da İzle
              </a>

              {/* Related nodes */}
              {relatedNodes && relatedNodes.length > 0 && (
                <div className={styles.relatedSection}>
                  <div className={styles.relatedTitle}>İlgili İçerikler</div>
                  <ul className={styles.relatedList}>
                    {relatedNodes.map((node) => (
                      <li key={node.id} className={styles.relatedItem}>
                        {node.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
