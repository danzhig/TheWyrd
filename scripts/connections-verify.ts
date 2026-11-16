/**
 * pnpm connections:verify [--approve <id,id…|all>] — check every connection in
 * content/connections/connections.json against the pinned raw sources and write the owner's review
 * document, docs/connections/seeds.md (Phase 4, P4.2). Needs `pnpm connections:fetch` and
 * `pnpm terms:fetch`.
 *
 * - each cross-reference row exists and links the two ends (either direction);
 * - each Greek word is the token at its cited position and row (Septuagint, TAGNT);
 * - each Father's phrase occurs in the pinned file, under the cited heading.
 *
 * With --approve, after every check passes, the named connections become `verified` with the
 * owner's approval (today's date and the fingerprint of their content). Run it only on the
 * owner's word.
 */
import fs from 'node:fs';
import path from 'node:path';
import { RAW_DIR } from './lib/paths';
import { CANON_BY_ID } from './lib/canon';
import { readSourcesManifest } from './fetch-sources';
import { inRange, readXrefs } from './connections/xrefs';
import {
  CONNECTIONS_FILE,
  ConnectionsSchema,
  connectionFingerprint,
  type Connection,
} from './connections/schema';
import { loadTermSources } from './terms/sources';
import { readSectionIndex, sectionFor } from './themes/taxonomy';

const args = process.argv.slice(2);
const approveIdx = args.indexOf('--approve');
const approve = approveIdx >= 0 ? (args[approveIdx + 1] ?? '').split(',') : null;

const file = JSON.parse(fs.readFileSync(CONNECTIONS_FILE, 'utf8'));
const { connections } = ConnectionsSchema.parse(file);
const xrefs = new Map(readXrefs(path.join(RAW_DIR, 'openbible-xrefs')).map((r) => [r.id, r]));
const terms = loadTermSources();
const manifest = new Map(readSourcesManifest().map((s) => [s.id, s]));
const index = readSectionIndex();
const sectionTitles = new Map<string, string>(
  (
    JSON.parse(fs.readFileSync('public/data/manifest.json', 'utf8')) as {
      sections: { id: string; title: string }[];
    }
  ).sections.map((s) => [s.id, s.title]),
);

const flat = (s: string) => s.replace(/\s+/g, ' ');
const texts = new Map<string, string>();
const fatherText = (id: string) => {
  if (!texts.has(id)) {
    const src = manifest.get(id);
    texts.set(id, src ? flat(fs.readFileSync(path.join(RAW_DIR, src.file), 'utf8')) : '');
  }
  return texts.get(id)!;
};

const results = new Map<string, string[]>();
const notes = new Map<string, string[]>();
for (const c of connections) {
  const problems: string[] = [];
  const ok: string[] = [];
  for (const s of c.sources) {
    if (s.kind === 'xref') {
      const r = xrefs.get(s.row);
      const links =
        r &&
        ((inRange(r.from.split('-')[0]!, c.from) && inRange(r.to.split('-')[0]!, c.to)) ||
          (inRange(r.from.split('-')[0]!, c.to) && inRange(r.to.split('-')[0]!, c.from)));
      if (!r) problems.push(`${s.row}: no such row`);
      else if (!links) problems.push(`${s.row} (${r.from} → ${r.to}) does not link the two ends`);
      else ok.push(`\`${s.row}\` ${r.from} → ${r.to}, ${r.votes} votes`);
    } else if (s.kind === 'father') {
      const text = fatherText(s.source);
      const at = text.indexOf(flat(s.phrase));
      if (!text) problems.push(`${s.source}: not pinned or not fetched`);
      else if (at < 0) problems.push(`${s.source}: the phrase is not in the file`);
      else {
        // The nearest heading of the same kind before the phrase must be the cited one.
        const kind = s.heading.split(' ')[0]!;
        const before = text.slice(0, at);
        const heads = [...before.matchAll(new RegExp(`${kind} [IVXLC]+\\.`, 'g'))];
        const last = heads[heads.length - 1]?.[0];
        if (last !== s.heading)
          problems.push(
            `${s.source}: the phrase falls under ${last ?? 'no heading'}, not ${s.heading}`,
          );
        else ok.push(`${s.author}, ${s.work}, ${s.locator}: phrase found under ${s.heading}`);
      }
    }
  }
  for (const e of c.evidence ?? []) {
    const list = (e.dataset === 'LXX' ? terms.lxx : terms.greek).get(e.ref) ?? [];
    const words = list.filter(
      (t) => t.wordIndex >= e.wordIndex && t.wordIndex <= (e.toWordIndex ?? e.wordIndex),
    );
    const form = words.map((t) => t.text).join(' ');
    const first = words[0] as { file: string; line?: number } | undefined;
    const row = first ? (first.line ? `${first.file}:${first.line}` : first.file) : '';
    if (form !== e.form)
      problems.push(`${e.dataset} ${e.ref} #${e.wordIndex}: the data has "${form}"`);
    else if (row !== e.row) problems.push(`${e.dataset} ${e.ref} #${e.wordIndex}: row is ${row}`);
    else
      ok.push(
        `${e.dataset} ${e.ref} word ${e.wordIndex}${e.toWordIndex ? `–${e.toWordIndex}` : ''}: ${e.form} (${e.row})`,
      );
  }
  results.set(c.id, problems);
  notes.set(c.id, ok);
}

