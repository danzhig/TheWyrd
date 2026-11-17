/**
 * Douay-Rheims alignment (Phase 7, step 1): for every book, which Douay-Rheims (Challoner) verses
 * hold the text of each WEBC verse. The WEBC stays the site's backbone; this table lets a reader
 * switch the words on a page to the Douay-Rheims without anything else learning a second numbering.
 *
 *  - Numbering differences come from STEPBible TVTMS, as for the WEBC itself: each record's TEST
 *    lines are evaluated against both texts' chapter lengths to prove which column (English KJV,
 *    Hebrew, Latin, …) each follows there, and the rows map one column onto the other.
 *  - Books whose Douay-Rheims text is a different form of the book (the Vulgate's Tobit, Judith,
 *    Esther, Daniel's Greek parts) need a content map the owner approves (`content/drc/maps.json`,
 *    step 1 proposes it from the checks below).
 *  - Every pair is checked by content: the words a WEBC verse shares with its Douay-Rheims verse,
 *    against those it shares with the Douay-Rheims verses either side. A pair whose neighbour fits
 *    better is reported, so a misalignment cannot pass silently.
 */
import type { CanonBook } from '../lib/canon';
import { evaluateTest, parseTvtmsCell, type TestResult, type TvtmsRecord } from '../lib/tvtms';
import type { ParsedBook } from '../parse-usfm';
import { pairByContent, refineByContent } from './content';
import { evalCond, parsePsalmCell, type NamedRecord } from './psalms';

/** The Douay-Rheims files use the Hebrew/Latin book codes where the WEBC uses its Greek forms. */
export const DRC_USFM: Record<string, string> = { ESG: 'EST', DAG: 'DAN' };

export interface RecordUse {
  header: string;
  line: number;
  /** The column each text follows here, or why the record was not used. */
  webc: string | null;
  drc: string | null;
  decision: 'applied' | 'same' | 'undetermined' | 'not-applicable' | 'unparsed';
  note?: string;
}

export interface Suspect {
  webc: string;
  drc: string[];
  score: number;
  neighbour: string;
  neighbourScore: number;
}

export interface DrcAlignment {
  book: CanonBook;
  /** WEBC verse ref → Douay-Rheims verse refs (in order). */
  pairs: Map<string, string[]>;
  /** Where each pair came from: `identity`, or the TVTMS record and line. */
  sources: Map<string, string>;
  records: RecordUse[];
  unmatchedWebc: string[];
  unmatchedDrc: string[];
  /** Douay-Rheims verses claimed by more than one WEBC verse that are not a merge in TVTMS. */
  shared: string[];
  suspects: Suspect[];
  /** Each WEBC unit's text (Esther 1:1 divided as the map says), for the report. */
  webcText: Map<string, string>;
  /** The map's segments, each with its verse pairs (books with an owner-approved map). */
  segments: SegmentReport[];
  /** Pairs the content refinement changed from the numbering's (`ref: before → after`). */
  moved: string[];
  meanScore: number;
  webcVerses: number;
  drcVerses: number;
}

const ref = (book: CanonBook, c: number, v: number) => `${book.id}.${c}.${v}`;

const passes = (rs: TestResult[]) => rs.includes('pass') && !rs.includes('fail');

/** The column a text follows in a record: the preferred one if its tests pass, else any other. */
function columnFor(
  rec: TvtmsRecord,
  parsed: ParsedBook,
  book: string,
  prefer: string[],
): { col: number; results: TestResult[][] } | null {
  const lengths = parsed.chapterLengths;
  const count = new Map(parsed.verses.map((v) => [`${v.c}:${v.v}`, v.text.split(/\s+/).length]));
  // Word-count comparisons ("Neh.7:56<Neh.7:68") tell apart layouts that put a verse's words in
  // its neighbour; the shared reader leaves them undecided, so they are evaluated here.
  const test = (cell: string): TestResult => {
    const m = /^([1-3]?[A-Za-z]+)\.(\d+):(\d+)([<>])\1\.(\d+):(\d+)$/.exec(cell.trim());
    if (!m || m[1] !== book) return evaluateTest(cell, lengths, book);
    const x = count.get(`${m[2]}:${m[3]}`);
    const y = count.get(`${m[5]}:${m[6]}`);
    if (x === undefined || y === undefined) return 'fail';
    return (m[4] === '<' ? x < y : x > y) ? 'pass' : 'fail';
  };
  const results = rec.columns.map((_, i) => rec.tests.map((t) => test(t[i] ?? '')));
  const order = [
    ...prefer.map((p) => rec.columns.findIndex((c) => c.startsWith(p))).filter((i) => i >= 0),
    ...rec.columns.map((_, i) => i),
  ];
  for (const i of order) if (passes(results[i]!)) return { col: i, results };
  return null;
}

