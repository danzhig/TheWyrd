/**
 * Threads in the content build (Phase 4, P4.2): check content/connections/connections.json against
 * the built sections and write public/data/connections.json with verified connections only. Each
 * end is placed in the section holding its first verse, with its display reference and an excerpt
 * cut from the built WEBC text (never typed). Checks that need the raw sources (cross-reference
 * rows, Greek tokens, the Fathers' phrases) are `pnpm connections:verify`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { corpusOfTestament, pairId, type CorpusId, type PairId } from '../../lib/corpora';
import {
  verseText,
  type PublicConnections,
  type ThreadOrder,
  type SectionFile,
  type ThreadCitation,
  type ThreadEnd,
  type VerseOut,
} from '../../lib/types';
import { CANON_BY_ID } from '../lib/canon';
import { readSourcesManifest } from '../fetch-sources';
import { displayRef, excerpt } from '../themes/emit-themes';
import {
  CONNECTION_FILES,
  connectionFingerprint,
  readConnections,
  sentenceCount,
  type Citation,
  type Connection,
} from './schema';

const EXCERPT_MIN = 90;
const EXCERPT_MAX = 200;

/** The first verse of an OSIS reference ("Exod.12" → "Exod.12.1"). */
export const firstVerse = (ref: string) => {
  const f = ref.split('-')[0]!;
  return f.split('.').length === 2 ? `${f}.1` : f;
};

