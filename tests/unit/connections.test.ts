/** Phase 4 data: the cross-reference parser, range matching, and the seed connections. */
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inRange, parseXrefs } from '@/scripts/connections/xrefs';
import { readSectionIndex, sectionFor } from '@/scripts/themes/taxonomy';

describe('OpenBible cross-references', () => {
  it('reads rows with their line numbers as citations, skipping the header', () => {
    const rows = parseXrefs(fs.readFileSync('tests/fixtures/connections/xrefs-head.txt', 'utf8'));
    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({ id: 'OpenBibleXref:L2', from: 'Gen.1.1' });
    expect(rows[0]!.to).toMatch(/^[1-3A-Z][A-Za-z]+\.\d+\.\d+/);
  });

  it('matches verses against verses, ranges and whole chapters', () => {
    expect(inRange('Luke.4.18', 'Luke.4.18-Luke.4.19')).toBe(true);
    expect(inRange('Luke.4.20', 'Luke.4.18-Luke.4.19')).toBe(false);
    expect(inRange('Jonah.2.5', 'Jonah.1-Jonah.3')).toBe(true);
    expect(inRange('Jonah.4.1', 'Jonah.1-Jonah.3')).toBe(false);
    expect(inRange('Exod.12.40', 'Exod.12')).toBe(true);
    expect(inRange('Acts.2.1', 'Acts.1.9-Acts.2.4')).toBe(true);
    expect(inRange('Acts.2.5', 'Acts.1.9-Acts.2.4')).toBe(false);
  });
});

describe('the seed connections', () => {
  const seeds = JSON.parse(fs.readFileSync('content/connections/seeds.json', 'utf8')) as {
    seeds: { id: string; from: string; to: string; status: string }[];
  };
  const index = readSectionIndex();

  it('have unique ids, and both ends of every seed fall in a built section', () => {
    const ids = seeds.seeds.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of seeds.seeds) {
      expect(sectionFor(s.from.split('-')[0]!, index), `${s.id} from`).toBeTruthy();
      expect(sectionFor(s.to.split('-')[0]!, index), `${s.id} to`).toBeTruthy();
    }
  });

  it('are candidates until verified (nothing is shown on the site yet)', () => {
    for (const s of seeds.seeds) expect(s.status).toBe('candidate');
  });
});
