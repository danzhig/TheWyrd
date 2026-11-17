/**
 * Every reading in a theme (owner, 2026-11-17; PLAN §16, P6.5): each of the 808 built sections
 * (path and library) gets a home sub-theme, and a second one where it truly sits in two.
 *
 *  1. Evidence. Every candidate the taxonomy's sources name (Nave rows, OpenBible topic votes)
 *     credits the section holding its first verse, as in `pnpm themes:build`: OpenBible's votes
 *     scaled 0–10 within the topic, 4 per Nave row. A sub-theme's credit in a section is divided
 *     by the square root of its credit across the whole Bible, so a vast entry (Nave's CHURCH,
 *     1,036 references) does not swallow every reading it touches.
 *  2. Home and second. The best sub-theme is the home; another becomes the second only when it
 *     scores at least SECOND of the home's weight.
 *  3. Similarity. A section no source cites (most of the deuterocanon, which the two
 *     Protestant-tradition datasets barely index, and some lists) goes to the sub-theme whose
 *     placed readings its words resemble most (cosine of word-weight vectors, WEBC text).
 *
 * Pure apart from its inputs; `pnpm themes:readings` runs it and writes the review document.
 */
import { words } from '../drc/align';
import type { Candidate } from './taxonomy';

export const SECOND = 0.9;
export const SIMILAR_SECOND = 2; // never: words alone do not make a second home

export interface ReadingInput {
  id: string;
  bookId: string;
  text: string;
}

export interface Placement {
  sectionId: string;
  /** Home sub-theme first, then the second if any. */
  subs: string[];
  method: 'evidence' | 'similarity';
  /** Weight (evidence) or cosine (similarity) of each sub-theme in `subs`. */
  scores: number[];
  /** The dataset rows behind an evidence placement (home sub-theme), strongest first. */
  rows: string[];
}

export function placeReadings(
  sections: ReadingInput[],
  candidates: Map<string, Candidate[][]>, // sub-theme id → each source's candidates
  sectionOf: (ref: string) => string | undefined,
): Placement[] {
  // 1. Evidence: credit per (section, sub-theme), with the rows behind it.
  const credit = new Map<string, Map<string, { pts: number; rows: Map<string, number> }>>();
  const totals = new Map<string, number>();
  for (const [sub, sources] of candidates)
    for (const cands of sources) {
      // OpenBible's votes are scaled within each topic (as in themes:build).
      const max = Math.max(1, ...cands.map((c) => c.score ?? 0));
      for (const c of cands) {
        const sec = sectionOf(c.ref);
        if (!sec) continue;
        const pts = c.source.dataset === 'openbible' ? ((c.score ?? 0) / max) * 10 : 4;
        if (pts <= 0) continue;
        const bySub = credit.get(sec) ?? new Map();
        const e = bySub.get(sub) ?? { pts: 0, rows: new Map<string, number>() };
        e.pts += pts;
        e.rows.set(c.source.row, (e.rows.get(c.source.row) ?? 0) + pts);
        bySub.set(sub, e);
        credit.set(sec, bySub);
        totals.set(sub, (totals.get(sub) ?? 0) + pts);
      }
    }
  const placements = new Map<string, Placement>();
  for (const s of sections) {
    const bySub = credit.get(s.id);
    if (!bySub) continue;
    const ranked = [...bySub]
      .map(([sub, e]) => ({ sub, w: e.pts / Math.sqrt(totals.get(sub)!), e }))
      .sort((a, b) => b.w - a.w || a.sub.localeCompare(b.sub));
    const [home, next] = ranked;
    const subs = [home!.sub];
    const scores = [home!.w];
    if (next && next.w >= SECOND * home!.w) {
      subs.push(next.sub);
      scores.push(next.w);
    }
    const rows = [...home!.e.rows].sort((a, b) => b[1] - a[1]).map(([r]) => r);
    placements.set(s.id, { sectionId: s.id, subs, method: 'evidence', scores, rows });
  }

  // 3. Similarity for the rest: word weights (tf × idf) of each section; each sub-theme's profile
  // is the sum of its evidence-placed readings' (home and second).
  const docs = new Map(sections.map((s) => [s.id, count(s.text)]));
  const df = new Map<string, number>();
  for (const d of docs.values()) for (const w of d.keys()) df.set(w, (df.get(w) ?? 0) + 1);
  const n = sections.length;
  const vec = (d: Map<string, number>) => {
    const v = new Map<string, number>();
    for (const [w, tf] of d) {
      const idf = Math.log(n / (df.get(w) ?? 1));
      if (idf > 0) v.set(w, (1 + Math.log(tf)) * idf);
    }
    return normalise(v);
  };
  const vecs = new Map([...docs].map(([id, d]) => [id, vec(d)]));
  const profiles = new Map<string, Map<string, number>>();
  for (const p of placements.values())
    for (const sub of p.subs) {
      const prof = profiles.get(sub) ?? new Map<string, number>();
      for (const [w, x] of vecs.get(p.sectionId)!) prof.set(w, (prof.get(w) ?? 0) + x);
      profiles.set(sub, prof);
    }
  for (const [sub, prof] of profiles) profiles.set(sub, normalise(prof));
  for (const s of sections) {
    if (placements.has(s.id)) continue;
    const v = vecs.get(s.id)!;
    const ranked = [...profiles]
      .map(([sub, prof]) => ({ sub, cos: dot(v, prof) }))
      .sort((a, b) => b.cos - a.cos || a.sub.localeCompare(b.sub));
    const [home, next] = ranked;
    const subs = [home!.sub];
    const scores = [home!.cos];
    if (next && next.cos >= SIMILAR_SECOND * home!.cos) {
      // A second by words alone must be very close to the home (weaker evidence than citations).
      subs.push(next.sub);
      scores.push(next.cos);
    }
    placements.set(s.id, { sectionId: s.id, subs, method: 'similarity', scores, rows: [] });
  }
  return sections.map((s) => placements.get(s.id)!);
}

function count(text: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const w of text
    .toLowerCase()
    .replace(/[’']/g, '')
    .split(/[^a-z]+/))
    if (w.length > 2 && words(w).size) {
      const k = [...words(w)][0]!;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
  return m;
}

function normalise(v: Map<string, number>): Map<string, number> {
  const len = Math.sqrt([...v.values()].reduce((a, x) => a + x * x, 0)) || 1;
  return new Map([...v].map(([k, x]) => [k, x / len]));
}

function dot(a: Map<string, number>, b: Map<string, number>): number {
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  let s = 0;
  for (const [k, x] of small) s += x * (big.get(k) ?? 0);
  return s;
}
