/**
 * Pairing verses by content inside a segment (a stretch of the WEBC and the stretch of the
 * Douay-Rheims that tells the same part of the book), for books whose Douay-Rheims text is a
 * different form of the book: the Vulgate's Tobit and Judith, and Esther, whose Greek additions the
 * Vulgate gathers after 10:3.
 *
 * A monotonic alignment (both texts keep their order) maximises the words paired verses share.
 * A Douay-Rheims verse left unpaired goes with the WEBC verse that holds the Douay-Rheims verse
 * before it (or after it, at the start), so every Douay-Rheims verse is shown somewhere; a WEBC
 * verse left unpaired has no Douay-Rheims words of its own (its sense is in a neighbour, or the
 * Vulgate lacks it), which the report lists.
 */
import { overlap, words } from './align';

export interface Pairing {
  /** WEBC index → Douay-Rheims indexes (in order). */
  pairs: Map<number, number[]>;
  /** Score of each WEBC verse's pairing (0–1), for the report. */
  scores: Map<number, number>;
  /** Douay-Rheims verses that matched nothing and were attached to a neighbour. */
  attached: number[];
}

/** The least shared-word score worth pairing two verses on. */
const FLOOR = 0.15;

export function pairByContent(webc: string[], drc: string[]): Pairing {
  const W = webc.map(words);
  const D = drc.map(words);
  const n = W.length;
  const m = D.length;
  const sim = (i: number, j: number) => overlap(W[i]!, D[j]!);
  // best[i][j]: best total over the first i WEBC and j Douay-Rheims verses.
  const best = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  const move = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1)); // 1 match, 2 skip W, 3 skip D
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= m; j++) {
      if (!i && !j) continue;
      let b = -Infinity;
      let mv = 0;
      if (i && j) {
        const s = best[i - 1]![j - 1]! + (sim(i - 1, j - 1) - FLOOR);
        if (s > b) [b, mv] = [s, 1];
      }
      if (i && best[i - 1]![j]! > b) [b, mv] = [best[i - 1]![j]!, 2];
      if (j && best[i]![j - 1]! > b) [b, mv] = [best[i]![j - 1]!, 3];
      best[i]![j] = b;
      move[i]![j] = mv;
    }
  const matched = new Map<number, number>(); // drc → webc
  for (let i = n, j = m; i || j;) {
    const mv = move[i]![j]!;
    if (mv === 1) {
      if (sim(i - 1, j - 1) >= FLOOR) matched.set(j - 1, i - 1);
      i--;
      j--;
    } else if (mv === 2) i--;
    else j--;
  }
  const pairs = new Map<number, number[]>();
  const attached: number[] = [];
  const firstMatched = [...matched.keys()].sort((a, b) => a - b)[0];
  for (let j = 0; j < m; j++) {
    let w = matched.get(j);
    if (w === undefined) {
      attached.push(j);
      // The WEBC verse holding the nearest earlier Douay-Rheims verse; at the start, the first one.
      for (let k = j - 1; k >= 0 && w === undefined; k--) w = matched.get(k);
      if (w === undefined) w = firstMatched !== undefined ? matched.get(firstMatched)! : 0;
    }
    if (!n) break;
    pairs.set(w, [...(pairs.get(w) ?? []), j]);
  }
  const scores = new Map<number, number>();
  for (const [w, ds] of pairs)
    scores.set(w, overlap(W[w]!, new Set(ds.flatMap((d) => [...D[d]!]))));
  return { pairs, scores, attached };
}

/**
 * Refine a numbering-based pairing (TVTMS or identity) by content, staying within `band` verses of
 * it: the Latin sometimes divides verses differently where TVTMS records nothing (Baruch 6,
 * 1 Maccabees 1), which shows as a run of verses each sharing more words with its neighbour than
 * with its partner. A pair the guide proposes earns `bonus`, so repetitive passages (Numbers 7)
 * keep their numbering unless the words clearly say otherwise.
 */
