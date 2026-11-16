/**
 * pnpm connections:candidates [--min N] — the candidate pool for Threads (Phase 4, P4.1).
 *
 * Reads OpenBible.info's cross-references (`pnpm connections:fetch`), places both ends of every
 * row in the built sections, and keeps the pairs that touch the path (at least one end in a path
 * section) with at least N readers' votes (default 10). Pairs in both directions are merged. It
 * also checks the seed connections (content/connections/connections.json) against the data: both ends
 * must resolve, and the rows that link them are listed as evidence. Writes
 * docs/connections/candidates.md; nothing here is shown on the site.
 */
import fs from 'node:fs';
import path from 'node:path';
import { RAW_DIR } from './lib/paths';
import { inRange, readXrefs, type XrefRow } from './connections/xrefs';
import { readConnections } from './connections/schema';
import { readSectionIndex, sectionFor } from './themes/taxonomy';

const args = process.argv.slice(2);
const minIdx = args.indexOf('--min');
const MIN = minIdx >= 0 ? Number(args[minIdx + 1]) : 10;

const rows = readXrefs(path.join(RAW_DIR, 'openbible-xrefs'));
const index = readSectionIndex();
const manifest = JSON.parse(fs.readFileSync('public/data/manifest.json', 'utf8')) as {
  books: { id: string; name: string }[];
  sections: { id: string; title: string; bookId: string }[];
};
const title = new Map(manifest.sections.map((s) => [s.id, s.title]));
const bookName = new Map(manifest.books.map((b) => [b.id, b.name]));
const onPath = (sec: string) => !index.library.has(sec);

// Every row placed in sections.
let unplaced = 0;
const placed: (XrefRow & { fromSec: string; toSec: string })[] = [];
for (const r of rows) {
  const fromSec = sectionFor(r.from, index);
  const toSec = sectionFor(r.to, index);
  if (!fromSec || !toSec) {
    unplaced++;
    continue;
  }
  placed.push({ ...r, fromSec, toSec });
}

// Pairs touching the path, merged across directions (keyed by both starting verses).
interface Pair {
  a: string;
  b: string;
  aSec: string;
  bSec: string;
  votes: number;
  rows: string[];
}
const pairs = new Map<string, Pair>();
for (const r of placed) {
  if (r.fromSec === r.toSec) continue;
  if (!onPath(r.fromSec) && !onPath(r.toSec)) continue;
  const [x, y] = [r.from.split('-')[0]!, r.to.split('-')[0]!];
  const key = x < y ? `${x}|${y}` : `${y}|${x}`;
  const p = pairs.get(key) ?? {
    a: r.from,
    b: r.to,
    aSec: r.fromSec,
    bSec: r.toSec,
    votes: 0,
    rows: [],
  };
  p.votes += r.votes;
  p.rows.push(r.id);
  pairs.set(key, p);
}
const all = [...pairs.values()];
const kept = all.filter((p) => p.votes >= MIN).sort((a, z) => z.votes - a.votes);
const bothPath = kept.filter((p) => onPath(p.aSec) && onPath(p.bSec)).length;

const at = (n: number) => all.filter((p) => p.votes >= n).length;
const book = (sec: string) => manifest.sections.find((s) => s.id === sec)?.bookId ?? '?';
const byBooks = new Map<string, number>();
for (const p of kept) {
  const [a, b] = [book(p.aSec), book(p.bSec)].sort();
  const k = `${bookName.get(a!) ?? a} ↔ ${bookName.get(b!) ?? b}`;
  byBooks.set(k, (byBooks.get(k) ?? 0) + 1);
}