export interface DrcSegment {
  webc: string; // "1:1!b-3:12"
  drc: string[]; // ["3:14-4:8", "15:1-3", …], in the order they pair with the WEBC
  why: string;
}

export interface DrcBookMap {
  why: string;
  /** Segments replace the numbering for the whole book (the Douay-Rheims is another form of it). */
  whole?: boolean;
  /** Pair each chapter with the same chapter, verses by content. */
  byChapter?: boolean;
  splits?: { ref: string; afterBlockEndingWith: string; why: string }[];
  segments: DrcSegment[];
  approval?: { by: string; date: string; fingerprint: string } | null;
}

export interface SegmentReport {
  webc: string;
  drc: string[];
  why: string;
  /** WEBC ref, its Douay-Rheims refs, and the score of the pair. */
  pairs: [string, string[], number][];
  /** WEBC verses inside the segment with no Douay-Rheims words of their own. */
  bare: string[];
}

/** A WEBC verse divided where a map says (Esther 1:1: Addition A, then the Hebrew 1:1). */
function splitVerses(parsed: ParsedBook, splits: DrcBookMap['splits'] = []): ParsedBook {
  if (!splits.length) return parsed;
  const verses = parsed.verses.flatMap((v) => {
    const sp = splits.find((x) => x.ref === `${v.c}:${v.v}`);
    if (!sp) return [v];
    const k = v.blocks.findIndex((b) => b.text.trimEnd().endsWith(sp.afterBlockEndingWith));
    if (k < 0 || k === v.blocks.length - 1)
      throw new Error(`${v.ref}: no block ending with "${sp.afterBlockEndingWith}" to split at`);
    const part = (p: 'a' | 'b', blocks: typeof v.blocks) => ({
      ...v,
      ref: `${v.ref}!${p}`,
      part: p,
      blocks,
      text: blocks.map((b) => b.text).join(' '),
    });
    return [part('a', v.blocks.slice(0, k + 1)), part('b', v.blocks.slice(k + 1))];
  });
  return { ...parsed, verses };
}

/** The refs a map range names, in text order: "3:14-4:8", "1:1!a", "10:4-10:13". */
function rangeRefs(refs: string[], book: CanonBook, spec: string): string[] {
  const [a, b = a] = spec.split(/-(?=\d)/);
  const at = (x: string) => {
    const r = `${book.id}.${x!.replace(':', '.')}`;
    const i = refs.indexOf(r);
    if (i < 0) throw new Error(`${book.id}: ${r} (in "${spec}") is not a verse of this text`);
    return i;
  };
  const from = at(a!);
  // "13:1-7": a bare verse number ends the range in the same chapter.
  const end = b && !b.includes(':') ? `${a!.split(':')[0]}:${b}` : (b ?? a!);
  const to = at(end);
  if (to < from) throw new Error(`${book.id}: "${spec}" runs backwards`);
  return refs.slice(from, to + 1);
}

