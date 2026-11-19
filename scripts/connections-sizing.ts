/**
 * pnpm connections:sizing [--min N] — the size of the candidate pool for each corpus pair (threads
 * plan TX2): for every path book, how many section pairs the cross-references join with N+ votes
 * (default 10) inside the Old Testament, inside the New and between them, and how many distinct
 * pairs of books those touch (each would be one arc on the Vault). Writes
 * docs/connections/expansion-sizing.md. Counts only; nothing is proposed or written up here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { RAW_DIR } from './lib/paths';
import { CANON_BY_ID } from './lib/canon';
import { corpusOfTestament, pairId, type PairId } from '../lib/corpora';
import { readXrefs } from './connections/xrefs';
import { readSectionIndex, sectionFor } from './themes/taxonomy';

const args = process.argv.slice(2);
const MIN = args.includes('--min') ? Number(args[args.indexOf('--min') + 1]) : 10;
const manifest = JSON.parse(fs.readFileSync('public/data/manifest.json', 'utf8')) as {
  sections: { id: string; bookId: string; library?: boolean }[];
};
const info = new Map(manifest.sections.map((s) => [s.id, s]));
const index = readSectionIndex();
const corpus = (book: string) => corpusOfTestament(CANON_BY_ID.get(book)!.testament);

// Votes per pair of sections (both directions together), at least one end on the path.
const votes = new Map<string, number>();
for (const r of readXrefs(path.join(RAW_DIR, 'openbible-xrefs'))) {
  const a = sectionFor(r.from, index);
  const b = sectionFor(r.to, index);
  if (!a || !b || a === b) continue;
  const [sa, sb] = [info.get(a)!, info.get(b)!];
  if (sa.bookId === sb.bookId || (sa.library && sb.library)) continue;
  const key = [a, b].sort().join('|');
  votes.set(key, (votes.get(key) ?? 0) + r.votes);
}
const PAIRS: PairId[] = ['ot-ot', 'nt-nt', 'ot-nt'];
const perBook = new Map<string, Record<PairId, number>>();
const bookPairs = new Map<PairId, Set<string>>(PAIRS.map((p) => [p, new Set()]));
for (const [key, n] of votes) {
  if (n < MIN) continue;
  const [a, b] = key.split('|').map((id) => info.get(id)!) as [
    { id: string; bookId: string; library?: boolean },
    { id: string; bookId: string; library?: boolean },
  ];
  const p = pairId(corpus(a.bookId), corpus(b.bookId));
  bookPairs.get(p)!.add([a.bookId, b.bookId].sort().join('|'));
  for (const s of [a, b]) {
    if (s.library) continue;
    const row =
      perBook.get(s.bookId) ?? ({ 'ot-ot': 0, 'nt-nt': 0, 'ot-nt': 0 } as Record<PairId, number>);
    row[p]++;
    perBook.set(s.bookId, row);
  }
}
const books = [...perBook.keys()].sort(
  (x, y) => [...CANON_BY_ID.keys()].indexOf(x) - [...CANON_BY_ID.keys()].indexOf(y),
);
const total = (p: PairId) => books.reduce((n, b) => n + perBook.get(b)![p], 0);
const doc = [
  '# Threads expansion: sizing (threads plan TX2)',
  '',
  `Written by \`pnpm connections:sizing\` from OpenBible.info's cross-references. A candidate is a pair of built sections in two different books, at least one on the path, that the cross-references join with ${MIN} or more votes in all. Counts only: most candidates will not hold up when read, and only those the data supports are written up (threads plan §7).`,
  '',
  '| Path book | Old ↔ Old | New ↔ New | Old ↔ New |',
  '| --- | ---: | ---: | ---: |',
  ...books.map((b) => {
    const r = perBook.get(b)!;
    return `| ${CANON_BY_ID.get(b)!.name} | ${r['ot-ot']} | ${r['nt-nt']} | ${r['ot-nt']} |`;
  }),
  `| **All** | **${total('ot-ot')}** | **${total('nt-nt')}** | **${total('ot-nt')}** |`,
  '',
  '**Arcs.** Each pair of books with a written-up thread is one arc on the Vault (93 today). If every candidate pair of books above had at least one thread, the ceiling would carry:',
  '',
  ...PAIRS.map((p) => `- ${p}: ${bookPairs.get(p)!.size} pairs of books`),
  `- all together: ${PAIRS.reduce((n, p) => n + bookPairs.get(p)!.size, 0)}`,
  '',
  'The Vault keeps its scene under 300 nodes (threads plan §6). One path per arc stays under it only while the arcs number about 200; past that, the arcs move to one canvas, as the theme stars did. The written-up set is expected to be far smaller than this upper bound.',
  '',
];
fs.writeFileSync('docs/connections/expansion-sizing.md', doc.join('\n'));
console.log(`wrote docs/connections/expansion-sizing.md (${books.length} path books)`);
