'use client';

/**
 * The Vault's Threads mode (PLAN §14, P4.3): gold arcs between medallions, one per pair of books,
 * weighted by how many connections join them; a filter by type; tapping an arc lists its
 * connections, each a link into the reader along the thread. Loaded only when Threads is switched
 * on (with `/data/connections.json`), so the Vault's first load carries none of it.
 *
 * The arcs are drawn into the scene (a portal into `arcHost`, under the medallions) and are
 * decorative for assistive technology, like the rest of the ceiling; the accessible structure is
 * the list of arcs (buttons that open the same panel), visually hidden on the map and shown by
 * List.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ThreadCard } from '@/components/threads/ThreadCard';
import { TYPE_LABEL, TYPE_ORDER } from '@/lib/threads';
import type { ConnectionType, PublicConnection, PublicConnections } from '@/lib/types';
import type { Point } from './layout';
import { ALL_PAIRS, pairLabel, type PairId } from '@/lib/corpora';
import { readThreadFilters, writeThreadFilters } from '@/lib/store';

/** On at first (owner, 2026-11-20): the threads between the Testaments. */
const DEFAULT_PAIRS: PairId[] = ['ot-nt'];
import {
  arcsFor,
  bundleArcs,
  bookThreads,
  directionSummary,
  nearestArc,
  panelOrder,
  threadedBooks,
  type BookRow,
} from './threads';
import s from './threads.module.css';

let dataPromise: Promise<PublicConnections> | null = null;
export function loadConnections(): Promise<PublicConnections> {
  // Every published file of threads (threads plan §5): Old ↔ New first, then the threads inside
  // each Testament (small; a missing file counts as empty).
  const within = (f: string) =>
    fetch(`/data/${f}`)
      .then((r) => (r.ok ? (r.json() as Promise<PublicConnections>) : { connections: [] }))
      .catch(() => ({ connections: [] }));
  dataPromise ??= Promise.all([
    fetch('/data/connections.json').then((r) => {
      if (!r.ok) throw new Error(`connections.json ${r.status}`);
      return r.json() as Promise<PublicConnections>;
    }),
    within('connections-within-ot.json'),
    within('connections-within-nt.json'),
  ])
    .then((files) => ({ connections: files.flatMap((f) => f.connections) }))
    .catch((err) => {
      dataPromise = null;
      throw err;
    });
  return dataPromise;
}

export interface ThreadsModeProps {
  homes: Map<string, Point & { r: number }>;
  /** The element in the scene the arcs are drawn into (under the medallions). */
  arcHost: HTMLElement | null;
  nameOf: (bookId: string) => string;
  /** List mode: the arcs as a visible list. */
  listVisible: boolean;
  /** A connection is being opened in the reader (remember the camera). */
  onOpen: () => void;
  /** Go into a book, as a single tap does with Threads off (the Vault's flight). */
  onOpenBook: (bookId: string) => void;
  /** An arc was chosen (from the map or the list): the camera may bring it into view. */
  onShowArc?: (mid: Point) => void;
  /** The Testaments filter: connections with an end in this testament are left out. */
  hidden?: 'ot' | 'nt';
  testamentOf: (bookId: string) => 'ot' | 'nt';
}

