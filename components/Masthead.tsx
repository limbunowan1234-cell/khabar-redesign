'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from './Masthead.module.css';

interface MastheadProps {
  isMobile: boolean;
  isDarkMode: boolean;
  onToggleDark: () => void;
  searchQuery: string;
  onSearch: (value: string) => void;
  loggedIn: boolean;
  userMenu: React.ReactNode;
  bell: React.ReactNode;
  onOpenMenu: () => void;
}

function useToday(): string {
  // Filled in after mount: the server and the visitor's browser can disagree
  // about "today" near midnight, which would trip a hydration warning.
  const [today, setToday] = useState('');
  useEffect(() => {
    setToday(new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  }, []);
  return today;
}

export default function Masthead({ isMobile, isDarkMode, onToggleDark, searchQuery, onSearch, loggedIn, userMenu, bell, onOpenMenu }: MastheadProps) {
  const today = useToday();

  if (isMobile) {
    return (
      <header className={styles.mobile}>
        <div className={styles.mobileInner}>
          <Link href="/" className={styles.mobileBrand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/logo.png" alt="" className={styles.mobileLogo} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <span>
              <span className={styles.mobileWordmark}>Khabar Darjeeling</span>
              <span className={styles.mobileTag}>Hamro Khabar, Hami Lekhaw</span>
            </span>
          </Link>
          <div className={styles.mobileActions}>
            {bell}
            <button className={styles.iconBtn} onClick={onToggleDark} aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}>{isDarkMode ? '☀' : '☾'}</button>
            <button className={styles.iconBtn} onClick={onOpenMenu} aria-label="Open menu">&#9776;</button>
          </div>
        </div>
        {today && <div className={styles.mobileDate}>{today}</div>}
      </header>
    );
  }

  return (
    <header className={styles.root}>
      <div className={styles.utility}>
        <div className={styles.utilityInner}>
          <span className={styles.date}>{today || ' '}</span>
          <nav className={styles.utilityLinks} aria-label="Sections">
            <Link href="/weekly" className={styles.utilityLink}>Weekly Edition</Link>
            <Link href="/daily-updates" className={styles.utilityLink}>Daily Updates</Link>
            <Link href="/patro" className={styles.utilityLink}>Patro</Link>
            <Link href="/hills-in-frame" className={styles.utilityLink}>Photos</Link>
            <Link href="/nepali-bhasa-diwas" className={`${styles.utilityLink} ${styles.hideMd}`}>Bhasa Diwas</Link>
            <Link href="/apps" className={styles.utilityLink}>Apps &amp; Games</Link>
          </nav>
          <div className={styles.utilityRight}>
            {loggedIn ? (
              <>
                {bell}
                {userMenu}
              </>
            ) : (
              <Link href="/auth" className={styles.loginLink}>Log in</Link>
            )}
            <button className={styles.themeBtn} onClick={onToggleDark} aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'} title={isDarkMode ? 'Light mode' : 'Dark mode'}>{isDarkMode ? '☀' : '☾'}</button>
          </div>
        </div>
      </div>

      <div className={styles.masthead}>
        <div className={styles.mastheadInner}>
          <div className={styles.left}>
            <div className={styles.search}>
              <span className={styles.searchIcon} aria-hidden="true">🔍</span>
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Search news"
                aria-label="Search news"
                value={searchQuery}
                onChange={(e) => onSearch(e.target.value)}
              />
            </div>
          </div>

          <Link href="/" className={styles.brand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/logo.png" alt="" className={styles.logo} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <span className={styles.brandText}>
              <span className={styles.wordmark}>Khabar Darjeeling</span>
              <span className={styles.tagline}>Hamro Khabar, Hami Lekhaw</span>
            </span>
          </Link>

          <div className={styles.right}>
            <Link href="/post" className={styles.postBtn}>Post a story</Link>
          </div>
        </div>
      </div>
    </header>
  );
}
