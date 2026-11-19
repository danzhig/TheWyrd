/**
 * Threads on the Vault (PLAN §14, P4.3), pure and unit-tested: connections grouped into arcs
 * between books (one arc per pair of books, weighted by how many connections join them), and each
 * arc's shape. Scene coordinates, as layout.ts: the spiral's centre (the oculus) is the origin.
 */
import type { PairId } from '@/lib/corpora';
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
  /** The quadratic's ends and control point (null for a loop), for the directed arc. */
  curve: [Point, Point, Point] | null;
  /** The corpora it joins ("ot-nt"); arcs inside one corpus bow outward (threads plan §5). */
  pair: PairId;
  /**
   * The book that takes the other up, when every thread on the arc says so (a chevron on the
   * arc points to it, threads plan §4); null when the threads run both ways or claim no use.
   */
  toward: string | null;
}

/** Connections of the chosen types, one arc per pair of books (both orders together). */
export function arcsFor(
  connections: PublicConnection[],
  homes: Map<string, Point & { r?: number }>,
  types: Set<ConnectionType>,
  /** The corpus pairs shown (all when omitted). */
  pairs?: Set<PairId>,
): ThreadArc[] {
  const groups = new Map<string, PublicConnection[]>();
  for (const c of connections) {
    if (!types.has(c.type)) continue;
    if (pairs && !pairs.has(c.pair)) continue;
    const [a, b] = [c.ends[0].bookId, c.ends[1].bookId].sort() as [string, string];
    if (!homes.has(a) || !homes.has(b)) continue;
    const key = `${a}|${b}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  return [...groups].map(([key, list]) => {
    const [a, b] = key.split('|') as [string, string];
    const pair = list[0]!.pair;
    const within = pair.split('-')[0] === pair.split('-')[1];
    const { d, mid, pts, curve } = arcPath(homes.get(a)!, homes.get(b)!, within ? OUTWARD : BOW);
    return {
      key,
      a,
      b,
      connections: list,
      d,
      width: arcWidth(list.length),
      mid,
      pts,
      curve,
      pair,
      // A loop (both ends in one book) has no direction to show.
      toward: a === b ? null : arcToward(list),
    };
  });
}

/** 1 connection → 3.3 scene units, growing gently (4 → 5.1, 9 → 6.9). */
export const arcWidth = (n: number) => 1.5 + Math.sqrt(n) * 1.8;

/**
 * A quadratic curve between two medallions, bowed toward the oculus so arcs sweep across the
 * vault rather than along the spiral. Two ends in one book loop outward.
 */
export function arcPath(
  p: Point,
  q: Point,
  bow = BOW,
): { d: string; mid: Point; pts: Point[]; curve: [Point, Point, Point] | null } {
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
      curve: null,
    };
  }
  const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  const c = { x: m.x * bow, y: m.y * bow };
  const quad = (t: number, a: number, b: number, e: number) =>
    (1 - t) ** 2 * a + 2 * (1 - t) * t * b + t * t * e;
  return {
    d: `M${r(p.x)} ${r(p.y)}Q${r(c.x)} ${r(c.y)} ${r(q.x)} ${r(q.y)}`,
    // The middle of a quadratic: a quarter of each end and half the control point.
    mid: { x: (p.x + q.x) / 4 + c.x / 2, y: (p.y + q.y) / 4 + c.y / 2 },
    pts: samples((t) => ({ x: quad(t, p.x, c.x, q.x), y: quad(t, p.y, c.y, q.y) })),
    curve: [p, c, q],
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

// -------------------------------------------------------------------------------------------------
// Panels (threads plan TD3): the order of an arc's cards, its direction in words, and a book's
// threads grouped by direction.
// -------------------------------------------------------------------------------------------------

/** "v-4-25" → [4, 25]. */
const pos = (anchor: string) => anchor.match(/\d+/g)!.map(Number) as [number, number];

/** The end that takes the other up (the later one when the order is known, else the second). */
const laterEnd = (c: PublicConnection) => c.ends[c.order.older === null ? 1 : 1 - c.order.older]!;

/** Strongest first, then through the later book in verse order. */
export function panelOrder(list: PublicConnection[]): PublicConnection[] {
  return [...list].sort((x, y) => {
    if (x.strength !== y.strength) return y.strength - x.strength;
    const [a, b] = [laterEnd(x), laterEnd(y)];
    if (a.bookId !== b.bookId) return a.bookId.localeCompare(b.bookId);
    const [ac, av] = pos(a.anchor);
    const [bc, bv] = pos(b.anchor);
    return ac - bc || av - bv;
  });
}

/** How many of an arc's threads run each way, in words: "Luke draws on Exodus in all 8". */
export function directionSummary(list: PublicConnection[], name: (id: string) => string): string {
  const uses = new Map<string, { from: string; n: number }>();
  let none = 0;
  for (const c of list) {
    if (c.order.older === null || !c.order.uses) {
      none++;
      continue;
    }
    const later = c.ends[1 - c.order.older]!.bookId;
    const older = c.ends[c.order.older]!.bookId;
    const k = `${later}|${older}`;
    uses.set(k, { from: older, n: (uses.get(k)?.n ?? 0) + 1 });
  }
  const parts = [...uses].map(([k, { from, n }]) => {
    const later = k.split('|')[0]!;
    const of = n === list.length ? (n === 1 ? '' : ` in all ${n}`) : ` in ${n} of ${list.length}`;
    return `${name(later)} draws on ${name(from)}${of}`;
  });
  if (none)
    parts.push(
      none === list.length
        ? none === 1
          ? 'No use is claimed either way'
          : `No use is claimed either way in all ${none}`
        : `${none} claim${none === 1 ? 's' : ''} no use`,
    );
  return parts.join('; ');
}

export interface BookRow {
  /** The other book. */
  bookId: string;
  connections: PublicConnection[];
}

export interface BookThreads {
  total: number;
  /** Older books this one uses. */
  drawsOn: BookRow[];
  /** Later books that use this one. */
  drawnOnBy: BookRow[];
  /** No use claimed, or the order not given. */
  alongside: BookRow[];
}

/** A book's threads (threads plan §2.5), grouped by direction, each partner book a row. */
export function bookThreads(list: PublicConnection[], bookId: string): BookThreads {
  const groups = { drawsOn: new Map(), drawnOnBy: new Map(), alongside: new Map() } as Record<
    'drawsOn' | 'drawnOnBy' | 'alongside',
    Map<string, PublicConnection[]>
  >;
  let total = 0;
  for (const c of list) {
    const i = c.ends.findIndex((e) => e.bookId === bookId);
    if (i < 0) continue;
    total++;
    const other = c.ends[1 - i]!.bookId;
    const { older, uses } = c.order;
    const g =
      older === null || !uses || other === bookId
        ? 'alongside'
        : older === i
          ? 'drawnOnBy'
          : 'drawsOn';
    groups[g].set(other, [...(groups[g].get(other) ?? []), c]);
  }
  const rows = (m: Map<string, PublicConnection[]>): BookRow[] =>
    [...m]
      .map(([id, cs]) => ({ bookId: id, connections: panelOrder(cs) }))
      .sort(
        (a, b) => b.connections.length - a.connections.length || a.bookId.localeCompare(b.bookId),
      );
  return {
    total,
    drawsOn: rows(groups.drawsOn),
    drawnOnBy: rows(groups.drawnOnBy),
    alongside: rows(groups.alongside),
  };
}

/** Books with at least one thread among these connections. */
export const threadedBooks = (list: PublicConnection[]) =>
  new Set(list.flatMap((c) => c.ends.map((e) => e.bookId)));

/** Arcs inside one corpus bow away from the oculus, so they stay readable over the others. */
export const OUTWARD = 1.35;

/** The later book, if every thread on the arc has it taking the other up (else null). */
export function arcToward(list: PublicConnection[]): string | null {
  let toward: string | null = null;
  for (const c of list) {
    if (c.order.older === null || !c.order.uses) return null;
    const later = c.ends[1 - c.order.older]!.bookId;
    if (toward && toward !== later) return null;
    toward = later;
  }
  return toward;
}

/**
 * An arc that shows its direction (threads plan §4): the same quadratic `[p, c, q]`, split at its
 * middle into two halves so the path has a vertex there for a `marker-mid` chevron, and drawn from
 * the older book toward the one that takes it up (`toEnd`: toward q), so the chevron points that
 * way. One stroked path per arc, as cheap to draw as the plain line (a filled, tapered band cost a
 * fifth of the camera's frames on a throttled phone).
 */
export function directedPath([p, c, q]: [Point, Point, Point], toEnd: boolean): string {
  const r = (n: number) => Math.round(n * 10) / 10;
  const [a, b] = toEnd ? [p, q] : [q, p];
  const m = { x: (p.x + 2 * c.x + q.x) / 4, y: (p.y + 2 * c.y + q.y) / 4 };
  const c1 = { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 };
  const c2 = { x: (c.x + b.x) / 2, y: (c.y + b.y) / 2 };
  return `M${r(a.x)} ${r(a.y)}Q${r(c1.x)} ${r(c1.y)} ${r(m.x)} ${r(m.y)}Q${r(c2.x)} ${r(c2.y)} ${r(b.x)} ${r(b.y)}`;
}
