'use client';

import { useState, useCallback, useRef } from 'react';
import styles from './Toast.module.css';

interface ToastState {
  message: string;
  id: number;
  exiting: boolean;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const id = Date.now();
    setToast({ message, id, exiting: false });

    timerRef.current = setTimeout(() => {
      setToast((prev) => (prev ? { ...prev, exiting: true } : null));

      setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, 150);
    }, 3000);
  }, []);

  function ToastComponent() {
    if (!toast) return null;

    const className = [styles.toast, toast.exiting ? styles.toastExiting : '']
      .filter(Boolean)
      .join(' ');

    return (
      <div className={className} id="toast" role="status" aria-live="polite">
        {toast.message}
      </div>
    );
  }

  return { showToast, ToastComponent };
}
