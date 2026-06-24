'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { MilestoneNodeData } from '@/types';
import styles from './MilestoneNode.module.css';

export default function MilestoneNode({ data }: NodeProps) {
  const { label, nextChapter } = data as unknown as MilestoneNodeData;

  return (
    <div className={styles.node}>
      <Handle type="target" position={Position.Top} />
      <div className={styles.label}>
        <span className={styles.emoji}>🏁</span>
        {label}
      </div>
      {nextChapter && (
        <div className={styles.next}>Sonraki: {nextChapter}</div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