export function refineByContent(
  webc: string[],
  drc: string[],
  guide: Map<number, number[]>,
  band = 4,
  bonus = 0.12,
): Pairing {
  const W = webc.map(words);
  const D = drc.map(words);
  const n = W.length;
  const m = D.length;
  // Where the guide puts each WEBC verse (interpolated where it has none).
  const at = new Float64Array(n);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const g = guide.get(i);
    if (g?.length) last = g[0]!;
    at[i] = last;
  }
  const inBand = (i: number, j: number) => Math.abs(j - at[i]!) <= band;
  // A pair the numbering proposes never costs anything (lists of names spelled differently, Noe
  // and Noah, share no words); any other pair must earn its place.
  const score = (i: number, j: number) =>
    guide.get(i)?.includes(j) ? overlap(W[i]!, D[j]!) + bonus : overlap(W[i]!, D[j]!) - FLOOR;
  // Sparse DP over the band (rows i, columns j near at[i]).
  const NEG = -1e18;
  const best: Map<number, number>[] = Array.from({ length: n + 1 }, () => new Map());
  const move: Map<number, number>[] = Array.from({ length: n + 1 }, () => new Map());
  const get = (i: number, j: number) => {
    if (i === 0 && j === 0) return 0;
    return best[i]!.get(j) ?? NEG;
  };
  const cols = (i: number) => {
    // Columns reachable in row i: the band of rows i and i+1 (so skips can cross rows).
    const lo = Math.max(
      0,
      Math.floor(Math.min(at[Math.max(0, i - 1)]!, at[Math.min(n - 1, i)]!) - band - 1),
    );
    const hi = Math.min(
      m,
      Math.ceil(Math.max(at[Math.max(0, i - 1)]!, at[Math.min(n - 1, i)]!) + band + 2),
    );
    return [lo, i === n ? m : hi] as const;
  };
  for (let i = 0; i <= n; i++) {
    const [lo, hi] = i === 0 ? [0, Math.min(m, Math.ceil(at[0]! + band + 2))] : cols(i);
    for (let j = i === 0 ? 1 : lo; j <= hi; j++) {
      let b = NEG;
      let mv = 0;
      if (i && j && inBand(i - 1, j - 1)) {
        const s = get(i - 1, j - 1) + score(i - 1, j - 1);
        if (s > b) [b, mv] = [s, 1];
      }
      if (i && get(i - 1, j) > b) [b, mv] = [get(i - 1, j), 2];
      if (j && get(i, j - 1) > b) [b, mv] = [get(i, j - 1), 3];
      if (b > NEG) {
        best[i]!.set(j, b);
        move[i]!.set(j, mv);
      }
    }
    if (i === 0) best[0]!.set(0, 0);
  }
  if (!best[n]!.has(m)) return { pairs: new Map(guide), scores: new Map(), attached: [] };
  const matched = new Map<number, number>();
  for (let i = n, j = m; i || j;) {
    const mv = move[i]!.get(j) ?? (i ? 2 : 3);
    if (mv === 1) {
      if (overlap(W[i - 1]!, D[j - 1]!) >= FLOOR || guide.get(i - 1)?.includes(j - 1))
        matched.set(j - 1, i - 1);
      i--;
      j--;
    } else if (mv === 2) i--;
    else j--;
  }
  const pairs = new Map<number, number[]>();
  const attached: number[] = [];
  const owner = new Map<number, number>();
  for (const [w, ds] of guide) for (const d of ds) if (!owner.has(d)) owner.set(d, w);
  const keptOwner = (j: number) => {
    const w = owner.get(j);
    return w !== undefined && [...matched.values()].includes(w) ? w : undefined;
  };
  for (let j = 0; j < m; j++) {
    let w = matched.get(j);
    if (w === undefined) {
      attached.push(j);
      // Back where the numbering put it (a psalm's title with its verse 1), else beside the
      // verse before it, else the verse after.
      w = keptOwner(j);
      for (let k = j - 1; k >= 0 && w === undefined; k--) w = matched.get(k);
      for (let k = j + 1; k < m && w === undefined; k++) w = matched.get(k);
      if (w === undefined) continue;
    }
    pairs.set(w, [...(pairs.get(w) ?? []), j]);
  }
  const scores = new Map<number, number>();
  for (const [w, ds] of pairs)
    scores.set(w, overlap(W[w]!, new Set(ds.flatMap((d) => [...D[d]!]))));
  return { pairs, scores, attached };
}
