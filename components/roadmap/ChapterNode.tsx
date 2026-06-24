'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ChapterNodeData } from '@/types';
import styles from './ChapterNode.module.css';

export default function ChapterNode({ data }: NodeProps) {
  const { name, videoCount, estimatedMinutes, isCollapsed, onToggleCollapse } =
    data as unknown as ChapterNodeData;

  const hours = Math.round(estimatedMinutes / 60);
  const timeLabel = estimatedMinutes >= 60 ? `~${hours} saat` : `~${estimatedMinutes} dk`;

  return (
    <div className={styles.node}>
      <Handle type="target" position={Position.Top} />
      <div className={styles.header}>
        <span className={styles.name}>{name}</span>
        <button
          className={styles.toggle}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
          aria-label={isCollapsed ? 'Genişlet' : 'Daralt'}
        >
          {isCollapsed ? '▶' : '▼'}
        </button>
      </div>
      <div className={styles.meta}>
        {videoCount} video · {timeLabel}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
