/** Phase 4: the cross-reference parser, range matching, and the seed connections with their checks. */
import { THREAD_FILES } from '@/lib/thread-files';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { inRange, parseXrefs } from '@/scripts/connections/xrefs';
import { readSectionIndex, sectionFor } from '@/scripts/themes/taxonomy';
import {
  buildAllConnections,
  buildConnections,
  hasWord,
  orderErrors,
  resolveOrder,
} from '@/scripts/connections/emit-connections';
import { ALL_PAIRS, pairId, pairLabel } from '@/lib/corpora';
import {
  connectionFingerprint,
  readConnections,
  sentenceCount,
} from '@/scripts/connections/schema';
import type { SectionFile } from '@/lib/types';
import { longestRun, sharedNames } from '@/scripts/connections/signals';

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
  const list = readConnections()!;
  const index = readSectionIndex();
  const sections = fs
    .readdirSync('public/data/sections')
    .map((f) => JSON.parse(fs.readFileSync(`public/data/sections/${f}`, 'utf8')) as SectionFile);
  const library = new Set(sections.filter((x) => x.library).map((x) => x.id));

  it('have unique ids, and both ends of every seed fall in a built section', () => {
    const ids = list.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of list) {
      expect(sectionFor(s.from.split('-')[0]!, index), `${s.id} from`).toBeTruthy();
      expect(sectionFor(s.to.split('-')[0]!, index), `${s.id} to`).toBeTruthy();
    }
  });

  it('pass the build checks: ends, cited words, two to four sentences, typology cites a Father', () => {
    const { errors } = buildConnections(sections, library);
    expect(errors).toEqual([]);
  });

  it('cite every interpretive reading, and give typology a Father with a phrase to check', () => {
    for (const c of list.filter((x) => x.type === 'typology')) {
      const fathers = c.sources.filter((s) => s.kind === 'father');
      expect(fathers.length, c.id).toBeGreaterThan(0);
      for (const f of fathers) if (f.kind === 'father') expect(f.phrase.length).toBeGreaterThan(20);
    }
  });

  it('publishes only verified connections whose approval matches their content', () => {
    const { data } = buildConnections(sections, library);
    const verified = list.filter((c) => c.status === 'verified').map((c) => c.id);
    expect(data!.connections.map((c) => c.id).sort()).toEqual(verified.sort());
  });

  it('refuses an edit to an approved connection, and a verified one without approval', () => {
    const c = list[0]!;
    const approved = { ...c, status: 'verified' as const };
    approved.approval = { date: '2026-11-16', fingerprint: connectionFingerprint(approved) };
    const edited = { ...approved, explanation: `${approved.explanation} Another sentence.` };
    const unapproved = { ...list[1]!, status: 'verified' as const, approval: undefined };
    const tmp = path.join(os.tmpdir(), `threads-${process.pid}.json`);
    fs.writeFileSync(tmp, JSON.stringify({ $comment: '', connections: [approved] }));
    let r = buildConnections(sections, library, tmp);
    expect(r.errors).toEqual([]);
    expect(r.data!.connections.map((x) => x.id)).toEqual([c.id]);
    const pub = r.data!.connections[0]!;
    expect(pub.ends[0].anchor).toMatch(/^v-\d+-\d+/);
    expect(pub.ends[1].excerpt.length).toBeGreaterThan(10);
    fs.writeFileSync(tmp, JSON.stringify({ $comment: '', connections: [edited, unapproved] }));
    r = buildConnections(sections, library, tmp);
    expect(r.errors.some((e) => e.includes('edited since its approval'))).toBe(true);
    expect(r.errors.some((e) => e.includes('without the owner'))).toBe(true);
    expect(r.data!.connections).toEqual([]);
    fs.rmSync(tmp);
  });

  it('checks whole words in the WEBC text and counts sentences', () => {
    expect(hasWord('Elijah was sent to none of them, except to Zarephath', 'zarephath')).toBe(true);
    expect(hasWord('the overshadowing cloud', 'overshadow')).toBe(false);
    expect(sentenceCount('One. Two? Three! 1 Maccabees 4 tells it.')).toBe(4);
    expect(sentenceCount("Luke's Greek (below). Then the end.")).toBe(2);
  });
});

describe('candidate signals (P4.4)', () => {
  it('finds the longest run of shared words, in the first text’s own words', () => {
    expect(
      longestRun(
        'He said, “The elder will serve the younger.”',
        'it was said, The elder will serve the younger! Then',
      ),
    ).toEqual(['said,', '“The', 'elder', 'will', 'serve', 'the', 'younger.”']);
    expect(longestRun('one two', 'three four')).toEqual([]);
  });

  it('finds names both texts carry, not ordinary words at the start of a sentence', () => {
    const lower = new Set(['is', 'remember']);
    expect(
      sharedNames('Is anything too hard? Sarah laughed.', 'Is it Sarah? Remember Lot.', lower),
    ).toEqual(['Sarah']);
  });
});

