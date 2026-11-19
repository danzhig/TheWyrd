import type { CorpusId, PairId } from './corpora';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Plan file (content/plan/reading-plan.json). Schema mirrors docs/PLAN.md §5.
// ---------------------------------------------------------------------------

export const StatusSchema = z.enum(['read', 'skim', 'optional', 'skip']);
export type Status = z.infer<typeof StatusSchema>;

export const AnchorSchema = z.object({
  ref: z.string(),
  mustContain: z.array(z.string()).min(1),
});
export type Anchor = z.infer<typeof AnchorSchema>;

export const InnerFoldSchema = z.object({
  range: z.string(),
  status: z.enum(['skim', 'skip']),
  label: z.string(),
});
export type InnerFold = z.infer<typeof InnerFoldSchema>;

export const PlanSectionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+-(x?\d+)$/),
    title: z.string(),
    range: z.string(),
    status: StatusSchema,
    summary: z.string().optional(),
    highlight: z.boolean().optional(),
    inner: z.array(InnerFoldSchema).optional(),
    anchors: z.array(AnchorSchema).optional(),
    noteIds: z.array(z.string()).optional(),
    contentNote: z.string().optional(),
    mapByContent: z.string().optional(),
    versificationNote: z.string().optional(),
  })
  .strict();
export type PlanSection = z.infer<typeof PlanSectionSchema>;

export const PlanBookSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    setting: z.string(),
    tagline: z.string(),
    sections: z.array(PlanSectionSchema).min(1),
    movable: z.boolean().optional(),
    excursion: z.boolean().optional(),
  })
  .strict();
export type PlanBook = z.infer<typeof PlanBookSchema>;

export const PlanStepSchema = z
  .object({
    kind: z.enum(['book', 'bridge', 'excursion']),
    id: z.string(),
    movable: z.boolean().optional(),
    note: z.string().optional(),
    after: z.string().optional(),
    optional: z.boolean().optional(),
  })
  .strict();
export type PlanStep = z.infer<typeof PlanStepSchema>;

export const BridgeSchema = z
  .object({ id: z.string(), after: z.string(), title: z.string(), text: z.string() })
  .strict();
export type Bridge = z.infer<typeof BridgeSchema>;

export const NoteSchema = z
  .object({
    id: z.string(),
    section: z.string(),
    at: z.string(), // 'start' | 'end' | 'fold' | a plan-numbered 'c:v'
    text: z.string(),
  })
  .strict();
export type Note = z.infer<typeof NoteSchema>;

export const ReadingPlanSchema = z
  .object({
    $schema: z.string().optional(),
    version: z.string(),
    versification: z.string(),
    baseText: z.string(),
    rangeNotation: z.string(),
    steps: z.array(PlanStepSchema),
    books: z.array(PlanBookSchema),
    bridges: z.array(BridgeSchema),
    notes: z.array(NoteSchema),
  })
  .strict();
export type ReadingPlan = z.infer<typeof ReadingPlanSchema>;

/**
 * The library (PLAN §15, Phase 5): sections for the books outside the path. Each book's sections
 * are approved by the owner; the approval carries a fingerprint of the sections, so any edit stops
 * the build until it is approved again.
 */
export const LibrarySchema = z
  .object({
    $comment: z.string().optional(),
    books: z.array(
      z
        .object({
          id: z.string(),
          sections: z.array(PlanSectionSchema).min(1),
          approval: z
            .object({ by: z.string(), date: z.string(), fingerprint: z.string() })
            .optional(),
        })
        .strict(),
    ),
  })
  .strict();
export type Library = z.infer<typeof LibrarySchema>;

// ---------------------------------------------------------------------------
// Generated data (public/data). Produced by `pnpm content:build`.
// ---------------------------------------------------------------------------

export type Testament = 'OT' | 'NT';
export type BookGroup =
  | 'Pentateuch'
  | 'Historical'
  | 'Wisdom'
  | 'Prophets'
  | 'Gospels'
  | 'Acts'
  | 'Letters'
  | 'Apocalypse';

export interface Book {
  id: string; // OSIS id: 'Gen', 'Job', '1Macc', 'Luke'
  name: string;
  testament: Testament;
  group: BookGroup;
  canonOrder: number; // 1..73, Catholic order
  inPlan: boolean;
  /** Off the path, with approved library sections (Phase 5): readable, never on the thread. */
  library?: boolean;
  tagline: string;
  /** Off-path taglines are drafts until David approves them (content/plan/offpath-taglines.json). */
  taglineDraft?: boolean;
  setting?: string;
  chapters: number; // in WEBC
  verses: number; // in WEBC
}

/** One block of a verse: a paragraph or poetry line as laid out in WEBC. */
export interface VerseBlock {
  text: string;
  /** USFM paragraph style the block sits in: p, m, pi1, li1, q1, q2, q3, pc, nb, mi, qs (selah) */
  style: string;
  /** True when this block begins a new paragraph or line in WEBC. */
  brk: boolean;
}

export interface Footnote {
  /** Character offset in `text` where the note marker sits. */
  at: number;
  text: string;
}

export interface Verse {
  ref: string; // 'Gen.12.1' or 'Esth.1.1!a' (WEBC numbering)
  c: number;
  v: number;
  part?: string; // subdivision used only where the plan splits a WEBC verse
  text: string; // plain text, all blocks joined by single spaces
  blocks: VerseBlock[];
  heading?: string; // WEBC section heading immediately before this verse
  wj?: [number, number][]; // character spans of words of Jesus
  footnotes?: Footnote[];
  /** Reader only (Phase 7): this verse's element id, where it is not `v-<c>-<v>` of its own numbers. */
  anchor?: string;
  /** Reader only (Phase 7): a WEBC verse with no Douay-Rheims words of its own, kept for its anchor. */
  bare?: boolean;
}

