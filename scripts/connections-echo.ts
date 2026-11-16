/**
 * pnpm connections:echo <old> <new> [--lxx <ref>] — the uncommon Greek words an Old Testament passage (in the
 * Septuagint) and a New Testament passage share, with the rows that prove them (Phase 4, verbal
 * echoes). References are OSIS in English numbering, a verse or a range in one book
 * (`Exod.40.34-Exod.40.35`). Where the Septuagint numbers the old passage differently, give its
 * own reference with --lxx (e.g. `--lxx Exod.40.28-Exod.40.29`). Nothing is typed: every form printed is the token at its cited row
 * (the Septuagint by its verse and word position, TAGNT by its file and line).
 */
import { CANON_BY_ID } from './lib/canon';
import { parsePoint } from './connections/xrefs';
import { loadTermSources, LXX_BOOKS } from './terms/sources';

const args = process.argv.slice(2);

// --span <LXX|TAGNT>:<ref>:<a>-<b> …: print consecutive words at their rows as JSON evidence (a
// phrase two passages share). The forms are the tokens at those positions, never typed.
if (args[0] === '--span') {
  const src = loadTermSources();
  const out = args.slice(1).map((spec) => {
    const [dataset, ref, span] = spec.split(':') as ['LXX' | 'TAGNT', string, string];
    const [a, b] = span.split('-').map(Number) as [number, number | undefined];
    const list = (dataset === 'LXX' ? src.lxx : src.greek).get(ref) ?? [];
    const words = list.filter((t) => t.wordIndex >= a && t.wordIndex <= (b ?? a));
    if (!words.length) throw new Error(`no words at ${spec}`);
    const first = words[0]!;
    return {
      dataset,
      ref,
      wordIndex: a,
      ...(b && b > a ? { toWordIndex: b } : {}),
      form: words.map((t) => t.text).join(' '),
      row: 'line' in first ? `${first.file}:${first.line}` : first.file,
    };
  });
  console.log(JSON.stringify(out));
  process.exit(0);
}
const lxxIdx = args.indexOf('--lxx');
const lxxRef = lxxIdx >= 0 ? args[lxxIdx + 1] : undefined;
// --json <lemma,lemma>: print the evidence for these lemmas as JSON (for content/connections).
const jsonIdx = args.indexOf('--json');
const jsonLemmas = jsonIdx >= 0 ? (args[jsonIdx + 1] ?? '').split(',') : null;
const flagValues = new Set([lxxIdx, jsonIdx].filter((i) => i >= 0).map((i) => i + 1));
const [oldRef, newRef] = args.filter((a, i) => !a.startsWith('--') && !flagValues.has(i));
if (!oldRef || !newRef) {
  console.error('usage: pnpm connections:echo <old ref> <new ref>');
  process.exit(1);
}

/** Compare dictionary forms without accents or case (display keeps the source's own forms). */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}]/gu, '');

/** Each verse of a single-book range, as [chapter, verse] pairs that `has` knows. */
function verses(range: string, has: (c: number, v: number) => boolean): [number, number][] {
  const [a, b] = range.split('-') as [string, string | undefined];
  const s = parsePoint(a);
  const e = parsePoint(b ?? a);
  const out: [number, number][] = [];
  for (let c = s.c; c <= e.c; c++)
    for (let v = 1; v <= 200; v++) {
      if (c === s.c && s.v && v < s.v) continue;
      if (c === e.c && e.v && v > e.v) break;
      if (has(c, v)) out.push([c, v]);
    }
  return out;
}

const s = loadTermSources();
const oldBook = parsePoint(oldRef!).book;
const newBook = parsePoint(newRef!).book;
const lxxBooks = LXX_BOOKS[oldBook] ?? [];
if (!lxxBooks.length) console.warn(`(no Septuagint text pinned for ${oldBook})`);
const step = CANON_BY_ID.get(newBook)!.tvtms;

// How common each New Testament lemma is, to leave out words like "and" and "the".
const ntFreq = new Map<string, number>();
for (const list of s.greek.values())
  for (const t of list)
    if (t.lemma) ntFreq.set(fold(t.lemma), (ntFreq.get(fold(t.lemma)) ?? 0) + 1);

const greek = verses(newRef!, (c, v) => s.greek.has(`${step}.${c}.${v}`)).flatMap(([c, v]) =>
  s.greek.get(`${step}.${c}.${v}`)!,
);
const lxx = lxxBooks.flatMap(({ abbr }) =>
  verses(lxxRef ?? oldRef!, (c, v) => s.lxx.has(`${abbr}.${c}.${v}`)).flatMap(([c, v]) =>
    s.lxx.get(`${abbr}.${c}.${v}`)!,
  ),
);

const shared = new Map<string, { lxx: typeof lxx; nt: typeof greek }>();
for (const t of greek) {
  if (!t.lemma) continue;
  const k = fold(t.lemma);
  if ((ntFreq.get(k) ?? 0) > 400) continue; // very common words
  const matches = lxx.filter((w) => w.lemma && fold(w.lemma) === k);
  if (!matches.length) continue;
  const e = shared.get(k) ?? { lxx: [], nt: [] };
  e.nt.push(t);
  for (const m of matches) if (!e.lxx.includes(m)) e.lxx.push(m);
  shared.set(k, e);
}

if (jsonLemmas) {
  const want = new Set(jsonLemmas.map(fold));
  const evidence = [...shared]
    .filter(([k]) => want.has(k))
    .flatMap(([, e]) => [
      ...e.lxx.map((w) => ({
        dataset: 'LXX',
        ref: w.ref,
        wordIndex: w.wordIndex,
        form: w.text,
        row: w.file,
      })),
      ...e.nt.map((w) => ({
        dataset: 'TAGNT',
        ref: w.ref,
        wordIndex: w.wordIndex,
        form: w.text,
        row: `${w.file}:${w.line}`,
      })),
    ]);
  console.log(JSON.stringify(evidence));
  process.exit(0);
}

console.log(
  `${oldRef}${lxxRef ? ` = LXX ${lxxRef}` : ''} (Septuagint, ${lxx.length} words) ↔ ${newRef} (TAGNT, ${greek.length} words): ${shared.size} uncommon shared lemmas`,
);
for (const [k, e] of [...shared].sort(
  (a, z) => (ntFreq.get(a[0]) ?? 0) - (ntFreq.get(z[0]) ?? 0),
)) {
  console.log(`\n${e.nt[0]!.lemma} (${ntFreq.get(k)} times in the NT)`);
  for (const w of e.lxx) console.log(`  LXX ${w.ref} #${w.wordIndex} ${w.text}  [${w.file}]`);
  for (const w of e.nt)
    console.log(`  NT  ${w.ref} #${w.wordIndex} ${w.text}  [${w.file}:${w.line}]`);
}
