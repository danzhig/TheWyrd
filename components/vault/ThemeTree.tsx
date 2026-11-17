'use client';

/**
 * The themes as a tree (PLAN §16, P6.4; every reading, owner 2026-11-17): theme → sub-theme →
 * reading. It is the accessible structure of the Themes view (the constellations are decorative
 * for assistive technology), visually hidden on the map and shown by List. Arrow keys move between
 * readings; focusing one on the map opens its sub-theme and lights its star. Memoised: the Vault
 * re-renders on every zoom step, and this list has a link for every reading.
 */
import Link from 'next/link';
import { memo, useRef } from 'react';
import styles from './vault.module.css';
import type { ThemesData } from './useThemes';

export interface ThemeTreeProps {
  data: ThemesData;
  visible: boolean;
  /** A reading link took focus (`key` = `${subId}:${sectionId}`), or lost it (null). */
  onFocusPassage: (key: string | null) => void;
  /** A passage is being opened: remember where the camera is. */
  onOpen: () => void;
  /** The Testaments filter: passages in this testament's books are left out. */
  hidden?: 'ot' | 'nt';
  testamentOf: (bookId: string) => 'ot' | 'nt';
}

/** A reading opened from a sub-theme: at its key passage's verse, if it holds one. */
function readingHref(sectionId: string, subId: string, key?: string): string {
  if (!key) return `/read/${sectionId}/?theme=${subId}`;
  const [, c, v] = key.split('-')[0]!.split('.');
  return `/read/${sectionId}/?theme=${subId}#v-${c}-${v ?? 1}`;
}

export const ThemeTree = memo(function ThemeTree({
  data,
  visible,
  onFocusPassage,
  onOpen,
  hidden,
  testamentOf,
}: ThemeTreeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onKey = (e: React.KeyboardEvent) => {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
    const links = [
      ...(ref.current?.querySelectorAll<HTMLAnchorElement>('a[data-tree-passage]') ?? []),
    ];
    const i = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (i < 0) return;
    e.preventDefault();
    const forward = e.key === 'ArrowRight' || e.key === 'ArrowDown';
    links[forward ? Math.min(links.length - 1, i + 1) : Math.max(0, i - 1)]?.focus();
  };
  return (
    <section
      className={visible ? styles.list : 'visually-hidden'}
      aria-label="The themes, as a list"
      data-testid="theme-tree"
    >
      <div ref={ref} onKeyDown={onKey}>
        <h2 className={styles.listHeading}>Themes</h2>
        {data.themes.map((t) => (
          <section key={t.id} aria-labelledby={`tree-${t.id}`} className={styles.treeTheme}>
            <h3 id={`tree-${t.id}`} className={styles.treeThemeTitle}>
              {t.title}
            </h3>
            <p className={styles.listMeta}>{t.description}</p>
            <ul className={styles.treeSubs}>
              {t.subthemes.map((s) => (
                <li key={s.id} data-tree-subtheme={s.id}>
                  <h4 className={styles.treeSubTitle}>{s.title}</h4>
                  <p className={styles.listMeta}>{s.description}</p>
                  <ol className={styles.treePassages}>
                    {s.readings
                      .filter((r) => !hidden || testamentOf(r.bookId) !== hidden)
                      .map((r) => {
                        const key = `${s.id}:${r.sectionId}`;
                        return (
                          <li key={key}>
                            <Link
                              href={readingHref(r.sectionId, s.id, r.key)}
                              prefetch={false}
                              data-tree-passage={key}
                              onFocus={() => onFocusPassage(key)}
                              onBlur={() => onFocusPassage(null)}
                              onClick={onOpen}
                            >
                              {r.title}
                            </Link>
                            <span className={styles.listMeta}>
                              {' '}
                              — {r.display}
                              {r.library ? ' · in the library' : ' · on the path'}
                            </span>
                          </li>
                        );
                      })}
                  </ol>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
});
