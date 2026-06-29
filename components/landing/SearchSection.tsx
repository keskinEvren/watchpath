'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { InterviewQuestion } from '@/types';
import InterviewModal from './InterviewModal';
import styles from './SearchSection.module.css';

export default function SearchSection() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Interview state
  const [showInterview, setShowInterview] = useState(false);
  const [interviewQuestions, setInterviewQuestions] = useState<InterviewQuestion[]>([]);
  const [interviewLoading, setInterviewLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = topic.trim();
    if (!trimmed) return;

    setInterviewLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: trimmed }),
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
      setInterviewQuestions(data.questions);
      setShowInterview(true);
    } catch {
      setError('Bağlantı hatası. İnternet bağlantınızı kontrol edin.');
    } finally {
      setInterviewLoading(false);
    }
  }

  async function handleInterviewSubmit(answers: Record<string, string>) {
    const trimmed = topic.trim();
    setShowInterview(false);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/roadmap/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: trimmed, level: 'beginner', answers }),
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

  function handleInterviewCancel() {
    setShowInterview(false);
    setInterviewQuestions([]);
  }

  const isDisabled = loading || interviewLoading || !topic.trim();

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
            disabled={loading || interviewLoading}
            id="search-topic-input"
            aria-label="Konu"
          />
        </div>
        <button
          className={`btn btn-primary ${styles.submitButton}`}
          type="submit"
          disabled={isDisabled}
          id="search-submit-button"
        >
          {interviewLoading
            ? 'Sorular hazırlanıyor...'
            : loading
              ? 'Oluşturuluyor...'
              : 'Başlayalım'}
        </button>
      </form>
      {error && (
        <p className={styles.error} id="search-error" role="alert">
          {error}
        </p>
      )}
      {showInterview && (
        <InterviewModal
          topic={topic.trim()}
          questions={interviewQuestions}
          onSubmit={handleInterviewSubmit}
          onCancel={handleInterviewCancel}
        />
      )}
    </section>
  );
}
