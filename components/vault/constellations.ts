/**
 * The Themes view's geometry (PLAN §16, P6.3), pure and unit-tested. World units are the Vault's
 * (pixels at zoom 1, centred on the oculus at 0, 0).
 *
 * - Each top-level theme is a constellation on a ring around the oculus; its sub-themes sit on a
 *   ring around the constellation's centre, joined by hairlines; each sub-theme's readings are
 *   stars spread around it (a sunflower spiral, so any number packs evenly). Every reading of the
 *   Bible is a star (owner, 2026-11-17: one per reading, a second where it sits in two); readings
 *   holding one of the sub-theme's key passages are bright. Sub-theme rings and the ring of
 *   constellations grow with their stars, so nothing overlaps however full a theme is.
 * - Each star also has a home: the medallion of the book its reading is in, on the spiral or the
 *   outer ring, scattered inside the medallion so the stars of one book do not stack.
 * - Opening a sub-theme spreads its stars into rows (`spreadLayout`), one name beside each.
 * - The switch is a flight (owner, 2026-11-12): every star travels from home to its constellation
 *   (or back) along its own curve, starting a little after the one before, so the spiral visibly
 *   comes apart into the constellations and re-forms on the way back.
 */
import type { Point } from './layout';

export interface ThemeInput {
  id: string;
  subthemes: {
    id: string;
    /** One per reading in the sub-theme: `key` is its section id; `bright` if it holds a key passage. */
    readings: { key: string; bookId: string; library: boolean; bright?: boolean }[];
  }[];
}

export interface Star extends Point {
  key: string; // `${subthemeId}:${sectionId}`, unique
  bright: boolean;
  themeId: string;
  subId: string;
  bookId: string;
  library: boolean;
  home: Point; // where it starts in the Spiral view
  delay: number; // 0–STAGGER, when it leaves (as a fraction of the flight)
  bend: number; // signed curvature of its path
}

export interface Constellation extends Point {
  id: string;
  r: number; // radius that holds all its stars
  subs: (Point & { id: string })[];
  lines: [Point, Point][]; // hairlines between sub-themes
}

export interface ThemesLayout {
  constellations: Constellation[];
  stars: Star[];
}

export const RING = 400; // constellation centres from the oculus (at least)
export const SUB_RING = 60; // sub-theme centres from their constellation's centre (at least)
export const STAR_STEP = 5.4; // sunflower spacing between a sub-theme's stars
const GAP = 16; // clear space between neighbouring clusters, and between constellations
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
export const STAGGER = 0.35; // the last star leaves this far into the flight

/**
 * The switch in three steps (owner, 2026-11-13), on one progress scale p from 0 (Spiral) to 1
 * (Themes); going back runs the same steps in reverse:
 * - SHRINK (0 → FLY_FROM): every book's bubble shrinks away, leaving its passages as small stars;
 * - fly (FLY_FROM → FLY_TO): the stars fly to their places, each on its own curve;
 * - settle (FLY_TO → 1): the constellations' lines and names draw in.
 */
export const FLY_FROM = 0.2;
export const FLY_TO = 0.85;

/** A stable pseudo-random number in [0, 1) for a string (FNV-1a). */
export function hash01(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 2 ** 32;
}

/**
 * @param homes where each book sits in the Spiral view (centre and radius), by book id
 */
