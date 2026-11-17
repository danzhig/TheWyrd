/** The Douay-Rheims alignment (Phase 7, step 1): the Psalms reader, merges, content pairing. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mergedInto, overlap, words } from '@/scripts/drc/align';
import { pairByContent, refineByContent } from '@/scripts/drc/content';
import { evalCond, parsePsalmCell, readNamedRecords } from '@/scripts/drc/psalms';

describe('the Psalms records (TVTMS named layout)', () => {
  const tsv = [
    '#DataStart(Condensed)',
    '$Psa.20:1-20:9\t\t\t',
    'English KJV\t & Psa.9:30=NotExist & Psa.20:9=Last & Psa.20:TextBeforeV1=Exist',
    'Latin + Greek\t & Psa.9:30=Exist & Psa.19:10=Last & Psa.19:TextBeforeV1=NotExist',
    'Latin2 \t & Psa.9:30=Exist & Psa.19:9=Last & Psa.19:1<Psa.19:9',
    'BIBLES\tEnglish KJV\tLatin\tGreek\tLatin2',
    'OneToOne\tPsa.20:Title\tPsa.19:1\tPsa.19:1\tPsa.19:1',
    'OneToOne\tPsa.20:1\tPsa.19:2\tPsa.19:2\tPsa.19:2',
    'MergedPrevVerse\tPsa.20:9\tPsa.19:10\tPsa.19:10\tAbsent [=Psa.19:9]',
    '\t\t\t',
    '#DataEnd(Condensed)',
  ].join('\n');
  const file = path.join(os.tmpdir(), `tvtms-${process.pid}.txt`);
  fs.writeFileSync(file, tsv);
  const [rec] = readNamedRecords(file);

  it('reads columns from the BIBLES row and tests from the named lines', () => {
    expect(rec!.header).toBe('Psa.20:1-20:9');
    expect(rec!.columns).toEqual(['English KJV', 'Latin', 'Greek', 'Latin2']);
    expect(rec!.conds[1]).toContain('Psa.19:10=Last'); // Latin, named with Greek
    expect(rec!.conds[2]).toEqual(rec!.conds[1]);
    expect(rec!.rows).toHaveLength(3);
  });

  it('evaluates verse, title and word-count tests', () => {
    const lengths = Array(20).fill(5);
    lengths[8] = 39; // Psalm 9 with 39 verses: the Latin numbering
    lengths[18] = 10;
    expect(evalCond('Psa.9:30=Exist', lengths, new Set())).toBe('pass');
    expect(evalCond('Psa.19:10=Last', lengths, new Set())).toBe('pass');
    expect(evalCond('Psa.19:TextBeforeV1=NotExist', lengths, new Set())).toBe('pass');
    expect(evalCond('Psa.19:TextBeforeV1=Exist', lengths, new Set([19]))).toBe('pass');
    const count = (c: number, v: number) => (v === 1 ? 4 : 12);
    expect(evalCond('Psa.19:1<Psa.19:9', lengths, new Set(), count)).toBe('pass');
    expect(evalCond('Psa.19:1>Psa.19:9', lengths, new Set(), count)).toBe('fail');
    expect(evalCond('Psa.19:1<Psa.19:9', lengths, new Set())).toBe('unknown');
  });

  it('parses titles, ranges and merged verses', () => {
    expect(parsePsalmCell('Psa.20:Title')).toBe('title');
    expect(parsePsalmCell('Psa.9:22-24')).toEqual([
      { c: 9, v: 22 },
      { c: 9, v: 23 },
      { c: 9, v: 24 },
    ]);
    expect(parsePsalmCell('Absent [=Psa.19:9]')).toBeNull();
    expect(mergedInto('Absent [=Psa.19:9]')).toBe('Psa.19:9');
    expect(parsePsalmCell(mergedInto('Absent [=Psa.19:9]'))).toEqual([{ c: 19, v: 9 }]);
  });
});

describe('pairing by content', () => {
  it('scores shared words, ignoring common words and old endings', () => {
    const a = words('And the father ran and kissed him');
    const b = words('And running to him, his father fell upon his neck, and kissed him');
    expect(overlap(a, b)).toBeGreaterThan(0.5);
    expect(words('he walketh').has('walk')).toBe(true);
  });

  const webc = [
    'In the beginning God created the heavens and the earth.',
    'The earth was formless and empty, and darkness was on the surface of the deep.',
    'God said, Let there be light, and there was light.',
  ];

  it('pairs verses in order and attaches a Douay-Rheims verse that matches nothing', () => {
    const drc = [
      'In the beginning God created heaven, and earth.',
      'And the earth was void and empty, and darkness was upon the face of the deep.',
      'And the spirit of God moved over the waters.',
      'And God said: Be light made. And light was made.',
    ];
    const p = pairByContent(webc, drc);
    expect(p.pairs.get(0)).toEqual([0]);
    expect(p.pairs.get(1)).toEqual([1, 2]); // the unmatched verse goes with the one before it
    expect(p.pairs.get(2)).toEqual([3]);
    expect(p.attached).toEqual([2]);
  });

  it('moves pairs off a numbering that is out of step, and keeps one that is not', () => {
    // The Douay-Rheims opens with a heading-like verse, so each verse sits one later.
    const drc = [
      'A word before the account.',
      'In the beginning God created heaven, and earth.',
      'And the earth was void and empty, and darkness was upon the face of the deep.',
      'And God said: Be light made. And light was made.',
    ];
    const byNumber = new Map([
      [0, [0]],
      [1, [1]],
      [2, [2]],
    ]);
    const p = refineByContent(webc, drc, byNumber);
    expect(p.pairs.get(0)).toEqual([0, 1]);
    expect(p.pairs.get(1)).toEqual([2]);
    expect(p.pairs.get(2)).toEqual([3]);
    // A numbering that is right stays as it is, even where the words differ (names spelled
    // differently share nothing).
    const names = ['Noah begot Shem, Ham, and Japheth.', 'These are the sons of Noah.'];
    const latin = ['Noe begot Sem, Cham, and Japheth.', 'These are the sons of Noe.'];
    const kept = refineByContent(
      names,
      latin,
      new Map([
        [0, [0]],
        [1, [1]],
      ]),
    );
    expect(kept.pairs.get(0)).toEqual([0]);
    expect(kept.pairs.get(1)).toEqual([1]);
  });
});