export function alignBook(
  webcParsed: ParsedBook,
  drc: ParsedBook,
  records: TvtmsRecord[],
  psalms: NamedRecord[] = [],
  map?: DrcBookMap,
): DrcAlignment {
  const webc = splitVerses(webcParsed, map?.splits);
  const whole = !!map?.whole;
  const { book } = webc;
  const webcRefs = webc.verses.map((v) => v.ref);
  const drcRefs = drc.verses.map((v) => v.ref);
  const drcExists = new Set(drcRefs);
  const webcExists = new Set(webcRefs);
  const pairs = new Map<string, string[]>();
  const sources = new Map<string, string>();
  const claimed = new Map<string, string[]>(); // drc ref → webc refs
  const fromRecords = new Set<string>(); // webc refs placed by a record (or left out by one)
  const uses: RecordUse[] = [];
  const add = (w: string, d: string, source: string) => {
    const list = pairs.get(w) ?? [];
    if (!list.includes(d)) list.push(d);
    pairs.set(w, list);
    sources.set(w, source);
    const by = claimed.get(d) ?? [];
    if (!by.includes(w)) by.push(w);
    claimed.set(d, by);
  };

  for (const rec of whole ? [] : records.filter((r) => r.book === book.tvtms)) {
    const use: RecordUse = {
      header: rec.header,
      line: rec.line,
      webc: null,
      drc: null,
      decision: 'undetermined',
    };
    uses.push(use);
    const ofBook = (s: string | undefined) => (s ?? '').includes(`${book.tvtms}.`);
    if (rec.rows.every((r) => r.cells.every((c) => !ofBook(c)))) {
      use.decision = 'not-applicable';
      continue;
    }
    const w = columnFor(rec, webc, book.tvtms, ['English', 'Hebrew']);
    const d = columnFor(rec, drc, book.tvtms, ['Latin', 'English']);
    if (!w || !d) {
      use.note = `${w ? '' : 'WEBC'}${!w && !d ? ' and ' : ''}${d ? '' : 'Douay-Rheims'} matches no column's tests`;
      continue;
    }
    use.webc = rec.columns[w.col]!;
    use.drc = rec.columns[d.col]!;
    const norm = (s: string | undefined) =>
      (s ?? '').replace(/\s+/g, '').replace(/\[[^\]]*\]/g, '');
    if (rec.rows.every((r) => norm(r.cells[w.col]) === norm(r.cells[d.col]))) {
      use.decision = 'same';
      continue;
    }
    try {
      const rows = rec.rows.map((row) => ({
        row,
        w: parseTvtmsCell(row.cells[w.col] ?? ''),
        d: parseTvtmsCell(mergedInto(row.cells[d.col] ?? '')),
      }));
      for (const { row, w: wr, d: dr } of rows) {
        const source = `TVTMS ${rec.header} (line ${row.line}, ${row.type})`;
        const wk = (wr ?? []).map(({ c, v }) => ref(book, c, v)).filter((r) => webcExists.has(r));
        const dk = (dr ?? []).map(({ c, v }) => ref(book, c, v)).filter((r) => drcExists.has(r));
        wk.forEach((r) => fromRecords.add(r));
        if (!wk.length || !dk.length) continue; // a verse one text lacks: reported as unmatched
        if (wk.length === dk.length) wk.forEach((r, i) => add(r, dk[i]!, source));
        else if (wk.length === 1) dk.forEach((r) => add(wk[0]!, r, source));
        else if (dk.length === 1) wk.forEach((r) => add(r, dk[0]!, source));
        else {
          // Unequal ranges: pair in order, the last of the shorter side taking the rest.
          const n = Math.max(wk.length, dk.length);
          for (let i = 0; i < n; i++)
            add(wk[Math.min(i, wk.length - 1)]!, dk[Math.min(i, dk.length - 1)]!, source);
        }
      }
      use.decision = 'applied';
    } catch (err) {
      use.decision = 'unparsed';
      use.note = err instanceof Error ? err.message : String(err);
    }
  }

  // The Psalms' own records (titles counted as verses in the Douay-Rheims, the Vulgate's numbering).
  if (book.tvtms === 'Psa' && !whole) {
    const titled = (p: ParsedBook) =>
      new Set(p.verses.filter((v) => v.v === 1 && v.heading).map((v) => v.c));
    const wTitled = titled(webc);
    const dTitled = titled(drc);
    const counter = (p: ParsedBook) => {
      const n = new Map(p.verses.map((v) => [`${v.c}:${v.v}`, v.text.split(/\s+/).length]));
      return (c: number, v: number) => n.get(`${c}:${v}`);
    };
    // The WEBC prints every title as a heading, never inside a verse, so the title tests (written
    // for Bibles that merge short titles into verse 1, like the KJV) do not apply to it.
    const wConds = (cs: string[]) => cs.filter((c) => !/TextBeforeV1/i.test(c));
    const pick = (
      rec: NamedRecord,
      p: ParsedBook,
      t: Set<number>,
      prefer: string,
      only: (cs: string[]) => string[] = (cs) => cs,
    ) => {
      const count = counter(p);
      const ok = (i: number) => {
        const r = only(rec.conds[i]!).map((c) => evalCond(c, p.chapterLengths, t, count));
        return r.includes('pass') && !r.includes('fail');
      };
      const first = rec.columns.findIndex((c) => c === prefer);
      if (first >= 0 && ok(first)) return { col: first, byShape: false };
      const any = rec.columns.findIndex((_, i) => ok(i));
      if (any >= 0) return { col: any, byShape: false };
      // No column's tests pass (TVTMS has the odd slip, e.g. `Psa.18:15=NotExist` for a Latin
      // column that maps verses up to 18:15): take the column whose verse ranges fit this text's
      // chapter lengths exactly, preferred one first, and say so in the report.
      const fits = (i: number) => {
        const cells = rec.rows.map((r) => parsePsalmCell(r.cells[i] ?? ''));
        const vs = cells.flatMap((x) => (Array.isArray(x) ? x : []));
        if (!vs.length) return false;
        const chapters = new Set(vs.map((x) => x.c));
        return [...chapters].every((c) => {
          const max = Math.max(...vs.filter((x) => x.c === c).map((x) => x.v));
          return max === p.chapterLengths[c - 1];
        });
      };
      if (first >= 0 && fits(first)) return { col: first, byShape: true };
      const shaped = rec.columns.findIndex((_, i) => fits(i));
      return { col: shaped, byShape: shaped >= 0 };
    };
    for (const rec of psalms) {
      const use: RecordUse = {
        header: rec.header,
        line: rec.line,
        webc: null,
        drc: null,
        decision: 'undetermined',
      };
      uses.push(use);
      const chapter = Number(/^Psa\.(\d+)/.exec(rec.header)?.[1]);
      if (!webc.chapterLengths[chapter - 1]) {
        use.decision = 'not-applicable'; // e.g. Psalm 151, not in the Catholic canon
        continue;
      }
      const wp = pick(rec, webc, wTitled, 'English KJV', wConds);
      const dp = pick(rec, drc, dTitled, 'Latin');
      const w = wp.col;
      const d = dp.col;
      if (wp.byShape || dp.byShape)
        use.note = `no column's tests pass for the ${wp.byShape ? 'WEBC' : 'Douay-Rheims'}; chosen by its verse counts`;
      if (w < 0 || d < 0) {
        use.note = `${w < 0 ? 'WEBC' : 'Douay-Rheims'} matches no column's tests`;
        continue;
      }
      use.webc = rec.columns[w]!;
      use.drc = rec.columns[d]!;
      try {
        for (const row of rec.rows) {
          const source = `TVTMS ${rec.header} (line ${row.line}, ${row.type})`;
          const wc = parsePsalmCell(row.cells[w] ?? '');
          // A verse merged into its neighbour ("Absent [=Psa.12:6]") is found in that verse.
          const dc = parsePsalmCell(mergedInto(row.cells[d] ?? ''));
          const dk =
            dc === 'title' || !dc
              ? []
              : dc.map(({ c, v }) => ref(book, c, v)).filter((r) => drcExists.has(r));
          if (wc === 'title') {
            // The WEBC prints a title as a heading over verse 1; its Douay-Rheims verse goes there.
            const c = Number(/(\d+):Title/i.exec(row.cells[w] ?? '')?.[1]);
            const first = ref(book, c, 1);
            if (webcExists.has(first)) dk.forEach((r) => add(first, r, source));
            fromRecords.add(first);
            continue;
          }
          const wk = (wc ?? []).map(({ c, v }) => ref(book, c, v)).filter((r) => webcExists.has(r));
          wk.forEach((r) => fromRecords.add(r));
          if (!wk.length || !dk.length) continue;
          if (wk.length === dk.length) wk.forEach((r, i) => add(r, dk[i]!, source));
          else if (wk.length === 1) dk.forEach((r) => add(wk[0]!, r, source));
          else if (dk.length === 1) wk.forEach((r) => add(r, dk[0]!, source));
          else
            for (let i = 0; i < Math.max(wk.length, dk.length); i++)
              add(wk[Math.min(i, wk.length - 1)]!, dk[Math.min(i, dk.length - 1)]!, source);
        }
        use.decision = w === d ? 'same' : 'applied';
      } catch (err) {
        use.decision = 'unparsed';
        use.note = err instanceof Error ? err.message : String(err);
      }
    }
    // Keep each WEBC verse's Douay-Rheims verses in their order (a title before verse 1).
    for (const [k, list] of pairs) pairs.set(k, sortRefs(list));
  }

  // Everything no record placed keeps its number, if the Douay-Rheims has a free verse there.
  for (const w of whole ? [] : webc.verses) {
    if (pairs.has(w.ref) || fromRecords.has(w.ref)) continue;
    if (drcExists.has(w.ref) && !claimed.has(w.ref)) add(w.ref, w.ref, 'identity');
  }

  // Content refinement within a few verses of the numbering (see refineByContent).
  const moved: string[] = [];
  if (!whole) {
    const wIdx = new Map(webcRefs.map((r, i) => [r, i]));
    const dIdx = new Map(drcRefs.map((r, i) => [r, i]));
    const guide = new Map<number, number[]>();
    for (const [w, ds] of pairs)
      guide.set(
        wIdx.get(w)!,
        ds.map((d) => dIdx.get(d)!),
      );
    const refined = refineByContent(
      webc.verses.map((v) => v.text),
      drc.verses.map((v) => v.text),
      guide,
    );
    const before = new Map([...pairs].map(([w, ds]) => [w, ds.join(',')]));
    pairs.clear();
    claimed.clear();
    for (const [wi, dis] of [...refined.pairs].sort((a, b) => a[0] - b[0])) {
      const w = webcRefs[wi]!;
      const ds = dis.map((j) => drcRefs[j]!);
      const was = before.get(w);
      if (was !== ds.join(',')) {
        moved.push(`${w}: ${was ?? 'none'} → ${ds.join(', ')}`);
        sources.set(w, 'content');
      }
      for (const d of ds) add(w, d, sources.get(w) ?? 'identity');
    }
    for (const w of before.keys()) if (!pairs.has(w)) moved.push(`${w}: ${before.get(w)} → none`);
  }

  // The owner-approved map: segments paired by content (the whole book, or a few verses).
  const segmentReports: SegmentReport[] = [];
  if (map) {
    const wTexts = new Map(webc.verses.map((v) => [v.ref, v.text]));
    const dTexts = new Map(drc.verses.map((v) => [v.ref, v.text]));
    const segs: DrcSegment[] = map.byChapter
      ? webc.chapterLengths.map((n, i) => ({
          webc: `${i + 1}:1-${i + 1}:${n}`,
          drc: [`${i + 1}:1-${i + 1}:${drc.chapterLengths[i]}`],
          why: `Chapter ${i + 1}.`,
        }))
      : map.segments;
    for (const seg of segs) {
      const ws = rangeRefs(webcRefs, book, seg.webc);
      const ds = seg.drc.flatMap((r) => rangeRefs(drcRefs, book, r));
      // Whatever the numbering said about these verses gives way to the map.
      for (const w of ws) {
        for (const d of pairs.get(w) ?? [])
          claimed.set(
            d,
            (claimed.get(d) ?? []).filter((x) => x !== w),
          );
        pairs.delete(w);
      }
      for (const d of ds) {
        for (const w of claimed.get(d) ?? []) {
          const rest = (pairs.get(w) ?? []).filter((x) => x !== d);
          if (rest.length) pairs.set(w, rest);
          else pairs.delete(w);
        }
        claimed.delete(d);
      }
      // Where most verses keep their numbers (the story of Esther), the numbering guides the
      // pairing as in other books; the content alignment moves pairs where the words say so.
      const num = (r: string) => r.split('.').slice(1).join(':').replace(/!.*/, '');
      const dAt = new Map(ds.map((d, j) => [num(d), j]));
      const guide = new Map<number, number[]>();
      let same = 0;
      ws.forEach((w, i) => {
        const j = dAt.get(num(w));
        if (j !== undefined) same++;
        if (j !== undefined) guide.set(i, [j]);
      });
      // In the Vulgate's Tobit and Judith the numbers do not correspond (chapter by chapter, the
      // verses are paired by content alone).
      const texts = [ws.map((w) => wTexts.get(w)!), ds.map((d) => dTexts.get(d)!)] as const;
      const p =
        !map.byChapter && same >= ws.length / 2
          ? refineByContent(...texts, guide)
          : pairByContent(...texts);
      const report: SegmentReport = { ...seg, pairs: [], bare: [] };
      ws.forEach((w, i) => {
        const dis = p.pairs.get(i);
        if (!dis) return report.bare.push(w);
        dis.forEach((j) => add(w, ds[j]!, 'map'));
        report.pairs.push([w, dis.map((j) => ds[j]!), p.scores.get(i) ?? 0]);
      });
      segmentReports.push(report);
    }
    for (const [d, ws] of claimed) if (!ws.length) claimed.delete(d);
  }

  const unmatchedWebc = webcRefs.filter((r) => !pairs.has(r));
  const unmatchedDrc = drcRefs.filter((r) => !claimed.has(r));
  const shared = [...claimed]
    .filter(([, ws]) => ws.length > 1 && !ws.every((w) => sources.get(w)?.startsWith('TVTMS')))
    .map(([d]) => d);

  // Content check.
  const wText = new Map(webc.verses.map((v) => [v.ref, words(v.text)]));
  const dText = new Map(drc.verses.map((v) => [v.ref, words(v.text)]));
  const dIndex = new Map(drcRefs.map((r, i) => [r, i]));
  const suspects: Suspect[] = [];
  let total = 0;
  let counted = 0;
  for (const [w, ds] of pairs) {
    const a = wText.get(w)!;
    const b = union(ds.map((d) => dText.get(d)!));
    const s = overlap(a, b);
    if (a.size >= 3 && b.size >= 3) {
      total += s;
      counted++;
    }
    const idx = ds.map((d) => dIndex.get(d)!);
    const around = [Math.min(...idx) - 1, Math.max(...idx) + 1]
      .filter((i) => i >= 0 && i < drcRefs.length)
      .map((i) => drcRefs[i]!);
    let best = { ref: '', score: -1 };
    for (const n of around) {
      const ns = overlap(a, dText.get(n)!);
      if (ns > best.score) best = { ref: n, score: ns };
    }
    // A neighbour that fits clearly better than the verse paired with it, on verses long enough to
    // judge, suggests the two texts are out of step here.
    if (a.size >= 4 && best.score >= 0.34 && best.score > s + 0.2)
      suspects.push({
        webc: w,
        drc: ds,
        score: s,
        neighbour: best.ref,
        neighbourScore: best.score,
      });
  }

  return {
    book,
    pairs,
    sources,
    records: uses,
    unmatchedWebc,
    unmatchedDrc,
    shared,
    suspects,
    moved,
    segments: segmentReports,
    webcText: new Map(webc.verses.map((v) => [v.ref, v.text])),
    meanScore: counted ? total / counted : 0,
    webcVerses: webcRefs.length,
    drcVerses: drcRefs.length,
  };
}

