/** The Vault's Threads mode (P4.3): connections grouped into arcs between books, and their shape. */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import {
  arcPath,
  arcsFor,
  arcWidth,
  BOW,
  bookThreads,
  directionSummary,
  nearestArc,
  panelOrder,
  threadedBooks,
} from '@/components/vault/threads';
import { TYPE_ORDER } from '@/lib/threads';
import type { PublicConnection, PublicConnections, ThreadEnd } from '@/lib/types';

const end = (bookId: string): ThreadEnd => ({
  ref: `${bookId}.1.1`,
  display: `${bookId} 1:1`,
  sectionId: `${bookId.toLowerCase()}-01`,
  sectionTitle: '',
  bookId,
  library: false,
  corpus: ['Luke', 'Acts', 'Rom', 'Heb', 'Gal'].includes(bookId) ? 'nt' : 'ot',
  anchor: 'v-1-1',
  excerpt: '',
  more: 0,
});
const conn = (id: string, a: string, b: string, type: PublicConnection['type']) =>
  ({
    id,
    type,
    strength: 2,
    label: id,
    explanation: '',
    ends: [end(a), end(b)],
    pair: 'ot-nt',
    order: { older: 0, uses: true, basis: 'canon' },
    evidence: [],
    sources: [],
  }) as PublicConnection;

const homes = new Map([
  ['Gen', { x: -300, y: 0, r: 50 }],
  ['Exod', { x: 0, y: -300, r: 50 }],
  ['Luke', { x: 100, y: 0, r: 40 }],
]);

describe('Vault threads', () => {
  it('groups connections into one arc per pair of books, in either direction', () => {
    const arcs = arcsFor(
      [
        conn('a', 'Exod', 'Luke', 'echo'),
        conn('b', 'Luke', 'Exod', 'typology'),
        conn('c', 'Gen', 'Luke', 'echo'),
      ],
      homes,
      new Set(TYPE_ORDER),
    );
    expect(arcs.map((a) => [a.key, a.connections.length])).toEqual([
      ['Exod|Luke', 2],
      ['Gen|Luke', 1],
    ]);
    expect(arcs[0]!.width).toBeGreaterThan(arcs[1]!.width);
  });

  it('filters by type and leaves out books with no medallion', () => {
    const arcs = arcsFor(
      [
        conn('a', 'Exod', 'Luke', 'echo'),
        conn('b', 'Gen', 'Luke', 'typology'),
        conn('x', 'Rev', 'Luke', 'echo'),
      ],
      homes,
      new Set(['typology'] as const),
    );
    expect(arcs.map((a) => a.key)).toEqual(['Gen|Luke']);
  });

  it('bows each arc toward the oculus, with its middle on the curve', () => {
    const p = { x: -300, y: 0 };
    const q = { x: 0, y: -300 };
    const { d, mid } = arcPath(p, q);
    expect(d).toBe(`M-300 0Q${-150 * BOW} ${-150 * BOW} 0 -300`);
    // Closer to the centre than the straight line between the ends.
    expect(Math.hypot(mid.x, mid.y)).toBeLessThan(Math.hypot(-150, -150));
    expect(arcWidth(4)).toBeGreaterThan(arcWidth(1));
  });

  it('places every published connection on the Vault (each book has a medallion)', () => {
    const data = JSON.parse(
      fs.readFileSync('public/data/connections.json', 'utf8'),
    ) as PublicConnections;
    const manifest = JSON.parse(fs.readFileSync('public/data/manifest.json', 'utf8')) as {
      books: { id: string }[];
    };
    const all = new Map(manifest.books.map((b) => [b.id, { x: 1, y: 2, r: 1 }]));
    const arcs = arcsFor(data.connections, all, new Set(TYPE_ORDER));
    expect(arcs.reduce((n, a) => n + a.connections.length, 0)).toBe(data.connections.length);
  });

  it('matches a tap to the nearest arc within reach', () => {
    const arcs = arcsFor(
      [conn('a', 'Exod', 'Luke', 'echo'), conn('c', 'Gen', 'Luke', 'echo')],
      homes,
      new Set(TYPE_ORDER),
    );
    const exod = arcs.find((a) => a.key === 'Exod|Luke')!;
    expect(nearestArc(arcs, exod.mid, 5)?.key).toBe('Exod|Luke');
    expect(nearestArc(arcs, { x: exod.mid.x + 3, y: exod.mid.y }, 5)?.key).toBe('Exod|Luke');
    expect(nearestArc(arcs, { x: 900, y: 900 }, 5)).toBeNull();
  });
});

describe('panels (threads plan TD3)', () => {
  const data = (
    JSON.parse(fs.readFileSync('public/data/connections.json', 'utf8')) as PublicConnections
  ).connections;
  const name = (id: string) => id;

  it('orders an arc strongest first, then through the later book', () => {
    const list = data.filter((c) => c.ends.some((e) => e.bookId === 'Luke'));
    const ordered = panelOrder(list);
    expect(ordered).toHaveLength(list.length);
    for (let i = 1; i < ordered.length; i++)
      expect(ordered[i - 1]!.strength).toBeGreaterThanOrEqual(ordered[i]!.strength);
  });

  it('says which way an arc runs', () => {
    const exLuke = data.filter(
      (c) => [c.ends[0].bookId, c.ends[1].bookId].sort().join('|') === 'Exod|Luke',
    );
    const uses = exLuke.filter((c) => c.order.uses).length;
    expect(directionSummary(exLuke, name)).toBe(
      `Luke draws on Exod in ${uses} of ${exLuke.length}; ${exLuke.length - uses} claim no use`,
    );
    const one = exLuke.filter((c) => c.order.uses).slice(0, 1);
    expect(directionSummary(one, name)).toBe('Luke draws on Exod');
  });

  it("groups a book's threads by direction, each partner book once per group", () => {
    const luke = bookThreads(data, 'Luke');
    expect(luke.total).toBe(data.filter((c) => c.ends.some((e) => e.bookId === 'Luke')).length);
    const count = (rows: { connections: unknown[] }[]) =>
      rows.reduce((n, r) => n + r.connections.length, 0);
    expect(count(luke.drawsOn) + count(luke.drawnOnBy) + count(luke.alongside)).toBe(luke.total);
    expect(luke.drawnOnBy).toEqual([]); // Luke is never the older end
    const exod = bookThreads(data, 'Exod');
    expect(exod.drawsOn).toEqual([]);
    expect(exod.drawnOnBy.map((r) => r.bookId)).toContain('Luke');
    expect(threadedBooks(data).has('Luke')).toBe(true);
  });
});
