/**
 * The Douay-Rheims maps (content/drc/maps.json) and the whole-Bible alignment, shared by
 * `pnpm drc:align` (the review documents) and `pnpm content:build` (the reader's files).
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CANON } from '../lib/canon';
import { RAW_DIR } from '../lib/paths';
import { readTvtmsCondensed } from '../lib/tvtms';
import { parseAllBooks, parseUsfm, type ParsedBook } from '../parse-usfm';
import { alignBook, DRC_USFM, type DrcAlignment, type DrcBookMap } from './align';
import { readNamedRecords } from './psalms';

export const MAPS_FILE = path.join(process.cwd(), 'content/drc/maps.json');

/** The parts of a book's map that decide where verses land. */
export function mapFingerprint(book: string, m: DrcBookMap): string {
  const { whole, byChapter, splits, segments } = m;
  return createHash('sha256')
    .update(
      JSON.stringify({
        book,
        whole: !!whole,
        byChapter: !!byChapter,
        splits: splits ?? [],
        segments,
      }),
    )
    .digest('hex')
    .slice(0, 16);
}

export function readDrc(dir = path.join(RAW_DIR, 'drc')): Map<string, ParsedBook> {
  if (!fs.existsSync(dir)) throw new Error(`${dir} not found: run pnpm content:fetch first`);
  const files = fs.readdirSync(dir);
  const out = new Map<string, ParsedBook>();
  for (const b of CANON) {
    const code = DRC_USFM[b.usfm] ?? b.usfm;
    const f = files.find((x) => new RegExp(`^\\d+-${code}engDRA\\.usfm$`).test(x));
    if (!f) throw new Error(`Douay-Rheims file for ${b.id} (${code}) not found in ${dir}`);
    out.set(b.id, parseUsfm(fs.readFileSync(path.join(dir, f), 'utf8'), b, f));
  }
  return out;
}

export function alignAll(
  webc: Map<string, ParsedBook> = parseAllBooks(path.join(RAW_DIR, 'webc')),
): { alignments: DrcAlignment[]; maps: Record<string, DrcBookMap> } {
  const file = JSON.parse(fs.readFileSync(MAPS_FILE, 'utf8')) as {
    books: Record<string, DrcBookMap>;
  };
  const drc = readDrc();
  const tvtms = path.join(RAW_DIR, 'TVTMS.txt');
  const records = readTvtmsCondensed(tvtms);
  const psalms = readNamedRecords(tvtms);
  const alignments = CANON.map((b) =>
    alignBook(webc.get(b.id)!, drc.get(b.id)!, records, psalms, file.books[b.id]),
  );
  return { alignments, maps: file.books };
}

/** Every map must carry the owner's approval, with a fingerprint matching its current content. */
export function checkMapApprovals(maps: Record<string, DrcBookMap>): string[] {
  const errors: string[] = [];
  for (const [id, m] of Object.entries(maps)) {
    const fp = mapFingerprint(id, m);
    if (!m.approval) errors.push(`content/drc/maps.json ${id}: not approved (fingerprint ${fp})`);
    else if (m.approval.fingerprint !== fp)
      errors.push(
        `content/drc/maps.json ${id}: changed since it was approved on ${m.approval.date} (approved ${m.approval.fingerprint}, now ${fp}); needs the owner's approval again`,
      );
  }
  return errors;
}
