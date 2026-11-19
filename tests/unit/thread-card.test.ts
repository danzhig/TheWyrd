/** The thread card's words (threads plan TD1): summary, direction and how the order is known. */
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { basisText, direction, directionVerb, splitExplanation } from '@/lib/threads';
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
    const d = direction(nn, nn.ends);
    expect(d.known).toBe(false);
    expect(basisText(nn.order)).toMatch(/not stated/);
  });

  it('gives every published thread a direction a reader can see', () => {
    for (const c of data.connections) {
      const d = direction(c, c.ends);
      expect(d.verb, c.id).toBeTruthy();
      expect(basisText(c.order, d.older), c.id).toMatch(/\.$/);
      for (const e of c.ends) expect(e.more, c.id).toBeGreaterThanOrEqual(0);
    }
  });
});