/** Does the WEBC text carry this word (whole word, any case)? */
export function hasWord(text: string, word: string): boolean {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}])${esc}($|[^\\p{L}])`, 'iu').test(text);
}

/** Types whose later end is said to use the older one when no order is stored (threads plan §2.3). */
const USES_BY_DEFAULT = new Set(['quotation', 'allusion', 'echo', 'fulfilment', 'contrast']);

/**
 * The order of a connection's ends: as stored, or computed. Old ↔ New: the Old Testament end is
 * older (`canon`); typology is the Father's reading (`father`, no use claimed); a parallel claims
 * no use; the other types are uses. Within one corpus nothing is assumed (`older: null`).
 */
export function resolveOrder(
  c: Connection,
  from: CorpusId,
  to: CorpusId,
): Omit<ThreadOrder, 'sources'> {
  if (c.order) {
    const { older, uses, basis, note } = c.order;
    return {
      older: older === 'from' ? 0 : older === 'to' ? 1 : null,
      uses,
      basis,
      ...(note ? { note } : {}),
    };
  }
  if (from !== to && (from === 'ot' || to === 'ot')) {
    const typology = c.type === 'typology';
    return {
      older: from === 'ot' ? 0 : 1,
      uses: !typology && USES_BY_DEFAULT.has(c.type),
      basis: typology ? 'father' : 'canon',
    };
  }
  return { older: null, uses: false, basis: null };
}

/** Problems with a stored order (threads plan §2.3). */
export function orderErrors(c: Connection): string[] {
  const o = c.order;
  if (!o) return [];
  const out: string[] = [];
  if (o.uses && o.older === 'unknown') out.push('a use is claimed but the older end is unknown');
  if ((o.basis === 'consensus' || o.basis === 'disputed') && !o.sources?.length)
    out.push(`an order on "${o.basis}" cites its sources`);
  if (o.basis === 'disputed' && !o.note) out.push('a disputed order names the positions in a note');
  if (o.basis === 'father' && !c.sources.some((s) => s.kind === 'father'))
    out.push('an order on "father" cites a Father among the sources');
  if (o.note && sentenceCount(o.note) !== 1) out.push('the order note is one sentence');
  if (o.basis === 'unstated' && (o.older !== 'unknown' || o.uses))
    out.push('an unstated order has no older end and claims no use');
  return out;
}

/**
 * The verbs a summary sentence may use for each type (threads plan §3): a use claimed, or none
 * ("both tell", "set against", a Father's "figure of").
 */
export const LEAD_VERBS: Record<Connection['type'], { uses: RegExp; none: RegExp }> = {
  quotation: { uses: /\b(quotes|cites|names|reads)\b/, none: /\btell\b/ },
  allusion: { uses: /\b(recalls|alludes to|names)\b/, none: /\btell\b/ },
  echo: { uses: /\bechoes\b/, none: /\btell\b/ },
  fulfilment: { uses: /\bfulfil/, none: /\btell\b/ },
  contrast: { uses: /\b(reverses|answers|refuses)\b/, none: /\bagainst\b/ },
  parallel: { uses: /\bretells\b/, none: /\btell\b/ },
  typology: { uses: /\bfigure of\b/, none: /\bfigure of\b/ },
};

/** Longest summary sentence (threads plan §3). */
export const LEAD_MAX = 200;

/**
 * Check 14 (threads plan §3): the explanation's first sentence names both ends as the card shows
 * them, in the order the direction gives (the later end first when it is said to use the older,
 * the older first otherwise), with a verb for the type, in at most 200 characters.
 */
export function leadErrors(
  c: Pick<Connection, 'type' | 'explanation'>,
  ends: [Pick<ThreadEnd, 'display'>, Pick<ThreadEnd, 'display'>],
  order: Pick<ThreadOrder, 'older' | 'uses'>,
): string[] {
  const lead = c.explanation.split(/(?<=[.!?])\s+(?=[A-Z0-9])/)[0]!;
  const out: string[] = [];
  if (lead.length > LEAD_MAX)
    out.push(`its first sentence has ${lead.length} characters (at most ${LEAD_MAX})`);
  const at = ends.map((e) => {
    // A display followed by more digits is a different reference ("Luke 1:3" in "Luke 1:35").
    const m = new RegExp(`${e.display.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\d|[:–]\\d)`).exec(
      lead,
    );
    return m ? m.index : -1;
  });
  ends.forEach((e, i) => {
    if (at[i]! < 0) out.push(`its first sentence does not name ${e.display}`);
  });
  if (out.length) return out;
  if (order.older !== null) {
    const older = at[order.older]!;
    const later = at[1 - order.older]!;
    if (order.uses && later > older)
      out.push('its first sentence names the older end first, but the later one uses it');
    if (!order.uses && older > later) out.push('its first sentence names the later end first');
  }
  const verbs = LEAD_VERBS[c.type];
  if (!(order.uses ? verbs.uses : verbs.none).test(lead))
    out.push(
      `its first sentence has no verb for the type ${c.type}${order.uses ? '' : ' with no use claimed'}`,
    );
  return out;
}

export function buildConnections(
  sectionFiles: SectionFile[],
  library: Set<string>,
  file?: string,
  /** The pair every connection in this file must join (the within files), or any. */
  pair: PairId | null = null,
): { data: PublicConnections | null; errors: string[]; drafts: number } {
  const list = readConnections(file);
  if (!list) return { data: null, errors: [], drafts: 0 };
  const errors: string[] = [];
  const name = path.basename(file ?? 'connections.json');
  const homes = new Map(readSourcesManifest().map((s) => [s.id, s]));
  // Every WEBC verse, by reference, with the section that first holds it.
  const verseAt = new Map<string, { sec: SectionFile; v: VerseOut; i: number }>();
  for (const sec of sectionFiles)
    sec.verses.forEach((v, i) => {
      const whole = v.ref.split('!')[0]!;
      if (!verseAt.has(whole)) verseAt.set(whole, { sec, v, i });
    });
  // The passage's opening words: its first verses in the section, until there is enough to
  // recognise it (a verse like "The LORD's word came to him, saying," says little alone).
  const opening = (sec: SectionFile, i: number, last?: string) => {
    let text = '';
    for (let j = i; j < sec.verses.length && text.length < EXCERPT_MIN; j++) {
      const v = sec.verses[j]!;
      text += (text ? ' ' : '') + verseText(v);
      if (last && v.ref.split('!')[0] === last) break;
    }
    return excerpt(text, EXCERPT_MAX);
  };
  const bookName = (sec: SectionFile) => CANON_BY_ID.get(sec.bookId)?.name ?? sec.bookName;
  const corpusOf = (bookId: string) => corpusOfTestament(CANON_BY_ID.get(bookId)!.testament);

  const end = (c: Connection, ref: string): ThreadEnd | null => {
    const at = verseAt.get(firstVerse(ref));
    if (!at) {
      errors.push(`${name} ${c.id}: ${ref} starts at no WEBC verse in a built section`);
      return null;
    }
    const last = ref.split('-')[1];
    if (last && !verseAt.has(firstVerse(last)))
      errors.push(`${name} ${c.id}: ${ref} ends at no WEBC verse`);
    const { sec, v, i } = at;
    return {
      ref,
      display: displayRef(ref, bookName(sec)),
      sectionId: sec.id,
      sectionTitle: sec.title,
      bookId: sec.bookId,
      library: library.has(sec.id),
      corpus: corpusOf(sec.bookId),
      anchor: `v-${v.c}-${v.v}${v.part ?? ''}`,
      excerpt: opening(sec, i, last && last.split('.').length === 3 ? last : undefined),
      more: 0, // counted across every file by buildAllConnections
    };
  };

  const citations = (list: Citation[], where: string): ThreadCitation[] => {
    const out: ThreadCitation[] = [];
    for (const s of list) {
      if (s.kind === 'xref') out.push(s);
      else if (s.kind === 'verse') {
        const at = verseAt.get(s.ref);
        if (!at) {
          errors.push(`${where}: cites ${s.ref}, which is not a WEBC verse in a built section`);
          continue;
        }
        const text = verseText(at.v);
        for (const w of s.words)
          if (!hasWord(text, w)) errors.push(`${where}: ${s.ref} does not contain "${w}"`);
        out.push({
          kind: 'verse',
          display: displayRef(s.ref, bookName(at.sec)),
          words: s.words,
        });
      } else if (s.kind === 'bibliographic') out.push(s);
      else {
        const home = homes.get(s.source);
        if (!home) errors.push(`${where}: no source ${s.source} in sources/manifest.json`);
        out.push({
          kind: 'father',
          author: s.author,
          work: s.work,
          locator: s.locator,
          edition: s.edition,
          url: home?.homepage ?? '',
        });
      }
    }
    return out;
  };

  const data: PublicConnections = { connections: [] };
  const seen = new Set<string>();
  let drafts = 0;
  for (const c of list) {
    const where = `${name} ${c.id}`;
    if (seen.has(c.id)) errors.push(`${where}: duplicate id`);
    seen.add(c.id);
    const from = end(c, c.from);
    const to = end(c, c.to);
    if (from && to && from.sectionId === to.sectionId)
      errors.push(`${where}: both ends are in ${from.sectionId}`);
    const n = sentenceCount(c.explanation);
    if (c.status !== 'candidate' && (n < 2 || n > 4))
      errors.push(`${where}: the explanation has ${n} sentences (2–4)`);
    // Interpretive readings cite their source (PLAN §18, check 12).
    if (c.type === 'typology' && !c.sources.some((s) => s.kind === 'father'))
      errors.push(`${where}: a typology must cite a Father's work and section`);
    const sources = citations(c.sources, where);
    const order = from && to ? resolveOrder(c, from.corpus, to.corpus) : null;
    for (const e of orderErrors(c)) errors.push(`${where}: ${e}`);
    const orderSources = c.order?.sources ? citations(c.order.sources, where) : undefined;
    if (from && to && pair && pairId(from.corpus, to.corpus) !== pair)
      errors.push(`${where}: joins ${pairId(from.corpus, to.corpus)}, not ${pair}`);
    // Inside one corpus the build assumes no order (threads plan §2.3): the within files state it.
    if (pair && !c.order) errors.push(`${where}: states its order (older end, use, basis)`);
    if (from && to && order && c.status !== 'candidate')
      for (const e of leadErrors(c, [from, to], order)) errors.push(`${where}: ${e} (check 14)`);
    const fingerprint = connectionFingerprint(c);
    const approved = !!c.approval && c.approval.fingerprint === fingerprint;
    if (c.approval && !approved)
      errors.push(`${where}: edited since its approval (fingerprint ${fingerprint})`);
    if (c.status === 'verified' && !c.approval)
      errors.push(`${where}: verified without the owner's approval (fingerprint ${fingerprint})`);
    // Drafts and candidates stay off the site (PLAN §18, check 13).
    if (c.status !== 'verified' || !approved || !from || !to) {
      if (c.status !== 'verified') drafts++;
      continue;
    }
    data.connections.push({
      id: c.id,
      type: c.type,
      strength: c.strength,
      label: c.label,
      explanation: c.explanation,
      ends: [from, to],
      pair: pairId(from.corpus, to.corpus),
      order: { ...order!, ...(orderSources ? { sources: orderSources } : {}) },
      evidence: (c.evidence ?? []).map((e) => ({
        dataset: e.dataset,
        ref: e.ref,
        words: e.toWordIndex ? `${e.wordIndex}–${e.toWordIndex}` : String(e.wordIndex),
        form: e.form.replace(/[.,·;:]+$/u, ''),
        row: e.row,
      })),
      sources,
    });
  }
  return { data, errors, drafts };
}

