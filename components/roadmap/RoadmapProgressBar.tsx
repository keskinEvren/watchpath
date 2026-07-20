'use client';

import type { RoadmapStatus } from '@/types';
import styles from './RoadmapProgressBar.module.css';

interface RoadmapProgressBarProps {
  status: RoadmapStatus | 'loading' | 'not_found' | 'revealing';
  revealedCount?: number;
  totalVideos?: number;
}

export default function RoadmapProgressBar({
  status,
  revealedCount = 0,
  totalVideos = 0,
}: RoadmapProgressBarProps) {
  if (status === 'ready' || status === 'failed' || status === 'not_found') {
    return null;
  }

  let progress = 0;
  let text = '';

  if (status === 'generating') {
    progress = 35;
    text = 'Yapay zeka profilinize uygun müfredat planını hazırlıyor...';
  } else if (status === 'tree_ready') {
    progress = 75;
    text = 'YouTube eğitim videoları taranıyor ve yapay zeka ile eşleştiriliyor...';
  } else if (status === 'revealing') {
    const ratio = totalVideos > 0 ? revealedCount / totalVideos : 0;
    progress = 75 + ratio * 25;
    text = `Videolar haritaya yerleştiriliyor... (${revealedCount}/${totalVideos})`;
  }

  return (
    <div className={styles.barWrap}>
      <div className={styles.progressContainer}>
        <div className={styles.progressBar} style={{ width: `${progress}%` }} />
      </div>
      <div className={styles.statusText}>
        <span className={styles.spinner} />
        {text}
      </div>
    </div>
  );
}