// The seeds against the data.
const seeds = readConnections() ?? [];
const seedLines: string[] = [];
const errors: string[] = [];
for (const s of seeds) {
  const fromSec = sectionFor(s.from.split('-')[0]!, index);
  const toSec = sectionFor(s.to.split('-')[0]!, index);
  if (!fromSec || !toSec)
    errors.push(`${s.id}: ${!fromSec ? s.from : s.to} is not in a built section`);
  const evidence = rows
    .filter(
      (r) =>
        (inRange(r.from.split('-')[0]!, s.from) && inRange(r.to.split('-')[0]!, s.to)) ||
        (inRange(r.from.split('-')[0]!, s.to) && inRange(r.to.split('-')[0]!, s.from)),
    )
    .sort((a, z) => z.votes - a.votes);
  const where = (sec?: string) =>
    sec ? `${title.get(sec)} (\`${sec}\`${onPath(sec) ? '' : ', library'})` : '—';
  const ev = evidence.length
    ? `${evidence.length} rows, best ${evidence[0]!.votes} votes: ${evidence
        .slice(0, 3)
        .map((r) => `\`${r.id}\` ${r.from} → ${r.to} (${r.votes})`)
        .join('; ')}`
    : 'none in the data';
  seedLines.push(
    `| \`${s.id}\` | ${s.from} → ${s.to} | ${s.type} | ${where(fromSec)} → ${where(toSec)} | ${ev} |`,
  );
}

const doc = [
  '# Threads: candidate pool',
  '',
  `Written by \`pnpm connections:candidates\` from OpenBible.info's cross-references (CC BY 4.0; mostly the public-domain Treasury of Scripture Knowledge), pinned in \`sources/manifest.json\`. Nothing here is on the site: it is the pool that connections are proposed from (P4.2, P4.4), each citing its data rows. References are OSIS in WEBC (English) numbering; no scripture is quoted.`,
  '',
  '## The pool',
  '',
  `- ${rows.length} cross-reference rows; ${rows.length - unplaced} place both ends in built sections (${unplaced} cite a verse WEBC numbers differently or omit).`,
  `- Pairs between different sections touching the path, merged across directions: ${all.length}.`,
  `- With at least 5 / 10 / 25 / 50 / 100 votes: ${at(5)} / ${at(10)} / ${at(25)} / ${at(50)} / ${at(100)}.`,
  `- Kept at ${MIN}+ votes: **${kept.length}** pairs, ${bothPath} with both ends on the path and ${kept.length - bothPath} reaching into the library.`,
  '',
  '## Most-linked books (pairs kept)',
  '',
  '| Books | Pairs |',
  '| --- | --- |',
  ...[...byBooks]
    .sort((a, z) => z[1] - a[1])
    .slice(0, 30)
    .map(([k, n]) => `| ${k} | ${n} |`),
  '',
  '## Strongest pairs',
  '',
  '| Votes | From | To | Rows |',
  '| --- | --- | --- | --- |',
  ...kept
    .slice(0, 60)
    .map(
      (p) =>
        `| ${p.votes} | ${p.a} · ${title.get(p.aSec)}${onPath(p.aSec) ? '' : ' (library)'} | ${p.b} · ${title.get(p.bSec)}${onPath(p.bSec) ? '' : ' (library)'} | ${p.rows.map((r) => `\`${r}\``).join(', ')} |`,
    ),
  '',
  '## The seed connections against the data',
  '',
  'Each seed from PLAN §14, with the sections its ends fall in and the cross-reference rows that link them (in either direction). OpenBible has no data for Tobit or 1 Maccabees, so those seeds rest on other evidence (P4.2).',
  '',
  '| Seed | Link | Type | Sections | Cross-references |',
  '| --- | --- | --- | --- | --- |',
  ...seedLines,
  '',
];
if (errors.length) {
  console.error(`FAILED:\n  - ${errors.join('\n  - ')}`);
  process.exit(1);
}
fs.mkdirSync('docs/connections', { recursive: true });
fs.writeFileSync('docs/connections/candidates.md', doc.join('\n'));
console.log(
  `wrote docs/connections/candidates.md: ${kept.length} pairs at ${MIN}+ votes (${bothPath} path–path), ${seeds.length} seeds checked`,
);
