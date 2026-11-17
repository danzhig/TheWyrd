'use client';

/**
 * The themes as a tree (PLAN §16, P6.4): theme → sub-theme → passage. It is the accessible
 * structure of the Themes view (the constellations are decorative for assistive technology),
 * visually hidden on the map and shown by List. Arrow keys move between passages; focusing one on
 * the map flies the camera to its star. Memoised: the Vault re-renders on every zoom step, and
 * this list has a link for every passage.
 */
import Link from 'next/link';
import { memo, useRef } from 'react';
import styles from './vault.module.css';
import type { ThemesData } from './useThemes';

export interface ThemeTreeProps {
  data: ThemesData;
  visible: boolean;
  /** A passage link took focus (`key` = `${subId}:${ref}`), or lost it (null). */
  onFocusPassage: (key: string | null) => void;
  /** A passage is being opened: remember where the camera is. */
  onOpen: () => void;
  hrefFor: (sectionId: string, ref: string, subId: string) => string;
  /** The Testaments filter: passages in this testament's books are left out. */
  hidden?: 'ot' | 'nt';
  testamentOf: (bookId: string) => 'ot' | 'nt';
}

export const ThemeTree = memo(function ThemeTree({
  data,
  visible,
  onFocusPassage,
  onOpen,
  hrefFor,
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
                    {s.passages
                      .filter((p) => !hidden || testamentOf(p.bookId) !== hidden)
                      .map((p) => {
                        const key = `${s.id}:${p.ref}`;
                        return (
                          <li key={key}>
                            <Link
                              href={hrefFor(p.sectionId, p.ref, s.id)}
                              prefetch={false}
                              data-tree-passage={key}
                              onFocus={() => onFocusPassage(key)}
                              onBlur={() => onFocusPassage(null)}
                              onClick={onOpen}
                            >
                              {p.display}
                            </Link>
                            <span className={styles.listMeta}>
                              {' '}
                              — {p.sectionTitle}
                              {p.library ? ' · in the library' : ' · on the path'}
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