/** A verse as stored in section files: `text` is omitted because it equals the blocks joined by spaces. */
export type VerseOut = Omit<Verse, 'text'>;

/** Plain text of a stored verse; footnote and words-of-Jesus offsets index into this string. */
export function verseText(v: Pick<Verse, 'blocks'>): string {
  return v.blocks.map((b) => b.text).join(' ');
}

export interface FoldOut {
  status: 'skim' | 'skip';
  label: string;
  range: string; // plan notation
  webcRange: string; // human-readable WEBC range
  from: string; // first verse ref (WEBC)
  to: string; // last verse ref (WEBC)
}

export interface NoteOut {
  id: string;
  at: 'start' | 'end' | 'fold' | 'verse';
  verseRef?: string; // WEBC ref when at === 'verse'
  text: string;
}

export interface SectionIndexEntry {
  id: string;
  bookId: string;
  order: number;
  title: string;
  range: string; // plan notation (Catholic numbering)
  webcRange: string; // the same passage in WEBC numbering
  status: Status;
  /** A library section (Phase 5): readable, never a stop on the path. */
  library?: boolean;
  summary?: string;
  highlight?: boolean;
  contentNote?: string;
  /** True when WEBC numbers this passage differently from the plan's reference (PLAN D10). */
  webcDiffers?: boolean;
  verseCount: number;
  words: number;
  minutes: number; // at 230 words per minute
}

export interface SectionFile extends SectionIndexEntry {
  bookName: string;
  verses: VerseOut[];
  folds: FoldOut[];
  notes: NoteOut[];
  versificationNote?: string;
}

// ---------------------------------------------------------------------------
// The Douay-Rheims (Phase 7): public/data/drc/<sectionId>.json
// ---------------------------------------------------------------------------

/** A Douay-Rheims verse, in its own numbering, as the reader shows it. */
export interface DrcVerseOut {
  c: number;
  v: number;
  blocks: VerseBlock[];
  footnotes?: Footnote[];
  heading?: string;
}

/** A section's Douay-Rheims text: the verses that hold each WEBC verse's words. */
export interface DrcSectionFile {
  id: string;
  /** The Douay-Rheims's own reference for the section, e.g. "Psalms 22:1–7". */
  reference: string;
  /** The section's WEBC verses in order (so the reader need not ship the WEBC text to the client). */
  order: string[];
  /** WEBC unit ref → its Douay-Rheims verses, in order; a unit absent here has no words of its own. */
  units: Record<string, DrcVerseOut[]>;
}

// ---------------------------------------------------------------------------
// Threads (Phase 4): connections as published in public/data/connections.json (verified only)
// ---------------------------------------------------------------------------

export type ConnectionType =
  'quotation' | 'allusion' | 'echo' | 'typology' | 'parallel' | 'fulfilment' | 'contrast';

/** One end of a connection, placed in the built section that holds its first verse. */
export interface ThreadEnd {
  ref: string; // OSIS, WEBC numbering ("Luke.4.25-Luke.4.26")
  display: string; // "Luke 4:25–26"
  sectionId: string;
  sectionTitle: string;
  bookId: string;
  library: boolean;
  /** The corpus its book belongs to (`lib/corpora.ts`). */
  corpus: CorpusId;
  /** Element id of its first verse in the section page ("v-4-25"). */
  anchor: string;
  /** The first verse's built text, cut at a word boundary (never typed). */
  excerpt: string;
  /** Other threads from the same verse, in every published file ("3 more from here"). */
  more: number;
}

export interface ThreadEvidence {
  dataset: 'LXX' | 'TAGNT';
  ref: string; // "Septuagint 3 Kingdoms 17:23" style is built from this at display
  words: string; // "11–15"
  form: string; // the tokens at those positions
  row: string;
}

export type ThreadCitation =
  | { kind: 'xref'; row: string }
  | { kind: 'verse'; display: string; words: string[] }
  | {
      kind: 'father';
      author: string;
      work: string;
      locator: string;
      edition: string;
      url: string;
    }
  | { kind: 'bibliographic'; author: string; title: string; year: string; locator: string };

export type OrderBasis = 'canon' | 'text' | 'consensus' | 'father' | 'disputed';

/**
 * Which end was written first and whether the later one is said to use it (threads plan §2.3),
 * stored or computed by the build. `older` indexes `ends`; null when the order is not given.
 */
export interface ThreadOrder {
  older: 0 | 1 | null;
  uses: boolean;
  basis: OrderBasis | null;
  note?: string;
  sources?: ThreadCitation[];
}

export interface PublicConnection {
  id: string;
  type: ConnectionType;
  strength: 1 | 2 | 3;
  label: string;
  explanation: string;
  ends: [ThreadEnd, ThreadEnd]; // from, to
  /** The corpora of the two ends, in table order ("ot-nt"). */
  pair: PairId;
  order: ThreadOrder;
  evidence: ThreadEvidence[];
  sources: ThreadCitation[];
}

export interface PublicConnections {
  connections: PublicConnection[];
}

/**
 * A reading's key passages (owner, 2026-11-18): the verses to mark in gold wherever the reading is
 * opened, and at the first verse of each passage the sub-themes it is key to. Keys are WEBC verse
 * refs as in `Verse.ref` (without a Douay-Rheims `~n`).
 */
export interface KeyMarks {
  marked: string[];
  starts: Record<string, { id: string; title: string; whole?: boolean }[]>;
}
