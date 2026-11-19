/**
 * Theme passages in the content build (Phase 6, P6.2): check content/themes/themes.json against the
 * built sections and write public/data/themes.json with approved passages only. Each passage gets
 * its reference for display, its section's title, and an excerpt cut from the built WEBC text of
 * its first verse (never typed).
 */
import fs from 'node:fs';
import path from 'node:path';
import { verseText, type SectionFile } from '../../lib/types';
import { CANON, CANON_BY_ID } from '../lib/canon';
import { prettyRange } from '../../lib/format';
import { readReadings, readingsFingerprint, readThemes, themesFingerprint } from './taxonomy';

export interface PublicThemePassage {
  ref: string; // OSIS, WEBC numbering
  display: string; // "Luke 6:36", "Psalms 56:3–4"
  sectionId: string;
  sectionTitle: string;
  bookId: string;
  library: boolean;
  excerpt: string;
  sources: { dataset: 'naves' | 'openbible'; row: string }[];
}
/** A reading in a sub-theme (P6.5): every built section has a home, some a second. */
export interface PublicThemeReading {
  sectionId: string;
  title: string;
  display: string; // "Genesis 1:1–2:3", the book's own name and the section's WEBC range
  bookId: string;
  library: boolean;
  /** This is the reading's second sub-theme (its home is elsewhere). */
  second?: boolean;
  /** The first key passage of this sub-theme inside the reading (OSIS), if any. */
  key?: string;
}
export interface PublicThemes {
  themes: {
    id: string;
    title: string;
    description: string;
    subthemes: {
      id: string;
      title: string;
      description: string;
      passages: PublicThemePassage[];
      readings: PublicThemeReading[];
    }[];
  }[];
}

const EXCERPT_CHARS = 160;

