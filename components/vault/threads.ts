/**
 * Threads on the Vault (PLAN §14, P4.3), pure and unit-tested: connections grouped into arcs
 * between books (one arc per pair of books, weighted by how many connections join them), and each
 * arc's shape. Scene coordinates, as layout.ts: the spiral's centre (the oculus) is the origin.
 */
import type { ConnectionType, PublicConnection } from '@/lib/types';
import type { Point } from './layout';

export interface ThreadArc {
  key: string; // "Exod|Luke" (book ids, sorted)
  a: string;
  b: string;
  connections: PublicConnection[];
  /** The arc as an SVG path in scene coordinates. */
  d: string;
  /** Stroke width in scene units, by the number of connections. */
  width: number;
  /** A point on the arc (its middle), e.g. for a label or a test's tap. */
  mid: Point;
  /** Points along the arc, to find the arc nearest a tap (`nearestArc`). */
  pts: Point[];
}

/** Connections of the chosen types, one arc per pair of books (both orders together). */
export function arcsFor(
  connections: PublicConnection[],
  homes: Map<string, Point & { r?: number }>,
  types: Set<ConnectionType>,
): ThreadArc[] {
  const groups = new Map<string, PublicConnection[]>();
  for (const c of connections) {
    if (!types.has(c.type)) continue;
    const [a, b] = [c.ends[0].bookId, c.ends[1].bookId].sort() as [string, string];
    if (!homes.has(a) || !homes.has(b)) continue;
    const key = `${a}|${b}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  return [...groups].map(([key, list]) => {
    const [a, b] = key.split('|') as [string, string];
    const { d, mid, pts } = arcPath(homes.get(a)!, homes.get(b)!);
    return { key, a, b, connections: list, d, width: arcWidth(list.length), mid, pts };
  });
}

/** 1 connection → 3.3 scene units, growing gently (4 → 5.1, 9 → 6.9). */
export const arcWidth = (n: number) => 1.5 + Math.sqrt(n) * 1.8;

/**
 * A quadratic curve between two medallions, bowed toward the oculus so arcs sweep across the
 * vault rather than along the spiral. Two ends in one book loop outward.
 */
export function arcPath(p: Point, q: Point): { d: string; mid: Point; pts: Point[] } {
  const r = (n: number) => Math.round(n * 10) / 10;
  if (Math.hypot(p.x - q.x, p.y - q.y) < 1) {
    const len = Math.hypot(p.x, p.y) || 1;
    const out = { x: (p.x / len) * 60, y: (p.y / len) * 60 };
    const c1 = { x: p.x + out.x - out.y * 0.6, y: p.y + out.y + out.x * 0.6 };
    const c2 = { x: p.x + out.x + out.y * 0.6, y: p.y + out.y - out.x * 0.6 };
    const cubic = (t: number, a: number, b: number, c: number) =>
      (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * a;
    return {
      d: `M${r(p.x)} ${r(p.y)}C${r(c1.x)} ${r(c1.y)} ${r(c2.x)} ${r(c2.y)} ${r(p.x)} ${r(p.y)}`,
      mid: { x: p.x + out.x * 0.75, y: p.y + out.y * 0.75 },
      pts: samples((t) => ({ x: cubic(t, p.x, c1.x, c2.x), y: cubic(t, p.y, c1.y, c2.y) })),
    };
  }
  const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  const c = { x: m.x * BOW, y: m.y * BOW };
  const quad = (t: number, a: number, b: number, e: number) =>
    (1 - t) ** 2 * a + 2 * (1 - t) * t * b + t * t * e;
  return {
    d: `M${r(p.x)} ${r(p.y)}Q${r(c.x)} ${r(c.y)} ${r(q.x)} ${r(q.y)}`,
    // The middle of a quadratic: a quarter of each end and half the control point.
    mid: { x: (p.x + q.x) / 4 + c.x / 2, y: (p.y + q.y) / 4 + c.y / 2 },
    pts: samples((t) => ({ x: quad(t, p.x, c.x, q.x), y: quad(t, p.y, c.y, q.y) })),
  };
}

const samples = (at: (t: number) => Point, n = 32) =>
  Array.from({ length: n + 1 }, (_, i) => at(i / n));

/** Distance from a point to a segment. */
function segDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * The arc nearest a point (scene coordinates), if any lies within `max` scene units. One element
 * per arc keeps the Vault under its node budget; taps are matched here instead of on a wide
 * invisible stroke per arc.
 */
export function nearestArc(arcs: ThreadArc[], p: Point, max: number): ThreadArc | null {
  let best: ThreadArc | null = null;
  let bestD = max;
  for (const a of arcs)
    for (let i = 1; i < a.pts.length; i++) {
      const d = segDist(p, a.pts[i - 1]!, a.pts[i]!);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
  return best;
}

/** How far an arc's control point sits from the oculus, relative to its ends' midpoint. */
export const BOW = 0.3;
