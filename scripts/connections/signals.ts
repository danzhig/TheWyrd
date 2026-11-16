/**
 * What the data itself shows about a pair of passages (Phase 4, P4.4), to judge a candidate
 * connection before it is written up. Nothing here is typed: every signal is computed from the
 * built WEBC text or from tagged Greek tokens at their rows.
 *
 * - the longest run of words the two WEBC passages share (a quotation shows as a long run);
 * - names both passages carry (a named reference: the New Testament naming an Old Testament
 *   person or place);
 * - uncommon Greek lemmas shared by the Septuagint of the older passage and TAGNT of the newer.
 */
import { parsePoint } from './xrefs';
import { CANON_BY_ID } from '../lib/canon';
import { LXX_BOOKS, type TermSources } from '../terms/sources';

/** Compare words without accents, case or punctuation. */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');

/** Each [chapter, verse] of a single-book range that `has` knows (at most `max` verses). */
export function versesOf(
  range: string,
  has: (c: number, v: number) => boolean,
  max = 40,
): [number, number][] {
  const [a, b] = range.split('-') as [string, string | undefined];
  const s = parsePoint(a);
  const e = parsePoint(b ?? a);
  const out: [number, number][] = [];
  for (let c = s.c; c <= e.c && out.length < max; c++)
    for (let v = 1; v <= 200 && out.length < max; v++) {
      if (c === s.c && s.v && v < s.v) continue;
      if (c === e.c && e.v && v > e.v) break;
      if (has(c, v)) out.push([c, v]);
    }
  return out;
}

const words = (t: string) => t.split(/\s+/).map(fold).filter(Boolean);

/** The longest run of consecutive words two texts share, as their own words from the first. */
export function longestRun(a: string, b: string): string[] {
  const x = words(a);
  const y = words(b);
  const raw = a.split(/\s+/).filter((w) => fold(w));
  let best = 0;
  let at = 0;
  // Dynamic programming over word positions (passages are short: a few hundred words).
  let prev = new Array<number>(y.length + 1).fill(0);
  for (let i = 1; i <= x.length; i++) {
    const cur = new Array<number>(y.length + 1).fill(0);
    for (let j = 1; j <= y.length; j++)
      if (x[i - 1] === y[j - 1]) {
        cur[j] = prev[j - 1]! + 1;
        if (cur[j]! > best) {
          best = cur[j]!;
          at = i;
        }
      }
    prev = cur;
  }
  return raw.slice(at - best, at);
}

/** Words that are not names even when capitalised (sentence starts, titles of God). */
const NOT_NAMES = new Set(
  (
    'the a an and but for or so then when while if as in on at to of by from with this that these ' +
    'those he she it they we you i my your his her their our its him them me us who what why how ' +
    'behold now there here all no yes let do don’t didn’t isn’t lord god god’s lord’s jesus christ ' +
    'spirit holy most high son father man men people one o after before because therefore again ' +
    'also even yet not most truly amen come go see hear look'
  ).split(' '),
);

/**
 * Capitalised words (names) both texts carry, excluding sentence words and titles of God. With
 * `lower` (every word WEBC ever writes in lowercase), a word counts as a name only if it is never
 * an ordinary word ("Is" at the start of a question is not a name).
 */
export function sharedNames(a: string, b: string, lower?: Set<string>): string[] {
  const names = (t: string) =>
    new Set(
      (t.match(/\b\p{Lu}[\p{Ll}’']+/gu) ?? [])
        .map((w) => w.replace(/[’']s$/u, ''))
        .filter((w) => !NOT_NAMES.has(w.toLowerCase()) && !lower?.has(w.toLowerCase())),
    );
  const nb = names(b);
  return [...names(a)].filter((w) => nb.has(w));
}

/** How often each lemma occurs in the New Testament (to leave out common words). */
export function ntFrequencies(s: TermSources): Map<string, number> {
  const f = new Map<string, number>();
  for (const list of s.greek.values())
    for (const t of list) if (t.lemma) f.set(fold(t.lemma), (f.get(fold(t.lemma)) ?? 0) + 1);
  return f;
}

export interface GreekShared {
  lemma: string;
  ntCount: number;
  lxx: { ref: string; wordIndex: number; form: string; row: string }[];
  nt: { ref: string; wordIndex: number; form: string; row: string }[];
}

/**
 * Uncommon lemmas (at most `maxNt` times in the New Testament) the Septuagint of `oldRef` shares
 * with TAGNT at `newRef`. References are OSIS in English numbering; the Septuagint is looked up at
 * the same numbers (where it numbers a passage differently, nothing is found, never a false match).
 */
export function sharedGreek(
  s: TermSources,
  freq: Map<string, number>,
  oldRef: string,
  newRef: string,
  maxNt = 150,
): GreekShared[] {
  const oldBook = parsePoint(oldRef).book;
  const step = CANON_BY_ID.get(parsePoint(newRef).book)?.tvtms;
  const lxxBooks = LXX_BOOKS[oldBook] ?? [];
  if (!step || !lxxBooks.length) return [];
  const nt = versesOf(newRef, (c, v) => s.greek.has(`${step}.${c}.${v}`)).flatMap(([c, v]) =>
    s.greek.get(`${step}.${c}.${v}`)!,
  );
  const lxx = lxxBooks.flatMap(({ abbr }) =>
    versesOf(oldRef, (c, v) => s.lxx.has(`${abbr}.${c}.${v}`)).flatMap(([c, v]) =>
      s.lxx.get(`${abbr}.${c}.${v}`)!,
    ),
  );
  const out = new Map<string, GreekShared>();
  for (const t of nt) {
    if (!t.lemma) continue;
    const k = fold(t.lemma);
    const n = freq.get(k) ?? 0;
    if (n > maxNt) continue;
    const m = lxx.filter((w) => w.lemma && fold(w.lemma) === k);
    if (!m.length) continue;
    const e = out.get(k) ?? { lemma: t.lemma, ntCount: n, lxx: [], nt: [] };
    e.nt.push({ ref: t.ref, wordIndex: t.wordIndex, form: t.text, row: `${t.file}:${t.line}` });
    for (const w of m)
      if (!e.lxx.some((x) => x.ref === w.ref && x.wordIndex === w.wordIndex))
        e.lxx.push({ ref: w.ref, wordIndex: w.wordIndex, form: w.text, row: w.file });
    out.set(k, e);
  }
  return [...out.values()].sort((a, b) => a.ntCount - b.ntCount);
}
