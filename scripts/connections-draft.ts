/**
 * pnpm connections:draft <spec.json> — the evidence for connections about to be written up
 * (Phase 4, P4.4). The spec lists `{ id, from, to, lemmas? }`; for each this prints, as JSON, the
 * OpenBible cross-reference rows linking the two ends (best three, either direction) and, for the
 * named lemmas, every token the Septuagint of the older end and TAGNT of the newer share, at their
 * rows — so rows and Greek forms go into content/connections/connections.json from the data,
 * never typed. Lemmas not found are listed under `missing`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { RAW_DIR } from './lib/paths';
import { CANON_BY_ID } from './lib/canon';
import { inRange, readXrefs } from './connections/xrefs';
import { fold, ntFrequencies, sharedGreek } from './connections/signals';
import { loadTermSources } from './terms/sources';

const specFile = process.argv[2];
if (!specFile) {
  console.error('usage: pnpm connections:draft <spec.json>');
  process.exit(1);
}
const specs = JSON.parse(fs.readFileSync(specFile, 'utf8')) as {
  id: string;
  from: string;
  to: string;
  lemmas?: string[];
}[];
const rows = readXrefs(path.join(RAW_DIR, 'openbible-xrefs'));
const terms = loadTermSources();
const freq = ntFrequencies(terms);
const first = (ref: string) => ref.split('-')[0]!;
const out: Record<string, unknown> = {};
for (const c of specs) {
  const linking = rows
    .filter(
      (r) =>
        (inRange(first(r.from), c.from) && inRange(first(r.to), c.to)) ||
        (inRange(first(r.from), c.to) && inRange(first(r.to), c.from)),
    )
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 3);
  const nt = (ref: string) => CANON_BY_ID.get(ref.split('.')[0]!)?.testament === 'NT';
  const [older, newer] = nt(c.from) ? [c.to, c.from] : [c.from, c.to];
  const shared = nt(newer) && !nt(older) ? sharedGreek(terms, freq, older, newer, Infinity) : [];
  const want = new Set((c.lemmas ?? []).map(fold));
  const found = shared.filter((g) => want.has(fold(g.lemma)));
  out[c.id] = {
    rows: linking.map((r) => ({ row: r.id, from: r.from, to: r.to, votes: r.votes })),
    evidence: found.flatMap((g) => [
      ...g.lxx.map((w) => ({ dataset: 'LXX', ...w })),
      ...g.nt.map((w) => ({ dataset: 'TAGNT', ...w })),
    ]),
    missing: [...want].filter((l) => !found.some((g) => fold(g.lemma) === l)),
    // Every uncommon lemma shared, to choose from.
    shared: shared.filter((g) => g.ntCount <= 60).map((g) => `${g.lemma} (${g.ntCount}× NT)`),
  };
}
console.log(JSON.stringify(out, null, 1));
