'use client';

import { useEffect, useCallback } from 'react';
import type { Video, RoadmapNode } from '@/types';
import styles from './VideoPanel.module.css';

interface VideoPanelProps {
  video: Video | null;
  onClose: () => void;
  relatedNodes?: RoadmapNode[];
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

export default function VideoPanel({ video, onClose, relatedNodes }: VideoPanelProps) {
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

              {/* AI Summary */}
              {video.description && (
                <div>
                  <div className={styles.summaryLabel}>Özet</div>
                  <p className={styles.summary}>{video.description}</p>
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
