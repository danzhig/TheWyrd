'use client';

/**
 * The names on the Themes ceiling, and a sub-theme opened up (PLAN §16; owner, 2026-11-17).
 * Loaded with the themes' data, so the Vault's first load carries none of it.
 *
 * - Constellation names always; sub-theme names once a constellation is near enough to read.
 * - Tapping a sub-theme opens it: the camera flies in, its stars (one per reading) move from
 *   their cluster into rows (`spreadLayout`) and every other star dims; each reading's name sits
 *   beside its star, a link into the reader. A long sub-theme runs down the screen: the reader
 *   pans through it. "← Back", Esc or zooming well out closes it.
 */
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/lib/camera';
import { spreadLayout, type Constellation, type ThemesLayout } from './constellations';
import type { Point } from './layout';
import type { DrawOptions } from './starfield';
import type { ThemesData } from './useThemes';
import styles from './vault.module.css';

/** A reading's name slot when its sub-theme is open, in screen pixels. */
const CELL = { w: 250, h: 30 };
/** The zoom a sub-theme opens at. */
export const SPREAD_K = 3;
const SPREAD_MS = 650;

export interface ThemesLabelsProps {
  data: ThemesData;
  layout: ThemesLayout;
  /** The zoom, quantised (labels update when it crosses a step). */
  k: number;
  /** The view is in Themes (not flying). */
  settled: boolean;
  tOf: (bookId: string) => 'ot' | 'nt';
  /** The Testaments filter: an opened sub-theme leaves this testament's readings out. */
  hidden?: 'ot' | 'nt';
  setLit: (sub: string | null) => void;
  setSpread: (s: DrawOptions['spread']) => void;
  flyTo: (p: Point, k: number, ms: number) => void;
  flyToConstellation: (c: Constellation) => void;
  /** The visible part of the screen (below the header), in pixels. */
  visibleArea: () => { w: number; h: number };
  /** A reading is being opened: remember the camera. */
  onOpen: () => void;
  /** Open this sub-theme (coming back from a reading, or from the theme tree). */
  request: { sub: string; n: number } | null;
}

const at = (p: Point) =>
  ({ ['--x' as string]: p.x, ['--y' as string]: p.y }) as React.CSSProperties;

export function readingHref(sectionId: string, sub: string, key?: string): string {
  if (!key) return `/read/${sectionId}/?theme=${sub}`;
  const [, c, v] = key.split('-')[0]!.split('.');
  return `/read/${sectionId}/?theme=${sub}#v-${c}-${v ?? 1}`;
}