export function ThreadsMode({
  homes,
  arcHost,
  nameOf,
  listVisible,
  onOpen,
  onOpenBook,
  onShowArc,
  hidden,
  testamentOf,
}: ThreadsModeProps) {
  const [data, setData] = useState<PublicConnections | null>(null);
  // The filters, as the reader last left them (owner, 2026-11-20): only Old ↔ New and every kind
  // of link at first. ThreadsMode is loaded only on the client, so storage is read here.
  const [saved] = useState(() => readThreadFilters());
  const [types, setTypes] = useState<Set<ConnectionType>>(
    () => new Set(saved ? TYPE_ORDER.filter((t) => !saved.typesOff.includes(t)) : TYPE_ORDER),
  );
  const [pairsOn, setPairsOn] = useState<Set<PairId>>(
    () => new Set(saved ? ALL_PAIRS.filter((p) => saved.pairs.includes(p)) : DEFAULT_PAIRS),
  );
  const setFilters = (pairs: Set<PairId>, kinds: Set<ConnectionType>) => {
    setPairsOn(pairs);
    setTypes(kinds);
    writeThreadFilters({
      pairs: [...pairs],
      typesOff: TYPE_ORDER.filter((t) => !kinds.has(t)),
    });
  };
  const [filtersOpen, setFiltersOpen] = useState(false);
  // The arcs fade in once, when Threads comes on; later regrouping (a book opened) is instant.
  const [entering, setEntering] = useState(true);
  const loaded = data !== null;
  useEffect(() => {
    if (!loaded) return;
    const t = window.setTimeout(() => setEntering(false), 700);
    return () => window.clearTimeout(t);
  }, [loaded]);
  const [selected, setSelected] = useState<string | null>(null);
  /** The book whose threads the book panel shows (threads plan §2.5). */
  const [book, setBook] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let alive = true;
    void loadConnections().then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.threads = data ? 'ready' : 'loading';
    return () => {
      delete document.documentElement.dataset.threads;
    };
  }, [data]);

  // Only threads with both ends in a testament on show.
  const shown = useMemo(
    () =>
      (data?.connections ?? []).filter(
        (c) => !hidden || c.ends.every((e) => testamentOf(e.bookId) !== hidden),
      ),
    [data, hidden, testamentOf],
  );
  const present = useMemo(() => {
    const counts = new Map<ConnectionType, number>();
    for (const c of shown) counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
    return TYPE_ORDER.filter((t) => counts.has(t)).map((t) => ({ type: t, n: counts.get(t)! }));
  }, [shown]);
  // The pairs present (shown when more than one), with their counts.
  const pairCounts = useMemo(() => {
    const m = new Map<PairId, number>();
    for (const c of shown) m.set(c.pair, (m.get(c.pair) ?? 0) + 1);
    return ALL_PAIRS.filter((p) => m.has(p)).map((p) => ({ pair: p, n: m.get(p)! }));
  }, [shown]);
  const arcs = useMemo(() => arcsFor(shown, homes, types, pairsOn), [shown, homes, types, pairsOn]);
  const arc = arcs.find((a) => a.key === selected) ?? null;
  // A few paths for all the arcs (the node budget), the selected one drawn on its own.
  const bundles = useMemo(() => bundleArcs(arcs, book, selected), [arcs, book, selected]);
  // The SVG box: every home inside it, with room for the arcs' bows.
  const R = useMemo(
    () => Math.max(...[...homes.values()].map((h) => Math.hypot(h.x, h.y) + h.r)) + 40,
    [homes],
  );

  // Books with a thread under the filters: the first tap on one opens its panel.
  const typed = useMemo(
    () => shown.filter((c) => types.has(c.type) && pairsOn.has(c.pair)),
    [shown, types, pairsOn],
  );
  const threaded = useMemo(() => threadedBooks(typed), [typed]);
  const bookData = useMemo(() => (book ? bookThreads(typed, book) : null), [typed, book]);

  const open = (key: string, from?: HTMLElement | null) => {
    opener.current = from ?? null;
    setBook(null);
    setFull(false);
    setSelected(key);
    const a = arcs.find((x) => x.key === key);
    if (a) onShowArc?.(a.mid);
  };
  const close = () => {
    setSelected(null);
    setBook(null);
    setFull(false);
    if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
  };
  // A tap near an arc opens it. One path per arc (the node budget), so taps are matched to the
  // nearest arc in scene coordinates rather than by a wide hit stroke on each.
  const svgRef = useRef<SVGSVGElement>(null);
  const arcsRef = useRef(arcs);
  const openRef = useRef(open);
  const closeRef = useRef<() => void>(() => {});
  useEffect(() => {
    arcsRef.current = arcs;
    openRef.current = open;
    closeRef.current = close;
  });
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const svg = svgRef.current;
      const t = e.target as HTMLElement | null;
      if (!svg || e.button !== 0 || !t?.closest('[data-testid="vault-view"]')) return;
      if (t.closest('a, button')) return; // medallions, stars and names keep their own taps
      const m = svg.getScreenCTM();
      if (!m) return;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      // Within 14 screen pixels of the line, whatever the zoom.
      const hit = nearestArc(arcsRef.current, { x: p.x, y: p.y }, 14 / m.a);
      if (hit) openRef.current(hit.key);
      else closeRef.current(); // a tap on the empty sky closes the panel
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  // For the tests: every arc drawn, with its count, pair and middle on screen (the arcs are a few
  // joined paths, so there is no element per arc to query).
  useEffect(() => {
    const w = window as unknown as { __sasArcs?: () => unknown };
    w.__sasArcs = () => {
      const m = svgRef.current?.getScreenCTM();
      if (!m) return [];
      return arcsRef.current.map((a) => {
        const p = new DOMPoint(a.mid.x, a.mid.y).matrixTransform(m);
        return { key: a.key, count: a.connections.length, pair: a.pair, x: p.x, y: p.y };
      });
    };
    return () => {
      delete w.__sasArcs;
    };
  }, []);

  const openBookPanel = (id: string, from?: HTMLElement | null) => {
    opener.current = from ?? null;
    setSelected(null);
    setFull(false);
    setBook(id);
  };
  // With Threads on, the first tap on a book opens its threads; a second tap on the same book
  // (or "Open …" in the panel) goes in. A book with no threads under the filters goes straight
  // in. Caught before the medallion's own handler, on the ceiling only.
  const bookRef = useRef(book);
  const threadedRef = useRef(threaded);
  const openBookPanelRef = useRef(openBookPanel);
  useEffect(() => {
    bookRef.current = book;
    threadedRef.current = threaded;
    openBookPanelRef.current = openBookPanel;
  });
  useEffect(() => {
    const onTap = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[data-book]');
      if (!a || !a.closest('[data-testid="vault-view"]')) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const id = a.dataset.book!;
      if (!threadedRef.current.has(id) || bookRef.current === id) return;
      e.preventDefault();
      e.stopPropagation();
      openBookPanelRef.current(id, a);
    };
    window.addEventListener('click', onTap, true);
    return () => window.removeEventListener('click', onTap, true);
  }, []);
  // Books without threads are drawn dimmed, so the difference shows before the tap.
  useEffect(() => {
    if (!data) return;
    const els = document.querySelectorAll<HTMLElement>('[data-testid="vault-view"] a[data-book]');
    for (const el of els) el.toggleAttribute('data-threadless', !threaded.has(el.dataset.book!));
    return () => {
      for (const el of els) el.removeAttribute('data-threadless');
    };
  }, [data, threaded]);

  // A panel takes focus when it opens. Esc steps out one level at a time: an open card, then an
  // open book row, then the panel.
  const panelRef = useRef<HTMLElement>(null);
  const panelKey = arc?.key ?? (book ? `book:${book}` : null);
  useEffect(() => {
    if (!panelKey) return;
    headingRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      const panel = panelRef.current;
      const openCard = panel?.querySelector<HTMLDetailsElement>('details[data-more][open]');
      const openRow = panel?.querySelector<HTMLDetailsElement>('details[data-book-row][open]');
      const step = openCard ?? openRow;
      if (step) {
        step.open = false;
        step.querySelector('summary')?.focus({ preventScroll: true });
      } else close();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [panelKey]);

  // A book's own name, as its passages show it ("John 1:1–3" → "John").
  const bookName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of data?.connections ?? [])
      for (const e of c.ends)
        if (!m.has(e.bookId)) m.set(e.bookId, e.display.slice(0, e.display.lastIndexOf(' ')));
    return m;
  }, [data]);
  const name = (id: string) => bookName.get(id) ?? nameOf(id);
  const label = (a: { a: string; b: string }) => `${name(a.a)} ↔ ${name(a.b)}`;
  // The list: the most-connected pairs first, then by name.
  const listed = [...arcs].sort(
    (x, y) => y.connections.length - x.connections.length || label(x).localeCompare(label(y)),
  );

  return (
    <>
      {arcHost
        ? createPortal(
            <svg
              className={s.arcs}
              width={R * 2}
              height={R * 2}
              viewBox={`${-R} ${-R} ${R * 2} ${R * 2}`}
              style={{ left: -R, top: -R }}
              ref={svgRef}
              data-testid="thread-arcs"
            >
              {bundles.map((b) => (
                <path
                  key={b.key}
                  d={b.d}
                  className={[
                    s.line,
                    entering ? s.enter : '',
                    b.within ? s.within : '',
                    b.state === 'lit' ? s.selected : '',
                    b.state === 'dim' ? s.dim : '',
                  ].join(' ')}
                  strokeWidth={b.width}
                  data-arc-bundle={b.state}
                  data-arcs={b.keys.length}
                />
              ))}
              {arc ? (
                <path
                  d={arc.d}
                  className={`${s.line} ${s.selected}`}
                  strokeWidth={arc.width * 1.6}
                  data-arc-selected={arc.key}
                />
              ) : null}
            </svg>,
            arcHost,
          )
        : null}

      {/* The filters (owner, 2026-11-20): a sidebar on the right, the corpus pairs above the
          kinds of link. Only Old ↔ New is on at first; the reader's own choice is kept
          (lib/store.ts). On phones it folds behind a tab on the right edge. */}
      <aside
        className={`${s.filter} ${listVisible ? s.filterInline : ''}`}
        aria-label="Thread filters"
        data-testid="thread-filter"
        data-open={filtersOpen || undefined}
      >
        <button
          type="button"
          className={s.filterTab}
          aria-expanded={filtersOpen}
          aria-controls="thread-filter-body"
          onClick={() => setFiltersOpen((o) => !o)}
          data-testid="thread-filter-tab"
        >
          Filters
        </button>
        <div id="thread-filter-body" className={s.filterBody}>
          {pairCounts.length > 1 ? (
            <div role="group" aria-labelledby="thread-filter-pairs" data-testid="pair-filter">
              <p id="thread-filter-pairs" className={s.filterHeading}>
                Between
              </p>
              {pairCounts.map(({ pair, n }) => (
                <button
                  key={pair}
                  type="button"
                  className={s.chip}
                  aria-pressed={pairsOn.has(pair)}
                  data-pair-chip={pair}
                  onClick={() => {
                    const next = new Set(pairsOn);
                    if (next.has(pair)) next.delete(pair);
                    else next.add(pair);
                    setFilters(next, types);
                    setSelected(null);
                  }}
                >
                  {pairLabel(pair)} <span className={s.count}>{n}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div role="group" aria-labelledby="thread-filter-types">
            <p id="thread-filter-types" className={s.filterHeading}>
              Kinds of link
            </p>
            {present.map(({ type, n }) => (
              <button
                key={type}
                type="button"
                className={s.chip}
                aria-pressed={types.has(type)}
                data-type={type}
                onClick={() => {
                  const next = new Set(types);
                  if (next.has(type)) next.delete(type);
                  else next.add(type);
                  setFilters(pairsOn, next);
                  setSelected(null);
                }}
              >
                {TYPE_LABEL[type]} <span className={s.count}>{n}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* The arcs as a list: the accessible structure of Threads, shown by List. */}
      <section
        className={listVisible ? s.list : 'visually-hidden'}
        aria-label="Threads, as a list"
        data-testid="thread-list"
      >
        <h2 className={s.listHeading}>Threads</h2>
        <p className={s.meta}>
          {data
            ? `${arcs.reduce((n, a) => n + a.connections.length, 0)} connections between ${new Set(arcs.flatMap((a) => [a.a, a.b])).size} books`
            : 'Loading…'}
        </p>
        <ul className={s.pairs}>
          {listed.map((a) => (
            <li key={a.key}>
              <button
                type="button"
                className={s.pairButton}
                data-arc-item={a.key}
                onClick={(e) => open(a.key, e.currentTarget)}
              >
                {label(a)}
              </button>
              <span className={s.meta}>
                {' '}
                · {a.connections.length} {a.connections.length === 1 ? 'connection' : 'connections'}
              </span>
            </li>
          ))}
        </ul>
        <h3 className={s.listHeading}>By book</h3>
        <ul className={s.pairs}>
          {[...threaded]
            .sort((x, y) => name(x).localeCompare(name(y)))
            .map((id) => (
              <li key={id}>
                <button
                  type="button"
                  className={s.pairButton}
                  data-book-item={id}
                  onClick={(e) => openBookPanel(id, e.currentTarget)}
                >
                  {name(id)}
                </button>
                <span className={s.meta}>
                  {' '}
                  · {typed.filter((c) => c.ends.some((e) => e.bookId === id)).length} threads ·{' '}
                </span>
                <a href={`/book/${id}/`}>Open the book</a>
              </li>
            ))}
        </ul>
      </section>

      {arc ? (
        <aside
          ref={panelRef}
          className={`${s.panel} ${full ? s.full : ''}`}
          aria-labelledby="arc-heading"
          data-testid="arc-panel"
        >
          <PanelHead
            id="arc-heading"
            headingRef={headingRef}
            title={label(arc)}
            count={arc.connections.length}
            full={full}
            onFull={() => setFull((f) => !f)}
            onClose={close}
          />
          <ArcCards key={arc.key} list={arc.connections} name={name} onGo={onOpen} />
        </aside>
      ) : null}
      {book && bookData ? (
        <aside
          ref={panelRef}
          className={`${s.panel} ${full ? s.full : ''}`}
          aria-labelledby="book-heading"
          data-testid="book-panel"
          data-book-panel={book}
        >
          <PanelHead
            id="book-heading"
            headingRef={headingRef}
            title={name(book)}
            count={bookData.total}
            full={full}
            onFull={() => setFull((f) => !f)}
            onClose={close}
          />
          <p className={s.openBook}>
            <a
              href={`/book/${book}/`}
              data-testid="open-book"
              onClick={(e) => {
                if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                onOpenBook(book);
              }}
            >
              Open {name(book)} →
            </a>
          </p>
          {(
            [
              ['drawsOn', 'Draws on', 'Older books it takes up'],
              ['drawnOnBy', 'Drawn on by', 'Later books that take it up'],
              ['alongside', 'Alongside', 'Shared with no use claimed'],
            ] as const
          ).map(([k, h, note]) =>
            bookData[k].length ? (
              <section key={k} className={s.bookGroup} data-book-group={k}>
                <h3 className={s.groupHeading}>
                  {h} <span className={s.groupNote}>· {note}</span>
                </h3>
                {bookData[k].map((row) => (
                  <BookRowView key={row.bookId} row={row} name={name} onGo={onOpen} />
                ))}
              </section>
            ) : null,
          )}
        </aside>
      ) : null}
    </>
  );
}

function PanelHead({
  id,
  headingRef,
  title,
  count,
  full,
  onFull,
  onClose,
}: {
  id: string;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  title: string;
  count: number;
  full: boolean;
  onFull: () => void;
  onClose: () => void;
}) {
  return (
    <header className={s.panelHead}>
      {/* Phones: the sheet opens at 60% of the screen; this lifts it to full height. */}
      <button
        type="button"
        className={s.handle}
        aria-label={full ? 'Lower the panel' : 'Raise the panel'}
        aria-pressed={full}
        onClick={onFull}
        data-testid="panel-handle"
      >
        <span aria-hidden="true" />
      </button>
      <h2 id={id} ref={headingRef} tabIndex={-1} className={s.panelTitle}>
        {title}{' '}
        <span className={s.panelCount}>
          · {count} {count === 1 ? 'thread' : 'threads'}
        </span>
      </h2>
      <button type="button" className={s.close} onClick={onClose} aria-label="Close">
        <span aria-hidden="true">×</span>
      </button>
    </header>
  );
}

/** At most this many cards before "Show all" (threads plan §2.4). */
const FIRST = 12;

function cards(list: PublicConnection[], group: string, onGo: () => void) {
  return list.map((c) => {
    const { ends, ...rest } = c;
    return (
      <li key={c.id} data-panel-connection={c.id}>
        <ThreadCard c={rest} ends={ends} group={group} onGo={onGo} />
      </li>
    );
  });
}

/** An arc's threads: how they run, chips by type, strongest first. */
function ArcCards({
  list,
  name,
  onGo,
}: {
  list: PublicConnection[];
  name: (id: string) => string;
  onGo: () => void;
}) {
  const [only, setOnly] = useState<ConnectionType | null>(null);
  const [all, setAll] = useState(false);
  const ordered = useMemo(() => panelOrder(list), [list]);
  const counts = TYPE_ORDER.map((t) => ({ t, n: list.filter((c) => c.type === t).length })).filter(
    (x) => x.n,
  );
  const picked = only ? ordered.filter((c) => c.type === only) : ordered;
  const visible = all ? picked : picked.slice(0, FIRST);
  return (
    <>
      <p className={s.summary} data-testid="arc-summary">
        {directionSummary(list, name)}.
      </p>
      {counts.length > 1 ? (
        <div className={s.panelChips} role="group" aria-label="Show one type">
          {counts.map(({ t, n }) => (
            <button
              key={t}
              type="button"
              className={s.panelChip}
              aria-pressed={only === t}
              data-panel-type={t}
              onClick={() => setOnly((o) => (o === t ? null : t))}
            >
              {TYPE_LABEL[t]} <span className={s.count}>{n}</span>
            </button>
          ))}
        </div>
      ) : null}
      <ul className={s.connections}>{cards(visible, 'arc-panel', onGo)}</ul>
      {picked.length > visible.length ? (
        <button type="button" className={s.showAll} onClick={() => setAll(true)}>
          Show all {picked.length}
        </button>
      ) : null}
    </>
  );
}

/** One partner book in a book's panel: a row that opens to its cards. */
function BookRowView({
  row,
  name,
  onGo,
}: {
  row: BookRow;
  name: (id: string) => string;
  onGo: () => void;
}) {
  const n = row.connections.length;
  return (
    <details className={s.bookRow} name="book-rows" data-book-row={row.bookId}>
      <summary>
        <span className={s.rowName}>{name(row.bookId)}</span>{' '}
        <span className={s.count}>
          {n} {n === 1 ? 'thread' : 'threads'}
        </span>
      </summary>
      <ul className={s.connections}>{cards(row.connections, 'book-panel', onGo)}</ul>
    </details>
  );
}
