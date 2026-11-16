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
    const { d, mid } = arcPath(homes.get(a)!, homes.get(b)!);
    return { key, a, b, connections: list, d, width: arcWidth(list.length), mid };
  });
}

/** 1 connection → 3 scene units, growing gently (5 → 7). */
export const arcWidth = (n: number) => 2 + Math.sqrt(n) * 2.2;

/**
 * A quadratic curve between two medallions, bowed toward the oculus so arcs sweep across the
 * vault rather than along the spiral. Two ends in one book loop outward.
 */
export function arcPath(p: Point, q: Point): { d: string; mid: Point } {
  const r = (n: number) => Math.round(n * 10) / 10;
  if (Math.hypot(p.x - q.x, p.y - q.y) < 1) {
    const len = Math.hypot(p.x, p.y) || 1;
    const out = { x: (p.x / len) * 60, y: (p.y / len) * 60 };
    const c1 = { x: p.x + out.x - out.y * 0.6, y: p.y + out.y + out.x * 0.6 };
    const c2 = { x: p.x + out.x + out.y * 0.6, y: p.y + out.y - out.x * 0.6 };
    return {
      d: `M${r(p.x)} ${r(p.y)}C${r(c1.x)} ${r(c1.y)} ${r(c2.x)} ${r(c2.y)} ${r(p.x)} ${r(p.y)}`,
      mid: { x: p.x + out.x * 0.75, y: p.y + out.y * 0.75 },
    };
  }
  const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  const c = { x: m.x * BOW, y: m.y * BOW };
  return {
    d: `M${r(p.x)} ${r(p.y)}Q${r(c.x)} ${r(c.y)} ${r(q.x)} ${r(q.y)}`,
    // The middle of a quadratic: a quarter of each end and half the control point.
    mid: { x: (p.x + q.x) / 4 + c.x / 2, y: (p.y + q.y) / 4 + c.y / 2 },
  };
}

/** How far an arc's control point sits from the oculus, relative to its ends' midpoint. */
export const BOW = 0.3;
