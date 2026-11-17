/**
 * TVTMS writes the Psalms in a second layout: each record names its traditions on test lines
 * ("Latin + Greek  & Psa.9:39=Last & Psa.9:TextBeforeV1=NotExist") and its columns on a "BIBLES"
 * row, and maps psalm titles ("Psa.3:Title") explicitly. This reader is used only for the
 * Douay-Rheims alignment; the WEBC pipeline never needs the Psalms' renumbering (the WEBC follows
 * the English column there, as the plan's numbering does).
 */
import fs from 'node:fs';

export interface NamedRecord {
  header: string;
  line: number;
  columns: string[];
  /** For each column, the conditions that hold in a Bible following it (empty if none given). */
  conds: string[][];
  rows: { type: string; cells: string[]; line: number }[];
}

export function readNamedRecords(file: string, book = 'Psa'): NamedRecord[] {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith('#DataStart(Condensed)'));
  const end = lines.findIndex((l) => l.startsWith('#DataEnd(Condensed)'));
  const out: NamedRecord[] = [];
  let cur: (NamedRecord & { named: [string[], string[]][] }) | null = null;
  for (let i = start + 1; i < end; i++) {
    const cols = lines[i]!.split('\t').map((c) => c.trim());
    const first = cols[0] ?? '';
    if (first.startsWith('$')) {
      cur = null;
      if (!first.startsWith(`$${book}.`) || cols.slice(1).some(Boolean)) continue;
      cur = { header: first.slice(1), line: i + 1, columns: [], conds: [], rows: [], named: [] };
      out.push(cur);
      continue;
    }
    if (!cur || !first) continue;
    if (first === 'BIBLES') {
      const named = cur.named;
      cur.columns = cols.slice(1).filter(Boolean);
      cur.conds = cur.columns.map((c) => named.find(([names]) => names.includes(c))?.[1] ?? []);
      continue;
    }
    if (!cur.columns.length) {
      // A named test line: traditions, then conditions joined by "&".
      const names = first.split('+').map((s) => s.trim());
      const conds = (cols[1] ?? '')
        .split('&')
        .map((s) => s.trim())
        .filter(Boolean);
      cur.named.push([names, conds]);
      continue;
    }
    cur.rows.push({ type: first, cells: cols.slice(1, 1 + cur.columns.length), line: i + 1 });
  }
  return out.map(({ header, line, columns, conds, rows }) => ({
    header,
    line,
    columns,
    conds,
    rows,
  }));
}

export type Cond = 'pass' | 'fail' | 'unknown';

/** One condition against a Bible's chapter lengths and the chapters that print a title. */
export function evalCond(
  cond: string,
  lengths: number[],
  titled: Set<number>,
  wordCount?: (c: number, v: number) => number | undefined,
): Cond {
  // Word-count comparisons (`Psa.19:1<Psa.19:9`) tell apart layouts that differ only in where a
  // title's words sit.
  const cmp = /^psa\.(\d+):(\d+)([<>])psa\.(\d+):(\d+)$/i.exec(cond.trim());
  if (cmp) {
    const x = wordCount?.(Number(cmp[1]), Number(cmp[2]));
    const y = wordCount?.(Number(cmp[4]), Number(cmp[5]));
    if (x === undefined || y === undefined) return wordCount ? 'fail' : 'unknown';
    return (cmp[3] === '<' ? x < y : x > y) ? 'pass' : 'fail';
  }
  const m = /^psa\.(\d+):(\d+|TextBeforeV1)=(Last|Exist|NotExist)$/i.exec(cond.trim());
  if (!m) return 'unknown';
  const c = Number(m[1]);
  const last = lengths[c - 1] ?? 0;
  if (m[2] === 'TextBeforeV1') {
    if (!last) return 'fail';
    return (m[3] === 'Exist') === titled.has(c) ? 'pass' : 'fail';
  }
  const v = Number(m[2]);
  const exists = v >= 1 && v <= last;
  if (m[3] === 'Last') return last === v ? 'pass' : 'fail';
  return (m[3] === 'Exist') === exists ? 'pass' : 'fail';
}

/** A cell such as "Psa.9:22-39", "Psa.3:Title", "Absent [=Psa.23:1]" → verses, or 'title'. */
export function parsePsalmCell(cell: string): { c: number; v: number }[] | 'title' | null {
  const s = cell.replace(/\[[^\]]*\]/g, '').trim();
  if (!s || /^Absent|^NoVerse/i.test(s)) return null;
  if (/:Title$/i.test(s)) return 'title';
  const out: { c: number; v: number }[] = [];
  let chapter: number | null = null;
  for (const raw of s.split(';')) {
    const part = raw.trim().replace(/^psa\./i, '');
    const m = /^(?:(\d+):)?(\d+)(?:\.\d+)?(?:-(\d+)(?:\.\d+)?)?\*?$/.exec(part);
    if (!m) throw new Error(`TVTMS: cannot parse Psalms reference "${cell}"`);
    if (m[1]) chapter = Number(m[1]);
    if (chapter === null) throw new Error(`TVTMS: reference without chapter "${cell}"`);
    const to = m[3] ? Number(m[3]) : Number(m[2]);
    for (let v = Number(m[2]); v <= to; v++) out.push({ c: chapter, v });
  }
  return out;
}
