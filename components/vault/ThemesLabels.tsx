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
import { camera as memory, prefersReducedMotion } from '@/lib/camera';
import {
  nearestConstellation,
  spreadLayout,
  STAR_STEP,
  type Constellation,
  type ThemesLayout,
} from './constellations';
import type { Point } from './layout';
import type { DrawOptions } from './starfield';
import type { ThemesData } from './useThemes';
import styles from './vault.module.css';

/** A reading's name slot when its sub-theme is open, in screen pixels. */
const CELL = { w: 250, h: 30 };
/** The zoom a sub-theme opens at. */
export const SPREAD_K = 3;
const SPREAD_MS = 650;
/** A constellation fills this share of the shorter side (as in the Vault). */
const FIT = 0.38;

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
  visibleArea: () => { w: number; h: number; cx: number; cy: number };
  /** A reading is being opened: remember the camera. */
  onOpen: () => void;
  /** Open this sub-theme (coming back from a reading, or from the theme tree). */
  request: { sub: string; n: number } | null;
  /** Keys act on the map (not in List mode). */
  keys: boolean;
  /** Where the camera is now (screen = world × k + x, y). */
  camera: () => { x: number; y: number; k: number };
  /** Fly back to the whole map of constellations. */
  home: () => void;
  /** The closest zoom allowed in Themes. */
  maxK: number;
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
  keys,
  camera,
  home,
  maxK,
}: ThemesLabelsProps) {
  const router = useRouter();
  const [open, setOpen] = useState<{ sub: string; at: Map<string, Point> } | null>(null);
  const [shown, setShown] = useState(false); // names in, once the stars have spread
  const anim = useRef(0);
  /**
   * Where Esc last stepped out to: a sub-theme's id (its readings just closed), 'constellation',
   * or null (the reader moved about freely, so the zoom decides).
   */
  const step = useRef<string | null>(null);

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
      step.current = null;
      memory.spread = sub;
      setShown(false);
      setOpen({ sub, at: positions });
      setLit(sub);
      flyTo(focus, SPREAD_K, 650);
      run(sub, positions, 0, 1, () => setShown(true));
    },
    [subOf, subPoint, visibleArea, flyTo, run, setLit, hidden, tOf],
  );

  /**
   * Close the open sub-theme. With `back` (Esc or the Back pill) the camera also steps out to the
   * sub-theme itself, its stars gathered round it again (owner, 2026-11-17: Esc steps out one level
   * at a time: readings → sub-theme → constellation → all the constellations).
   */
  const close = useCallback(
    (back = false) => {
      if (!open) return;
      const { sub, at } = open;
      memory.spread = null;
      setShown(false);
      setOpen(null);
      setLit(null);
      run(sub, at, 1, 0, () => setSpread(undefined));
      const centre = subPoint.get(sub);
      const s = subOf.get(sub);
      if (back && centre && s) {
        const a = visibleArea();
        const n = s.theme.subthemes[s.i]!.readings.length;
        const reach = STAR_STEP * Math.sqrt(n + 0.6) + 10;
        const k = Math.min(SPREAD_K, (Math.min(a.w, a.h) * 0.3) / reach);
        flyTo(centre, Math.min(maxK, k), 600);
        step.current = sub;
      }
    },
    [open, run, setLit, setSpread, subPoint, subOf, visibleArea, flyTo, maxK],
  );

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

  // A tap on the sky (owner, 2026-11-17): on or near a constellation flies into it; once its
  // sub-themes' names show, a tap on a sub-theme's stars opens it. Drags never count (the zoom
  // library swallows the click after one).
  const tapRef = useRef<(e: MouseEvent) => void>(() => {});
  useEffect(() => {
    tapRef.current = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!keys || !settled || e.button !== 0) return;
      if (!el?.closest('[data-testid="vault-view"]') || el.closest('a, button, input, dialog'))
        return;
      // An open sub-theme (its table of readings): a click outside the readings closes it, as Esc
      // does (owner, 2026-11-18).
      if (open) {
        // The table: its heading and every reading's name, with a little room around them.
        const parts = document.querySelectorAll('[data-reading], [data-testid="spread-head"]');
        let l = Infinity,
          t = Infinity,
          r = -Infinity,
          b = -Infinity;
        for (const p of parts) {
          const q = p.getBoundingClientRect();
          l = Math.min(l, q.left);
          t = Math.min(t, q.top);
          r = Math.max(r, q.right);
          b = Math.max(b, q.bottom);
        }
        const pad = 16;
        const inside =
          e.clientX >= l - pad &&
          e.clientX <= r + pad &&
          e.clientY >= t - pad &&
          e.clientY <= b + pad;
        if (!inside) close(true);
        return;
      }
      const view = document.querySelector('[data-testid="vault-view"]')!.getBoundingClientRect();
      const cam = camera();
      const p = {
        x: (e.clientX - view.left - cam.x) / cam.k,
        y: (e.clientY - view.top - cam.y) / cam.k,
      };
      const a = visibleArea();
      const subK =
        Math.min(
          ...layout.constellations.map((c) => Math.min(maxK, (Math.min(a.w, a.h) * FIT) / c.r)),
        ) * 0.9;
      if (cam.k >= subK) {
        let best: { id: string; d: number } | null = null;
        for (const c of layout.constellations)
          for (const sp of c.subs) {
            const n = subOf.get(sp.id)!.theme.subthemes[subOf.get(sp.id)!.i]!.readings.length;
            const reach = STAR_STEP * Math.sqrt(n + 0.6) + 14 / cam.k;
            const d = Math.hypot(p.x - sp.x, p.y - sp.y);
            if (d <= reach && (!best || d < best.d)) best = { id: sp.id, d };
          }
        if (best) {
          openSub(best.id);
          return;
        }
      }
      const c = nearestConstellation(layout, p);
      if (!c || Math.hypot(p.x - c.x, p.y - c.y) > c.r + 30 / cam.k) return;
      step.current = 'constellation';
      flyToConstellation(c);
    };
  });
  useEffect(() => {
    const onClick = (e: MouseEvent) => tapRef.current(e);
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

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

  // Esc steps out one level at a time (owner, 2026-11-17): an open sub-theme closes to the
  // sub-theme, a sub-theme to its constellation, a constellation to the whole map.
  useEffect(() => {
    if (!keys || !settled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
      if (open) {
        e.preventDefault();
        close(true);
        return;
      }
      e.preventDefault();
      const a = visibleArea();
      const last = step.current;
      if (last === 'constellation') {
        step.current = null;
        home();
        return;
      }
      let c = last
        ? layout.constellations.find((x) => x.subs.some((y) => y.id === last))
        : undefined;
      if (!c) {
        // No step to retrace: the constellation in the middle of the view, if close enough to it.
        const cam = camera();
        const at = { x: (a.cx - cam.x) / cam.k, y: (a.cy - cam.y) / cam.k };
        const near = nearestConstellation(layout, at);
        if (near && cam.k > Math.min(maxK, (Math.min(a.w, a.h) * FIT) / near.r) * 1.2) c = near;
      }
      if (c) {
        step.current = 'constellation';
        flyToConstellation(c);
      } else {
        step.current = null;
        home();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keys, settled, open, close, camera, visibleArea, layout, maxK, flyToConstellation, home]);
  useEffect(() => {
    if (!open || !shown || k >= SPREAD_K * 0.45) return;
    const id = requestAnimationFrame(() => close());
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

  // Sub-theme names show at one zoom for every constellation (owner, 2026-11-17): a little before
  // the zoom that frames the largest constellation, so flying to any of them shows its names, and
  // a large constellation never shows its names alone while the others show none.
  const area = visibleArea();
  const subK =
    Math.min(
      ...layout.constellations.map((c) => Math.min(maxK, (Math.min(area.w, area.h) * FIT) / c.r)),
    ) * 0.9;
  const near = k >= subK;
  const wide = area.w > 720;

  return (
    <>
      {layout.constellations.map((c, i) => {
        const t = data.themes[i]!;
        // The name sits beside its constellation, out from the oculus along a diagonal that
        // points back at its own figure (owner, 2026-11-17): always to one side, never straight
        // above or below (where it would seem to belong to a neighbour), tilted at most 60° from
        // level. On phones, where the ring fills the width, it sits small over its constellation.
        const d = Math.hypot(c.x, c.y) || 1;
        const sx = c.x >= 0 ? 1 : -1;
        const vx = sx * Math.max(Math.abs(c.x / d), 0.5);
        const vy = c.y / d;
        const vl = Math.hypot(vx, vy);
        const dir = { x: vx / vl, y: vy / vl };
        const side = !wide ? 'centre' : sx > 0 ? 'right' : 'left';
        const anchor = wide ? { x: c.x + dir.x * c.r, y: c.y + dir.y * c.r } : { x: c.x, y: c.y };
        const tilt = { ['--dy' as string]: dir.y } as React.CSSProperties;
        return (
          <Fragment key={c.id}>
            <button
              type="button"
              tabIndex={-1}
              className={`${styles.at} ${styles.constName} ${open ? styles.quiet : ''}`}
              style={{ ...at(anchor), ...tilt }}
              data-side={side}
              data-constellation={c.id}
              onClick={() => {
                close();
                step.current = 'constellation';
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
                    <span className={styles.subCount}>
                      {
                        // With a testament switched off, only the readings left (owner, 2026-11-17).
                        t.subthemes[j]!.readings.filter((r) => !hidden || tOf(r.bookId) !== hidden)
                          .length
                      }
                    </span>
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
              onClick={() => close(true)}
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
