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
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TYPE_LABEL, TYPE_ORDER, threadHref } from '@/lib/threads';
import type { ConnectionType, PublicConnections } from '@/lib/types';
import type { Point } from './layout';
import { arcsFor, nearestArc } from './threads';
import s from './threads.module.css';

let dataPromise: Promise<PublicConnections> | null = null;
export function loadConnections(): Promise<PublicConnections> {
  dataPromise ??= fetch('/data/connections.json')
    .then((r) => {
      if (!r.ok) throw new Error(`connections.json ${r.status}`);
      return r.json() as Promise<PublicConnections>;
    })
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
  /** An arc was chosen (from the map or the list): the camera may bring it into view. */
  onShowArc?: (mid: Point) => void;
}

export function ThreadsMode({
  homes,
  arcHost,
  nameOf,
  listVisible,
  onOpen,
  onShowArc,
}: ThreadsModeProps) {
  const [data, setData] = useState<PublicConnections | null>(null);
  const [types, setTypes] = useState<Set<ConnectionType>>(() => new Set(TYPE_ORDER));
  const [selected, setSelected] = useState<string | null>(null);
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

  const present = useMemo(() => {
    const counts = new Map<ConnectionType, number>();
    for (const c of data?.connections ?? []) counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
    return TYPE_ORDER.filter((t) => counts.has(t)).map((t) => ({ type: t, n: counts.get(t)! }));
  }, [data]);
  const arcs = useMemo(
    () => (data ? arcsFor(data.connections, homes, types) : []),
    [data, homes, types],
  );
  const arc = arcs.find((a) => a.key === selected) ?? null;
  // The SVG box: every home inside it, with room for the arcs' bows.
  const R = useMemo(
    () => Math.max(...[...homes.values()].map((h) => Math.hypot(h.x, h.y) + h.r)) + 40,
    [homes],
  );

  const open = (key: string, from?: HTMLElement | null) => {
    opener.current = from ?? null;
    setSelected(key);
    const a = arcs.find((x) => x.key === key);
    if (a) onShowArc?.(a.mid);
  };
  // A tap near an arc opens it. One path per arc (the node budget), so taps are matched to the
  // nearest arc in scene coordinates rather than by a wide hit stroke on each.
  const svgRef = useRef<SVGSVGElement>(null);
  const arcsRef = useRef(arcs);
  const openRef = useRef(open);
  useEffect(() => {
    arcsRef.current = arcs;
    openRef.current = open;
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
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const close = () => {
    setSelected(null);
    if (opener.current?.isConnected) opener.current.focus();
  };

  // The panel takes focus when it opens; Esc closes it.
  useEffect(() => {
    if (!arc) return;
    headingRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arc?.key]);

  const label = (a: { a: string; b: string }) => `${nameOf(a.a)} ↔ ${nameOf(a.b)}`;

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
              {arcs.map((a) => (
                <path
                  key={a.key}
                  d={a.d}
                  pathLength={1}
                  className={`${s.line} ${selected === a.key ? s.selected : ''}`}
                  strokeWidth={selected === a.key ? a.width * 1.6 : a.width}
                  data-arc={a.key}
                  data-count={a.connections.length}
                />
              ))}
            </svg>,
            arcHost,
          )
        : null}

      {/* The filter: one chip per type of link present. */}
      <div className={s.filter} role="group" aria-label="Types of link" data-testid="thread-filter">
        {present.map(({ type, n }) => (
          <button
            key={type}
            type="button"
            className={s.chip}
            aria-pressed={types.has(type)}
            data-type={type}
            onClick={() => {
              setTypes((prev) => {
                const next = new Set(prev);
                if (next.has(type)) next.delete(type);
                else next.add(type);
                return next;
              });
              setSelected(null);
            }}
          >
            {TYPE_LABEL[type]} <span className={s.count}>{n}</span>
          </button>
        ))}
      </div>

      {/* The arcs as a list: the accessible structure of Threads, shown by List. */}
      <section
        className={listVisible ? s.list : 'visually-hidden'}
        aria-label="Threads, as a list"
        data-testid="thread-list"
      >
        <h2 className={s.listHeading}>Threads</h2>
        <p className={s.meta}>
          {data
            ? `${data.connections.length} connections between ${new Set(arcs.flatMap((a) => [a.a, a.b])).size} books`
            : 'Loading…'}
        </p>
        <ul className={s.pairs}>
          {arcs.map((a) => (
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
      </section>

      {arc ? (
        <aside className={s.panel} aria-labelledby="arc-heading" data-testid="arc-panel">
          <header className={s.panelHead}>
            <h2 id="arc-heading" ref={headingRef} tabIndex={-1} className={s.panelTitle}>
              {label(arc)}
            </h2>
            <button type="button" className={s.close} onClick={close} aria-label="Close">
              <span aria-hidden="true">×</span>
            </button>
          </header>
          <ul className={s.connections}>
            {arc.connections.map((c) => (
              <li key={c.id} data-panel-connection={c.id}>
                <p className={s.type}>{TYPE_LABEL[c.type]}</p>
                <p className={s.connTitle}>{c.label}</p>
                <p className={s.ends}>
                  {c.ends.map((e, i) => (
                    <span key={i}>
                      {i ? <span aria-hidden="true"> ↔ </span> : null}
                      <Link
                        href={threadHref(c.id, e)}
                        prefetch={false}
                        onClick={onOpen}
                        data-open-end={`${c.id}:${i}`}
                      >
                        {e.display}
                      </Link>
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </>
  );
}
