import styles from './HowItWorks.module.css';

const STEPS = [
  {
    number: 1,
    icon: '🔎',
    title: 'Konunu Gir',
    description: 'Öğrenmek istediğin konuyu veya YouTube linkini gir',
  },
  {
    number: 2,
    icon: '✨',
    title: 'AI Analiz Etsin',
    description: 'AI videoları bulur, analiz eder, yapılandırır',
  },
  {
    number: 3,
    icon: '🗺️',
    title: 'Yolunu Keşfet',
    description: 'İnteraktif yol haritanla öğrenmeye başla',
  },
];

export default function HowItWorks() {
  return (
    <section className={styles.section} id="how-it-works">
      <h2 className={styles.title}>Nasıl Çalışır?</h2>
      <div className={styles.grid}>
        {STEPS.map((step) => (
          <div className={styles.card} key={step.number} id={`how-step-${step.number}`}>
            <div className={styles.stepNumber}>{step.number}</div>
            <span className={styles.stepIcon} aria-hidden="true">{step.icon}</span>
            <h3 className={styles.stepTitle}>{step.title}</h3>
            <p className={styles.stepDescription}>{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
