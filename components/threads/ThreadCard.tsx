/**
 * One thread, the same card wherever it appears: the Vault's arc panel, the reader's dialog and
 * the reader's list (threads plan §2, TD1). Closed, it is five short lines: the kind, the title,
 * the direction (older passage, an arrow naming the relation, the passage that takes it up), the
 * summary (the explanation's first sentence), and links to both readings. The arrow at the top
 * right opens the rest: the explanation, both passages' opening words, the shared Greek, how the
 * order is known, the sources and the other threads from each verse.
 *
 * The open part is a native `<details>`, so it works without JavaScript; cards that share a
 * `group` are an exclusive accordion (one open at a time).
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  STRENGTH_LABEL,
  TYPE_LABEL,
  basisText,
  direction,
  splitExplanation,
  threadHref,
} from '@/lib/threads';
import type { PublicConnection, ThreadCitation, ThreadEnd, ThreadEvidence } from '@/lib/types';
import s from './card.module.css';

export type CardConnection = Omit<PublicConnection, 'ends'>;

/** "3Kgdms.17.23" → "3Kgdms 17:23" (the dataset's own numbering). */
const dataRef = (ref: string) => ref.replace(/\.(\d+)\.(\d+)$/, ' $1:$2');

/** "v-4-25" → "4:25". */
export const verseLabel = (anchor: string) => anchor.replace(/^v-(\d+)-(\d+).*$/, '$1:$2');

const DATASET = { LXX: 'Septuagint', TAGNT: 'TAGNT', TAHOT: 'TAHOT' } as const;

/** The shared words at their rows: Greek (Septuagint, TAGNT) and Hebrew (TAHOT), each its own line. */
function Evidence({ list }: { list: ThreadEvidence[] }) {
  if (!list.length) return null;
  const hebrew = list.filter((e) => e.dataset === 'TAHOT');
  const greek = list.filter((e) => e.dataset !== 'TAHOT');
  const line = (label: string, items: ThreadEvidence[], lang: 'grc' | 'he') =>
    items.length ? (
      <p className={s.greek} data-evidence={lang}>
        <span className={s.label}>{label}</span>{' '}
        {items.map((e, i) => (
          <span key={i}>
            {i ? ' · ' : ''}
            {DATASET[e.dataset]} {dataRef(e.ref)}:{' '}
            <span lang={lang} dir={lang === 'he' ? 'rtl' : undefined}>
              {/* TAHOT marks a word's parts with slashes; the word is shown whole. */}
              {lang === 'he' ? e.form.replace(/[/\\]/g, '') : e.form}
            </span>
          </span>
        ))}
      </p>
    ) : null;
  return (
    <>
      {line('Shared Greek', greek, 'grc')}
      {line('Shared Hebrew', hebrew, 'he')}
    </>
  );
}

export function Source({ s: c }: { s: ThreadCitation }) {
  if (c.kind === 'xref')
    return <>OpenBible.info cross-reference, row {c.row.replace('OpenBibleXref:', '')}</>;
  if (c.kind === 'verse')
    return (
      <>
        {c.display} (WEBC): {c.words.join(', ')}
      </>
    );
  if (c.kind === 'bibliographic')
    return (
      <>
        {c.author}, <cite>{c.title}</cite> ({c.year}), {c.locator}
      </>
    );
  return (
    <>
      {c.author}, <cite>{c.work}</cite>, {c.locator} ({c.edition}){' '}
      <a href={c.url} rel="noopener">
        CCEL
      </a>
    </>
  );
}

export function ThreadCard({
  c,
  ends,
  here,
  headingLevel = 3,
  group,
  onGo,
}: {
  c: CardConnection;
  ends: [ThreadEnd, ThreadEnd];
  /** The end on the current page (the reader): named "here", not linked away. */
  here?: 0 | 1;
  headingLevel?: 2 | 3 | 4;
  /** Cards sharing a group open one at a time. */
  group?: string;
  /** Following a link (closes the dialog or panel it sits in, remembers the camera). */
  onGo?: () => void;
}) {
  const H = `h${headingLevel}` as const;
  const d = direction(c, ends);
  const { summary, rest } = splitExplanation(c.explanation);
  const order = [d.first, (1 - d.first) as 0 | 1];
  const titleId = `thread-${c.id}-${here ?? 'x'}`;
  const ref = (i: 0 | 1): ReactNode => (
    <span className={s.ref} data-end={i}>
      {ends[i].display}
    </span>
  );
  return (
    <article
      className={s.card}
      data-thread-card={c.id}
      data-uses={d.uses}
      data-known={d.known}
      aria-labelledby={titleId}
    >
      <p className={s.kind}>
        <span className={s.label}>{TYPE_LABEL[c.type]}</span> · {STRENGTH_LABEL[c.strength]}
      </p>
      <H id={titleId} className={s.title}>
        {c.label}
      </H>
      <p className={s.direction} data-direction>
        {ref(order[0]!)}
        {d.known ? (
          <span className={s.arrow}>
            <span className={s.verb}>{d.verb}</span>
          </span>
        ) : (
          <span className={s.both} aria-label="and">
            ↔
          </span>
        )}
        {ref(order[1]!)}
        {!d.known ? <span className={s.badge}>order not given</span> : null}
        {c.order.basis === 'disputed' ? <span className={s.badge}>order disputed</span> : null}
      </p>
      <p className={s.summary} data-summary>
        {summary}
      </p>
      <details className={s.more} name={group} data-more>
        <summary className={s.toggle}>
          <span className="visually-hidden">The full thread: {c.label}</span>
          <span aria-hidden="true" className={s.chevron} />
        </summary>
        <div className={s.open}>
          {rest ? <p>{rest}</p> : null}
          {order.map((i) => (
            <figure key={i} className={s.excerpt}>
              <figcaption>{ends[i!].display}</figcaption>
              <blockquote>{ends[i!].excerpt}</blockquote>
            </figure>
          ))}
          <Evidence list={c.evidence} />
          <p className={s.basis}>
            <span className={s.label}>Order</span>{' '}
            {basisText(c.order, d.known ? d.older : undefined)}
          </p>
          <div className={s.sources}>
            <p className={s.label}>Sources</p>
            <ul>
              {[...c.sources, ...(c.order.sources ?? [])].map((x, i) => (
                <li key={i}>
                  <Source s={x} />
                </li>
              ))}
            </ul>
          </div>
          {order
            .filter((i) => i !== here && ends[i!].more > 0)
            .map((i) => (
              <p key={i} className={s.moreFrom}>
                <Link
                  href={`/read/${ends[i!].sectionId}/#threads-${ends[i!].anchor}`}
                  prefetch={false}
                  onClick={onGo}
                  data-more-from={`${c.id}:${i}`}
                >
                  {ends[i!].more} more {ends[i!].more === 1 ? 'thread' : 'threads'} from{' '}
                  {ends[i!].display.replace(/[–-].*$/, '')}
                </Link>
              </p>
            ))}
        </div>
      </details>
      <p className={s.links}>
        {order.map((i, k) => (
          <span key={i}>
            {k ? <span aria-hidden="true"> · </span> : null}
            {i === here ? (
              <a href={`#${ends[i!].anchor}`} className={s.here}>
                Here: {ends[i!].display}
              </a>
            ) : (
              <Link
                href={threadHref(c.id, ends[i!])}
                prefetch={false}
                onClick={onGo}
                data-go-there={c.id}
                data-open-end={`${c.id}:${i}`}
              >
                Read {ends[i!].display}
              </Link>
            )}
          </span>
        ))}
      </p>
    </article>
  );
}
