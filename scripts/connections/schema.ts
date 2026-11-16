/**
 * Threads (Phase 4): the shape of content/connections/connections.json and its approval
 * fingerprint. A connection is shown on the site only when it is `verified` and its approval's
 * fingerprint matches its content (any edit needs the owner's approval again).
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { z } from 'zod';

export const CONNECTIONS_FILE = 'content/connections/connections.json';

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
]);
export type Citation = z.infer<typeof CitationSchema>;

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
  status: z.enum(['candidate', 'draft', 'verified']),
  approval: z.object({ date: z.string(), fingerprint: z.string() }).optional(),
});
export type Connection = z.infer<typeof ConnectionSchema>;

export const ConnectionsSchema = z.object({
  $comment: z.string(),
  connections: z.array(ConnectionSchema),
});

/** Everything the owner approves: ends, type, strength, wording, evidence and citations. */
export function connectionFingerprint(c: Connection): string {
  const canonical = [
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