// ---------------------------------------------------------------------------------------------
// Words for the content check: lower case, no common words, crude endings removed so that
// "walketh" and "walked", "kissed" and "kiss" meet. Proper names spelled differently (Noe, Noah)
// simply do not count.
// ---------------------------------------------------------------------------------------------

const STOP = new Set(
  (
    'the and of to in that he his him they them their for with was is be it not shall will said ' +
    'all which but you your thou thee thy thine ye i me my mine we us our who whom this these those ' +
    'from by on at as are were have has had hath do did doth so then there when unto upon into out ' +
    'up what an or if also no one nor because before after even she her its let may might would ' +
    'should can could than more any every lord god'
  ).split(' '),
);

function stem(w: string): string {
  for (const end of ['eth', 'est', 'ing', 'ed', 'es', 's'])
    if (w.length > end.length + 3 && w.endsWith(end)) return w.slice(0, -end.length);
  return w;
}

export function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[’']/g, '')
      .split(/[^a-z]+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map(stem),
  );
}

/** "Absent [=Psa.12:6]" → "Psa.12:6": where a merged verse's words are. */
export const mergedInto = (cell: string) =>
  /^Absent\s*\[=([^\]]+)\]/i.exec(cell.trim())?.[1] ?? cell;

const sortRefs = (refs: string[]) =>
  [...refs].sort((a, b) => {
    const [, ac, av] = a.split('.').map(Number);
    const [, bc, bv] = b.split('.').map(Number);
    return ac! - bc! || av! - bv!;
  });

const union = (sets: Set<string>[]) => new Set(sets.flatMap((s) => [...s]));

/** Shared words over the smaller verse's words (0–1). */
export function overlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n / Math.min(a.size, b.size);
}
