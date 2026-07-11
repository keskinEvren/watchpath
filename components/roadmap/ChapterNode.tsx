'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ChapterNodeData } from '@/types';
import styles from './ChapterNode.module.css';

export default function ChapterNode({ data }: NodeProps) {
  const { name, videoCount, estimatedMinutes, isCollapsed, onToggleCollapse, progress } =
    data as any;

  const hours = Math.round(estimatedMinutes / 60);
  const timeLabel = estimatedMinutes >= 60 ? `~${hours} saat` : `~${estimatedMinutes} dk`;
  const displayProgress = progress ?? 0;

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
        {videoCount > 0 ? `${videoCount} video · ${timeLabel}` : 'Videolar aranıyor...'}
      </div>
      
      {/* Progress Bar UI */}
      <div className={styles.progressContainer}>
        <div className={styles.progressBar}>
          <div 
            className={styles.progressFill} 
            style={{ width: `${displayProgress}%` }} 
          />
        </div>
        <span className={styles.progressText}>%{displayProgress} tamamlandı</span>
      </div>
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
