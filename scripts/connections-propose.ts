/**
 * pnpm connections:propose <bookId> [--min N] [--top K] — candidate connections for one path book
 * (Phase 4, P4.4), for the owner's approval: docs/connections/<bookId>-candidates.md.
 *
 * From OpenBible.info's cross-references (`pnpm connections:fetch`), every row with one end in this
 * book's path sections and the other in another book is grouped by the pair of sections it joins
 * (both directions together). Pairs are ranked by their total votes; at least N (default 10). For
 * each, the strongest row's two passages are compared for what the data shows (signals.ts): the
 * longest run of words they share in WEBC, the names both carry, and, between the Testaments, the
 * uncommon Greek lemmas the Septuagint and TAGNT share (`pnpm terms:fetch`). Pairs already in
 * content/connections/connections.json are marked. No scripture is quoted beyond the shared run.
 *
 * `--pair ot-ot|nt-nt|ot-nt` (threads plan TX2) keeps only pairs between those corpora and writes
 * docs/connections/<bookId>-<pair>-candidates.md. Inside one Testament the signals are the
 * uncommon Hebrew (TAHOT) or Greek (TAGNT) words both passages share, the people and places both
 * name (TIPNR ids, not spellings) and, for parallel accounts, how many verses closely match.
 */
import fs from 'node:fs';
import path from 'node:path';
import { RAW_DIR } from './lib/paths';
import { CANON_BY_ID } from './lib/canon';
import { verseText, type SectionFile } from '../lib/types';
import { readXrefs } from './connections/xrefs';
import { corpusOfTestament, pairId, type PairId } from '../lib/corpora';
import { readTipnr } from './terms/tipnr';
import { readConnections } from './connections/schema';
import {
  longestRun,
  ntFrequencies,
  otFrequencies,
  parallelVerses,
  sharedGreek,
  sharedGreekNT,
  sharedHebrew,
  sharedNames,
  sharedPeople,
  versesOf,
} from './connections/signals';
import { loadTermSources } from './terms/sources';
import { readSectionIndex, sectionFor } from './themes/taxonomy';

const args = process.argv.slice(2);
const flag = (name: string, d: number) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : d;
};
const bookId = args.find((a, i) => !a.startsWith('--') && !/^--/.test(args[i - 1] ?? ''));
const MIN = flag('--min', 10);
const TOP = flag('--top', 40);
const pairArg = args[args.indexOf('--pair') + 1];
const PAIR = args.includes('--pair') ? (pairArg as PairId) : null;
if (PAIR && !['ot-ot', 'nt-nt', 'ot-nt'].includes(PAIR)) {
  console.error('--pair is one of ot-ot, nt-nt, ot-nt');
  process.exit(1);
}
const corpusOf = (book: string) => corpusOfTestament(CANON_BY_ID.get(book)!.testament);
if (!bookId || !CANON_BY_ID.has(bookId)) {
  console.error('usage: pnpm connections:propose <bookId> [--min N] [--top K]');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync('public/data/manifest.json', 'utf8')) as {
  sections: { id: string; title: string; bookId: string; library?: boolean }[];
};
const index = readSectionIndex();
const secInfo = new Map(manifest.sections.map((s) => [s.id, s]));
const pathSections = new Set(
  manifest.sections.filter((s) => s.bookId === bookId && !s.library).map((s) => s.id),
);
if (!pathSections.size) {
  console.error(`${bookId} has no sections on the path`);
  process.exit(1);
}

// The built WEBC text of every verse, and each section's verses in order.
const text = new Map<string, string>();
const sectionVerses = new Map<string, string[]>();
for (const s of manifest.sections) {
  const f = JSON.parse(
    fs.readFileSync(path.join('public/data/sections', `${s.id}.json`), 'utf8'),
  ) as SectionFile;
  sectionVerses.set(
    s.id,
    f.verses.map((v) => verseText(v)),
  );
  for (const v of f.verses) {
    const whole = v.ref.split('!')[0]!;
    text.set(whole, (text.has(whole) ? `${text.get(whole)} ` : '') + verseText(v));
  }
}
// Every word WEBC writes in lowercase somewhere: such a word is not a name.
const lower = new Set<string>();
for (const t of text.values())
  for (const w of t.match(/\b\p{Ll}[\p{Ll}’']*/gu) ?? []) lower.add(w.replace(/[’']s$/u, ''));
