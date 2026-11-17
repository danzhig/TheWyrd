/**
 * The Themes view's stars, drawn on one canvas in screen space (PLAN §16, P6.3). Hundreds of
 * passages as DOM nodes would break the Vault's 300-node budget and its frame rate on phones, so
 * the stars are pixels; only the focused constellation's passages get DOM links (see Vault.tsx).
 * Path passages glow gold; library passages are paler.
 */
import type { Point } from './layout';
import { FLY_FROM, FLY_TO, flightT, starAt, type ThemesLayout } from './constellations';

export interface Cam {
  x: number;
  y: number;
  k: number;
}

export interface DrawOptions {
  /** Flight progress: 0 = every star at home in its book, 1 = in its constellation. */
  p: number;
  /** Reduced motion: stars stay in their constellations and fade in with `p` instead of flying. */
  fade: boolean;
  /** The sub-theme whose stars are lit up (hovered or focused), if any. */
  lit: string | null;
  /** Which way the flight is going: +1 out to the constellations, −1 home to the books. */
  dir?: 1 | -1;
  /** Books whose stars are hidden (the Testaments filter), fading from `prev` to `next` as t goes 0 → 1. */
  hide?: StarHide;
  /**
   * A sub-theme opened up (owner, 2026-11-17): its stars move from their cluster to `at` (world
   * units, by star key) as t goes 0 → 1, and every other star dims.
   */
  spread?: { sub: string; t: number; at: Map<string, Point> };
}

export interface StarHide {
  prev: ((bookId: string) => boolean) | null;
  next: ((bookId: string) => boolean) | null;
  t: number;
}

/** How visible a book's stars are (0–1) under the Testaments filter. */
export function starVisibility(h: StarHide | undefined, bookId: string): number {
  if (!h) return 1;
  const a = h.prev?.(bookId) ? 0 : 1;
  const b = h.next?.(bookId) ? 0 : 1;
  return a + (b - a) * h.t;
}

