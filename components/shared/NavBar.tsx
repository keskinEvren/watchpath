import Link from 'next/link';
import styles from './NavBar.module.css';

export default function NavBar() {
  return (
    <nav className={styles.nav} id="navbar">
      <div className={styles.inner}>
        <Link href="/" className={styles.logo} id="nav-logo">
          WatchPath
        </Link>
      </div>
    </nav>
  );
}
