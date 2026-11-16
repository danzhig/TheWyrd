/** Phase 4: the cross-reference parser, range matching, and the seed connections with their checks. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { inRange, parseXrefs } from '@/scripts/connections/xrefs';
import { readSectionIndex, sectionFor } from '@/scripts/themes/taxonomy';
import { buildConnections, hasWord } from '@/scripts/connections/emit-connections';
import {
  connectionFingerprint,
  readConnections,
  sentenceCount,
} from '@/scripts/connections/schema';
import type { SectionFile } from '@/lib/types';

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
