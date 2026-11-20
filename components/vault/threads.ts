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
  /** The corpora it joins ("ot-nt"); arcs inside one corpus bow outward (threads plan §5). */
  pair: PairId;
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
    const { d, mid, pts } = arcPath(homes.get(a)!, homes.get(b)!, within ? OUTWARD : BOW);
    return {
      key,
      a,
      b,
      connections: list,
      d,
      width: arcWidth(list.length),
      mid,
      pts,
      pair,
    };
  });
}

/**
 * Arcs drawn as a few paths (TX7: the library's threads take the arcs past what one path each
 * allows under the scene's 300-node budget). Arcs sharing a look are joined into one path of
 * several subpaths: the same state (plain, lit for the open book, dimmed), the same class (between
 * the Testaments, or inside one) and the same width, rounded to half a scene unit. The selected
 * arc is drawn on its own, by the caller. Pure.
 */
export type ArcState = 'plain' | 'lit' | 'dim';
export interface ArcBundle {
  key: string;
  state: ArcState;
  within: boolean;
  width: number;
  d: string;
  keys: string[];
}
export function bundleArcs(
  arcs: Pick<ThreadArc, 'key' | 'a' | 'b' | 'd' | 'width' | 'pair'>[],
  book: string | null,
  skip: string | null = null,
): ArcBundle[] {
  const out = new Map<string, ArcBundle>();
  for (const a of arcs) {
    if (a.key === skip) continue;
    const state: ArcState = !book ? 'plain' : a.a === book || a.b === book ? 'lit' : 'dim';
    const within = a.pair !== 'ot-nt';
    const width = Math.round(a.width * 2) / 2;
    const key = `${state}|${within ? 'w' : 'b'}|${width}`;
    const b = out.get(key) ?? { key, state, within, width, d: '', keys: [] };
    b.d += (b.d ? ' ' : '') + a.d;
    b.keys.push(a.key);
    out.set(key, b);
  }
  // Dimmed first, lit last, so the open book's arcs lie on top; thin under thick.
  const rank = { dim: 0, plain: 1, lit: 2 } as const;
  return [...out.values()].sort((x, y) => rank[x.state] - rank[y.state] || x.width - y.width);
}

/** 1 connection → 3.3 scene units, growing gently (4 → 5.1, 9 → 6.9). */
export const arcWidth = (n: number) => 1.5 + Math.sqrt(n) * 1.8;

/**
 * A quadratic curve between two medallions, bowed toward the oculus so arcs sweep across the
 * vault rather than along the spiral. Two ends in one book loop outward.
 */
export function arcPath(p: Point, q: Point, bow = BOW): { d: string; mid: Point; pts: Point[] } {
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
  const c = { x: m.x * bow, y: m.y * bow };
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
