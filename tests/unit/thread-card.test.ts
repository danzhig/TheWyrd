/** The thread card's words (threads plan TD1): summary, direction and how the order is known. */
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { basisText, direction, directionVerb, splitExplanation } from '@/lib/threads';
import { leadErrors } from '@/scripts/connections/emit-connections';
import type { PublicConnections } from '@/lib/types';
import { sentenceCount } from '@/scripts/connections/schema';

const data = JSON.parse(
  fs.readFileSync('public/data/connections.json', 'utf8'),
) as PublicConnections;

describe('the thread card', () => {
  it('summarises with the first sentence and keeps every other sentence for the open card', () => {
    for (const c of data.connections) {
      const { summary, rest } = splitExplanation(c.explanation);
      expect(sentenceCount(summary), c.id).toBe(1);
      expect([summary, rest].filter(Boolean).join(' '), c.id).toBe(
        c.explanation.replace(/\s+/g, ' '),
      );
    }
  });

  it('puts the older end first, with a verb for the relation', () => {
    const dan = data.connections.find((c) => c.id === 'dan07')!;
    const d = direction(dan, dan.ends);
    expect([d.older.display, d.verb, d.later.display]).toEqual([
      'Daniel 7:14',
      'echoed in',
      'Luke 1:33',
    ]);
    // A thread stored later-first still reads older-first.
    const flipped = direction({ ...dan, order: { ...dan.order, older: 1 } }, [
      dan.ends[1],
      dan.ends[0],
    ]);
    expect(flipped.older.display).toBe('Daniel 7:14');
    expect(flipped.first).toBe(1);
  });

  it('claims no use for parallels and typology, and says so when the order is not given', () => {
    expect(directionVerb('parallel', false)).toBe('told also in');
    expect(directionVerb('parallel', true)).toBe('retold in');
    expect(directionVerb('typology', false)).toBe('a figure of');
    expect(directionVerb('quotation', true)).toBe('quoted in');
    const nn = data.connections.find((c) => c.pair === 'nt-nt')!;
    // Galatians and Acts: two accounts, Galatians the older (TD2), no use claimed.
    expect(direction(nn, nn.ends)).toMatchObject({
      known: true,
      uses: false,
      verb: 'told also in',
    });
    expect(nn.order.sources?.[0]).toMatchObject({ kind: 'bibliographic' });
    const unknown = { ...nn, order: { older: null, uses: false, basis: null } };
    expect(direction(unknown, nn.ends).known).toBe(false);
    expect(basisText(unknown.order)).toMatch(/not stated/);
  });

  it('gives every published thread a direction a reader can see', () => {
    for (const c of data.connections) {
      const d = direction(c, c.ends);
      expect(d.verb, c.id).toBeTruthy();
      expect(basisText(c.order, d.older), c.id).toMatch(/\.$/);
      for (const e of c.ends) expect(e.more, c.id).toBeGreaterThanOrEqual(0);
    }
  });

  it('check 14: the summary names both ends in the direction, with a verb for the type', () => {
    const c = data.connections.find((x) => x.id === 'dan07')!;
    const ends = c.ends;
    expect(leadErrors(c, ends, c.order)).toEqual([]);
    const backwards = { ...c, explanation: `Daniel 7:14 echoes Luke 1:33: no. Second.` };
    expect(leadErrors(backwards, ends, c.order)).toEqual([
      'its first sentence names the older end first, but the later one uses it',
    ]);
    const noVerb = { ...c, explanation: `Luke 1:33 takes Daniel 7:14: a kingdom. Second.` };
    expect(leadErrors(noVerb, ends, c.order)[0]).toMatch(/no verb for the type echo/);
    const wrongRef = { ...c, explanation: `Luke 1:3 echoes Daniel 7:14: a kingdom. Second.` };
    expect(leadErrors(wrongRef, ends, c.order)[0]).toMatch(/does not name Luke 1:33/);
    const long = { ...c, explanation: `Luke 1:33 echoes Daniel 7:14: ${'a '.repeat(100)}. Two.` };
    expect(leadErrors(long, ends, c.order)[0]).toMatch(/characters/);
  });
});
