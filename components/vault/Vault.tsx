'use client';

import type { Selection } from 'd3-selection';
import type { ZoomBehavior, ZoomTransform } from 'd3-zoom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { camera, easeCamera, prefersReducedMotion } from '@/lib/camera';
import { animationsOn, bookIn, bookOut, END_EVENT, transition } from '@/lib/transition';
import { CHANGE_EVENT, readLast, readProgress, readSettings, writeSettings } from '@/lib/store';
import type { Testaments } from '@/lib/store';
import { GROUP_ORDER, type VaultData } from './data';
import { nearestConstellation, type Constellation } from './constellations';
import { layoutVault, type Medallion, type Point } from './layout';
import { ThemeTree } from './ThemeTree';
import type { StarHide } from './starfield';
import { useThemes } from './useThemes';
import styles from './vault.module.css';

export interface VaultBook {
  id: string;
  name: string;
  tagline: string;
  taglineDraft?: boolean;
  group: string;
  inPlan: boolean;
  /** A library book (Phase 5): its stops are counted in the library's ledger. */
  library?: boolean;
  stops: string[]; // section ids that count toward progress
  minutes: number;
}

export interface VaultProps {
  data: VaultData;
  books: VaultBook[];
  bridges: { id: string; title: string; after: string }[];
  /** Section id → [title, bookId] (compact: it is inlined in the page). */
  sections: Record<string, [title: string, bookId: string]>;
}

const subscribe = (cb: () => void) => {
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
};

/** Reader state as a stable string: last section | completed ids. */
function useReaderKey(): string {
  return useSyncExternalStore(
    subscribe,
    () =>
      `${readLast()?.sectionId ?? ''}|${Object.keys(readProgress()).sort().join(',')}|${Object.keys(
        readProgress('library'),
      )
        .sort()
        .join(',')}`,
    () => '||',
  );
}

/** Groups of the New Testament; every other book (and every bridge) is the Old. */
const NT_GROUPS = new Set(['Gospels', 'Acts', 'Letters', 'Apocalypse']);

/** A camera position: translate (x, y), then scale k. */
type Cam = { x: number; y: number; k: number };

const FLY_MS = 850;
const K_MAX = 2.6; // medallion detail
const K_MAX_THEMES = 5; // passage labels in a constellation
// The focused constellation's passages become links once it is this wide on screen (px).
const PASSAGE_PX = 260;
// …and their references show beside their stars from this zoom.
const PASSAGE_LABEL_K = 2.6;

/** A point on the ceiling, for the label layer: world units, scaled by --k in CSS. */
const at = (p: { x: number; y: number }) =>
  ({ ['--x' as string]: p.x, ['--y' as string]: p.y }) as React.CSSProperties;

/** A passage's address in the reader: its section, at its first verse (WEBC numbering). */
function passageHref(sectionId: string, ref: string, subId: string): string {
  const [, c, v] = ref.split('-')[0]!.split('.');
  return `/read/${sectionId}/?theme=${subId}#v-${c}-${v ?? 1}`;
}

