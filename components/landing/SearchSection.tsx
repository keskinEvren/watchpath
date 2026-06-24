'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Level } from '@/types';
import styles from './SearchSection.module.css';

export default function SearchSection() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState<Level>('beginner');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = topic.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/roadmap/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: trimmed, level }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (res.status === 429) {
          setError('Çok fazla istek gönderildi. Lütfen biraz bekleyin.');
        } else {
          setError(data?.error || 'Bir şeyler ters gitti. Tekrar deneyin.');
        }
        return;
      }

      const data = await res.json();
      router.push(`/r/${data.slug}`);
    } catch {
      setError('Bağlantı hatası. İnternet bağlantınızı kontrol edin.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={styles.section} id="search-section">
      <form className={styles.form} onSubmit={handleSubmit} id="search-form">
        <div className={styles.inputGroup}>
          <input
            className={`input ${styles.topicInput}`}
            type="text"
            placeholder="React, Python, İngilizce A2..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={loading}
            id="search-topic-input"
            aria-label="Konu"
          />
          <select
            className={styles.levelSelect}
            value={level}
            onChange={(e) => setLevel(e.target.value as Level)}
            disabled={loading}
            id="search-level-select"
            aria-label="Seviye"
          >
            <option value="beginner">Başlangıç</option>
            <option value="intermediate">Orta</option>
            <option value="advanced">İleri</option>
          </select>
        </div>
        <button
          className={`btn btn-primary ${styles.submitButton}`}
          type="submit"
          disabled={loading || !topic.trim()}
          id="search-submit-button"
        >
          {loading ? 'Oluşturuluyor...' : 'Yol Haritası Oluştur'}
        </button>
      </form>
      {error && (
        <p className={styles.error} id="search-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
