/**
 * Threads (Phase 4): the shape of content/connections/connections.json and its approval
 * fingerprint. A connection is shown on the site only when it is `verified` and its approval's
 * fingerprint matches its content (any edit needs the owner's approval again).
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { z } from 'zod';

export const CONNECTIONS_FILE = 'content/connections/connections.json';

/**
 * Every file of connections, with the corpus pair its connections must join (threads plan §5).
 * `connections.json` holds the first 170 (Old ↔ New, and two New ↔ New seeds) and any pair; the
 * within files hold only their own pair. Each is emitted to its own file under public/data.
 */
export const CONNECTION_FILES = [
  { file: CONNECTIONS_FILE, out: 'connections.json', pair: null },
  { file: 'content/connections/within-ot.json', out: 'connections-within-ot.json', pair: 'ot-ot' },
  { file: 'content/connections/within-nt.json', out: 'connections-within-nt.json', pair: 'nt-nt' },
] as const;

export const CONNECTION_TYPES = [
  'quotation',
  'allusion',
  'echo',
  'typology',
  'parallel',
  'fulfilment',
  'contrast',
] as const;

const Osis = z.string().regex(/^[1-4A-Za-z]+\.\d+(\.\d+)?(-[1-4A-Za-z]+\.\d+(\.\d+)?)?$/);

/** A Greek word (or a run of words) at its row in tagged data: the Septuagint or TAGNT. */
export const EvidenceSchema = z.object({
  dataset: z.enum(['LXX', 'TAGNT']),
  ref: z.string(), // the dataset's own reference ("3Kgdms.17.23", "Luk.7.15")
  wordIndex: z.number().int().positive(),
  toWordIndex: z.number().int().positive().optional(),
  form: z.string(), // the tokens at those positions, as the data has them
  row: z.string(), // "LXX 011-3Kgdms", "TAGNT Mat-Jhn:60784"
});

export const CitationSchema = z.discriminatedUnion('kind', [
  // An OpenBible.info cross-reference row linking the two ends.
  z.object({ kind: z.literal('xref'), row: z.string().regex(/^OpenBibleXref:L\d+$/) }),
  // Words the WEBC text carries at a verse (a name, a feast): checked against the built text.
  z.object({ kind: z.literal('verse'), ref: Osis, words: z.array(z.string().min(2)).min(1) }),
  // A Church Father in a pinned public-domain edition; the phrase must occur in that file.
  z.object({
    kind: z.literal('father'),
    source: z.string().regex(/^ccel-/),
    author: z.string(),
    work: z.string(),
    locator: z.string(),
    edition: z.string(),
    /** The heading the phrase falls under in the pinned file ("Homily II."), checked by verify. */
    heading: z.string(),
    phrase: z.string().min(20),
  }),
  // A published work cited by bibliography only (threads plan §2.6): not machine-checked, and
  // listed apart in the review documents so the owner sees which claims rest on one.
  z.object({
    kind: z.literal('bibliographic'),
    author: z.string(),
    title: z.string(),
    year: z.string(),
    locator: z.string(),
  }),
]);
export type Citation = z.infer<typeof CitationSchema>;

/** Which end is older, and whether the later one is said to use it (threads plan §2.3). */
export const ORDER_BASES = ['canon', 'text', 'consensus', 'father', 'disputed'] as const;
export const OrderSchema = z.object({
  older: z.enum(['from', 'to', 'unknown']),
  uses: z.boolean(),
  basis: z.enum(ORDER_BASES),
  /** One sentence of original prose, shown when the order is disputed. */
  note: z.string().optional(),
  sources: z.array(CitationSchema).optional(),
});
export type Order = z.infer<typeof OrderSchema>;

export const ConnectionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  from: Osis,
  to: Osis,
  type: z.enum(CONNECTION_TYPES),
  strength: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  label: z.string(),
  explanation: z.string(),
  evidence: z.array(EvidenceSchema).optional(),
  sources: z.array(CitationSchema).min(1),
  /** Absent: computed from the corpora and the type (`resolveOrder` in emit-connections.ts). */
  order: OrderSchema.optional(),
  status: z.enum(['candidate', 'draft', 'verified']),
  approval: z.object({ date: z.string(), fingerprint: z.string() }).optional(),
});
export type Connection = z.infer<typeof ConnectionSchema>;

export const ConnectionsSchema = z.object({
  $comment: z.string(),
  connections: z.array(ConnectionSchema),
});

/**
 * Everything the owner approves: ends, type, strength, wording, evidence, citations and the order.
 * The order joins only when present, so the first 170 keep their approvals (threads plan §2.3).
 */
export function connectionFingerprint(c: Connection): string {
  const canonical: unknown[] = [
    c.id,
    c.from,
    c.to,
    c.type,
    c.strength,
    c.label,
    c.explanation,
    c.evidence ?? [],
    c.sources,
  ];
  if (c.order) canonical.push(c.order);
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex').slice(0, 16);
}

export function readConnections(file = CONNECTIONS_FILE): Connection[] | null {
  if (!fs.existsSync(file)) return null;
  return ConnectionsSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8'))).connections;
}

/** Sentences in an explanation (PLAN §14: two to four). */
export function sentenceCount(text: string): number {
  return text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).filter((s) => s.trim()).length;
}