/** The first verse's text, cut at a word boundary. */
export function excerpt(text: string, max = EXCERPT_CHARS): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 40)).replace(/[\s,;:]+$/, '')}…`;
}

/** "Luke.6.36" → "Luke 6:36"; ranges within a chapter "6:36–38", across chapters "6:36–7:2". */
export function displayRef(ref: string, bookName: string): string {
  const [a, b] = ref.split('-') as [string, string | undefined];
  const [, c1, v1] = a.split('.');
  if (!v1) return `${bookName} ${c1}`;
  if (!b) return `${bookName} ${c1}:${v1}`;
  const [b2, c2, v2] = b.split('.');
  // A range into another book ("Gen.12.1-1Kgs.8.21"): "Genesis 12:1 – 1 Kings 8:21".
  if (b2 !== a.split('.')[0])
    return `${bookName} ${c1}:${v1} – ${CANON_BY_ID.get(b2!)?.name ?? b2} ${c2}:${v2}`;
  return c2 === c1 ? `${bookName} ${c1}:${v1}–${v2}` : `${bookName} ${c1}:${v1}–${c2}:${v2}`;
}

export function buildThemes(
  sectionFiles: SectionFile[],
  library: Set<string>,
  themesFile?: string,
  readingsFile?: string,
): { data: PublicThemes | null; errors: string[] } {
  const file = readThemes(themesFile);
  if (!file) return { data: null, errors: [] };
  const errors: string[] = [];
  // Every reading in a theme (P6.5): each built section has exactly one home, approved.
  const readings = readReadings(readingsFile);
  const subIds = new Set(file.themes.flatMap((t) => t.subthemes.map((s) => s.id)));
  const placed = new Map<string, string[]>();
  let readingsOk = false;
  if (readings) {
    const fp = readingsFingerprint(readings.readings);
    if (!readings.approval) errors.push(`readings.json: not approved (fingerprint ${fp})`);
    else if (readings.approval.fingerprint !== fp)
      errors.push(`readings.json: edited since its approval (fingerprint ${fp})`);
    else readingsOk = true;
    for (const r of readings.readings) {
      if (placed.has(r.sectionId)) errors.push(`readings.json: ${r.sectionId} is placed twice`);
      if (!sectionFiles.some((s) => s.id === r.sectionId))
        errors.push(`readings.json: no section ${r.sectionId}`);
      for (const sub of r.subs)
        if (!subIds.has(sub)) errors.push(`readings.json ${r.sectionId}: no sub-theme ${sub}`);
      placed.set(r.sectionId, r.subs);
    }
    for (const s of sectionFiles)
      if (!placed.has(s.id)) errors.push(`readings.json: ${s.id} has no theme`);
  }
  const bySection = new Map(sectionFiles.map((s) => [s.id, s]));
  const verseSection = new Map<string, string>();
  for (const s of sectionFiles)
    for (const v of s.verses) {
      const whole = v.ref.split('!')[0]!;
      if (!verseSection.has(whole)) verseSection.set(whole, s.id);
    }
  const first = (ref: string) => {
    const f = ref.split('-')[0]!;
    return f.split('.').length === 2 ? `${f}.1` : f;
  };
  // A sub-theme's readings go in the Bible's order (the canon's books; within a book, as built).
  const canonAt = new Map(CANON.map((b, i) => [b.id, i]));
  const inBibleOrder = sectionFiles
    .map((sec, i) => ({ sec, i }))
    .sort(
      (a, b) =>
        (canonAt.get(a.sec.bookId) ?? 999) - (canonAt.get(b.sec.bookId) ?? 999) || a.i - b.i,
    )
    .map((x) => x.sec);
  const data: PublicThemes = { themes: [] };
  for (const t of file.themes) {
    const approved = t.approval && t.approval.fingerprint === themesFingerprint(t.subthemes);
    if (t.approval && !approved)
      errors.push(
        `themes.json ${t.id}: edited since its approval (fingerprint ${themesFingerprint(t.subthemes)})`,
      );
    const subthemes = [];
    for (const s of t.subthemes) {
      const passages: PublicThemePassage[] = [];
      for (const p of s.passages) {
        const where = `themes.json ${s.id} ${p.ref}`;
        const sec = bySection.get(p.sectionId);
        if (!sec) {
          errors.push(`${where}: no section ${p.sectionId}`);
          continue;
        }
        if (verseSection.get(first(p.ref)) !== p.sectionId)
          errors.push(`${where}: its first verse is not in ${p.sectionId}`);
        const end = p.ref.split('-')[1];
        if (end && !verseSection.has(end)) errors.push(`${where}: no verse ${end} in WEBC`);
        if (!p.sources.length) errors.push(`${where}: cites no dataset row`);
        // Drafts, and anything in a theme without a valid approval, stay out of the site.
        if (p.status !== 'approved' || !approved) continue;
        const v = sec.verses.find((x) => x.ref.split('!')[0] === first(p.ref));
        passages.push({
          ref: p.ref,
          // The book's own name, not the plan's label for the part it reads ("Daniel 1–6, 13–14").
          display: displayRef(p.ref, CANON_BY_ID.get(sec.bookId)?.name ?? sec.bookName),
          sectionId: p.sectionId,
          sectionTitle: sec.title,
          bookId: sec.bookId,
          library: library.has(p.sectionId),
          excerpt: v ? excerpt(verseText(v)) : '',
          sources: p.sources,
        });
      }
      const own: PublicThemeReading[] = [];
      if (readingsOk)
        for (const sec of inBibleOrder) {
          // A reading belongs to its home and second, and to every sub-theme for which it holds
          // an approved key passage (owner, 2026-11-17: a sub-theme never loses its key passages).
          const subs = placed.get(sec.id);
          const key = passages.find((p) => p.sectionId === sec.id)?.ref;
          if (!subs?.includes(s.id) && !key) continue;
          const r: PublicThemeReading = {
            sectionId: sec.id,
            title: sec.title,
            display: `${CANON_BY_ID.get(sec.bookId)?.name ?? sec.bookName} ${prettyRange(sec.webcRange)}`,
            bookId: sec.bookId,
            library: library.has(sec.id),
          };
          if (subs?.[0] !== s.id) r.second = true;
          if (key) r.key = key;
          own.push(r);
        }
      subthemes.push({
        id: s.id,
        title: s.title,
        description: s.description,
        passages,
        readings: own,
      });
    }
    data.themes.push({ id: t.id, title: t.title, description: t.description, subthemes });
  }
  return { data, errors };
}

export function writeThemes(dir: string, data: PublicThemes): void {
  fs.writeFileSync(path.join(dir, 'themes.json'), JSON.stringify(data) + '\n');
}
