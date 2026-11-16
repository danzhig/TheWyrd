/**
 * OpenBible.info cross-references (`cross_references.txt`, CC BY 4.0; drawn mainly from the
 * public-domain Treasury of Scripture Knowledge): one row per link, `from`, `to` and readers'
 * votes. References are OSIS in English numbering (a verse or a range), which matches WEBC. Rows
 * are cited by their line number: `OpenBibleXref:L123`.
 */
import fs from 'node:fs';
import path from 'node:path';

export interface XrefRow {
  id: string;
  from: string;
  to: string;
  votes: number;
}

export function readXrefs(dirOrFile: string): XrefRow[] {
  const file = fs.statSync(dirOrFile).isDirectory()
    ? path.join(dirOrFile, 'cross_references.txt')
    : dirOrFile;
  return parseXrefs(fs.readFileSync(file, 'utf8'));
}

export function parseXrefs(text: string): XrefRow[] {
  const rows: XrefRow[] = [];
  text.split('\n').forEach((line, i) => {
    if (i === 0 || !line.trim()) return; // header
    const [from, to, votes] = line.split('\t');
    if (!from || !to) return;
    rows.push({ id: `OpenBibleXref:L${i + 1}`, from, to, votes: Number(votes) || 0 });
  });
  return rows;
}

/** Book, chapter and verse of a reference's start or end (`Gen.1.1`, `Gen.1`: verse 0 = whole). */
export function parsePoint(p: string): { book: string; c: number; v: number } {
  const [book, c, v] = p.split('.');
  return { book: book!, c: Number(c), v: v === undefined ? 0 : Number(v) };
}

/** Does verse `ref` (`Book.c.v`) fall inside range `r` (a verse, a range, or whole chapters)? */
export function inRange(ref: string, r: string): boolean {
  const x = parsePoint(ref);
  const [a, b] = r.split('-') as [string, string | undefined];
  const s = parsePoint(a);
  const e = parsePoint(b ?? a);
  if (s.book !== e.book) {
    // A range across books: only its own books' ends are checked.
    if (x.book === s.book) return x.c > s.c || (x.c === s.c && (s.v === 0 || x.v >= s.v));
    if (x.book === e.book) return x.c < e.c || (x.c === e.c && (e.v === 0 || x.v <= e.v));
    return false;
  }
  if (x.book !== s.book) return false;
  const after = x.c > s.c || (x.c === s.c && (s.v === 0 || x.v >= s.v));
  const before = x.c < e.c || (x.c === e.c && (e.v === 0 || x.v <= e.v));
  return after && before;
}
