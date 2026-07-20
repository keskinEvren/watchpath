'use client';

import type { PipelineStatus } from '@/types';
import styles from './LoadingOverlay.module.css';

interface LoadingOverlayProps {
  status: PipelineStatus | 'generating';
}

const STEPS: { key: string; label: string }[] = [
  { key: 'generating', label: 'Yapay zeka müfredat planlıyor...' },
  { key: 'searching', label: "YouTube'da videolar aranıyor..." },
  { key: 'fetching_transcripts', label: 'Transkriptler analiz ediliyor...' },
  { key: 'analyzing', label: 'Yol haritası çiziliyor...' },
];

const ORDER: string[] = [
  'generating',
  'searching',
  'fetching_transcripts',
  'analyzing',
  'ready',
  'failed',
];

function getStepState(
  stepKey: string,
  currentStatus: string
): 'completed' | 'active' | 'pending' {
  const stepIndex = ORDER.indexOf(stepKey);
  const currentIndex = ORDER.indexOf(currentStatus);

  if (stepIndex < currentIndex) return 'completed';
  if (stepIndex === currentIndex) return 'active';
  return 'pending';
}

export default function LoadingOverlay({ status }: LoadingOverlayProps) {
  // If we poll and get 'loading', show 'generating' state
  const currentStatus = status === 'generating' ? 'generating' : status;

  return (
    <div className={styles.overlay} id="loading-overlay" role="alert" aria-busy="true">
      <div className={styles.content}>
        <span className={styles.icon} aria-hidden="true">🌱</span>
        <h2 className={styles.headline}>Yol haritanı oluşturuyoruz...</h2>

        <div className={styles.steps}>
          {STEPS.map((step) => {
            const state = getStepState(step.key, currentStatus);

            const stepClassName = [
              styles.step,
              state === 'completed' ? styles.stepCompleted : '',
              state === 'active' ? styles.stepActive : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <div className={stepClassName} key={step.key} id={`loading-step-${step.key}`}>
                <span className={styles.stepIcon}>
                  {state === 'completed' && <span className={styles.checkmark}>✓</span>}
                  {state === 'active' && <span className={styles.pulse} />}
                  {state === 'pending' && <span className={styles.pendingDot} />}
                </span>
                <span>{step.label}</span>
              </div>
            );
          })}
        </div>

        <p className={styles.footer}>Bu işlem 10-20 saniye sürebilir</p>
      </div>
    </div>
  );
}
