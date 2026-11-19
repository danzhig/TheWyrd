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
import { THREAD_GROUPS, threadGroup, type ThreadGroup } from '@/lib/threads';
import styles from './reader.module.css';

/** A section's threads in the reader's three groups, each in verse order. */
function byGroup(threads: SectionThread[]): Record<ThreadGroup, SectionThread[]> {
  const out: Record<ThreadGroup, SectionThread[]> = { drawsOn: [], takenUpIn: [], alongside: [] };
  for (const t of threads) out[threadGroup(t.connection.order, t.hereIndex)].push(t);
  return out;
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
  const groups = byGroup(threads);
  const shown = threads.filter((t) => t.here.anchor === open);
  const shownGroups = byGroup(shown);
  // The glyph's link (`#threads-<verse>`) lands on the first card from that verse.
  const first = new Set<string>();
  const anchorFor = (t: SectionThread) => {
    if (first.has(t.here.anchor)) return undefined;
    first.add(t.here.anchor);
    return `threads-${t.here.anchor}`;
  };
  const listed = THREAD_GROUPS.filter((g) => g.id !== 'alongside' || groups.alongside.length);
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
          Passages elsewhere in the Bible that this one takes up, or that take it up, each with its
          sources.
        </p>
        <nav className={styles.threadJump} aria-label="Thread groups">
          {listed.map((g, k) => (
            <span key={g.id}>
              {k ? <span aria-hidden="true"> · </span> : null}
              <a href={`#threads-group-${g.id}`}>
                {g.title} <span className={styles.threadJumpCount}>{groups[g.id].length}</span>
              </a>
            </span>
          ))}
        </nav>
        <div className={styles.threadGroups}>
          {listed.map((g) => (
            <section
              key={g.id}
              id={`threads-group-${g.id}`}
              className={styles.threadGroup}
              aria-labelledby={`threads-group-${g.id}-h`}
              data-thread-group={g.id}
            >
              <h3 id={`threads-group-${g.id}-h`} className={styles.threadGroupHeading}>
                {g.title} <span className={styles.threadGroupNote}>· {g.note}</span>
              </h3>
              {groups[g.id].length ? (
                groups[g.id].map((t) => (
                  <div
                    key={t.connection.id}
                    id={anchorFor(t)}
                    className={styles.threadItem}
                    data-from={t.here.anchor}
                  >
                    <p className={styles.threadVerse}>
                      <a href={`#${t.here.anchor}`}>From {verseLabel(t.here.anchor)}</a>
                    </p>
                    <ThreadCard
                      c={t.connection}
                      ends={t.ends}
                      here={t.hereIndex}
                      headingLevel={4}
                      group={`threads-${g.id}`}
                    />
                  </div>
                ))
              ) : (
                <p className={styles.threadEmpty}>{g.empty}</p>
              )}
            </section>
          ))}
        </div>
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
          {THREAD_GROUPS.filter((g) => shownGroups[g.id].length).map((g) => (
            <section key={g.id} data-dialog-group={g.id}>
              <h3 className={styles.threadGroupHeading}>{g.title}</h3>
              {shownGroups[g.id].map((t) => (
                <ThreadCard
                  key={t.connection.id}
                  c={t.connection}
                  ends={t.ends}
                  here={t.hereIndex}
                  headingLevel={4}
                  group="thread-dialog"
                  onGo={close}
                />
              ))}
            </section>
          ))}
        </div>
      </dialog>
    </>
  );
}
