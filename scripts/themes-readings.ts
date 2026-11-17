/**
 * pnpm themes:readings [--approve] — place every reading (all 808 built sections, path and library)
 * in a home sub-theme, and a second where it truly sits in two (owner, 2026-11-17; PLAN §16, P6.5),
 * from the taxonomy's sources and, where no source cites a reading, by its words
 * (scripts/themes/readings.ts). Writes content/themes/readings.json and the review document
 * docs/themes/readings.md. Needs `pnpm themes:fetch`.
 *
 * --approve records the owner's approval with a fingerprint of the placements; run it only on the
 * owner's word. `pnpm content:build` publishes approved placements only and fails if any reading
 * has no home.
 */
import fs from 'node:fs';
import path from 'node:path';
import { verseText, type SectionFile } from '../lib/types';
import { RAW_DIR } from './lib/paths';
import { CANON_BY_ID } from './lib/canon';
import { readNave } from './themes/naves';
import { readOpenBible, type OpenBibleRow } from './themes/openbible';
import { placeReadings, SECOND } from './themes/readings';
import {
  candidatesFor,
  readingsFingerprint,
  READINGS_FILE,
  readSectionIndex,
  readTaxonomy,
  readThemes,
  sectionFor,
  type Candidate,
  type ReadingsFile,
} from './themes/taxonomy';

const approve = process.argv.includes('--approve');
const tax = readTaxonomy();
const nave = readNave(path.join(RAW_DIR, 'naves'));
const ob = new Map<string, OpenBibleRow[]>();
for (const r of readOpenBible(path.join(RAW_DIR, 'openbible-topics')))
  ob.set(r.topic, [...(ob.get(r.topic) ?? []), r]);
const index = readSectionIndex();
const manifest = JSON.parse(fs.readFileSync('public/data/manifest.json', 'utf8')) as {
  sections: { id: string; bookId: string; title: string; range: string; library?: boolean }[];
};
const sections = manifest.sections.map((s) => ({
  ...s,
  text: (
    JSON.parse(fs.readFileSync(`public/data/sections/${s.id}.json`, 'utf8')) as SectionFile
  ).verses
    .map((v) => verseText(v))
    .join(' '),
}));

const candidates = new Map<string, Candidate[][]>();
for (const t of tax.themes)
  for (const s of t.subthemes)
    candidates.set(
      s.id,
      s.sources.map((src) => candidatesFor(src, nave, ob)),
    );
const placements = placeReadings(sections, candidates, (r) => sectionFor(r, index));

const file: ReadingsFile = {
  $comment:
    'Phase 6 readings (PLAN §16, P6.5), written by pnpm themes:readings: every built section with its home sub-theme (first) and, where it truly sits in two, a second. Evidence placements cite their strongest dataset rows; similarity placements were matched by their words. Approved by the owner with a fingerprint of the placements.',
  approval: null,
  readings: placements.map((p) => ({
    sectionId: p.sectionId,
    subs: p.subs,
    method: p.method,
    scores: p.scores.map((x) => Math.round(x * 1000) / 1000),
    rows: p.rows.slice(0, 5),
  })),
};
const old = fs.existsSync(READINGS_FILE)
  ? (JSON.parse(fs.readFileSync(READINGS_FILE, 'utf8')) as ReadingsFile)
  : null;
const fp = readingsFingerprint(file.readings);
if (approve)
  file.approval = { by: 'the owner', date: new Date().toISOString().slice(0, 10), fingerprint: fp };
else if (old?.approval?.fingerprint === fp) file.approval = old.approval;
fs.writeFileSync(READINGS_FILE, JSON.stringify(file, null, 2) + '\n');

// The review document: each theme and sub-theme with its readings. On the site a sub-theme also
// shows every reading that holds one of its approved key passages (owner, 2026-11-17).
const keys = new Map<string, Set<string>>();
for (const t of readThemes()?.themes ?? [])
  for (const s of t.subthemes)
    keys.set(
      s.id,
      new Set(s.passages.filter((p) => p.status === 'approved').map((p) => p.sectionId)),
    );
const title = new Map(sections.map((s) => [s.id, s]));
const OT = new Set([...CANON_BY_ID.values()].filter((b) => b.testament === 'OT').map((b) => b.id));
const doc: string[] = [
  '# Themes: every reading',
  '',
  `Written by \`pnpm themes:readings\` from \`content/themes/taxonomy.json\` and the pinned datasets (Nave's Topical Bible, OpenBible.info's topics). Each of the ${placements.length} readings has a home sub-theme, and a second where it scores at least ${Math.round(SECOND * 100)}% of its home; ${placements.filter((p) => p.subs.length > 1).length} have a second. A sub-theme also shows every reading that holds one of its approved key passages (owner, 2026-11-17), so none of its key passages is ever missing. ${placements.filter((p) => p.method === 'similarity').length} readings no dataset cites (mostly the deuterocanonical books, which these Protestant-tradition datasets barely index) were placed by their words, nearest to the readings already in each sub-theme. Status: ${file.approval ? `approved ${file.approval.date} (\`${fp}\`)` : `awaiting approval (fingerprint \`${fp}\`)`}.`,
  '',
];
for (const t of tax.themes) {
  doc.push(`## ${t.title}`, '');
  for (const s of t.subthemes) {
    const here = placements.filter(
      (p) => p.subs.includes(s.id) || keys.get(s.id)?.has(p.sectionId),
    );
    const ot = here.filter((p) => OT.has(title.get(p.sectionId)!.bookId)).length;
    doc.push(
      `### ${s.title} (\`${s.id}\`) — ${here.length} readings (Old Testament ${ot}, New ${here.length - ot})`,
      '',
      '| Reading | Book | Placed | Evidence |',
      '| --- | --- | --- | --- |',
      ...here.map((p) => {
        const sec = title.get(p.sectionId)!;
        const how =
          p.method === 'similarity' && p.subs.includes(s.id)
            ? `by its words (${p.scores[0]!.toFixed(2)})`
            : p.subs[0] === s.id
              ? 'home'
              : p.subs.includes(s.id)
                ? 'second'
                : 'holds a key passage';
        return `| ${sec.title} (\`${p.sectionId}\`) | ${CANON_BY_ID.get(sec.bookId)?.name} ${sec.range} | ${how} | ${
          p.subs[0] === s.id
            ? p.rows
                .slice(0, 3)
                .map((r) => `\`${r}\``)
                .join(', ')
            : ''
        } |`;
      }),
      '',
    );
  }
}
fs.mkdirSync('docs/themes', { recursive: true });
fs.writeFileSync('docs/themes/readings.md', doc.join('\n'));
console.log(
  `placed ${placements.length} readings (${placements.filter((p) => p.subs.length > 1).length} with a second, ${placements.filter((p) => p.method === 'similarity').length} by their words); ${file.approval ? 'approved' : `awaiting approval (fingerprint ${fp})`}`,
);
