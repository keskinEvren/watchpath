'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { RootNodeData } from '@/types';
import styles from './RootNode.module.css';

const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Başlangıç',
  intermediate: 'Orta',
  advanced: 'İleri',
};

export default function RootNode({ data }: NodeProps) {
  const { topic, level, videoCount, totalMinutes } = data as unknown as RootNodeData;
  const hours = Math.round(totalMinutes / 60);

  return (
    <div className={styles.node}>
      <h3 className={styles.topic}>{topic}</h3>
      <div className={styles.meta}>
        <span className={styles.levelBadge}>
          {LEVEL_LABELS[level] ?? level}
        </span>
        <span className={styles.stats}>
          {videoCount} video · ~{hours} saat
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
