/**
 * Threads in the content build (Phase 4, P4.2): check content/connections/connections.json against
 * the built sections and write public/data/connections.json with verified connections only. Each
 * end is placed in the section holding its first verse, with its display reference and an excerpt
 * cut from the built WEBC text (never typed). Checks that need the raw sources (cross-reference
 * rows, Greek tokens, the Fathers' phrases) are `pnpm connections:verify`.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  verseText,
  type PublicConnections,
  type SectionFile,
  type ThreadCitation,
  type ThreadEnd,
  type VerseOut,
} from '../../lib/types';
import { CANON_BY_ID } from '../lib/canon';
import { readSourcesManifest } from '../fetch-sources';
import { displayRef, excerpt } from '../themes/emit-themes';
import { connectionFingerprint, readConnections, sentenceCount, type Connection } from './schema';

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

export function buildConnections(
  sectionFiles: SectionFile[],
  library: Set<string>,
  file?: string,
): { data: PublicConnections | null; errors: string[]; drafts: number } {
  const list = readConnections(file);
  if (!list) return { data: null, errors: [], drafts: 0 };
  const errors: string[] = [];
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

  const end = (c: Connection, ref: string): ThreadEnd | null => {
    const at = verseAt.get(firstVerse(ref));
    if (!at) {
      errors.push(`connections.json ${c.id}: ${ref} starts at no WEBC verse in a built section`);
      return null;
    }
    const last = ref.split('-')[1];
    if (last && !verseAt.has(firstVerse(last)))
      errors.push(`connections.json ${c.id}: ${ref} ends at no WEBC verse`);
    const { sec, v, i } = at;
    return {
      ref,
      display: displayRef(ref, bookName(sec)),
      sectionId: sec.id,
      sectionTitle: sec.title,
      bookId: sec.bookId,
      library: library.has(sec.id),
      anchor: `v-${v.c}-${v.v}${v.part ?? ''}`,
      excerpt: opening(sec, i, last && last.split('.').length === 3 ? last : undefined),
    };
  };

  const data: PublicConnections = { connections: [] };
  const seen = new Set<string>();
  let drafts = 0;
  for (const c of list) {
    const where = `connections.json ${c.id}`;
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
    const sources: ThreadCitation[] = [];
    for (const s of c.sources) {
      if (s.kind === 'xref') sources.push(s);
      else if (s.kind === 'verse') {
        const at = verseAt.get(s.ref);
        if (!at) {
          errors.push(`${where}: cites ${s.ref}, which is not a WEBC verse in a built section`);
          continue;
        }
        const text = verseText(at.v);
        for (const w of s.words)
          if (!hasWord(text, w)) errors.push(`${where}: ${s.ref} does not contain "${w}"`);
        sources.push({
          kind: 'verse',
          display: displayRef(s.ref, bookName(at.sec)),
          words: s.words,
        });
      } else {
        const home = homes.get(s.source);
        if (!home) errors.push(`${where}: no source ${s.source} in sources/manifest.json`);
        sources.push({
          kind: 'father',
          author: s.author,
          work: s.work,
          locator: s.locator,
          edition: s.edition,
          url: home?.homepage ?? '',
        });
      }
    }
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

export function writeConnections(dir: string, data: PublicConnections): void {
  fs.writeFileSync(path.join(dir, 'connections.json'), JSON.stringify(data) + '\n');
}
