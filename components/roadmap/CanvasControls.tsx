'use client';

import { useReactFlow } from '@xyflow/react';
import styles from './CanvasControls.module.css';

export default function CanvasControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div className={styles.controls}>
      <button
        className={styles.button}
        onClick={() => zoomIn()}
        aria-label="Yakınlaştır"
        title="Yakınlaştır"
      >
        +
      </button>
      <button
        className={styles.button}
        onClick={() => zoomOut()}
        aria-label="Uzaklaştır"
        title="Uzaklaştır"
      >
        −
      </button>
      <button
        className={styles.button}
        onClick={() => fitView({ padding: 0.15, duration: 200 })}
        aria-label="Sığdır"
        title="Ekrana sığdır"
      >
        ⊡
      </button>
    </div>
  );
}
