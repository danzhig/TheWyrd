/** Threads inside one Testament (threads plan TX2): TIPNR names, shared words and parallels. */
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseTipnr } from '@/scripts/terms/tipnr';
import { parseTahot, type Token } from '@/scripts/terms/stepbible';
import {
  otFrequencies,
  parallelVerses,
  sharedHebrew,
  sharedPeople,
} from '@/scripts/connections/signals';
import type { TermSources } from '@/scripts/terms/sources';

describe('TIPNR', () => {
  const t = parseTipnr(fs.readFileSync('tests/fixtures/terms/tipnr.txt', 'utf8'));

  it('indexes one person under every verse that names him, by his unique id', () => {
    const id = 'Abraham@Gen.11.26-1Pe';
    expect(t.names.get(id)).toBe('Abraham');
    // Named as Abram, as Abraham and in Greek: one id.
    expect(t.byVerse.get('Gen.11.26')).toEqual(new Set([id]));
    expect(t.byVerse.get('Gen.17.5')).toEqual(new Set([id]));
    expect(t.byVerse.get('Mat.1.1')).toEqual(new Set([id]));
    // "Gen.17.23a" and "Gen.17.23b" are one verse.
    expect(t.byVerse.has('Gen.17.23')).toBe(true);
  });

  it('finds the people two passages both name', () => {
    expect(sharedPeople(t, 'Gen.12.1-Gen.12.4', 'Matt.1.1')).toEqual(['Abraham@Gen.11.26-1Pe']);
    expect(sharedPeople(t, 'Gen.1.1', 'Matt.1.1')).toEqual([]);
  });
});

describe('shared Hebrew (TAHOT)', () => {
  const tokens = parseTahot('tests/fixtures/terms/tahot.txt', 'TAHOT fixture');
  const hebrew = new Map<string, Token[]>();
  for (const k of tokens) hebrew.set(k.ref, [...(hebrew.get(k.ref) ?? []), k]);
  const s = { hebrew } as TermSources;
  const refs = [...hebrew.keys()];

  it('finds lexemes two passages share, each at its row', () => {
    const [a, b] = [refs[0]!, refs[1]!];
    const osis = (r: string) => r.replace(/^Gen\./, 'Gen.');
    const list = sharedHebrew(s, otFrequencies(s), osis(a), osis(b), 1e9);
    for (const w of list) {
      expect(w.a.length).toBeGreaterThan(0);
      expect(w.b.length).toBeGreaterThan(0);
      for (const x of [...w.a, ...w.b]) expect(x.row).toMatch(/^TAHOT fixture:\d+$/);
    }
    // A passage shares every lexeme with itself; the frequency cap leaves the common ones out.
    expect(sharedHebrew(s, otFrequencies(s), osis(a), osis(a), 1e9).length).toBeGreaterThan(0);
    expect(sharedHebrew(s, otFrequencies(s), osis(a), osis(a), 0)).toEqual([]);
  });
});

describe('parallel accounts', () => {
  it('counts verses that closely match, and the longest run in order', () => {
    const a = [
      'Solomon assembled the elders of Israel to bring up the ark',
      'All the men of Israel assembled themselves to the king at the feast',
      'A completely different sentence about something else entirely',
      'The priests brought in the ark of the covenant to its place',
    ];
    const b = [
      'Then Solomon assembled the elders of Israel to bring up the ark',
      'All the men of Israel assembled themselves to the king at the feast',
      'The priests brought in the ark of the covenant to its place',
    ];
    expect(parallelVerses(a, b)).toEqual({ matched: 3, longest: 2 });
    expect(parallelVerses(['one two three'], ['four five six'])).toEqual({
      matched: 0,
      longest: 0,
    });
  });
});