export function layoutThemes(
  themes: ThemeInput[],
  homes: Map<string, Point & { r: number }>,
): ThemesLayout {
  const constellations: Constellation[] = [];
  const stars: Star[] = [];
  // How far each sub-theme's cluster reaches, how far its constellation's sub-themes sit from the
  // centre (far enough that neighbouring clusters clear each other), and the constellation's reach.
  const reach = (count: number) => STAR_STEP * Math.sqrt(Math.max(count, 1) + 0.6);
  const sizes = themes.map((t) => {
    const m = t.subthemes.length;
    const rs = t.subthemes.map((s) => reach(s.readings.length));
    const widest = Math.max(...rs);
    const d = m > 1 ? Math.max(SUB_RING, (widest * 2 + GAP) / (2 * Math.sin(Math.PI / m))) : 0;
    return { d, r: d * 1.08 + widest };
  });
  // The ring of constellations: each takes a share of it as wide as itself, and the ring is long
  // enough for all of them with a gap between neighbours (a little more, as chords are shorter
  // than arcs).
  const arcs = sizes.map((x) => x.r * 2 + GAP);
  const ring = Math.max(RING, (arcs.reduce((a, b) => a + b, 0) / (2 * Math.PI)) * 1.06);
  const starts: number[] = [];
  arcs.reduce((at, w) => (starts.push(at + w / 2), at + w), 0);
  const total = arcs.reduce((a, b) => a + b, 0);
  themes.forEach((t, i) => {
    // Start at the top and go round clockwise; each constellation turned a little differently.
    const a = -Math.PI / 2 + (starts[i]! / total) * Math.PI * 2;
    const c = { x: Math.cos(a) * ring, y: Math.sin(a) * ring };
    const m = t.subthemes.length;
    const twist = hash01(t.id) * Math.PI * 2;
    const subs = t.subthemes.map((s, j) => {
      const b = twist + (j / m) * Math.PI * 2;
      // Alternate the distance a little so the shape reads as a figure, not a regular polygon.
      const d = sizes[i]!.d * (j % 2 ? 0.92 : 1.08);
      return { id: s.id, x: c.x + Math.cos(b) * d, y: c.y + Math.sin(b) * d };
    });
    const lines: [Point, Point][] = subs.map((s, j) => [s, subs[(j + 1) % m]!]);
    let r = 0;
    t.subthemes.forEach((s, j) => {
      const sc = subs[j]!;
      s.readings.forEach((p, k) => {
        const rr = STAR_STEP * Math.sqrt(k + 0.6);
        const x = sc.x + Math.cos(k * GOLDEN) * rr;
        const y = sc.y + Math.sin(k * GOLDEN) * rr;
        r = Math.max(r, Math.hypot(x - c.x, y - c.y));
        const key = `${s.id}:${p.key}`;
        const home = homes.get(p.bookId) ?? { x: 0, y: 0, r: 20 };
        const ha = hash01(`${key}#a`) * Math.PI * 2;
        const hr = Math.sqrt(hash01(`${key}#r`)) * home.r * 0.7;
        stars.push({
          key,
          bright: !!p.bright,
          themeId: t.id,
          subId: s.id,
          bookId: p.bookId,
          library: p.library,
          x,
          y,
          home: { x: home.x + Math.cos(ha) * hr, y: home.y + Math.sin(ha) * hr },
          delay: 0,
          bend: (hash01(`${key}#b`) - 0.5) * 0.9,
        });
      });
    });
    constellations.push({ id: t.id, x: c.x, y: c.y, r: r + 14, subs, lines });
  });
  // Leave in order of distance from the oculus outward, so the flight ripples across the ceiling.
  const order = [...stars].sort(
    (a, b) => Math.hypot(a.home.x, a.home.y) - Math.hypot(b.home.x, b.home.y),
  );
  order.forEach((s, i) => (s.delay = (i / Math.max(1, order.length - 1)) * STAGGER));
  return { constellations, stars };
}

/** Smooth start and end. */
export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Where a star is at progress `p` (0 = home, 1 = in its constellation). Within the flight step
 * each star moves over its own window [delay, delay + 1 − STAGGER] along a quadratic curve bowed
 * sideways by its `bend`, so the paths cross and swirl instead of all running straight.
 */
/** How far along its own flight a star is at overall progress p (0 = home, 1 = arrived), eased. */
export function flightT(s: Star, p: number): number {
  const q = Math.min(1, Math.max(0, (p - FLY_FROM) / (FLY_TO - FLY_FROM)));
  return easeInOut(Math.min(1, Math.max(0, (q - s.delay) / (1 - STAGGER))));
}

export function starAt(s: Star, p: number): Point {
  const t = flightT(s, p);
  const mx = (s.home.x + s.x) / 2;
  const my = (s.home.y + s.y) / 2;
  const dx = s.x - s.home.x;
  const dy = s.y - s.home.y;
  const cx = mx - dy * s.bend;
  const cy = my + dx * s.bend;
  const u = 1 - t;
  return {
    x: u * u * s.home.x + 2 * u * t * cx + t * t * s.x,
    y: u * u * s.home.y + 2 * u * t * cy + t * t * s.y,
  };
}

/** The constellation nearest a world point (the one the camera is looking at). */
export function nearestConstellation(l: ThemesLayout, p: Point): Constellation | null {
  let best: Constellation | null = null;
  let d = Infinity;
  for (const c of l.constellations) {
    const e = Math.hypot(c.x - p.x, c.y - p.y);
    if (e < d) {
      d = e;
      best = c;
    }
  }
  return best;
}

/**
 * A sub-theme opened up (owner, 2026-11-17): its readings in rows around the sub-theme's centre,
 * in the order given (the Bible's), each with room for its name to the right of its star. `cell`
 * is a row's slot in world units (width and height), `cols` how many slots fit across the screen.
 * The grid's top is kept at the centre's height minus half its height, so the camera can start at
 * the top and the reader pans down through a long sub-theme.
 */
export function spreadLayout(
  count: number,
  centre: Point,
  cell: { w: number; h: number },
  cols: number,
): Point[] {
  const c = Math.max(1, Math.min(cols, count));
  const rows = Math.ceil(count / c);
  const left = centre.x - (c * cell.w) / 2;
  const top = centre.y - ((rows - 1) * cell.h) / 2;
  return Array.from({ length: count }, (_, i) => ({
    x: left + (i % c) * cell.w,
    y: top + Math.floor(i / c) * cell.h,
  }));
}