export function ThemesLabels({
  data,
  layout,
  k,
  settled,
  tOf,
  hidden,
  setLit,
  setSpread,
  flyTo,
  flyToConstellation,
  visibleArea,
  onOpen,
  request,
}: ThemesLabelsProps) {
  const router = useRouter();
  const [open, setOpen] = useState<{ sub: string; at: Map<string, Point> } | null>(null);
  const [shown, setShown] = useState(false); // names in, once the stars have spread
  const anim = useRef(0);

  const subOf = useMemo(() => {
    const m = new Map<string, { theme: ThemesData['themes'][number]; i: number }>();
    for (const t of data.themes) t.subthemes.forEach((s, i) => m.set(s.id, { theme: t, i }));
    return m;
  }, [data]);
  const subPoint = useMemo(
    () => new Map(layout.constellations.flatMap((c) => c.subs.map((s) => [s.id, s] as const))),
    [layout],
  );

  const run = useCallback(
    (sub: string, positions: Map<string, Point>, from: number, to: number, done?: () => void) => {
      cancelAnimationFrame(anim.current);
      const ms = prefersReducedMotion() ? 0 : SPREAD_MS * Math.abs(to - from);
      const t0 = performance.now();
      const step = (now: number) => {
        const q = ms ? Math.min(1, (now - t0) / ms) : 1;
        const e = q < 0.5 ? 2 * q * q : 1 - (-2 * q + 2) ** 2 / 2;
        setSpread({ sub, t: from + (to - from) * e, at: positions });
        if (q < 1) anim.current = requestAnimationFrame(step);
        else done?.();
      };
      anim.current = requestAnimationFrame(step);
    },
    [setSpread],
  );

  const openSub = useCallback(
    (sub: string) => {
      const s = subOf.get(sub);
      const centre = subPoint.get(sub);
      if (!s || !centre) return;
      const readings = s.theme.subthemes[s.i]!.readings.filter(
        (r) => !hidden || tOf(r.bookId) !== hidden,
      );
      if (!readings.length) return;
      const a = visibleArea();
      const cols = Math.max(1, Math.min(4, Math.floor((a.w - 32) / CELL.w)));
      const cell = { w: CELL.w / SPREAD_K, h: CELL.h / SPREAD_K };
      const pts = spreadLayout(readings.length, centre, cell, cols);
      const positions = new Map(readings.map((r, i) => [`${sub}:${r.sectionId}`, pts[i]!]));
      // The camera: the rows' middle if they fit on screen, else their top.
      const rows = Math.ceil(readings.length / cols);
      const fits = rows * CELL.h < a.h - 80;
      const left = pts[0]!.x;
      const width = Math.min(readings.length, cols) * cell.w;
      const focus = {
        x: left + width / 2 - cell.w * 0.1,
        y: fits ? centre.y : pts[0]!.y + (a.h / 2 - 70) / SPREAD_K,
      };
      setShown(false);
      setOpen({ sub, at: positions });
      setLit(sub);
      flyTo(focus, SPREAD_K, 650);
      run(sub, positions, 0, 1, () => setShown(true));
    },
    [subOf, subPoint, visibleArea, flyTo, run, setLit, hidden, tOf],
  );

  const close = useCallback(() => {
    if (!open) return;
    const { sub, at } = open;
    setShown(false);
    setOpen(null);
    setLit(null);
    run(sub, at, 1, 0, () => setSpread(undefined));
  }, [open, run, setLit, setSpread]);

  // Requests from the Vault (back from a reading, the theme tree).
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    if (!request || !settled || openRef.current?.sub === request.sub) return;
    const id = requestAnimationFrame(() => openSub(request.sub));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.n, settled]);

  // The Testaments filter changed: lay the open sub-theme out again with what is shown.
  const shownHidden = useRef(hidden);
  useEffect(() => {
    if (shownHidden.current === hidden) return;
    shownHidden.current = hidden;
    const sub = openRef.current?.sub;
    if (!sub) return;
    const id = requestAnimationFrame(() => openSub(sub));
    return () => cancelAnimationFrame(id);
  }, [hidden, openSub]);

  // Esc closes; zooming well out closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, close]);
  useEffect(() => {
    if (!open || !shown || k >= SPREAD_K * 0.45) return;
    const id = requestAnimationFrame(close);
    return () => cancelAnimationFrame(id);
  }, [k, open, shown, close]);
  // Leaving Themes clears the spread.
  useEffect(
    () => () => {
      cancelAnimationFrame(anim.current);
      setSpread(undefined);
    },
    [setSpread],
  );

  const openInfo = open ? subOf.get(open.sub) : null;
  const openReadings = openInfo
    ? openInfo.theme.subthemes[openInfo.i]!.readings.filter((r) =>
        open!.at.has(`${open!.sub}:${r.sectionId}`),
      )
    : [];

  return (
    <>
      {layout.constellations.map((c, i) => {
        const t = data.themes[i]!;
        const near = c.r * k >= 110;
        return (
          <Fragment key={c.id}>
            <button
              type="button"
              tabIndex={-1}
              className={`${styles.at} ${styles.constName} ${open ? styles.quiet : ''}`}
              style={at({ x: c.x, y: c.y - c.r - 4 })}
              data-constellation={c.id}
              onClick={() => {
                close();
                flyToConstellation(c);
              }}
            >
              {t.title}
            </button>
            {near && !open
              ? c.subs.map((s, j) => (
                  <button
                    key={s.id}
                    type="button"
                    tabIndex={-1}
                    className={`${styles.at} ${styles.subName}`}
                    style={at(s)}
                    data-subtheme={s.id}
                    onPointerEnter={() => setLit(s.id)}
                    onPointerLeave={() => setLit(null)}
                    onClick={() => openSub(s.id)}
                  >
                    {t.subthemes[j]!.title}{' '}
                    <span className={styles.subCount}>{t.subthemes[j]!.readings.length}</span>
                  </button>
                ))
              : null}
          </Fragment>
        );
      })}

      {open && openInfo ? (
        <>
          {/* The opened sub-theme's name, above its rows. */}
          <p
            className={`${styles.at} ${styles.spreadHead}`}
            style={at({
              x: [...open.at.values()][0]!.x,
              y: [...open.at.values()][0]!.y - 40 / SPREAD_K,
            })}
            data-testid="spread-head"
          >
            <span className={styles.spreadTheme}>{openInfo.theme.title}</span>
            {openInfo.theme.subthemes[openInfo.i]!.title} · {openReadings.length} readings
          </p>
          {shown
            ? openReadings.map((r) => {
                const key = `${open.sub}:${r.sectionId}`;
                const href = readingHref(r.sectionId, open.sub, r.key);
                return (
                  <a
                    key={key}
                    href={href}
                    tabIndex={-1}
                    className={`${styles.at} ${styles.spreadName} ${r.library ? styles.passageLibrary : ''} ${r.key ? styles.spreadKey : ''}`}
                    style={at(open.at.get(key)!)}
                    data-reading={key}
                    data-testament={tOf(r.bookId)}
                    title={`${r.title} · ${r.display}${r.second ? ' (also in another theme)' : ''}`}
                    onClick={(e) => {
                      // A client navigation keeps the Vault's memory (Themes, the camera).
                      e.preventDefault();
                      onOpen();
                      router.push(href);
                    }}
                  >
                    <span className={styles.spreadTitle}>{r.title}</span>
                    <span className={styles.spreadRef}>{r.display}</span>
                  </a>
                );
              })
            : null}
        </>
      ) : null}
      {/* On the page, not in the label layer (which is translated with the camera). */}
      {open && typeof document !== 'undefined'
        ? createPortal(
            <button
              type="button"
              className={styles.spreadBack}
              onClick={close}
              data-testid="spread-back"
            >
              ← {openInfo?.theme.title ?? 'Themes'}
            </button>,
            document.body,
          )
        : null}
    </>
  );
}