/** Every file of connections (`CONNECTION_FILES`), checked together: ids are unique across them. */
export function buildAllConnections(
  sectionFiles: SectionFile[],
  library: Set<string>,
  files: readonly { file: string; out: string; pair: PairId | null }[] = CONNECTION_FILES,
): { outputs: { out: string; data: PublicConnections }[]; errors: string[]; drafts: number } {
  const outputs: { out: string; data: PublicConnections }[] = [];
  const errors: string[] = [];
  let drafts = 0;
  const ids = new Map<string, string>();
  for (const f of files) {
    const r = buildConnections(sectionFiles, library, f.file, f.pair);
    errors.push(...r.errors);
    drafts += r.drafts;
    for (const c of readConnections(f.file) ?? []) {
      const other = ids.get(c.id);
      if (other && other !== f.file) errors.push(`${c.id}: in both ${other} and ${f.file}`);
      ids.set(c.id, f.file);
    }
    if (r.data) outputs.push({ out: f.out, data: r.data });
  }
  // "More from here": the other published threads that start at the same verse.
  const key = (e: ThreadEnd) => `${e.sectionId}#${e.anchor}`;
  const ends = outputs.flatMap((o) => o.data.connections.flatMap((c) => c.ends));
  const at = new Map<string, number>();
  for (const e of ends) at.set(key(e), (at.get(key(e)) ?? 0) + 1);
  for (const e of ends) e.more = at.get(key(e))! - 1;
  return { outputs, errors, drafts };
}

export function writeConnections(
  dir: string,
  data: PublicConnections,
  out = 'connections.json',
): void {
  fs.writeFileSync(path.join(dir, out), JSON.stringify(data) + '\n');
}
