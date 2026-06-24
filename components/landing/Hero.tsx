import styles from './Hero.module.css';

export default function Hero() {
  return (
    <section className={styles.hero} id="hero">
      <h1 className={styles.headline}>YouTube&apos;dan öğrenme yolunu keşfet</h1>
      <p className={styles.subheadline}>
        Herhangi bir konu gir, AI ile yapılandırılmış interaktif öğrenme yol haritası oluştur.
      </p>
    </section>
  );
}
