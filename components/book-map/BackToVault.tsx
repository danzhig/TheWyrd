'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { animationsOn, bookOut } from '@/lib/transition';
import { bookCover } from './BookCover';
import styles from './book-page.module.css';

/**
 * "All books": the cover closes, then the closed book shrinks back into its medallion (PLAN §9).
 * Esc does the same (owner, 2026-11-18), as it leads from a reading back to its map, and so does
 * a click outside the open book.
 */
export function BackToVault({
  bookId,
  name,
  tagline,
}: {
  bookId: string;
  name: string;
  tagline: string;
}) {
  const router = useRouter();
  const leaving = useRef(false);
  /** Leave for the Vault; false if the plain link should do it (no animation to run). */
  const leave = useCallback(async (): Promise<boolean> => {
    if (!animationsOn() || !bookCover.close) return false;
    if (leaving.current) return true;
    leaving.current = true;
    const rect = await bookCover.close();
    void bookOut(bookId, name, tagline, rect); // the closed book now lives on the transition layer
    router.push('/');
    return true;
  }, [bookId, name, tagline, router]);

  useEffect(() => {
    const goHome = () =>
      void leave().then((done) => {
        if (!done && !leaving.current) {
          leaving.current = true;
          router.push('/');
        }
      });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('dialog[open]')) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      goHome();
    };
    // A click outside the open book (on the page around it) leads home too (owner, 2026-11-18).
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (!t || t.closest('[data-book-frame], a, button, input, select, textarea, dialog, nav'))
        return;
      if (document.querySelector('dialog[open]') || String(window.getSelection() ?? '')) return;
      goHome();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, [leave, router]);

  return (
    <Link
      href="/"
      className={styles.back}
      onClick={(e) => {
        if (!animationsOn() || !bookCover.close) return;
        e.preventDefault();
        void leave();
      }}
    >
      ← All books
    </Link>
  );
}