export function Vault({ data, books, bridges, sections }: VaultProps) {
  const router = useRouter();
  const viewRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const labelLayerRef = useRef<HTMLDivElement>(null);
  const cloudRefs = useRef<(HTMLDivElement | null)[]>([]);
  const zoomRef = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null);
  const selRef = useRef<Selection<HTMLDivElement, unknown, null, undefined> | null>(null);
  const baseRef = useRef<Cam>({ x: 0, y: 0, k: 1 });
  const camRef = useRef<Cam>({ x: 0, y: 0, k: 1 }); // where the camera is now
  const d3Ref = useRef<typeof import('./d3') | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const [kq, setKq] = useState(0); // zoom, quantised: labels update only when it crosses a step
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<'map' | 'list'>('map');
  const [focused, setFocused] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // The settings sheet loads on first use: it is not needed for the Vault's first paint.
  const [Sheet, setSheet] = useState<
    typeof import('@/components/ui/SettingsSheet').SettingsSheet | null
  >(null);
  const openSettings = () =>
    void import('@/components/ui/SettingsSheet').then((m) => {
      setSheet(() => m.SettingsSheet);
      setSettingsOpen(true);
    });
  // Book transitions: the ceiling dims behind a flying book; the medallion it left is hidden.
  // Start dimmed when a book is on its way home (closed on its page, or via the back button).
  const [dimmed, setDimmed] = useState(
    () =>
      typeof window !== 'undefined' &&
      (transition.pending?.kind === 'book-out' || (!!camera.fromBook && animationsOn())),
  );
  const [lifted, setLifted] = useState<string | null>(null);
  // Threads (Phase 4, P4.3): arcs between books over the spiral. Their code and data load only
  // when switched on (the Vault's first load is near its budget).
  const [threadsOn, setThreadsOn] = useState(() => typeof window !== 'undefined' && camera.threads);
  const [threadsMod, setThreadsMod] = useState<typeof import('./ThreadsMode') | null>(null);
  const [arcHost, setArcHost] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    camera.threads = threadsOn;
    if (threadsOn && !threadsMod) void import('./ThreadsMode').then((m) => setThreadsMod(m));
  }, [threadsOn, threadsMod]);

  const readerKey = useReaderKey();
  const [lastSection, doneList, libraryList] = readerKey.split('|');
  const done = useMemo(() => new Set((doneList ?? '').split(',').filter(Boolean)), [doneList]);
  const libraryDone = useMemo(
    () => new Set((libraryList ?? '').split(',').filter(Boolean)),
    [libraryList],
  );

  const layout = useMemo(
    () => layoutVault(data.path, data.bridges, data.satellites, data.offpath, GROUP_ORDER),
    [data],
  );
  const byId = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  // The Testaments filter (owner, 2026-11-17): show the Old, the New, or both. It filters what the
  // Vault shows (books, names, stars, threads and the lists); the path and progress are untouched.
  const testaments = useSyncExternalStore<Testaments>(
    subscribe,
    () => readSettings().testaments,
    () => 'both',
  );
  const hide = testaments === 'both' ? undefined : testaments === 'ot' ? 'nt' : 'ot';
  const tOf = useCallback(
    (id: string) => (NT_GROUPS.has(byId.get(id)?.group ?? '') ? 'nt' : 'ot'),
    [byId],
  );
  // Turning a testament off shows only the other; turning it back on shows both.
  const toggleTestament = (t: 'ot' | 'nt') => {
    const other = t === 'ot' ? 'nt' : 'ot';
    writeSettings({ testaments: testaments === other ? 'both' : other });
  };
  const hideRef = useRef<StarHide | undefined>(undefined);
  const placed = useMemo(
    () => [...layout.medallions, ...layout.satellites] as Medallion[],
    [layout],
  );

  // Where each book's stars live in the Spiral view: its medallion, on the spiral or the outer ring.
  const homes = useMemo(() => {
    const h = new Map<string, Point & { r: number }>();
    for (const m of [...layout.medallions, ...layout.satellites])
      h.set(m.id, { x: m.x, y: m.y, r: m.w / 2 });
    for (const o of layout.offpath) h.set(o.id, { x: o.x, y: o.y, r: o.size / 2 });
    return h;
  }, [layout]);
  const {
    view: themeView,
    data: themeData,
    layout: themeLayout,
    canvasRef: starCanvas,
    spiralRef,
    spiralLabelsRef,
    labelsRef,
    draw: drawThemes,
    switchTo: switchThemes,
    setLit,
  } = useThemes({ camRef, homes, hideRef });
  const drawStars = useRef(drawThemes);
  const themesLayout = useRef(themeLayout);
  useLayoutEffect(() => {
    drawStars.current = drawThemes;
    themesLayout.current = themeLayout;
  }, [drawThemes, themeLayout]);
  // The stars of a testament switched off fade out (and back in), on the one canvas.
  const shownHide = useRef(hide);
  useEffect(() => {
    if (shownHide.current === hide) return;
    const by = (h: string | undefined) => (h ? (id: string) => tOf(id) === h : null);
    const st: StarHide = { prev: by(shownHide.current), next: by(hide), t: 0 };
    shownHide.current = hide;
    hideRef.current = st;
    const t0 = performance.now();
    const ms = prefersReducedMotion() ? 0 : 450;
    let raf = 0;
    const step = (now: number) => {
      st.t = ms ? Math.min(1, (now - t0) / ms) : 1;
      drawStars.current(camRef.current);
      if (st.t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [hide, tOf]);
  const [focusC, setFocusC] = useState<string | null>(null);
  const passageOf = useMemo(
    () =>
      new Map(
        (themeData?.themes ?? []).flatMap((t) =>
          t.subthemes.flatMap((s) =>
            s.passages.map((p) => [`${s.id}:${p.ref}` as string, p] as const),
          ),
        ),
      ),
    [themeData],
  );

  const currentBook = lastSection ? sections[lastSection]?.[1] : undefined;
  const currentMedallion = layout.medallions.find((m) => m.id === currentBook);
  const sparkAt = currentMedallion ?? layout.medallions[0]!;

  // ---------------------------------------------------------------------------------------------
  // Camera
  // ---------------------------------------------------------------------------------------------

  // The zoom at which the names were last laid out (see `settleLabels`).
  const labelK = useRef<number | null>(null);
  const settleLabels = useCallback((t: Cam) => {
    const labels = labelLayerRef.current;
    if (!labels) return;
    labelK.current = t.k;
    labels.style.setProperty('--k', String(t.k));
    // Show the names that are big enough to read at this zoom (and taglines on the biggest).
    for (const el of labels.querySelectorAll<HTMLElement>('[data-label-min]')) {
      el.toggleAttribute('data-shown', t.k >= Number(el.dataset.labelMin));
      if (el.dataset.detailMin)
        el.toggleAttribute('data-detail', t.k >= Number(el.dataset.detailMin));
    }
    labels.style.transform = `translate(${Math.round(t.x)}px, ${Math.round(t.y)}px)`;
  }, []);

  const apply = useCallback(
    (t: Cam) => {
      const scene = sceneRef.current;
      const view = viewRef.current;
      if (!scene || !view) return;
      camRef.current = { x: t.x, y: t.y, k: t.k };
      scene.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.k})`;
      // Names follow the camera. While it moves they are only scaled with it (cheap); when it
      // comes to rest `settleLabels` lays them out again at their real pixel size (sharp).
      const labels = labelLayerRef.current;
      if (labels) {
        if (labelK.current === null) settleLabels(t);
        else
          labels.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.k / labelK.current})`;
      }
      const cx = view.clientWidth / 2;
      const cy = view.clientHeight / 2;
      cloudRefs.current.forEach((el, i) => {
        if (!el) return;
        const depth = [0.03, 0.06, 0.1][i]!;
        const px = (t.x - cx) * depth + pointer.current.x * (i + 1) * 6;
        const py = (t.y - cy) * depth + pointer.current.y * (i + 1) * 6;
        el.style.transform = `translate3d(${px}px, ${py}px, 0)`;
      });
      const q = Math.round(Math.log2(t.k) * 6) / 6;
      setKq((prev) => (prev === q ? prev : q));
      // Themes: the stars follow the camera, and the constellation in view gets its passage links.
      drawStars.current(t);
      const tl = themesLayout.current;
      if (tl) {
        const c = nearestConstellation(tl, { x: (cx - t.x) / t.k, y: (cy - t.y) / t.k });
        setFocusC((prev) => (prev === (c?.id ?? null) ? prev : (c?.id ?? null)));
      }
    },
    [settleLabels],
  );

  /**
   * The part of the screen the ceiling really shows: below the header and, on phones, above the
   * switch and zoom buttons at the foot. Flights centre their target here, not in the window.
   */
  const visibleArea = useCallback(() => {
    const view = viewRef.current!;
    const w = view.clientWidth;
    const h = view.clientHeight;
    // On narrow screens the header spans the whole width; on wide ones it keeps to the corners,
    // leaving the middle of the top edge open.
    const top =
      w <= 720 ? Math.min(h * 0.3, hudRef.current?.getBoundingClientRect().bottom ?? 0) : 0;
    const bottom = h - (w <= 520 ? 90 : 0);
    return { w, h: Math.max(120, bottom - top), cx: w / 2, cy: (top + bottom) / 2 };
  }, []);

  /** The whole spiral, fitted to the visible part of the screen. */
  const fit = useCallback((): Cam => {
    const a = visibleArea();
    const k = Math.min(a.w, a.h) / (2 * layout.spiralRadius + 24);
    return { x: a.cx, y: a.cy, k };
  }, [layout.spiralRadius, visibleArea]);

  const target = useCallback(
    (p: { x: number; y: number }, k: number): Cam => {
      const a = visibleArea();
      return { x: a.cx - p.x * k, y: a.cy - p.y * k, k };
    },
    [visibleArea],
  );

  /** A camera position as the zoom library's transform. */
  const toD3 = (t: Cam): ZoomTransform =>
    d3Ref.current!.zoomIdentity.translate(t.x, t.y).scale(t.k);

  /** Animate the camera; resolves when it lands (immediately under reduced motion). */
  const flyTo = useCallback(
    (cam: Cam, ms = FLY_MS): Promise<void> => {
      const sel = selRef.current;
      const z = zoomRef.current;
      if (!sel || !z) {
        apply(cam); // the zoom library is still loading: jump
        settleLabels(cam);
        return Promise.resolve();
      }
      const t = toD3(cam);
      if (prefersReducedMotion() || ms === 0) {
        z.transform(sel, t);
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        sel
          .transition()
          .duration(ms)
          .ease(easeCamera)
          .call(z.transform, t)
          .on('end interrupt', () => resolve());
      });
    },
    [apply, settleLabels],
  );

  useLayoutEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const minK = () => Math.min(view.clientWidth, view.clientHeight) / (2 * layout.radius);
    baseRef.current = fit();

    // Start where the reader last left the ceiling (or fitted to the screen), placed at once,
    // before the zoom library arrives, so the first paint is already right.
    const resume = camera.last ?? baseRef.current;
    apply(resume);

    // Coming back from a book: its closed book shrinks back into this medallion (lib/transition).
    transition.medallionRect = (bookId) => {
      const el = sceneRef.current?.querySelector<HTMLElement>(`a[data-book="${bookId}"]`);
      if (!el) return null;
      setDimmed(false); // the ceiling brightens as the book flies home
      return el.getBoundingClientRect();
    };
    const back = camera.fromBook;
    camera.fromBook = null;
    if (back && transition.pending?.kind !== 'book-out' && animationsOn()) {
      // Arrived by the browser's back button: the book was not closed on its page, so close it here.
      const b = byId.get(back);
      if (b) void bookOut(back, b.name, b.tagline, null);
    }

    // Then the zoom library takes over the camera: pinch, wheel, drag and flights.
    let alive = true;
    let sel: Selection<HTMLDivElement, unknown, null, undefined> | null = null;
    let z: ZoomBehavior<HTMLDivElement, unknown> | null = null;
    void import('./d3').then((d3) => {
      if (!alive) return;
      d3Ref.current = d3;
      sel = d3.select(stageRef.current ?? view);
      z = d3
        .zoom<HTMLDivElement, unknown>()
        .scaleExtent([minK(), K_MAX])
        .filter((e: Event) => !(e.type === 'dblclick') && !(e as MouseEvent).button)
        .on('start', () => {
          sceneRef.current?.classList.add(styles.moving!);
          labelLayerRef.current?.classList.add(styles.moving!);
        })
        .on('zoom', (e: { transform: ZoomTransform }) => apply(e.transform))
        .on('end', (e: { transform: ZoomTransform }) => {
          sceneRef.current?.classList.remove(styles.moving!);
          labelLayerRef.current?.classList.remove(styles.moving!);
          settleLabels(camRef.current);
          camera.last = { x: e.transform.x, y: e.transform.y, k: e.transform.k };
        });
      zoomRef.current = z;
      selRef.current = sel;
      sel.call(z);
      z.transform(sel, toD3(camRef.current));
      setReady(true);
      document.documentElement.dataset.vault = 'ready';
    });

    const onResize = () => {
      baseRef.current = fit();
      z?.scaleExtent([minK(), K_MAX]);
    };
    window.addEventListener('resize', onResize);
    return () => {
      alive = false;
      window.removeEventListener('resize', onResize);
      sel?.on('.zoom', null);
      zoomRef.current = null;
      selRef.current = null;
      transition.medallionRect = null;
    };
  }, [apply, byId, fit, flyTo, layout.radius, placed, settleLabels, target]);

  // Themes zoom further in, to the passages of one constellation.
  useEffect(() => {
    const z = zoomRef.current;
    const view = viewRef.current;
    if (!z || !view) return;
    const minK = Math.min(view.clientWidth, view.clientHeight) / (2 * layout.radius);
    z.scaleExtent([minK, themeView === 'spiral' ? K_MAX : K_MAX_THEMES]);
    if (themeView === 'spiral' && camRef.current.k > K_MAX)
      void flyTo(
        target(
          {
            x: (view.clientWidth / 2 - camRef.current.x) / camRef.current.k,
            y: (view.clientHeight / 2 - camRef.current.y) / camRef.current.k,
          },
          K_MAX,
        ),
        400,
      );
  }, [themeView, ready, layout.radius, flyTo, target]);

  /** Spiral ⇄ Themes: the camera settles back to the whole ceiling while the stars fly. */
  const switchView = useCallback(
    (to: 'spiral' | 'themes') => {
      const base = baseRef.current;
      if (Math.abs(camRef.current.k - base.k) / base.k > 0.15 || to === 'spiral')
        void flyTo(base, prefersReducedMotion() ? 0 : 1100);
      if (to === 'themes') setThreadsOn(false);
      void switchThemes(to, mode === 'list');
    },
    [flyTo, switchThemes, mode],
  );

  const flyToConstellation = useCallback(
    (c: Constellation) => {
      if (!viewRef.current) return;
      // Fit the constellation and its name (above it) in the visible part of the screen.
      const a = visibleArea();
      const k = Math.min(K_MAX_THEMES, (Math.min(a.w, a.h) * 0.42) / c.r);
      void flyTo(target({ x: c.x, y: c.y - 8 / k }, k), 700);
    },
    [flyTo, target, visibleArea],
  );

  // The theme tree (P6.4): focusing a passage lights its sub-theme and, on the map, flies the
  // camera to its star; opening one remembers where the camera is, to come back to.
  const onTreeFocus = useCallback(
    (key: string | null) => {
      setLit(key ? key.split(':')[0]! : null);
      if (!key || mode !== 'map') return;
      const s = themesLayout.current?.stars.find((x) => x.key === key);
      if (s && viewRef.current)
        void flyTo(target(s, Math.max(camRef.current.k, Math.min(K_MAX_THEMES, 3))), 450);
    },
    [mode, setLit, flyTo, target],
  );
  const onTreeOpen = useCallback(() => {
    camera.last = { ...camRef.current };
  }, []);

  // When the themes arrive (after the camera was placed, e.g. coming back to the Vault in
  // Themes), work out the constellation in view so its passage links appear.
  useEffect(() => {
    if (themeLayout) apply(camRef.current);
  }, [themeLayout, apply]);

  // Back from a passage opened in a constellation (`/?theme=<sub-theme>`, the reader's up link):
  // show that sub-theme again, close enough to pick another of its passages. Within a visit the
  // Vault is already in Themes where the reader left it; on a fresh load it switches and flies.
  const themeReturn = useRef(false);
  useEffect(() => {
    if (!ready || themeReturn.current) return;
    themeReturn.current = true;
    const sub = new URLSearchParams(window.location.search).get('theme');
    if (!sub) return;
    window.history.replaceState(window.history.state, '', '/');
    if (themeView === 'themes') return;
    void (async () => {
      await switchThemes('themes');
      const s = themesLayout.current?.constellations
        .flatMap((c) => c.subs)
        .find((x) => x.id === sub);
      if (s) void flyTo(target(s, Math.min(K_MAX_THEMES, 3)), 900);
    })();
  }, [ready, themeView, switchThemes, flyTo, target]);

  // Parallax against the pointer (off under reduced motion).
  useEffect(() => {
    const view = viewRef.current;
    if (!view || prefersReducedMotion()) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      pointer.current = {
        x: e.clientX / view.clientWidth - 0.5,
        y: e.clientY / view.clientHeight - 0.5,
      };
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        apply(camRef.current);
      });
    };
    view.addEventListener('pointermove', onMove);
    return () => {
      view.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
    };
  }, [apply]);

  // Whatever happens to a transition, the ceiling ends up bright.
  useEffect(() => {
    const undim = () => setDimmed(false);
    window.addEventListener(END_EVENT, undim);
    return () => window.removeEventListener(END_EVENT, undim);
  }, []);

  // ---------------------------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------------------------

  const openBook = useCallback(
    async (id: string) => {
      const m = placed.find((x) => x.id === id) ?? layout.offpath.find((x) => x.id === id);
      const view = viewRef.current;
      if (!m || !view || mode === 'list' || prefersReducedMotion()) {
        router.push(`/book/${id}/`);
        return;
      }
      // The medallion becomes a closed book that lifts off and flies to the centre, where the
      // book's page opens it. The ceiling dims and leans in only slightly behind it.
      const el = sceneRef.current?.querySelector<HTMLElement>(`a[data-book="${id}"]`);
      const b = byId.get(id);
      if (!el || !b) return router.push(`/book/${id}/`);
      const now = camRef.current;
      const before = { x: now.x, y: now.y, k: now.k };
      setLifted(id);
      setDimmed(true);
      await Promise.all([
        flyTo(target(m, now.k * 1.12), 700),
        bookIn(id, b.name, b.tagline, el.getBoundingClientRect()),
      ]);
      // The lean-in is only a gesture: coming back, the ceiling returns to where it was.
      camera.last = before;
      router.push(`/book/${id}/`);
    },
    [byId, flyTo, layout.offpath, mode, placed, router, target],
  );

  // Zoom buttons build on the previous click's target, so quick taps add up.
  const pendingK = useRef<number | null>(null);
  const zoomTap = useRef(0);
  const zoomBy = (f: number) => {
    const sel = selRef.current;
    const z = zoomRef.current;
    const view = viewRef.current;
    if (!sel || !z || !view) return;
    const [lo, hi] = z.scaleExtent();
    const k = Math.min(hi, Math.max(lo, (pendingK.current ?? camRef.current.k) * f));
    pendingK.current = k;
    const tap = ++zoomTap.current;
    // Only the latest tap clears the target: a quick next tap interrupts this one and builds on
    // it, but an interruption by anything else (a flight, the Spiral / Themes switch) means the
    // target was never reached, so the next tap starts from where the camera really is.
    const done = () => {
      if (zoomTap.current === tap) pendingK.current = null;
    };
    sel
      .transition()
      .duration(prefersReducedMotion() ? 0 : 250)
      .call(z.scaleTo, k)
      .on('end', done)
      .on('interrupt', done);
  };

  // Keyboard: arrows move focus along the spiral (the list links), and the camera follows.
  const listRef = useRef<HTMLOListElement>(null);
  const onListKey = (e: React.KeyboardEvent<HTMLOListElement>) => {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
    const links = [
      ...(listRef.current?.querySelectorAll<HTMLAnchorElement>('a[data-book], a[data-bridge]') ??
        []),
    ].filter((a) => a.getClientRects().length); // skip a testament switched off
    const i = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (i < 0) return;
    e.preventDefault();
    const next =
      links[
        e.key === 'ArrowRight' || e.key === 'ArrowDown'
          ? Math.min(links.length - 1, i + 1)
          : Math.max(0, i - 1)
      ];
    next?.focus();
  };
  const onListFocus = (id: string | null) => {
    setFocused(id);
    if (!id || mode !== 'map') return;
    const p =
      placed.find((m) => m.id === id) ??
      layout.offpath.find((o) => o.id === id) ??
      layout.bridges.find((b) => b.id === id);
    const view = viewRef.current;
    if (p && view) void flyTo(target(p, Math.max(camRef.current.k, baseRef.current.k * 1.6)), 450);
  };

  // ---------------------------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------------------------

  const k = 2 ** kq;
  const readIn = (b: VaultBook) => (b.library ? libraryDone : done);
  const readCount = (b: VaultBook) => b.stops.filter((s) => readIn(b).has(s)).length;
  const progressOf = (b: VaultBook) => (b.stops.length ? readCount(b) / b.stops.length : 0);
  const lastMedallion = sections[lastSection ?? ''];

  return (
    <div className={styles.vault} data-mode={mode} data-hide={hide}>
      <header ref={hudRef} className={styles.hud}>
        <h1 className={styles.title}>Scripture as Story</h1>
        <div className={styles.actions}>
          {/* One way back into the reading (owner, 2026-11-16): where you left off, or the start. */}
          <Link
            href={lastMedallion ? `/read/${lastSection}/` : '/read/gen-01/'}
            className={`${styles.button} ${styles.continue}`}
            title={lastMedallion ? `Continue reading: ${lastMedallion[0]}` : 'Begin reading'}
            data-hud="continue"
            data-testid="continue"
          >
            {lastMedallion ? 'Continue' : 'Begin'}
            {/* Non-breaking spaces: a flex item drops ordinary ones at its edges. */}
            <span className={styles.continueTitle}>
              {'\u00a0·\u00a0'}
              {lastMedallion ? lastMedallion[0] : sections['gen-01']?.[0]}
            </span>
          </Link>
          {/* Two ways through the same Bible (PLAN §16): the story's spiral, or its themes. */}
          <div className={styles.switch} role="group" aria-label="View">
            {(['spiral', 'themes'] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={styles.switchButton}
                aria-pressed={themeView === v || themeView === `to-${v}`}
                onPointerEnter={() =>
                  v === 'themes' && void import('./useThemes').then((m) => m.loadThemes())
                }
                onClick={() => switchView(v)}
                data-testid={`view-${v}`}
              >
                {v === 'spiral' ? 'Spiral' : 'Themes'}
              </button>
            ))}
            {/* Threads (Phase 4): connections between passages, drawn over the spiral. */}
            <button
              type="button"
              className={styles.switchButton}
              aria-pressed={threadsOn}
              disabled={themeView !== 'spiral'}
              onPointerEnter={() => void import('./ThreadsMode').then((m) => m.loadConnections())}
              onClick={() => setThreadsOn((on) => !on)}
              data-testid="view-threads"
            >
              Threads
            </button>
          </div>
          {/* The Testaments filter: a view of either testament, or both (owner, 2026-11-17). */}
          <div
            className={`${styles.switch} ${styles.testaments}`}
            role="group"
            aria-label="Testaments"
            data-testid="testaments"
          >
            {(['ot', 'nt'] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={styles.switchButton}
                aria-pressed={testaments === 'both' || testaments === t}
                title={t === 'ot' ? 'Old Testament' : 'New Testament'}
                onClick={() => toggleTestament(t)}
                data-testid={`testament-${t}`}
              >
                {t === 'ot' ? 'Old' : 'New'}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.button}
            aria-pressed={mode === 'list'}
            data-hud="list"
            onClick={() => setMode((m) => (m === 'map' ? 'list' : 'map'))}
          >
            {mode === 'map' ? 'List' : 'Map'}
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={openSettings}
            data-hud="settings"
            aria-label="Reading settings"
          >
            Aa
          </button>
        </div>
        <nav className={styles.links} aria-label="More">
          <Link href="/search/" data-testid="search-link">
            Search
          </Link>
          <Link href="/path/" data-testid="path-link">
            The path
          </Link>
          <Link href="/about/" data-testid="about-link">
            About
          </Link>
          <Link href="/sources/" data-testid="sources-link">
            Sources
          </Link>
        </nav>
      </header>
      {Sheet ? <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} /> : null}

      {/* The stage takes every pan, pinch and wheel, whether it starts on the sky or on a name, a
          star or a sub-theme in the label layer above it (they are siblings, so the zoom sits here). */}
      <div ref={stageRef} className={styles.stage} data-testid="vault-stage">
        {/* The ceiling: decorative for assistive technology, which gets the list below. */}
        <div
          ref={viewRef}
          className={`vault-sky ${styles.view} ${ready ? styles.ready : ''} ${dimmed ? styles.dimmed : ''}`}
          aria-hidden="true"
          data-testid="vault-view"
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              ref={(el) => {
                cloudRefs.current[i] = el;
              }}
              className={`cloud-layer ${['cloud-far', 'cloud-mid', 'cloud-near'][i]} ${styles.cloud}`}
            />
          ))}
          <div ref={sceneRef} className={styles.scene} data-testid="vault-scene">
            {/* Light falling through the oculus, turning very slowly (still under reduced motion). */}
            <div className={styles.rays} aria-hidden="true" />
            {themeView !== 'themes' ? (
              <div
                ref={spiralRef}
                className={styles.spiralLayer}
                style={themeView === 'to-spiral' ? { opacity: 0 } : undefined}
                data-testid="spiral-layer"
              >
                <svg
                  className={styles.threadSvg}
                  width={layout.radius * 2}
                  height={layout.radius * 2}
                  viewBox={`${-layout.radius} ${-layout.radius} ${layout.radius * 2} ${layout.radius * 2}`}
                  style={{ left: -layout.radius, top: -layout.radius }}
                >
                  <path d={layout.thread} className={styles.thread} />
                  <path d={layout.threadUpTo(sparkAt.along)} className={styles.threadLit} />
                  {layout.detours.map((t) => (
                    <path key={t.id} d={t.d} className={styles.detour} data-detour={t.id} />
                  ))}
                </svg>
                {/* Threads' arcs are drawn here, under the medallions (ThreadsMode). */}
                <div ref={setArcHost} className={styles.arcHost} />
                {layout.offpath.map((o) => {
                  const b = byId.get(o.id)!;
                  // Books outside the path open into the library (Phase 5), with the same flight.
                  return (
                    <a
                      key={o.id}
                      href={`/book/${o.id}/`}
                      tabIndex={-1}
                      className={[
                        styles.offpath,
                        progressOf(b) > 0 ? styles.offStarted : '',
                        focused === o.id ? styles.focused : '',
                        lifted === o.id ? styles.lifted : '',
                      ].join(' ')}
                      style={{
                        left: o.x - o.size / 2,
                        top: o.y - o.size / 2,
                        width: o.size,
                        height: o.size,
                        ['--p' as string]: progressOf(b),
                      }}
                      data-book={o.id}
                      data-offpath={o.id}
                      data-testament={tOf(o.id)}
                      onClick={(e) => {
                        e.preventDefault();
                        void openBook(o.id);
                      }}
                    />
                  );
                })}
                {layout.bridges.map((br) => {
                  const b = bridges.find((x) => x.id === br.id)!;
                  return (
                    <a
                      key={br.id}
                      href={`/bridge/${br.id}/`}
                      tabIndex={-1}
                      className={`${styles.star} ${focused === br.id ? styles.focused : ''}`}
                      style={{ left: br.x, top: br.y }}
                      data-bridge={br.id}
                      data-testament="ot"
                      title={b.title}
                    >
                      ✦
                    </a>
                  );
                })}
                {placed.map((m) => {
                  const b = byId.get(m.id)!;
                  const screenW = m.w * k;
                  const p = progressOf(b);
                  return (
                    <a
                      key={m.id}
                      href={`/book/${m.id}/`}
                      tabIndex={-1}
                      data-book={m.id}
                      data-testament={tOf(m.id)}
                      className={[
                        styles.medallion,
                        screenW >= 56 ? styles.named : '',
                        screenW >= 150 ? styles.detailed : '',
                        focused === m.id ? styles.focused : '',
                        m.id === currentBook ? styles.current : '',
                        p >= 1 ? styles.finished : '',
                        lifted === m.id ? styles.lifted : '',
                      ].join(' ')}
                      style={{
                        left: m.x - m.w / 2,
                        top: m.y - m.h / 2,
                        width: m.w,
                        height: m.h,
                        ['--p' as string]: p,
                        ['--fs' as string]: `${Math.max(11, m.w * 0.17)}px`,
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        void openBook(m.id);
                      }}
                    >
                      {/* The name is drawn in the label layer (screen space, always sharp). */}
                    </a>
                  );
                })}
                <span
                  data-testament={tOf(sparkAt.id)}
                  className={styles.spark}
                  style={{ left: sparkAt.x, top: sparkAt.y - sparkAt.h / 2 - 10 }}
                />
              </div>
            ) : null}
          </div>
          {/* The passages as stars, in screen space (pixels, not elements: see starfield.ts). */}
          <canvas ref={starCanvas} className={styles.stars} data-testid="star-canvas" />
        </div>
        {/* The names sit outside the sky, so its vignette and grain never dim them; this frame
          fades and dims with it. */}
        <div
          className={`${styles.labelFrame} ${ready ? styles.ready : ''} ${dimmed ? styles.dimmed : ''}`}
          aria-hidden="true"
          data-testid="vault-label-frame"
        >
          {/* Every name on the ceiling, in screen space: it follows the camera (translate and --k,
              set in apply) but is never magnified, so text stays sharp at any zoom in every
              browser (Safari would otherwise stretch the scene's bitmap). */}
          <div ref={labelLayerRef} className={styles.labelLayer} data-testid="vault-labels">
            {themeView !== 'themes' ? (
              <div
                ref={spiralLabelsRef}
                className={styles.labelGroup}
                style={themeView === 'to-spiral' ? { opacity: 0 } : undefined}
                data-testid="spiral-labels"
              >
                {layout.groups.map((g) => (
                  <span
                    key={g.label}
                    className={`${styles.at} ${styles.group}`}
                    style={at(g)}
                    data-testament={NT_GROUPS.has(g.label) ? 'nt' : 'ot'}
                  >
                    {g.label}
                  </span>
                ))}
                {layout.offpath.map((o) => (
                  <span
                    key={o.id}
                    className={`${styles.at} ${styles.offName} ${lifted === o.id ? styles.gone : ''}`}
                    style={{ ...at(o), ['--w' as string]: o.size }}
                    data-label-min={40 / o.size}
                    data-testament={tOf(o.id)}
                  >
                    {byId.get(o.id)!.name}
                  </span>
                ))}
                {placed.map((m) => {
                  // Always in the page; which names show is decided when the camera comes to rest
                  // (`settleLabels`), so a flight never re-lays them out.
                  const b = byId.get(m.id)!;
                  return (
                    <span
                      key={m.id}
                      className={`${styles.at} ${styles.medName} ${lifted === m.id ? styles.gone : ''}`}
                      data-label-min={56 / m.w}
                      data-detail-min={150 / m.w}
                      style={{
                        ...at(m),
                        ['--w' as string]: m.w,
                        ['--fs' as string]: Math.max(11, m.w * 0.17),
                      }}
                      data-name={m.id}
                      data-testament={tOf(m.id)}
                    >
                      <span className={styles.medTitle}>{b.name}</span>
                      <span className={styles.medTag}>{b.tagline}</span>
                    </span>
                  );
                })}
              </div>
            ) : null}
            {themeView !== 'spiral' && themeData && themeLayout ? (
              <div
                ref={labelsRef}
                className={styles.themesLayer}
                style={themeView === 'to-themes' ? { opacity: 0 } : undefined}
                data-testid="themes-layer"
              >
                {/* Passages first, so the sub-theme names sit on top of their labels. */}
                {themeView === 'themes' &&
                (themeLayout.constellations.find((c) => c.id === focusC)?.r ?? 0) * 2 * k >=
                  PASSAGE_PX
                  ? themeLayout.stars
                      .filter((s) => s.themeId === focusC)
                      .map((s) => {
                        const p = passageOf.get(s.key);
                        if (!p) return null;
                        return (
                          <a
                            key={s.key}
                            href={passageHref(p.sectionId, p.ref, s.subId)}
                            tabIndex={-1}
                            className={`${styles.at} ${styles.passage} ${p.library ? styles.passageLibrary : ''}`}
                            style={at(s)}
                            data-passage={s.key}
                            data-testament={tOf(s.bookId)}
                            onClick={(e) => {
                              // A client navigation keeps the Vault's memory (Themes, the camera);
                              // remember exactly where the camera is, even mid-flight, to come back to.
                              e.preventDefault();
                              camera.last = { ...camRef.current };
                              router.push(passageHref(p.sectionId, p.ref, s.subId));
                            }}
                            onPointerEnter={() => setLit(s.subId)}
                            onPointerLeave={() => setLit(null)}
                          >
                            {/* The reference names the link; the section's title is its tooltip. */}
                            <span
                              className={`${styles.passageName} ${k >= PASSAGE_LABEL_K ? '' : styles.quiet}`}
                              title={p.sectionTitle}
                            >
                              {p.display}
                            </span>
                          </a>
                        );
                      })
                  : null}
                {themeLayout.constellations.map((c, i) => {
                  const t = themeData!.themes[i]!;
                  const open = c.r * k >= 110;
                  return (
                    <Fragment key={c.id}>
                      <button
                        type="button"
                        tabIndex={-1}
                        className={`${styles.at} ${styles.constName}`}
                        style={at({ x: c.x, y: c.y - c.r - 4 })}
                        data-constellation={c.id}
                        onClick={() => flyToConstellation(c)}
                      >
                        {t.title}
                      </button>
                      {open
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
                              onClick={() => void flyTo(target(s, K_MAX_THEMES), 600)}
                            >
                              {t.subthemes[j]!.title}
                            </button>
                          ))
                        : null}
                    </Fragment>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* What the two kinds of star mean (Themes only). */}
      {themeView !== 'spiral' && mode === 'map' ? (
        <p className={styles.legend} data-testid="themes-legend">
          <span className={styles.keyPath} aria-hidden="true" /> On the path
          <span className={styles.keyLibrary} aria-hidden="true" /> In the library
        </p>
      ) : null}
      {mode === 'map' ? (
        <div className={styles.zoomButtons}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => zoomBy(1.5)}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => zoomBy(1 / 1.5)}
            aria-label="Zoom out"
          >
            −
          </button>
        </div>
      ) : null}

      {threadsOn && threadsMod && themeView === 'spiral' ? (
        <threadsMod.ThreadsMode
          homes={homes}
          arcHost={arcHost}
          nameOf={(id) => byId.get(id)?.name ?? id}
          listVisible={mode === 'list'}
          hidden={hide}
          testamentOf={tOf}
          onOpen={() => {
            camera.last = { ...camRef.current };
          }}
        />
      ) : null}

      {/* In Themes, the accessible structure is the theme tree (shown by List). */}
      {themeView !== 'spiral' && themeData ? (
        <ThemeTree
          data={themeData}
          visible={mode === 'list'}
          hidden={hide}
          testamentOf={tOf}
          onFocusPassage={onTreeFocus}
          onOpen={onTreeOpen}
          hrefFor={passageHref}
        />
      ) : null}
      {/* The same content as an ordered list (PLAN §9 accessibility). Visible in List mode. */}
      <section
        className={mode === 'list' ? styles.list : 'visually-hidden'}
        aria-label="The path, as a list"
        hidden={themeView !== 'spiral' && !!themeData}
      >
        <ol ref={listRef} onKeyDown={onListKey} className={styles.pathList}>
          {data.path.map((p) => {
            const b = byId.get(p.id)!;
            const bridge = bridges.find((x) => x.after === p.id);
            const sat = data.satellites.filter((s) => s.of === p.id);
            const read = readCount(b);
            return [
              <li key={p.id} data-testament={tOf(p.id)}>
                <Link
                  href={`/book/${p.id}/`}
                  data-book={p.id}
                  onFocus={() => onListFocus(p.id)}
                  onBlur={() => onListFocus(null)}
                  onClick={(e) => {
                    if (mode === 'map') {
                      e.preventDefault();
                      void openBook(p.id);
                    }
                  }}
                >
                  <span className="book-name">{b.name}</span>
                </Link>
                <span className={styles.listMeta}>
                  {' '}
                  — {b.tagline} · {read} of {b.stops.length} read
                  {p.id === currentBook ? ' · you are here' : ''}
                </span>
                {sat.map((s) => (
                  <p key={s.id} className={styles.listSat} data-testament={tOf(s.id)}>
                    Optional detour:{' '}
                    <Link
                      href={`/book/${s.id}/`}
                      data-book={s.id}
                      onFocus={() => onListFocus(s.id)}
                      onBlur={() => onListFocus(null)}
                    >
                      {byId.get(s.id)!.name}
                    </Link>
                  </p>
                ))}
              </li>,
              bridge ? (
                <li key={bridge.id} className={styles.listBridge} data-testament="ot">
                  <Link
                    href={`/bridge/${bridge.id}/`}
                    data-bridge={bridge.id}
                    onFocus={() => onListFocus(bridge.id)}
                    onBlur={() => onListFocus(null)}
                  >
                    Bridge · {bridge.title}
                  </Link>
                </li>
              ) : null,
            ];
          })}
        </ol>
        <h2 className={styles.listHeading}>The library: not on this path</h2>
        {GROUP_ORDER.map((g) => {
          const members = data.offpath.filter((o) => o.group === g);
          if (!members.length) return null;
          return (
            <div key={g} data-testament={NT_GROUPS.has(g) ? 'nt' : 'ot'}>
              <h3 className="label">{g}</h3>
              <ul className={styles.offList}>
                {members.map((o) => {
                  const b = byId.get(o.id)!;
                  return (
                    <li key={o.id} data-offpath-item={o.id} data-testament={tOf(o.id)}>
                      <Link
                        href={`/book/${o.id}/`}
                        data-book={o.id}
                        onFocus={() => onListFocus(o.id)}
                        onBlur={() => onListFocus(null)}
                        onClick={(e) => {
                          if (mode === 'map') {
                            e.preventDefault();
                            void openBook(o.id);
                          }
                        }}
                      >
                        <span className="book-name">{b.name}</span>
                      </Link>{' '}
                      — {b.tagline} · {readCount(b)} of {b.stops.length} read
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>
    </div>
  );
}
