/** Phase 6 sources and taxonomy: parsers on excerpts, and the shape of the proposed taxonomy. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { verseText, type SectionFile } from '@/lib/types';
import { buildThemes, displayRef, excerpt, type PublicThemes } from '@/scripts/themes/emit-themes';
import { parseEntry } from '@/scripts/themes/naves';
import { parseOpenBible } from '@/scripts/themes/openbible';
import { readingsFingerprint, readTaxonomy, themesFingerprint } from '@/scripts/themes/taxonomy';

/** A readings file that does not exist: these checks are about passages alone. */
const NO_READINGS = '/nonexistent/readings.json';

describe("Nave's entries", () => {
  const rows = parseEntry('MERCY', fs.readFileSync('tests/fixtures/themes/nave-MERCY.xml', 'utf8'));

  it('splits an entry into cited rows of labels, references and cross-references', () => {
    expect(rows.map((r) => r.id)).toEqual(rows.map((_, i) => `Nave:MERCY#${i + 1}`));
    const general = rows[0]!;
    expect(general.refs[0]).toBe('2Sam.22.26');
    expect(general.refs.length).toBeGreaterThan(20);
    expect(rows.find((r) => r.see.includes('KINDNESS'))).toBeTruthy();
    // List items keep their ranges and their own words.
    const range = rows.find((r) => r.refs.includes('Gen.39.21-Gen.39.23'))!;
    expect(range.label.length).toBeGreaterThan(0);
    expect(range.label).not.toMatch(/[<>]/);
  });
});

describe('OpenBible topics', () => {
  it('reads rows with their line numbers as citations, skipping the header', () => {
    const rows = parseOpenBible(
      fs.readFileSync('tests/fixtures/themes/openbible-head.txt', 'utf8'),
    );
    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({ id: 'OpenBible:L2', ref: 'Exod.20.1-Exod.20.26' });
    expect(rows[0]!.score).toBeGreaterThan(0);
  });
});

describe('the taxonomy', () => {
  const tax = readTaxonomy();

  // Ten themes (2026-11-12), and three for content that fitted none of them (2026-11-17).
  it('has 8–14 themes, each with sub-themes, all described, ids unique', () => {
    expect(tax.themes.length).toBeGreaterThanOrEqual(8);
    expect(tax.themes.length).toBeLessThanOrEqual(14);
    const ids = tax.themes.flatMap((t) => [t.id, ...t.subthemes.map((s) => s.id)]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of tax.themes) {
      expect(t.description.length, t.id).toBeGreaterThan(20);
      expect(t.subthemes.length, t.id).toBeGreaterThanOrEqual(3);
      for (const s of t.subthemes) {
        expect(s.id.startsWith(`${t.id}-`)).toBe(true);
        expect(s.description.length, s.id).toBeGreaterThan(10);
      }
    }
  });

  it('is approved only with a named approval', () => {
    expect(tax.status === 'approved').toBe(tax.approval !== null);
  });
});

