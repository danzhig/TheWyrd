/** The Douay-Rheims in the reader (Phase 7, P7.2): the files, and how the reader lays them out. */
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getFullManifest, getSection } from '@/lib/data';
import { drcVerses } from '@/lib/drc';
import { readSettings, writeSettings } from '@/lib/store';
import type { DrcSectionFile } from '@/lib/types';
import { reference } from '@/scripts/drc/emit-drc';

const drcFile = (id: string) =>
  JSON.parse(fs.readFileSync(`public/data/drc/${id}.json`, 'utf8')) as DrcSectionFile;

describe('the Douay-Rheims files', () => {
  const sections = getFullManifest().sections;

  it('exist for every section, in the order of its WEBC verses', () => {
    for (const s of sections) {
      const f = drcFile(s.id);
      expect(f.id).toBe(s.id);
      expect(f.order).toEqual(getSection(s.id).verses.map((v) => v.ref));
      for (const u of Object.keys(f.units)) expect(f.order).toContain(u);
    }
  });

  it('hold every Douay-Rheims verse once', () => {
    const seen = new Set<string>();
    let n = 0;
    for (const s of sections)
      for (const ds of Object.values(drcFile(s.id).units))
        for (const d of ds) {
          const key = `${s.bookId}.${d.c}.${d.v}`;
          expect(seen.has(key), key).toBe(false);
          seen.add(key);
          n++;
        }
    expect(n).toBe(35811); // the pinned Douay-Rheims, all 73 books
  });
});

describe('the reader’s layout of a Douay-Rheims file', () => {
  const file: DrcSectionFile = {
    id: 'x',
    reference: 'Psalm 22:1–3',
    order: ['Ps.23.1', 'Ps.23.2', 'Ps.23.3'],
    units: {
      'Ps.23.1': [
        { c: 22, v: 1, blocks: [{ text: 'A psalm.', style: 'q1', brk: true }] },
        { c: 22, v: 2, blocks: [{ text: 'The Lord ruleth me.', style: 'q1', brk: true }] },
      ],
      'Ps.23.3': [
        { c: 22, v: 3, blocks: [{ text: 'He hath converted.', style: 'q1', brk: true }] },
      ],
    },
  };

  it('keeps each WEBC verse’s anchor and gives the Douay-Rheims verses their own numbers', () => {
    const { verses } = drcVerses(file);
    expect(verses.map((v) => [v.ref, v.c, v.v, v.anchor, !!v.bare])).toEqual([
      ['Ps.23.1', 22, 1, 'v-23-1', false],
      ['Ps.23.1~1', 22, 2, 'd-22-2', false],
      ['Ps.23.2', 23, 2, 'v-23-2', true], // no words of its own: an empty anchor
      ['Ps.23.3', 22, 3, 'v-23-3', false],
    ]);
  });

  it('ends a fold with the last Douay-Rheims verse of its last WEBC verse', () => {
    const fold = {
      status: 'skip' as const,
      label: '',
      range: '',
      webcRange: '',
      from: 'Ps.23.1',
      to: 'Ps.23.1',
    };
    expect(drcVerses(file, [fold]).folds[0]!.to).toBe('Ps.23.1~1');
  });

  it('writes references as runs, one psalm as a Psalm', () => {
    expect(reference('Ps', ['Ps.22.1', 'Ps.22.2', 'Ps.22.3'])).toBe('Psalm 22:1–3');
    expect(
      reference('Esth', ['Esth.3.12', 'Esth.3.13', 'Esth.13.1', 'Esth.13.2', 'Esth.3.14']),
    ).toBe('Esther 3:12–13; 13:1–2; 3:14');
    expect(reference('Gen', ['Gen.1.31', 'Gen.2.1'])).toBe('Genesis 1:31–2:1');
  });

  it('is a setting, the WEBC by default', () => {
    expect(readSettings().translation).toBe('webc');
    writeSettings({ translation: 'drc' });
    expect(readSettings().translation).toBe('drc');
    writeSettings({ translation: 'latin' as never });
    expect(readSettings().translation).toBe('webc');
  });
});
