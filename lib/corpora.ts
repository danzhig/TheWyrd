/**
 * Corpora and the pairs a thread can join (threads plan §5). Today the Bible's two Testaments; a
 * later corpus (the Religion Expansion's Mishnah or Quran) is one more row here plus its data, and
 * the Vault's pair chips follow from the pairs present in the approved threads.
 */
import type { Testament } from './types';

export type CorpusId = 'ot' | 'nt';

export interface Corpus {
  id: CorpusId;
  /** "Old Testament" */
  name: string;
  /** "Old", as a chip reads ("Old ↔ New") */
  short: string;
}

/** In the order pairs are named: an earlier row comes first in a pair's id and label. */
export const CORPORA: readonly Corpus[] = [
  { id: 'ot', name: 'Old Testament', short: 'Old' },
  { id: 'nt', name: 'New Testament', short: 'New' },
];

export const CORPUS_IDS = CORPORA.map((c) => c.id);

const BY_ID = new Map(CORPORA.map((c) => [c.id, c]));

/** The Bible's books take their corpus from their testament. */
export const corpusOfTestament = (t: Testament): CorpusId => (t === 'OT' ? 'ot' : 'nt');

/** "ot-nt": the two corpora in table order, so a pair has one id whichever end comes first. */
export type PairId = `${CorpusId}-${CorpusId}`;

export function pairId(a: CorpusId, b: CorpusId): PairId {
  const [x, y] = CORPUS_IDS.indexOf(a) <= CORPUS_IDS.indexOf(b) ? [a, b] : [b, a];
  return `${x}-${y}`;
}

/** "Old ↔ New", "Old ↔ Old". */
export function pairLabel(p: PairId): string {
  const [a, b] = p.split('-') as [CorpusId, CorpusId];
  return `${BY_ID.get(a)!.short} ↔ ${BY_ID.get(b)!.short}`;
}

/** Every pair the corpora can form, in table order (ot-ot, ot-nt, nt-nt). */
export const ALL_PAIRS: PairId[] = CORPUS_IDS.flatMap((a, i) =>
  CORPUS_IDS.slice(i).map((b) => pairId(a, b)),
);

export const corpusName = (id: CorpusId) => BY_ID.get(id)!.name;