const passage = (ref: string, max = 12) => {
  const book = ref.split('.')[0]!;
  return versesOf(ref, (c, v) => text.has(`${book}.${c}.${v}`), max)
    .map(([c, v]) => text.get(`${book}.${c}.${v}`)!)
    .join(' ');
};

// Rows grouped by the pair of sections they join.
interface Cand {
  here: string; // section in this book
  there: string;
  votes: number;
  rows: { id: string; from: string; to: string; votes: number }[];
}
const cands = new Map<string, Cand>();
for (const r of readXrefs(path.join(RAW_DIR, 'openbible-xrefs'))) {
  const a = sectionFor(r.from, index);
  const b = sectionFor(r.to, index);
  if (!a || !b || a === b) continue;
  const [here, there] = pathSections.has(a) ? [a, b] : pathSections.has(b) ? [b, a] : [];
  if (!here || !there || secInfo.get(there)?.bookId === bookId) continue;
  if (PAIR && pairId(corpusOf(bookId), corpusOf(secInfo.get(there)!.bookId)) !== PAIR) continue;
  const key = `${here}|${there}`;
  const c = cands.get(key) ?? { here, there, votes: 0, rows: [] };
  c.votes += r.votes;
  c.rows.push(r);
  cands.set(key, c);
}
const existing = new Set(
  (readConnections() ?? []).flatMap((c) => {
    const a = sectionFor(c.from, index);
    const b = sectionFor(c.to, index);
    return [`${a}|${b}`, `${b}|${a}`];
  }),
);
const ranked = [...cands.values()]
  .filter((c) => c.votes >= MIN)
  .sort((a, b) => b.votes - a.votes)
  .slice(0, TOP);

const terms = loadTermSources();
const freq = ntFrequencies(terms);
const otFreq = otFrequencies(terms);
const tipnr = readTipnr(path.join(RAW_DIR, 'TIPNR.txt'));
// A TIPNR name without its translators' notes ("Jachin =ESV,KJV; Jakin =NIV" → "Jachin").
const personName = (id: string) =>
  (tipnr.names.get(id) ?? id.split('@')[0]!).split(/\s*[=;,]/)[0]!.trim();
const testament = (ref: string) => CANON_BY_ID.get(ref.split('.')[0]!)?.testament;

