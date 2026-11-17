/**
 * pnpm drc:align [--approve <Book,Book…|all>] — align the Douay-Rheims (Challoner) with the WEBC,
 * verse by verse, for the whole Bible (Phase 7, step 1), and write the owner's review documents:
 * docs/drc/alignment.md (every book: method, counts, checks, map approvals) and
 * docs/drc/details.md (every pair that is not simply a verse with its own number: TVTMS
 * renumberings, pairs moved by content, the maps' segments with every pair, verses left without
 * words of their own, and pairs the content check doubts).
 *
 * Needs `pnpm content:fetch` (WEBC, TVTMS and the Douay-Rheims).
 * --approve records the owner's approval of the named books' maps in content/drc/maps.json, with a
 * fingerprint of their segments; run it only on the owner's word.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { DrcAlignment, DrcBookMap } from './drc/align';
import { alignAll, MAPS_FILE, mapFingerprint, readDrc } from './drc/maps';

// ---------------------------------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) main();

function main() {
  const args = process.argv.slice(2);
  const ai = args.indexOf('--approve');
  const approve = ai >= 0 ? (args[ai + 1] ?? '').split(',').filter(Boolean) : null;

  const { alignments, maps } = alignAll();
  const raw = JSON.parse(fs.readFileSync(MAPS_FILE, 'utf8')) as {
    books: Record<string, DrcBookMap>;
  };
  if (approve) {
    const today = new Date().toISOString().slice(0, 10);
    for (const [id, m] of Object.entries(raw.books)) {
      if (!approve.includes('all') && !approve.includes(id)) continue;
      m.approval = { by: 'the owner', date: today, fingerprint: mapFingerprint(id, m) };
    }
    fs.writeFileSync(MAPS_FILE, JSON.stringify(raw, null, 2) + '\n');
    console.log(
      `approved: ${approve.join(', ')} (run Prettier on ${path.relative('.', MAPS_FILE)})`,
    );
  }

  const words = (text: string, n = 7) => {
    const w = text.replace(/\s+/g, ' ').trim().split(' ');
    return w.length > n ? `${w.slice(0, n).join(' ')} …` : w.join(' ');
  };
  const drc = readDrc();
  const wText = new Map(alignments.flatMap((a) => [...a.webcText]));
  const dText = new Map([...drc.values()].flatMap((b) => b.verses.map((v) => [v.ref, v.text])));
  const short = (r: string) => r.split('.').slice(1).join(':'); // "Esth.1.1!a" → "1:1!a"
  const cite = (r: string) => {
    const [, c, v] = r.split('.');
    return `${c}:${v}`;
  };

  const status = (id: string) => {
    const m = raw.books[id];
    if (!m) return '';
    const fp = mapFingerprint(id, m);
    if (!m.approval) return `awaiting approval (fingerprint \`${fp}\`)`;
    return m.approval.fingerprint === fp
      ? `approved ${m.approval.date} (\`${fp}\`)`
      : `changed since approval on ${m.approval.date}; needs approval again (\`${fp}\`)`;
  };

  // --- Summary --------------------------------------------------------------------------------
  const total = (f: (a: DrcAlignment) => number) => alignments.reduce((n, a) => n + f(a), 0);
  const summary: string[] = [
    '# The Douay-Rheims alignment',
    '',
    'Written by `pnpm drc:align` (Phase 7, step 1). For the reading toggle, every WEBC verse is paired with the Douay-Rheims (Challoner) verses that hold the same words, so a page can switch translation while the plan, sections, threads and themes keep the WEBC numbering. Nothing here is on the site yet.',
    '',
    '**How a pair is found**',
    '',
    '1. **Numbering.** Most verses keep their number. Where the Latin tradition numbers differently (the Psalms, Malachi, parts of Kings, Sirach…), STEPBible TVTMS gives the change; each TVTMS record is used only after its own tests, run on both texts, show which column each text follows there.',
    '2. **Content.** Within four verses of that numbering, an order-keeping alignment on the words two verses share may move a pair, where the Latin divides verses differently and TVTMS records nothing (Baruch 6, 1 Maccabees 1, Daniel 3). A pair the numbering proposes is kept unless the words clearly say otherwise.',
    '3. **Maps** (`content/drc/maps.json`, owner-approved). Where the Douay-Rheims is another form of the book (the Vulgate’s Tobit and Judith; Esther, whose additions it gathers after 10:3), or holds a passage elsewhere (the doxology of Romans), the map pairs stretches of the two texts and verses inside each stretch are paired by content.',
    '',
    'A Douay-Rheims verse that pairs with nothing on its own goes with the WEBC verse beside it, so every Douay-Rheims verse is shown somewhere. A WEBC verse can be left without Douay-Rheims words of its own when the Latin merges it into a neighbour or lacks it; on such a verse the toggle shows nothing extra. **Score** is the share of words (common words aside) a WEBC verse and its Douay-Rheims verses have in common: about 0.6 is typical, as the two translations word things differently; a **doubt** is a pair whose neighbour shares clearly more words.',
    '',
    `**Totals.** ${total((a) => a.webcVerses).toLocaleString('en')} WEBC verses and ${total((a) => a.drcVerses).toLocaleString('en')} Douay-Rheims verses in 73 books. Douay-Rheims verses left unplaced: ${total((a) => a.unmatchedDrc.length)}. WEBC verses without Douay-Rheims words of their own: ${total((a) => a.unmatchedWebc.length)}. Pairs moved by content: ${total((a) => a.moved.length)}. Doubts: ${total((a) => a.suspects.length)}.`,
    '',
    '**Maps (owner-approved):** ' +
      (Object.keys(raw.books)
        .map((id) => `${id} — ${status(id)}`)
        .join('; ') || 'none'),
    '',
    '| Book | WEBC verses | Douay-Rheims verses | Method | TVTMS records used | Moved by content | WEBC without own words | Doubts | Mean score |',
    '| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: |',
    ...alignments.map((a) => {
      const m = maps[a.book.id];
      const method = m?.whole ? 'map' : m ? 'numbering + map' : 'numbering';
      return `| ${a.book.name} | ${a.webcVerses} | ${a.drcVerses} | ${method} | ${a.records.filter((r) => r.decision === 'applied').length} | ${a.moved.length} | ${a.unmatchedWebc.length} | ${a.suspects.length} | ${a.meanScore.toFixed(2)} |`;
    }),
    '',
    'Every pair that is not simply a verse with its own number is listed in [details.md](details.md).',
    '',
  ];

  // --- Details --------------------------------------------------------------------------------
  const details: string[] = [
    '# The Douay-Rheims alignment: details',
    '',
    'Written by `pnpm drc:align`. For each book: the TVTMS records that renumber it, the pairs the content step moved, the map’s segments with every pair, the WEBC verses left without words of their own, and the doubts. Quotations are the first words of each verse, from the pinned texts.',
    '',
  ];
  for (const a of alignments) {
    const lines: string[] = [];
    const applied = a.records.filter((r) => r.decision === 'applied');
    const odd = a.records.filter((r) => r.decision === 'undetermined' || r.decision === 'unparsed');
    if (applied.length)
      lines.push(
        `**TVTMS records used** (${applied.length}): ` +
          applied
            .map(
              (r) =>
                `${r.header} (line ${r.line}: WEBC ${r.webc}, Douay-Rheims ${r.drc}${r.note ? `; ${r.note}` : ''})`,
            )
            .join('; '),
        '',
      );
    if (odd.length)
      lines.push(
        `**TVTMS records not used** (their tests do not decide; the verses they cover keep their numbers and pass the content check unless listed below): ` +
          odd.map((r) => `${r.header} (line ${r.line}${r.note ? `: ${r.note}` : ''})`).join('; '),
        '',
      );
    for (const seg of a.segments) {
      if (maps[a.book.id]?.byChapter && !seg.bare.length && seg.pairs.every((p) => p[2] >= 0.25))
        continue;
      lines.push(
        `**Segment** WEBC ${seg.webc} ↔ Douay-Rheims ${seg.drc.join(', ')} — ${seg.why}`,
        '',
        '| WEBC | Douay-Rheims | Score | WEBC opens | Douay-Rheims opens |',
        '| --- | --- | ---: | --- | --- |',
        ...seg.pairs.map(
          ([w, ds, sc]) =>
            `| ${short(w)} | ${ds.map(cite).join(', ')} | ${sc.toFixed(2)} | ${words(wText.get(w) ?? '')} | ${words(dText.get(ds[0]!) ?? '')} |`,
        ),
        ...seg.bare.map((w) => `| ${short(w)} | — | | ${words(wText.get(w) ?? '')} | |`),
        '',
      );
    }
    if (a.moved.length)
      lines.push(
        `**Moved by content** (${a.moved.length}): ` +
          a.moved
            .map((m) => m.replace(new RegExp(`${a.book.id}\\.(\\d+)\\.(\\d+)`, 'g'), '$1:$2'))
            .join('; '),
        '',
      );
    if (a.unmatchedWebc.length && !a.segments.length)
      lines.push(
        `**WEBC verses without Douay-Rheims words of their own** (${a.unmatchedWebc.length}): ${a.unmatchedWebc.map(short).join(', ')}`,
        '',
      );
    if (a.suspects.length)
      lines.push(
        `**Doubts** (${a.suspects.length}):`,
        '',
        ...a.suspects.map(
          (s) =>
            `- WEBC ${cite(s.webc)} ↔ ${s.drc.map(cite).join(', ')} (${s.score.toFixed(2)}), but ${cite(s.neighbour)} shares ${s.neighbourScore.toFixed(2)}: “${words(wText.get(s.webc) ?? '', 10)}” / “${words(dText.get(s.drc[0]!) ?? '', 10)}”`,
        ),
        '',
      );
    if (lines.length)
      details.push(
        `## ${a.book.name}${maps[a.book.id] ? ` — map ${status(a.book.id)}` : ''}`,
        '',
        ...lines,
      );
  }

  fs.mkdirSync('docs/drc', { recursive: true });
  fs.writeFileSync('docs/drc/alignment.md', summary.join('\n'));
  fs.writeFileSync('docs/drc/details.md', details.join('\n'));
  console.log(
    `wrote docs/drc/alignment.md and docs/drc/details.md: ${total((a) => a.webcVerses)} WEBC verses, ` +
      `${total((a) => a.unmatchedDrc.length)} Douay-Rheims verses unplaced, ${total((a) => a.suspects.length)} doubts`,
  );
}
