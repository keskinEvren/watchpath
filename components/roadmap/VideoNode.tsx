'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { VideoNodeData } from '@/types';
import styles from './VideoNode.module.css';

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatViews(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M görüntülenme`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}B görüntülenme`;
  return `${count} görüntülenme`;
}

export default function VideoNode({ data }: NodeProps) {
  const { video, onClick, isComplete, onToggleComplete, aiSummary, importance } = data as any;
  const thumb = video.thumbnail_url ?? `https://i.ytimg.com/vi/${video.youtube_id}/mqdefault.jpg`;
  const importanceClass = importance ? styles[importance] : '';

  return (
    <div className={`${styles.node} ${isComplete ? styles.nodeCompleted : ''} ${importanceClass}`} onClick={onClick}>
      <Handle type="target" position={Position.Top} />
      <div className={styles.content}>
        <button
          className={`${styles.checkbox} ${isComplete ? styles.checkboxCompleted : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (onToggleComplete) onToggleComplete();
          }}
          aria-label="Tamamlandı olarak işaretle"
        >
          {isComplete && <span className={styles.checkIcon}>✓</span>}
        </button>
        <div className={styles.thumbnailWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.thumbnail}
            src={thumb}
            alt={video.title}
            loading="lazy"
          />
          {video.duration_seconds ? (
            <span className={styles.duration}>
              {formatDuration(video.duration_seconds)}
            </span>
          ) : null}
        </div>
        <div className={styles.info}>
          <p className={styles.title}>
            {video.language === 'en' && (
              <span className={styles.langBadge}>EN</span>
            )}
            {video.title}
          </p>
          
          <div className={styles.metaRow}>
            <span className={styles.channel}>{video.channel_name}</span>
            {importance && (
              <span className={`${styles.importanceBadge} ${styles[importance + 'Badge']}`}>
                {importance === 'required' ? 'Zorunlu' : importance === 'recommended' ? 'Önerilen' : 'Seçmeli'}
              </span>
            )}
          </div>

          {aiSummary && (
            <p className={styles.aiSummary}>
              <span className={styles.aiSparkle}>✨</span> {aiSummary}
            </p>
          )}
          {video.view_count > 0 && (
            <span className={styles.views}>{formatViews(video.view_count)}</span>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