const lines: string[] = [];
ranked.forEach((c, i) => {
  c.rows.sort((a, b) => b.votes - a.votes);
  // Signals from the strongest rows (a quotation is often one verse of a longer pair).
  const orient = (r: (typeof c.rows)[number]) =>
    sectionFor(r.from, index) === c.here ? [r.from, r.to] : [r.to, r.from];
  const [hereRef, thereRef] = orient(c.rows[0]!) as [string, string];
  let run: string[] = [];
  let runAt = '';
  const names = new Set<string>();
  const greek = new Map<string, ReturnType<typeof sharedGreek>[number]>();
  for (const r of c.rows.slice(0, 6)) {
    const [h, t] = orient(r) as [string, string];
    const [ph, pt] = [passage(h), passage(t)];
    const rr = longestRun(ph, pt);
    if (rr.length > run.length) {
      run = rr;
      runAt = `${h} ↔ ${t}`;
    }
    for (const n of sharedNames(ph, pt, lower)) names.add(n);
    const ot = testament(h) === 'OT' ? h : testament(t) === 'OT' ? t : null;
    const nt = testament(h) === 'NT' ? h : testament(t) === 'NT' ? t : null;
    if (ot && nt)
      for (const g of sharedGreek(terms, freq, ot, nt))
        if (!greek.has(g.lemma)) greek.set(g.lemma, g);
  }
  const greekList = [...greek.values()].sort((a, b) => a.ntCount - b.ntCount).slice(0, 4);
  // Inside one Testament: shared Hebrew or Greek words, the same people and places, parallels.
  const within = new Map<string, ReturnType<typeof sharedHebrew>[number]>();
  const people = new Set<string>();
  let parallel = { matched: 0, longest: 0 };
  for (const r of c.rows.slice(0, 6)) {
    const [h, t] = orient(r) as [string, string];
    const [th, tt] = [testament(h), testament(t)];
    if (th === tt) {
      const list =
        th === 'OT' ? sharedHebrew(terms, otFreq, h, t) : sharedGreekNT(terms, freq, h, t);
      for (const w of list) if (!within.has(w.key)) within.set(w.key, w);
    }
    for (const id of sharedPeople(tipnr, h, t)) people.add(id);
  }
  // Parallel accounts: the two sections compared whole, verse by verse.
  if (testament(hereRef) === testament(thereRef))
    parallel = parallelVerses(sectionVerses.get(c.here) ?? [], sectionVerses.get(c.there) ?? []);
  const withinList = [...within.values()].sort((a, b) => a.count - b.count).slice(0, 4);
  const signals = [
    run.length >= 4 ? `shared run of ${run.length} words (${runAt}): “${run.join(' ')}”` : null,
    names.size ? `names in both: ${[...names].join(', ')}` : null,
    parallel.matched >= 2
      ? `parallel account: ${parallel.matched} verses closely match, ${parallel.longest} in a row`
      : null,
    people.size
      ? `people and places in both (TIPNR): ${[...new Set([...people].map(personName))].join(', ')}`
      : null,
    ...withinList.map(
      (w) =>
        `${testament(hereRef) === 'OT' ? 'Hebrew' : 'Greek'} ${w.lemma} (${w.count}× in its Testament): ${w.a.map((x) => `${x.ref} #${x.wordIndex}`).join(', ')} · ${w.b.map((x) => `${x.ref} #${x.wordIndex}`).join(', ')}`,
    ),
    ...greekList.map(
      (g) =>
        `Greek ${g.lemma} (${g.ntCount}× NT): LXX ${g.lxx.map((w) => `${w.ref} #${w.wordIndex}`).join(', ')} · TAGNT ${g.nt.map((w) => `${w.ref} #${w.wordIndex}`).join(', ')}`,
    ),
  ].filter(Boolean);
  const hint =
    parallel.longest >= 3
      ? 'parallel account'
      : run.length >= 6
        ? 'quotation'
        : names.size
          ? 'named reference'
          : greekList.some((g) => g.ntCount <= 30)
            ? 'verbal echo'
            : 'parallel or allusion (judge from the text)';
  const t = secInfo.get(c.there)!;
  lines.push(
    `### ${i + 1}. ${hereRef} ↔ ${thereRef} · ${c.votes} votes${existing.has(`${c.here}|${c.there}`) ? ' · already a connection' : ''}`,
    '',
    `- ${secInfo.get(c.here)!.title} (\`${c.here}\`) ↔ ${t.title} (\`${c.there}\`${t.library ? ', library' : ''})`,
    `- Rows: ${c.rows
      .slice(0, 5)
      .map((r) => `\`${r.id}\` ${r.from} → ${r.to} (${r.votes})`)
      .join('; ')}${c.rows.length > 5 ? `; and ${c.rows.length - 5} more` : ''}`,
    ...(signals.length ? signals.map((s) => `- ${s}`) : ['- no shared run, names or rare Greek']),
    `- Looks like: ${hint}`,
    '',
  );
});

const name = CANON_BY_ID.get(bookId)!.name;
const PAIR_NOTE: Partial<Record<PairId, string>> = {
  'ot-ot': 'Old ↔ Old: threads inside the Old Testament',
  'nt-nt': 'New ↔ New: threads inside the New Testament',
  'ot-nt': 'Old ↔ New: threads between the Testaments',
};
const doc = [
  `# Threads: candidates for ${name}${PAIR ? ` (${PAIR_NOTE[PAIR]})` : ''}`,
  '',
  `Written by \`pnpm connections:propose ${bookId}${PAIR ? ` --pair ${PAIR}` : ''}\` from OpenBible.info's cross-references (CC BY 4.0), pinned in \`sources/manifest.json\`. Every row with one end in ${name}'s path sections and the other in another book, grouped by the two sections it joins and ranked by total votes (at least ${MIN}; the top ${TOP} shown). For each, the strongest row's passages are compared: the longest run of words they share in WEBC (a quotation shows as a long run), the names both carry, and, between the Testaments, uncommon Greek lemmas the Septuagint and TAGNT share at their rows. (The Septuagint transcription has no lemma for some words, such as the capitals that open a book, so a missing Greek signal is not proof of absence.) These signals suggest a type; the write-ups are drafted only for the pairs that hold up, and each needs the owner's approval before it is shown.`,
  '',
  `${cands.size} section pairs touch ${name}'s path sections; ${[...cands.values()].filter((c) => c.votes >= MIN).length} have ${MIN}+ votes.`,
  '',
  ...lines,
];
fs.mkdirSync('docs/connections', { recursive: true });
const out = `docs/connections/${bookId}${PAIR ? `-${PAIR}` : ''}-candidates.md`;
fs.writeFileSync(out, doc.join('\n'));
console.log(`wrote ${out}: ${ranked.length} candidates`);
