'use client';

/**
 * Threads in the reader (PLAN §14, P4.2). A gold thread glyph beside a verse (VerseText) marks the
 * connections that start there. Without JavaScript it links to this section's list of threads at
 * the end of the page; with it, tapping the glyph opens that verse's cards in a dialog. Each is
 * the shared `ThreadCard` (threads plan TD1): direction, summary, the rest on demand, and links
 * that carry `?thread=<id>` so the page they open offers the way back.
 */
import { useEffect, useRef, useState } from 'react';
import { ThreadCard, verseLabel } from '@/components/threads/ThreadCard';
import type { SectionThread } from '@/lib/data';
import styles from './reader.module.css';

/** Group a section's threads by the verse they start from. */
function byVerse(threads: SectionThread[]): [string, SectionThread[]][] {
  const groups = new Map<string, SectionThread[]>();
  for (const t of threads) groups.set(t.here.anchor, [...(groups.get(t.here.anchor) ?? []), t]);
  return [...groups];
}

export function Threads({ threads }: { threads: SectionThread[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  // A tap on a verse's thread glyph opens its cards (without JavaScript the glyph is a link to
  // the list below).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a.thread-glyph');
      if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (typeof HTMLDialogElement === 'undefined') return;
      e.preventDefault();
      opener.current = a;
      setOpen(a.dataset.thread ?? null);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    const d = dialogRef.current;
    if (open && d && !d.open) d.showModal();
  }, [open]);

  const close = () => {
    dialogRef.current?.close();
  };
  const onClose = () => {
    setOpen(null);
    if (opener.current?.isConnected) opener.current.focus();
  };

  if (!threads.length) return null;
  const groups = byVerse(threads);
  const shown = groups.find(([anchor]) => anchor === open)?.[1] ?? [];
  return (
    <>
      <section
        className={styles.threads}
        aria-labelledby="threads-heading"
        data-testid="threads"
        data-pagefind-ignore="all"
      >
        <h2 id="threads-heading" className={styles.threadsHeading}>
          Threads
        </h2>
        <p className={styles.threadsIntro}>
          Passages elsewhere in the Bible that this one quotes, echoes or answers, each with its
          sources.
        </p>
        {groups.map(([anchor, list]) => (
          <div key={anchor} id={`threads-${anchor}`} className={styles.threadGroup}>
            <h3 className={styles.threadVerse}>
              <a href={`#${anchor}`}>From {verseLabel(anchor)}</a>
            </h3>
            {list.map((t) => (
              <ThreadCard
                key={t.connection.id}
                c={t.connection}
                ends={t.ends}
                here={t.hereIndex}
                headingLevel={4}
                group={`threads-${anchor}`}
              />
            ))}
          </div>
        ))}
      </section>
      <dialog
        ref={dialogRef}
        className={styles.threadDialog}
        aria-labelledby="thread-dialog-heading"
        onClose={onClose}
        onClick={(e) => {
          // A tap on the backdrop closes it.
          if (e.target === e.currentTarget) close();
        }}
        data-testid="thread-dialog"
      >
        <div className={styles.threadDialogBody}>
          <header className={styles.threadDialogHead}>
            <h2 id="thread-dialog-heading" className={styles.threadsHeading}>
              Threads from {open ? verseLabel(open) : ''}
            </h2>
            <button
              type="button"
              className={`${styles.iconButton} ${styles.threadClose}`}
              onClick={close}
              aria-label="Close"
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>
          {shown.map((t) => (
            <ThreadCard
              key={t.connection.id}
              c={t.connection}
              ends={t.ends}
              here={t.hereIndex}
              group="thread-dialog"
              onGo={close}
            />
          ))}
        </div>
      </dialog>
    </>
  );
}
