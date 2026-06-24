import styles from './ErrorState.module.css';

interface ErrorStateProps {
  type: 'error' | 'empty';
  title: string;
  message: string;
  onRetry?: () => void;
}

export default function ErrorState({ type, title, message, onRetry }: ErrorStateProps) {
  return (
    <div className={styles.wrapper} id={`${type}-state`}>
      <span className={type === 'error' ? styles.iconError : styles.iconEmpty} aria-hidden="true">
        {type === 'error' ? '⚠️' : '🔍'}
      </span>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.message}>{message}</p>
      {onRetry && (
        <button
          className={`btn ${type === 'error' ? 'btn-primary' : 'btn-secondary'} ${styles.retryButton}`}
          onClick={onRetry}
          id={`${type}-retry-button`}
        >
          Tekrar Dene
        </button>
      )}
    </div>
  );
}
