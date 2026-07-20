'use client';

import { Handle, Position } from '@xyflow/react';
import styles from './SkeletonVideoNode.module.css';

export default function SkeletonVideoNode() {
  return (
    <div className={styles.node}>
      <Handle type="target" position={Position.Top} />
      <div className={styles.content}>
        <div className={styles.checkbox} />
        <div className={styles.thumbnailWrap}>
          <div className={styles.shimmer} />
        </div>
        <div className={styles.info}>
          <div className={styles.titleLine}>
            <div className={styles.shimmer} />
          </div>
          <div className={styles.titleLineShort}>
            <div className={styles.shimmer} />
          </div>
          <div className={styles.channelLine}>
            <div className={styles.shimmer} />
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