describe('the threads baseline (threads plan TD0)', () => {
  const list = readConnections()!;
  const pin = JSON.parse(
    fs.readFileSync('tests/fixtures/connections/approved-fingerprints.json', 'utf8'),
  ) as { count: number; fingerprints: Record<string, string> };
  const sections = fs
    .readdirSync('public/data/sections')
    .map((f) => JSON.parse(fs.readFileSync(`public/data/sections/${f}`, 'utf8')) as SectionFile);
  const library = new Set(sections.filter((x) => x.library).map((x) => x.id));
  const tmp = (name: string, connections: unknown[]) => {
    const f = path.join(os.tmpdir(), `threads-${process.pid}-${name}.json`);
    fs.writeFileSync(f, JSON.stringify({ $comment: '', connections }));
    return f;
  };
  const approve = <T extends (typeof list)[number]>(c: T): T => ({
    ...c,
    status: 'verified',
    approval: { date: '2026-11-19', fingerprint: connectionFingerprint(c) },
  });

  it('keeps the approved connections exactly as pinned (only the owner changes the pin)', () => {
    const verified = list.filter((c) => c.status === 'verified');
    expect(verified).toHaveLength(pin.count);
    expect(Object.fromEntries(verified.map((c) => [c.id, connectionFingerprint(c)]))).toEqual(
      pin.fingerprints,
    );
  });

  it('fingerprints the order only when one is stored', () => {
    const c = list.find((x) => x.type === 'parallel')!;
    expect(connectionFingerprint({ ...c, order: undefined })).toBe(c.approval!.fingerprint);
    const ordered = { ...c, order: { older: 'from', uses: true, basis: 'canon' } as const };
    expect(connectionFingerprint(ordered)).not.toBe(c.approval!.fingerprint);
  });

  it('computes the order of Old ↔ New threads from the canon and the type', () => {
    const of = (type: (typeof list)[number]['type']) => ({ ...list[0]!, type, order: undefined });
    expect(resolveOrder(of('quotation'), 'ot', 'nt')).toEqual({
      older: 0,
      uses: true,
      basis: 'canon',
    });
    expect(resolveOrder(of('echo'), 'nt', 'ot')).toMatchObject({ older: 1, uses: true });
    expect(resolveOrder(of('typology'), 'ot', 'nt')).toEqual({
      older: 0,
      uses: false,
      basis: 'father',
    });
    expect(resolveOrder(of('parallel'), 'ot', 'nt')).toMatchObject({ uses: false });
    // Inside one corpus nothing is assumed.
    expect(resolveOrder(of('parallel'), 'nt', 'nt')).toEqual({
      older: null,
      uses: false,
      basis: null,
    });
    const stored = {
      ...of('parallel'),
      order: { older: 'to', uses: true, basis: 'text' } as const,
    };
    expect(resolveOrder(stored, 'ot', 'ot')).toEqual({ older: 1, uses: true, basis: 'text' });
  });

  it('checks a stored order: sources, a note when disputed, no use without an older end', () => {
    const c = list.find((x) => x.type === 'parallel')!;
    const at = (order: NonNullable<(typeof list)[number]['order']>) => orderErrors({ ...c, order });
    expect(at({ older: 'unknown', uses: true, basis: 'text' })).toHaveLength(1);
    expect(at({ older: 'from', uses: false, basis: 'disputed' })).toHaveLength(2);
    expect(
      at({
        older: 'from',
        uses: false,
        basis: 'disputed',
        note: 'Most modern scholars hold one view and Augustine the other.',
        sources: [
          { kind: 'bibliographic', author: 'A', title: 'T', year: '2000', locator: 'p. 1' },
        ],
      }),
    ).toEqual([]);
    expect(at({ older: 'from', uses: true, basis: 'father' })).toHaveLength(1);
  });

  it('publishes every thread with its pair and order', () => {
    const { outputs, errors } = buildAllConnections(sections, library);
    expect(errors).toEqual([]);
    // The site reads exactly the files the build writes.
    expect(outputs.map((o) => o.out)).toEqual([...THREAD_FILES]);
    for (const c of outputs[0]!.data.connections) {
      expect(c.pair).toBe(pairId(c.ends[0].corpus, c.ends[1].corpus));
      if (c.pair === 'ot-nt') expect(c.ends[c.order.older!]!.corpus).toBe('ot');
    }
  });

  it('holds a within file to its pair, with every order stated, and ids unique across files', () => {
    const between = list.find((c) => c.id === 'dan07')!;
    const nn = list.find((c) => c.id === 'act12')!;
    let f = tmp('pair', [approve(between)]);
    let r = buildConnections(sections, library, f, 'nt-nt');
    expect(r.errors.some((e) => e.includes('joins ot-nt, not nt-nt'))).toBe(true);
    f = tmp('order', [approve({ ...nn, order: undefined })]);
    r = buildConnections(sections, library, f, 'nt-nt');
    expect(r.errors.some((e) => e.includes('states its order'))).toBe(true);
    const ordered = approve({
      ...nn,
      order: { older: 'from', uses: false, basis: 'consensus', sources: [nn.sources[0]!] },
    });
    f = tmp('ok', [ordered]);
    r = buildConnections(sections, library, f, 'nt-nt');
    expect(r.errors).toEqual([]);
    expect(r.data!.connections[0]!.order).toMatchObject({ older: 0, uses: false });
    const twice = buildAllConnections(sections, library, [
      { file: tmp('a', [approve(between)]), out: 'a.json', pair: null },
      { file: tmp('b', [approve(between)]), out: 'b.json', pair: null },
    ]);
    expect(twice.errors.some((e) => e.includes('in both'))).toBe(true);
  });

  it('names corpus pairs in table order', () => {
    expect(pairId('nt', 'ot')).toBe('ot-nt');
    expect(pairLabel('ot-nt')).toBe('Old ↔ New');
    expect(ALL_PAIRS).toEqual(['ot-ot', 'ot-nt', 'nt-nt']);
  });
});