/** The night sky's colour (--night), for the veil over an opened sub-theme. */
const NIGHT = '#14100C';

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class StarField {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private gold = '#e7c873';
  private pale = '#c9c3b4';
  private glow: HTMLCanvasElement;

  constructor(
    private canvas: HTMLCanvasElement,
    private layout: ThemesLayout,
  ) {
    this.ctx = canvas.getContext('2d')!;
    const css = getComputedStyle(canvas);
    this.gold = css.getPropertyValue('--gold-light').trim() || this.gold;
    this.pale = css.getPropertyValue('--cloud').trim() || this.pale;
    // One soft glow, drawn once and stamped under every path star.
    this.glow = document.createElement('canvas');
    this.glow.width = this.glow.height = 32;
    const g = this.glow.getContext('2d')!;
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, this.gold);
    grad.addColorStop(1, 'transparent');
    g.fillStyle = grad;
    g.globalAlpha = 0.55;
    g.fillRect(0, 0, 32, 32);
    this.resize();
  }

  resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = this.canvas.clientWidth;
    this.h = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }

  clear(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Where each star is at progress p (world units); also used by tests through the Vault. */
  positions(p: number, fade: boolean): Point[] {
    return this.layout.stars.map((s) => (fade ? { x: s.x, y: s.y } : starAt(s, p)));
  }

  draw(cam: Cam, o: DrawOptions): void {
    const { ctx } = this;
    this.clear();
    if (o.p <= 0) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const X = (x: number) => cam.x + x * cam.k;
    const Y = (y: number) => cam.y + y * cam.k;
    // Reduced motion: everything in place, fading. Otherwise the stars appear as the bubbles
    // shrink away (and vanish into them on the way home), and the lines draw in once they land.
    const starsAlpha = o.fade ? o.p : smooth(0.02, FLY_FROM, o.p);
    // An opened sub-theme: a veil over the sky, and every other star and line steps back.
    const st = o.spread?.t ?? 0;
    if (st > 0) {
      ctx.globalAlpha = 0.5 * st;
      ctx.fillStyle = NIGHT;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.globalAlpha = 1;
    }
    const lines = (o.fade ? o.p : smooth(FLY_TO, 1, o.p)) * 0.75 * (1 - 0.85 * st);
    const flying = !o.fade && o.p > FLY_FROM && o.p < FLY_TO;
    const dir = o.dir ?? 1;

    // Where each star is now, in screen pixels.
    const n = this.layout.stars.length;
    const xs = new Float32Array(n);
    const ys = new Float32Array(n);
    this.layout.stars.forEach((s, i) => {
      let at = o.fade ? { x: s.x, y: s.y } : starAt(s, o.p);
      const to = o.spread && s.subId === o.spread.sub ? o.spread.at.get(s.key) : undefined;
      if (to) {
        const t = o.spread!.t;
        at = { x: at.x + (to.x - at.x) * t, y: at.y + (to.y - at.y) * t };
      }
      xs[i] = X(at.x);
      ys[i] = Y(at.y);
    });
    if (lines > 0) {
      ctx.strokeStyle = this.gold;
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = lines;
      ctx.beginPath();
      for (const c of this.layout.constellations)
        for (const [a, b] of c.lines) {
          ctx.moveTo(X(a.x), Y(a.y));
          ctx.lineTo(X(b.x), Y(b.y));
        }
      ctx.stroke();
      // Closer in, faint spokes from each star to its sub-theme.
      if (cam.k >= 1.6) {
        ctx.globalAlpha = lines * 0.35;
        ctx.beginPath();
        const subAt = new Map(
          this.layout.constellations.flatMap((c) => c.subs.map((s) => [s.id, s] as const)),
        );
        this.layout.stars.forEach((s, i) => {
          if (!starVisibility(o.hide, s.bookId)) return;
          // An opened sub-theme's stars are in rows: no spokes to them.
          if (o.spread && o.spread.t > 0 && s.subId === o.spread.sub) return;
          const c = subAt.get(s.subId)!;
          ctx.moveTo(X(c.x), Y(c.y));
          ctx.lineTo(xs[i]!, ys[i]!);
        });
        ctx.stroke();
      }
    }

    // The Testaments filter: hidden stars fade out (and back in), then are skipped.
    // An opened sub-theme dims every other star.
    const dim = 1 - 0.88 * st;
    const vis = this.layout.stars.map(
      (s) => starVisibility(o.hide, s.bookId) * (o.spread && s.subId !== o.spread.sub ? dim : 1),
    );
    const levels = [...new Set(vis)].filter((v) => v > 0);
    const shown = (i: number) =>
      vis[i]! > 0 && xs[i]! > -20 && ys[i]! > -20 && xs[i]! < this.w + 20 && ys[i]! < this.h + 20;
    const r = Math.min(4, Math.max(1.3, 1.3 * cam.k));

    // A short, thin streak behind each star while it flies.
    if (flying) {
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      for (const lib of [true, false]) {
        ctx.strokeStyle = lib ? this.pale : this.gold;
        ctx.globalAlpha = lib ? 0.25 : 0.4;
        ctx.beginPath();
        this.layout.stars.forEach((s, i) => {
          if (s.library !== lib || !shown(i)) return;
          const t = flightT(s, o.p);
          if (t <= 0 || t >= 1) return;
          const back = starAt(s, Math.min(1, Math.max(0, o.p - dir * 0.025)));
          ctx.moveTo(X(back.x), Y(back.y));
          ctx.lineTo(xs[i]!, ys[i]!);
        });
        ctx.stroke();
      }
    }

    // A small soft glow under each path star, then the stars themselves.
    this.layout.stars.forEach((s, i) => {
      if (s.library || !shown(i)) return;
      ctx.globalAlpha = starsAlpha * vis[i]!;
      const open = st > 0 && s.subId === o.spread!.sub;
      const g = open ? r * 3.5 : r * (s.subId === o.lit ? 7 : 4.5) * (s.bright ? 1.5 : 1);
      ctx.drawImage(this.glow, xs[i]! - g / 2, ys[i]! - g / 2, g, g);
    });
    for (const lib of [true, false])
      for (const level of levels) {
        ctx.fillStyle = lib ? this.pale : this.gold;
        ctx.globalAlpha = starsAlpha * (lib ? 0.62 : 1) * level;
        ctx.beginPath();
        this.layout.stars.forEach((s, i) => {
          if (s.library !== lib || vis[i] !== level || !shown(i)) return;
          // A reading that holds a key passage of its sub-theme is a bright star.
          const open = st > 0 && s.subId === o.spread!.sub;
          const rr = open
            ? (lib ? 0.8 : 1) * (s.bright ? 4.5 : 3)
            : (lib ? 0.75 : 1) * r * (s.subId === o.lit ? 1.4 : 1) * (s.bright ? 1.6 : 1);
          ctx.moveTo(xs[i]! + rr, ys[i]!);
          ctx.arc(xs[i]!, ys[i]!, rr, 0, Math.PI * 2);
        });
        ctx.fill();
      }
    ctx.globalAlpha = 1;
  }
}
