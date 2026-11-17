/**
 * The reader's Douay-Rheims files (Phase 7, P7.2): for every built section, the Douay-Rheims
 * verses that hold each of its WEBC verses' words, from the alignment (scripts/drc/align.ts).
 * Each Douay-Rheims verse is written once, with the first WEBC verse that holds it, and its text
 * is copied from the parsed source unaltered. The build stops on an unapproved or edited map, or
 * if any Douay-Rheims verse is left out or written twice.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { DrcSectionFile, DrcVerseOut, SectionFile } from '../../lib/types';
import { CANON_BY_ID } from '../lib/canon';
import type { ParsedBook } from '../parse-usfm';
import { alignAll, checkMapApprovals, readDrc } from './maps';

export function buildDrc(
  sections: SectionFile[],
  webc: Map<string, ParsedBook>,
): { files: DrcSectionFile[]; errors: string[] } {
  const { alignments, maps } = alignAll(webc);
  const errors = checkMapApprovals(maps);
  const drc = readDrc();
  const verse = new Map([...drc.values()].flatMap((b) => b.verses.map((v) => [v.ref, v] as const)));

  // Each Douay-Rheims verse goes with the first WEBC verse (in the WEBC's order) that holds it.
  const owned = new Map<string, string[]>();
  const taken = new Set<string>();
  for (const a of alignments)
    for (const w of a.webcText.keys())
      for (const d of a.pairs.get(w) ?? []) {
        if (taken.has(d)) continue;
        taken.add(d);
        owned.set(w, [...(owned.get(w) ?? []), d]);
      }

  const out = (ref: string): DrcVerseOut => {
    const v = verse.get(ref)!;
    const o: DrcVerseOut = { c: v.c, v: v.v, blocks: v.blocks };
    if (v.footnotes?.length) o.footnotes = v.footnotes;
    if (v.heading) o.heading = v.heading;
    return o;
  };
  const written = new Map<string, string>(); // drc ref → section id
  const files = sections.map((s) => {
    const units: Record<string, DrcVerseOut[]> = {};
    const refs: string[] = [];
    for (const u of s.verses) {
      // A unit the alignment does not divide (a plan split verse) takes its whole verse's words,
      // once, on its first part.
      const ds = owned.get(u.ref) ?? owned.get(u.ref.replace(/!.*/, '')) ?? [];
      const fresh = ds.filter((d) => !written.has(d));
      if (!fresh.length) continue;
      fresh.forEach((d) => written.set(d, s.id));
      units[u.ref] = fresh.map(out);
      refs.push(...fresh);
    }
    return {
      id: s.id,
      reference: reference(s.bookId, refs),
      order: s.verses.map((u) => u.ref),
      units,
    };
  });

  const total = [...drc.values()].reduce((n, b) => n + b.verses.length, 0);
  if (written.size !== total) {
    const missing = [...verse.keys()].filter((r) => !written.has(r));
    errors.push(
      `Douay-Rheims: ${total - written.size} verses not written to any section (${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', …' : ''})`,
    );
  }
  return { files, errors };
}

/** "Psalms 22:1–7", "Esther 3:1–13; 13:1–7; 3:14–15": runs of consecutive verses. */
export function reference(bookId: string, refs: string[]): string {
  // One psalm is a "Psalm" (the book is the Psalms).
  const book = CANON_BY_ID.get(bookId)?.name ?? bookId;
  const name =
    book === 'Psalms' && new Set(refs.map((r) => r.split('.')[1])).size === 1 ? 'Psalm' : book;
  if (!refs.length) return name;
  const cv = refs.map((r) => r.split('.').slice(1).map(Number) as [number, number]);
  const runs: [number, number, number, number][] = [];
  for (const [c, v] of cv) {
    const last = runs.at(-1);
    if (last && ((last[2] === c && last[3] + 1 === v) || (last[2] + 1 === c && v === 1))) {
      last[2] = c;
      last[3] = v;
    } else runs.push([c, v, c, v]);
  }
  const fmt = ([c1, v1, c2, v2]: [number, number, number, number]) =>
    c1 === c2 ? (v1 === v2 ? `${c1}:${v1}` : `${c1}:${v1}–${v2}`) : `${c1}:${v1}–${c2}:${v2}`;
  return `${name} ${runs.map(fmt).join('; ')}`;
}

export function writeDrc(outDir: string, files: DrcSectionFile[]): number {
  const dir = path.join(outDir, 'drc');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const f of files) fs.writeFileSync(path.join(dir, `${f.id}.json`), JSON.stringify(f) + '\n');
  return files.length;
}
