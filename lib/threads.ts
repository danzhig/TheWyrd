/** Shared by the reader's thread cards and the Vault's Threads mode (Phase 4). */
import type { ConnectionType, PublicConnection, ThreadEnd, ThreadOrder } from './types';

export const TYPE_LABEL: Record<ConnectionType, string> = {
  quotation: 'Quotation',
  allusion: 'Allusion',
  echo: 'Verbal echo',
  typology: 'Typology',
  parallel: 'Parallel',
  fulfilment: 'Fulfilment',
  contrast: 'Contrast',
};

/** The types in the order the filter lists them. */
export const TYPE_ORDER = Object.keys(TYPE_LABEL) as ConnectionType[];

/** Open one end of a connection in the reader, with the way back along it (`?thread=`). */
export const threadHref = (id: string, end: Pick<ThreadEnd, 'sectionId' | 'anchor'>) =>
  `/read/${end.sectionId}/?thread=${id}#${end.anchor}`;

/** Strength, as the card names it (PLAN §14: 3 = quoted or named, 2 = strong, 1 = proposed). */
export const STRENGTH_LABEL = { 3: 'named or quoted', 2: 'strong', 1: 'proposed' } as const;

/** An explanation's sentences (the same rule as `sentenceCount` in the schema). */
export const sentences = (text: string) =>
  text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).filter((s) => s.trim());

/** The card's summary: the explanation's first sentence (threads plan §3), and the rest. */
export function splitExplanation(text: string): { summary: string; rest: string } {
  const [first = '', ...more] = sentences(text);
  return { summary: first, rest: more.join(' ') };
}

/**
 * The words on the card's arrow, read from the older end to the later one (threads plan §2.3):
 * "Esther 5:3 — echoed in → Mark 6:22–23".
 */
export function directionVerb(type: ConnectionType, uses: boolean): string {
  if (type === 'typology') return 'a figure of';
  if (type === 'parallel') return uses ? 'retold in' : 'told also in';
  if (type === 'contrast') return uses ? 'reversed in' : 'set against';
  if (!uses) return 'set beside';
  return {
    quotation: 'quoted in',
    allusion: 'alluded to in',
    echo: 'echoed in',
    fulfilment: 'fulfilled in',
  }[type];
}

/** The ends in reading order (older first when the order is known) and how they are joined. */
export function direction(
  c: Pick<PublicConnection, 'type' | 'order'>,
  ends: [ThreadEnd, ThreadEnd],
) {
  const { older, uses } = c.order;
  const first = older ?? 0;
  return {
    older: ends[first]!,
    later: ends[1 - first]!,
    /** Which index of `ends` comes first on the card. */
    first: first as 0 | 1,
    known: older !== null,
    uses,
    verb: older === null ? 'and' : directionVerb(c.type, uses),
  };
}

/** One line on how the order is known, for the open card. */
export function basisText(o: ThreadOrder, older?: ThreadEnd): string {
  switch (o.basis) {
    case 'canon':
      return `${older?.display ?? 'The Old Testament passage'} is the older text: the Old Testament was written before the New.`;
    case 'text':
      return 'The later passage itself names or introduces the earlier one.';
    case 'consensus':
      return 'The order of writing follows scholarly agreement (see the sources).';
    case 'father':
      return 'Typology: the reading of one passage as a figure of the other is a Church Father’s (see the sources).';
    case 'disputed':
      return o.note ?? 'The order of writing is disputed.';
    default:
      return 'Which passage was written first is not stated for this thread.';
  }
}
