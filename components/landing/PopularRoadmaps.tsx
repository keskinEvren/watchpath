import Link from 'next/link';
import styles from './PopularRoadmaps.module.css';

const ROADMAPS = [
  {
    topic: 'React',
    slug: 'react-ogrenme-yolu',
    videoCount: 12,
    hours: 4,
  },
  {
    topic: 'Python',
    slug: 'python-ogrenme-yolu',
    videoCount: 15,
    hours: 6,
  },
  {
    topic: 'JavaScript',
    slug: 'javascript-ogrenme-yolu',
    videoCount: 14,
    hours: 5,
  },
  {
    topic: 'Next.js',
    slug: 'nextjs-ogrenme-yolu',
    videoCount: 10,
    hours: 3,
  },
  {
    topic: 'TypeScript',
    slug: 'typescript-ogrenme-yolu',
    videoCount: 11,
    hours: 4,
  },
  {
    topic: 'CSS',
    slug: 'css-ogrenme-yolu',
    videoCount: 13,
    hours: 5,
  },
];

export default function PopularRoadmaps() {
  return (
    <section className={styles.section} id="popular-roadmaps">
      <h2 className={styles.title}>Popüler Yol Haritaları</h2>
      <div className={styles.grid}>
        {ROADMAPS.map((roadmap) => (
          <Link
            href={`/r/${roadmap.slug}`}
            className={styles.card}
            key={roadmap.slug}
            id={`roadmap-card-${roadmap.slug}`}
          >
            <span className={styles.topicName}>{roadmap.topic}</span>
            <span className={styles.meta}>
              ~{roadmap.videoCount} video · ~{roadmap.hours} saat
            </span>
            <span className={styles.badge}>{roadmap.videoCount} video</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
