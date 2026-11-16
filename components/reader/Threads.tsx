'use client';

/**
 * Threads in the reader (PLAN §14, P4.2). A gold thread glyph beside a verse (VerseText) marks the
 * connections that start there. Without JavaScript it links to this section's list of threads at
 * the end of the page; with it, tapping the glyph opens that verse's cards in a dialog. Each card
 * shows the linked passage (an excerpt from the built text), the type of link, the explanation,
 * the shared Greek words and the sources, and "Go there", which carries `?thread=<id>` so the page
 * it opens offers the way back.
 */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { SectionThread } from '@/lib/data';
import type { ConnectionType, ThreadCitation, ThreadEvidence } from '@/lib/types';
import styles from './reader.module.css';

export const TYPE_LABEL: Record<ConnectionType, string> = {
  quotation: 'Quotation',
  allusion: 'Allusion',
  echo: 'Verbal echo',
  typology: 'Typology',
  parallel: 'Parallel',
  fulfilment: 'Fulfilment',
  contrast: 'Contrast',
};
const STRENGTH = { 3: 'named or quoted', 2: 'strong', 1: 'proposed' } as const;

/** "3Kgdms.17.23" → "3Kgdms 17:23" (the dataset's own numbering). */
const dataRef = (ref: string) => ref.replace(/\.(\d+)\.(\d+)$/, ' $1:$2');

function Evidence({ list }: { list: ThreadEvidence[] }) {
  if (!list.length) return null;
  return (
    <p className={styles.threadGreek}>
      <span className="label">Shared Greek</span>{' '}
      {list.map((e, i) => (
        <span key={i}>
          {i ? ' · ' : ''}
          {e.dataset === 'LXX' ? 'Septuagint' : 'TAGNT'} {dataRef(e.ref)}:{' '}
          <span lang="grc">{e.form}</span>
        </span>
      ))}
    </p>
  );
}

function Source({ s }: { s: ThreadCitation }) {
  if (s.kind === 'xref')
    return <>OpenBible.info cross-reference, row {s.row.replace('OpenBibleXref:', '')}</>;
  if (s.kind === 'verse')
    return (
      <>
        {s.display} (WEBC): {s.words.join(', ')}
      </>
    );
  return (
    <>
      {s.author}, <cite>{s.work}</cite>, {s.locator} ({s.edition}){' '}
      <a href={s.url} rel="noopener">
        CCEL
      </a>
    </>
  );
}

export function ThreadCard({
  t,
  headingLevel = 3,
  onGo,
}: {
  t: SectionThread;
  headingLevel?: 3 | 4;
  /** Following the link (closes the dialog it sits in). */
  onGo?: () => void;
}) {
  const { connection: c, there } = t;
  const H = `h${headingLevel}` as const;
  return (
    <article className={styles.threadCard} data-thread-card={c.id}>
      <p className={styles.threadType}>
        <span className="label">{TYPE_LABEL[c.type]}</span>
        <span> · {STRENGTH[c.strength]}</span>
      </p>
      <H className={styles.threadTitle}>{c.label}</H>
      <p className={styles.threadThere}>
        {there.display} · {there.sectionTitle}
        {there.library ? ' · in the library' : ''}
      </p>
      <blockquote className={styles.threadExcerpt}>{there.excerpt}</blockquote>
      <p>{c.explanation}</p>
      <Evidence list={c.evidence} />
      <details className={styles.threadSources}>
        <summary>Sources</summary>
        <ul>
          {c.sources.map((s, i) => (
            <li key={i}>
              <Source s={s} />
            </li>
          ))}
        </ul>
      </details>
      <Link
        href={`/read/${there.sectionId}/?thread=${c.id}#${there.anchor}`}
        className={styles.goThere}
        data-go-there={c.id}
        onClick={onGo}
      >
        Go there: {there.display}
      </Link>
    </article>
  );
}

/** Group a section's threads by the verse they start from. */
function byVerse(threads: SectionThread[]): [string, SectionThread[]][] {
  const groups = new Map<string, SectionThread[]>();
  for (const t of threads) groups.set(t.here.anchor, [...(groups.get(t.here.anchor) ?? []), t]);
  return [...groups];
}

/** "v-4-25" → "4:25". */
const verseLabel = (anchor: string) => anchor.replace(/^v-(\d+)-(\d+).*$/, '$1:$2');

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
              <ThreadCard key={t.connection.id} t={t} headingLevel={4} />
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
            <ThreadCard key={t.connection.id} t={t} onGo={close} />
          ))}
        </div>
      </dialog>
    </>
  );
}
