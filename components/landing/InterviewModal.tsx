'use client';

import { useState } from 'react';
import type { InterviewQuestion } from '@/types';
import styles from './InterviewModal.module.css';

interface InterviewModalProps {
  topic: string;
  questions: InterviewQuestion[];
  onSubmit: (answers: Record<string, string>) => void;
  onCancel: () => void;
}

export default function InterviewModal({
  topic,
  questions,
  onSubmit,
  onCancel,
}: InterviewModalProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const allAnswered = questions.every((q) => answers[q.id] !== undefined);

  function handleSelect(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>&ldquo;{topic}&rdquo; için birkaç soru</h2>

        {questions.map((q) => (
          <div key={q.id} className={styles.questionGroup}>
            <p className={styles.questionLabel}>{q.question}</p>
            <ul className={styles.optionsList}>
              {q.options.map((opt) => {
                const isSelected = answers[q.id] === opt.value;
                return (
                  <li key={opt.value}>
                    <label
                      className={`${styles.option} ${isSelected ? styles.optionSelected : ''}`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={opt.value}
                        checked={isSelected}
                        onChange={() => handleSelect(q.id, opt.value)}
                        className={styles.optionRadio}
                      />
                      <span className={styles.optionLabel}>{opt.label}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onCancel}
          >
            İptal
          </button>
          <button
            type="button"
            className={styles.submitButton}
            disabled={!allAnswered}
            onClick={() => onSubmit(answers)}
          >
            Yol Haritamı Oluştur
          </button>
        </div>
      </div>
    </div>
  );
}