describe('theme passages (P6.2)', () => {
  const section = (id: string) =>
    JSON.parse(fs.readFileSync(`public/data/sections/${id}.json`, 'utf8')) as SectionFile;

  it('formats references and cuts excerpts at a word', () => {
    expect(displayRef('Luke.6.36', 'Luke')).toBe('Luke 6:36');
    expect(displayRef('Ps.56.3-Ps.56.4', 'Psalms')).toBe('Psalms 56:3–4');
    expect(displayRef('Gen.1.1-Gen.2.3', 'Genesis')).toBe('Genesis 1:1–2:3');
    expect(displayRef('Ps.46', 'Psalms')).toBe('Psalms 46');
    const long = 'word '.repeat(60).trim();
    const e = excerpt(long);
    expect(e.endsWith('…')).toBe(true);
    expect(e.length).toBeLessThanOrEqual(161);
    expect(excerpt('Short.')).toBe('Short.');
  });

  it('publishes approved passages only, and refuses an edited theme or a misplaced passage', () => {
    const gen = section('gen-01');
    const sub = (status: 'draft' | 'approved', ref = 'Gen.1.1') => ({
      id: 'x-y',
      title: 'Y',
      description: 'A test.',
      passages: [
        {
          ref,
          sectionId: 'gen-01',
          sources: [{ dataset: 'naves' as const, row: 'Nave:X#1' }],
          score: 1,
          status,
        },
      ],
    });
    const write = (subthemes: ReturnType<typeof sub>[], fingerprint?: string) => {
      const file = path.join(os.tmpdir(), `themes-${Math.random()}.json`);
      fs.writeFileSync(
        file,
        JSON.stringify({
          $comment: 'test',
          themes: [
            {
              id: 'x',
              title: 'X',
              description: 'A test theme.',
              subthemes,
              approval: {
                by: 'test',
                date: '2026-11-12',
                fingerprint: fingerprint ?? themesFingerprint(subthemes),
              },
            },
          ],
        }),
      );
      return file;
    };
    // A draft is checked but never published.
    const draft = buildThemes([gen], new Set(), write([sub('draft')]), NO_READINGS);
    expect(draft.errors).toEqual([]);
    expect(draft.data!.themes[0]!.subthemes[0]!.passages).toEqual([]);
    // An approved passage is published with its excerpt from the built text.
    const ok = buildThemes([gen], new Set(), write([sub('approved')]), NO_READINGS);
    expect(ok.errors).toEqual([]);
    const p = ok.data!.themes[0]!.subthemes[0]!.passages[0]!;
    expect(p.display).toBe('Genesis 1:1');
    expect(p.excerpt).toBe(excerpt(verseText(gen.verses[0]!)));
    // Edited after approval: refused, nothing published.
    const edited = buildThemes([gen], new Set(), write([sub('approved')], 'stale'), NO_READINGS);
    expect(edited.errors.join()).toMatch(/edited since its approval/);
    expect(edited.data!.themes[0]!.subthemes[0]!.passages).toEqual([]);
    // A passage whose first verse is not in its section.
    const wrong = buildThemes([gen], new Set(), write([sub('approved', 'Exod.1.1')]), NO_READINGS);
    expect(wrong.errors.join()).toMatch(/not in gen-01/);

    // Readings (P6.5): every section has a home; a second is flagged; an unplaced one fails.
    const readingsFile = (readings: object[], fingerprint?: string) => {
      const f = path.join(os.tmpdir(), `readings-${Math.random()}.json`);
      const r = readings as Parameters<typeof readingsFingerprint>[0];
      fs.writeFileSync(
        f,
        JSON.stringify({
          $comment: 'test',
          approval: {
            by: 'test',
            date: '2026-11-17',
            fingerprint: fingerprint ?? readingsFingerprint(r),
          },
          readings: r,
        }),
      );
      return f;
    };
    const one = { sectionId: 'gen-01', subs: ['x-y'], method: 'evidence', scores: [1], rows: [] };
    const placed = buildThemes([gen], new Set(), write([sub('approved')]), readingsFile([one]));
    expect(placed.errors).toEqual([]);
    expect(placed.data!.themes[0]!.subthemes[0]!.readings).toMatchObject([
      { sectionId: 'gen-01', display: 'Genesis 1:1–2:3', key: 'Gen.1.1' },
    ]);
    const unplaced = buildThemes([gen], new Set(), write([sub('approved')]), readingsFile([]));
    expect(unplaced.errors.join()).toMatch(/gen-01 has no theme/);
    const stale = buildThemes(
      [gen],
      new Set(),
      write([sub('approved')]),
      readingsFile([one], 'old'),
    );
    expect(stale.errors.join()).toMatch(/readings.json: edited since its approval/);
    expect(stale.data!.themes[0]!.subthemes[0]!.readings).toEqual([]);
  });

  it('every published passage resolves to a built section and cites a dataset row', () => {
    const data = JSON.parse(fs.readFileSync('public/data/themes.json', 'utf8')) as PublicThemes;
    const m = JSON.parse(fs.readFileSync('public/data/manifest.json', 'utf8')) as {
      sections: { id: string }[];
    };
    const ids = new Set(m.sections.map((s) => s.id));
    const tax = readTaxonomy();
    expect(data.themes.map((t) => t.id)).toEqual(tax.themes.map((t) => t.id));
    let n = 0;
    for (const t of data.themes)
      for (const s of t.subthemes)
        for (const p of s.passages) {
          n++;
          expect(ids.has(p.sectionId), p.ref).toBe(true);
          expect(p.sources.length, p.ref).toBeGreaterThan(0);
          expect(p.excerpt.length, p.ref).toBeGreaterThan(0);
        }
    expect(n).toBeGreaterThan(400);
  });
});
