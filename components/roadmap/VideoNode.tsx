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
  const { video, onClick } = data as unknown as VideoNodeData;
  const thumb = video.thumbnail_url ?? `https://i.ytimg.com/vi/${video.youtube_id}/mqdefault.jpg`;

  return (
    <div className={styles.node} onClick={onClick}>
      <Handle type="target" position={Position.Top} />
      <div className={styles.content}>
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
          <p className={styles.title}>{video.title}</p>
          <span className={styles.channel}>{video.channel_name}</span>
          {video.view_count > 0 && (
            <span className={styles.views}>{formatViews(video.view_count)}</span>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