const failed = [...results].filter(([, p]) => p.length);
for (const [id, p] of failed) console.error(`${id}:\n  - ${p.join('\n  - ')}`);

if (approve && !failed.length) {
  const today = new Date().toISOString().slice(0, 10);
  for (const c of file.connections as Connection[]) {
    if (!approve.includes('all') && !approve.includes(c.id)) continue;
    c.status = 'verified';
    delete c.approval;
    c.approval = { date: today, fingerprint: connectionFingerprint(c) };
  }
  fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(file, null, 2) + '\n');
  console.log(`approved: ${approve.join(', ')}`);
}

// The owner's review document.
const where = (ref: string) => {
  const sec = sectionFor(ref.split('-')[0]!, index);
  return sec
    ? `${sectionTitles.get(sec)} (\`${sec}\`${index.library.has(sec) ? ', library' : ''})`
    : '—';
};
const cite = (c: Connection) =>
  c.sources.map((s) =>
    s.kind === 'xref'
      ? null
      : s.kind === 'verse'
        ? `${s.ref} carries: ${s.words.join(', ')}`
        : `${s.author}, *${s.work}*, ${s.locator} (${s.edition}; \`${s.source}\`): “${s.phrase}”`,
  );
// The review documents: the plan's seeds (ids `s…`), and each book's proposals (P4.4).
const section = (c: Connection) => [
  `## \`${c.id}\` ${c.label}`,
  '',
  `- **${c.from} → ${c.to}** · ${c.type} · strength ${c.strength} · ${c.status}${c.approval ? ` (approved ${c.approval.date})` : ''} · fingerprint \`${connectionFingerprint(c)}\``,
  `- From: ${where(c.from)}`,
  `- To: ${where(c.to)}`,
  '',
  `> ${c.explanation}`,
  '',
  ...[...(notes.get(c.id) ?? []), ...cite(c).filter(Boolean)].map((n) => `- ${n}`),
  ...(results.get(c.id)!.length ? results.get(c.id)!.map((p) => `- **Fails:** ${p}`) : []),
  '',
];
const CHECKS =
  'checked against the pinned sources: OpenBible.info cross-reference rows, words the WEBC text carries at a verse (also checked by `pnpm content:build`), Greek words at their Septuagint and TAGNT rows, and Church Fathers in the pinned public-domain CCEL editions, by work and section with a phrase that must occur there.';
const APPROVAL =
  'Nothing here is on the site until the owner approves it: then each approved connection is `verified` with a fingerprint of its content (`pnpm connections:verify --approve <ids|all>`), and any later edit hides it until approved again.';
const count = (list: Connection[]) =>
  `${list.length} connections; ${list.filter((c) => c.status === 'verified').length} verified; ${list.filter((c) => results.get(c.id)!.length).length} failing a check.`;
const docs = new Map<string, string[]>();
const seeds = connections.filter((c) => /^s\d/.test(c.id));
docs.set('seeds', [
  '# Threads: the seed connections',
  '',
  `Written by \`pnpm connections:verify\` from \`content/connections/connections.json\`. Each seed from PLAN §14 with its type, strength (3 = explicit quotation or named reference), the sections its ends fall in, its explanation (original prose; no scripture beyond a few words) and every citation, ${CHECKS} Interpretive readings (typology, and the reading of Pentecost against Babel) rest on the Fathers cited; the rest describe what the texts show.`,
  '',
  APPROVAL,
  '',
  count(seeds),
  '',
  ...seeds.flatMap(section),
]);
const byBook = new Map<string, Connection[]>();
for (const c of connections.filter((x) => !/^s\d/.test(x.id))) {
  const b = c.from.split('.')[0]!;
  byBook.set(b, [...(byBook.get(b) ?? []), c]);
}
for (const [book, list] of byBook)
  docs.set(`${book}-connections`, [
    `# Threads: connections from ${CANON_BY_ID.get(book)?.name ?? book}`,
    '',
    `Written by \`pnpm connections:verify\` from \`content/connections/connections.json\`: the connections drafted from \`docs/connections/${book}-candidates.md\` (P4.4), each with its type, strength (3 = explicit quotation or named reference), sections, explanation (original prose; no scripture beyond a few words) and every citation, ${CHECKS}`,
    '',
    APPROVAL,
    '',
    count(list),
    '',
    ...list.flatMap(section),
  ]);
fs.mkdirSync('docs/connections', { recursive: true });
for (const [name, lines] of docs) fs.writeFileSync(`docs/connections/${name}.md`, lines.join('\n'));
console.log(
  `wrote ${[...docs.keys()].map((k) => `docs/connections/${k}.md`).join(', ')}: ${connections.length} connections, ${failed.length} failing`,
);
if (failed.length) process.exit(1);
