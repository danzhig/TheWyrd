# Threads expansion plan

_Drafted 2026-11-17 at the owner's request. A plan only: nothing here is built yet. It extends PLAN §14 (Phase 4) and follows every rule in PLAN §1 and §18._

## 1. What this adds

**Threads today join the two Testaments; the expansion adds threads inside each Testament, a three-way switch to choose which kinds show, and a reader list split into an Old Testament column and a New Testament column.**

Today 168 of the 170 connections run Old ↔ New. Two run New ↔ New (Galatians ↔ Acts) and none run Old ↔ Old. That is why turning off either Testament in the Vault leaves almost no threads. This was not a fault: the candidate tools looked for the New Testament's use of the Old.

The expansion has three parts:

1. **Content.** Two new sets of connections, made by the same method as the first 170:
   - **Within the Old Testament**, for example Samuel–Kings retold in Chronicles, the Law cited by the prophets, the Exodus sung in the Psalms, Joshua crossing the Jordan as Moses crossed the sea.
   - **Within the New Testament**, for example the same event in two Gospels, Paul's letters beside Acts, a saying of Jesus repeated in a letter.
2. **The Vault.** Threads mode gets its own set of three toggles:
   - **Between** (Old ↔ New, the current set; on by default)
   - **Within the Old**
   - **Within the New**

   Any combination is allowed, including all three on. The map will be crowded with all three on, and that is acceptable.

3. **The reader.** The list of threads at the foot of a page becomes two columns side by side: **Old Testament** on the left and **New Testament** on the right. Each thread goes in the column of the passage it leads _to_. A reader can then follow a verse back into the Old Testament or on into the New. On phones the columns stack.

The aim is depth for the reader who wants it. Someone reading a verse can see everything it echoes and everything that echoes it, while the default view stays as it is now.

## 2. Protecting what exists

**The expansion is additive: the 170 approved connections, the Vault's default look, its first-load budget and every current test stay exactly as they are.**

| Risk                                                                    | Protection                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Approved connections change by accident                                 | New connections go in **new files**: `content/connections/within-ot.json` and `within-nt.json`. `connections.json` is not edited. A new unit test pins the count and the approval fingerprints of the current verified set, and fails if any of them changes.                                                                                                                      |
| A new kind of link slips onto the site unreviewed                       | Same rule as now: `draft` until the owner approves, and an approval fingerprint covering ends, type, strength, wording, evidence and citations. Any edit hides the connection again (PLAN §18 check 13).                                                                                                                                                                           |
| The Vault's first load grows past its 150 KB budget (it is at 149.5 KB) | The scope toggles live inside the lazily loaded `ThreadsMode` chunk. `Vault.tsx` keeps only the existing Threads button. The perf test already checks this budget.                                                                                                                                                                                                                 |
| The Vault downloads more data before anyone asks                        | `public/data/connections.json` keeps exactly what it has today (Between). The within sets are emitted as `connections-within-ot.json` and `connections-within-nt.json` and fetched only when their toggle is first switched on.                                                                                                                                                    |
| Too many nodes on the ceiling (limit: 300)                              | Today 93 arcs carry 170 connections, one `path` per pair of books. With all three scopes on, the number of book pairs could pass the limit. Before content lands, measure the arc count for all three scopes together. If it would pass about 200, draw the arcs on one canvas, as the theme star field already does, and keep the DOM for the accessible list and the tap target. |
| Frame rate                                                              | `perf.spec.ts` gains a camera move with all three scopes on, held to the same 60 fps rule.                                                                                                                                                                                                                                                                                         |
| Reader pages get heavy                                                  | Thread lists are rendered into each page's HTML. Add a test that keeps the HTML of the heaviest section (likely Genesis 1 or Luke 4) under an agreed size. A verse with many threads shows its strongest ones in the dialog, with the rest one tap away.                                                                                                                           |
| Search changes                                                          | The search page's extra results read `connections.json`. They gain the within files only behind the same rule: approved only, and loaded only on `/search`.                                                                                                                                                                                                                        |
| Existing behaviour of the Testament switch                              | Defined explicitly in §5.3, with an e2e test for each combination.                                                                                                                                                                                                                                                                                                                 |

Nothing in the expansion needs a new npm dependency. Canvas, if needed, is built into the browser.

## 3. Method: the same as Phase 4

**Every new connection is found in the data, checked against pinned sources, written up in original prose and approved by the owner, exactly as P4.4 did for the first 170.**

The pipeline per book, unchanged in shape:

1. **Candidates.** Run `pnpm connections:propose <bookId> --scope ot|nt`. It writes `docs/connections/<bookId>-<scope>-candidates.md`: cross-reference rows grouped by the two sections they join, ranked by votes, each with what the data shows.
2. **Only pairs the data supports are written up:**
   - a quotation or a long shared run of words;
   - a named reference;
   - an uncommon shared word in the original language;
   - a parallel account;
   - typology only where a Church Father makes the reading, cited to a pinned volume.
3. **Write-up.** Type, strength, a 2–4 sentence original explanation and citations. Original-language evidence comes from `pnpm connections:draft` / `connections:echo` output and is never typed (PLAN §1 rules 2 and 3).
4. **Verify.** `pnpm connections:verify` checks every row, token and phrase against `sources/raw` and writes the review document `docs/connections/<bookId>-<scope>-connections.md`.
5. **Approval.** The owner approves, then `--approve`. One book per PR, in path order.

**Ids.** The book prefix stays, with the scope marked: `kgs1-o01` (Old ↔ Old), `luke-n01` (New ↔ New). The id pattern already allows hyphens.

**Types.** The seven current types cover both new scopes:

- _parallel_: Kings ↔ Chronicles, Luke ↔ Mark
- _quotation_: a psalm quoting the Law; 1 Timothy 5:18 quoting Luke 10:7
- _allusion_, _echo_, _typology_, _fulfilment_, _contrast_

One possible addition is _retelling_, for passages that retell the whole story, such as Nehemiah 9, Psalm 78 and Psalm 105. Stephen's speech is filed as _parallel_ today. This is the owner's call (§9); without a decision, keep the seven.

**Strength.** Unchanged: 3 = quoted or named, 2 = strong, 1 = proposed.

**Scope of the first pass (Stage A).** As now, at least one end must be in a **path** section; the other end may be anywhere, library included. **Stage B** (optional, later) opens library ↔ library pairs, such as Matthew ↔ Mark or Isaiah ↔ Jeremiah, for full depth.

## 4. Sources

**Most of what the expansion needs is already pinned; a few additions need the owner's approval and a licence check before first use (PLAN §1 rule 5), and every addition is credited on `/sources`.**

### Already pinned and usable as is

| Source                                                                                                                          | Use in the expansion                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenBible.info cross-references (CC BY 4.0, mostly the Treasury of Scripture Knowledge)                                         | The candidate pool for both new scopes. It covers Old ↔ Old and New ↔ New as densely as it covers Between.                                                                                                    |
| WEBC (public domain)                                                                                                            | Display text, excerpts, the shared-run signal, `verse` citations                                                                                                                                              |
| STEPBible TAHOT (CC BY 4.0)                                                                                                     | **New signal:** uncommon Hebrew/Aramaic lemmas two Old Testament passages share, by extended Strong's number, with token rows as evidence. This is the Old ↔ Old counterpart of the Septuagint ↔ TAGNT check. |
| STEPBible TAGNT (CC BY 4.0)                                                                                                     | **New signal:** uncommon Greek lemmas two New Testament passages share (TAGNT ↔ TAGNT)                                                                                                                        |
| STEPBible TBESH / TBESG lexicons                                                                                                | Rarity counts and glosses for the review documents (not shown as claims)                                                                                                                                      |
| Swete's Septuagint (CC BY-SA 4.0)                                                                                               | Old ↔ Old for the books with no Hebrew in TAHOT (Tobit, Judith, 1 Maccabees, the Greek parts of Esther and Daniel)                                                                                            |
| STEPBible TVTMS                                                                                                                 | Lining up verse numbers across Hebrew, Greek, Latin and English (§6)                                                                                                                                          |
| CCEL Fathers already pinned: Augustine on John; Chrysostom on Matthew, Acts and Romans, Corinthians; Tertullian against Marcion | Typology and New ↔ New readings, where they apply                                                                                                                                                             |

### To add, each needing the owner's approval

| Source                                                                                                                      | Why                                                                                                                                                                                                                      | Notes                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| **Swete's Septuagint for the rest of the Old Testament** (same TEI transcription and licence as now)                        | Only the path books' Septuagint files are pinned. Old ↔ Old links into Psalms, Isaiah, the other prophets, Wisdom, Sirach, Baruch and 2 Maccabees need the rest, and the deuterocanonical books have no Hebrew in TAHOT. | Same pipeline (`terms` in `sources/manifest.json`), more files                                                      |
| **STEPBible TIPNR** (proper names, CC BY 4.0; already listed in PLAN §3 for phase 4+)                                       | A better "shared names" signal: the same person or place by its TIPNR id, not just by spelling                                                                                                                           | New reader in `scripts/terms/`                                                                                      |
| **Augustine, _The Harmony of the Gospels_** (NPNF1-06, CCEL, public domain)                                                 | The classic patristic source for New ↔ New Gospel parallels                                                                                                                                                              | Same `father` citation kind                                                                                         |
| **Augustine, _City of God_** (NPNF1-02, CCEL) and a volume of **Jerome** or **Ambrose** on the Old Testament (NPNF2 series) | Fathers who read Old Testament figures as figures of each other, needed before any Old ↔ Old _typology_ goes up (check 12)                                                                                               | Choose volumes when the first typology candidates appear                                                            |
| **The Eusebian Canons** (4th-century Gospel parallel tables; the text itself is public domain)                              | An ancient, independent check on which Gospel passages are parallels                                                                                                                                                     | Only if a digital edition with a clear open licence is found. Otherwise rely on Augustine and the cross-references. |
| **A Hebrew font** (Ezra SIL or Taamey Frank CLM, OFL; listed in PLAN §3) and **Gentium Plus** for polytonic Greek           | Cards would show "Shared Hebrew" for the first time, and Greek has no dedicated font yet (the site self-hosts only EB Garamond and Cormorant Garamond)                                                                   | `pnpm fonts` pipeline. Hebrew is right-to-left and needs `dir="rtl"`.                                               |

**Network.** The download host for the cross-references (`a.openbible.info`) is blocked in the current cloud environment, so `pnpm connections:fetch` fails there. Add the host to that environment's allowed list, or run the fetch steps locally, before TX1.

## 5. Design

### 5.1 Data

- **Stored files:** `connections.json` (Between, unchanged), `within-ot.json`, `within-nt.json`. Same `ConnectionSchema`, read and checked together.
- **Scope is computed, never stored:** from the two ends' books (`testament` in the manifest). The fingerprint of an existing connection therefore never changes. A connection filed in the wrong file fails the build (for example, an Old ↔ New pair in `within-ot.json`).
- **Evidence** gains `dataset: 'TAHOT'` with the dataset's own row (`TAHOT Gen-Deu:<line>`), checked by verify exactly like LXX and TAGNT rows (PLAN §18 check 8: the shown form must equal the token at the row after NFC).
- **The build emits:**
  - `public/data/connections.json` (Between: byte-identical to today until new Between connections are approved)
  - `connections-within-ot.json` and `connections-within-nt.json`
  - per-section thread lists for the reader, built from all three sets at build time

### 5.2 Reader: two columns

- The Threads list at the foot of a page splits into **Old Testament** and **New Testament** columns, each headed and each a list.
- A thread goes in the column of its **other end**: from Genesis 22, Hebrews 11 goes right and 2 Chronicles 3 goes left. Within a column, threads are ordered by the other end's place in the canon, so each column reads from first to last. The verse each thread starts from in this section is named on its card, as now.
- **Wide screens:** side by side. **Phones:** the columns stack with their headings, Old first. A small "Jump to New Testament" link sits at the top of the stacked list.
- An empty column says so plainly ("No threads to the Old Testament from this section yet") rather than disappearing, so the layout explains itself.
- **The margin glyph's dialog** groups its cards the same way: two headed groups in one dialog.
- **Without JavaScript** it is the same two lists, as plain HTML. Axe-clean; headings are real headings so screen readers can jump between columns.
- **Reader filtering.** The reader shows all approved threads, all scopes, by default; depth is the point. Whether it also obeys the Vault's toggles is an open question (§9).
- **This part can ship first,** with today's data: Old Testament sections fill the right-hand column, Luke and Acts fill the left-hand one.

### 5.3 Vault: the scope toggles

- With Threads on, a second row of chips appears beside the type filter: **Between · Within the Old · Within the New**. Between is on by default, so the Vault looks exactly as it does now. Each chip toggles independently and is remembered for the session with the rest of the Threads state (`camera`).
- A chip whose scope has no approved connections yet is hidden, so no dead control ships.
- **Telling the scopes apart.** Arcs keep the gold of Between. Within the Old and Within the New get distinct treatments drawn from the design tokens (for example a paler line, and a dashed or differently bowed line), never colour alone. Inside-Testament arcs join books close together on the spiral, so they bow outward, away from the oculus, to stay readable over the Between arcs.
- **With the Testament switch.** Turning off a Testament hides its books, and a thread shows only when both of its ends are shown (as now). So with the New Testament hidden and Within the Old on, the map shows only Old ↔ Old threads: a useful view rather than an empty one. Each combination gets an e2e check.
- **Accessibility.** The arc list (`thread-list`) gains the scope as a heading level, and the chips are toggle buttons with `aria-pressed`.

### 5.4 Performance and limits

Measure first: book pairs per scope, arcs with all three on, the heaviest section's thread count and HTML size. Then set the arc-drawing method (DOM or canvas) and any per-verse cap from those numbers, not guesses.

## 6. Bible versions and numbering

**Every connection is stored, anchored and displayed in WEBC's English numbering, as now; other versions are used as evidence or reading aids at their own numbering, and lined up through TVTMS.**

| Text                             | Numbering                                                                                                                                                                                        | Role in the expansion                                                                                                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WEBC                             | English                                                                                                                                                                                          | Ends (`from`/`to`), anchors, excerpts, `verse` citations. It is the only text shown.                                                                                                                                      |
| OpenBible cross-references       | English                                                                                                                                                                                          | Matches WEBC directly                                                                                                                                                                                                     |
| TAHOT                            | English, with the Hebrew in brackets (`Gen.31.55(32.1)`)                                                                                                                                         | Lines up with WEBC; evidence keeps the dataset's own reference                                                                                                                                                            |
| TAGNT                            | English, with a few known differences (for example 3 John 14–15, Revelation 12:18)                                                                                                               | Checked through TVTMS where they occur                                                                                                                                                                                    |
| Septuagint (Swete)               | Its own: the Kingdoms books, a different order for Jeremiah 25–51, Psalms numbered one lower over most of the Psalter, Sirach 30–36 in a different order, and the additions to Esther and Daniel | Evidence at its own reference, mapped with TVTMS. `terms:lookup` already tries the Hebrew number too. Every Old ↔ Old Septuagint citation is checked through TVTMS before it is written.                                  |
| Clementine Vulgate, Douay-Rheims | Psalms one lower over most of the Psalter (the Greek numbering), and other differences TVTMS records                                                                                             | Not used as evidence. Check 7 already stops explanations reproducing Douay-Rheims wording. If a Douay-Rheims reading toggle ships later, thread anchors stay in WEBC numbering and are mapped through TVTMS, with a test. |
| KJV, Brenton                     | English; Brenton follows the Septuagint                                                                                                                                                          | Reading aids while drafting, never evidence. **Extend check 7** to scan KJV and Brenton as well, since writers will now read them closely.                                                                                |
| The plan's references            | Catholic, Hebrew-based (NABRE)                                                                                                                                                                   | Used only for placing an end in a section, as now (`sectionFor`)                                                                                                                                                          |

Two cases to watch:

- **Esther and Daniel** are mapped by content (`structure-maps.json`). An Old ↔ Old link into a Greek addition must use WEBC's place for it and cite the Septuagint, since TAHOT has no Hebrew there.
- **Psalms** will carry many Old ↔ Old links. Its Hebrew/Greek/Latin numbering offset is the most likely source of a wrong reference, so verify checks each Psalm end against TVTMS.

## 7. Milestones

| #   | Milestone                 | Scope                                                                                                                                                                                                                                                                                                                                      | Acceptance                                                                                                               |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| TX0 | Lock the baseline         | Fingerprint-pin test for the 170; the scope computed in the build; the within files and their emitted outputs wired in, empty; a test that `public/data/connections.json` is byte-identical                                                                                                                                                | All current tests green; output unchanged; `content:check` passes                                                        |
| TX1 | Sources                   | The owner approves the §4 additions; pin them in `sources/manifest.json` with checksums and credit them on `/sources`; the openbible host allowed in the cloud environment, or the fetch run locally                                                                                                                                       | Every new id credited on `/sources` (the existing e2e test covers this); licences recorded                               |
| TX2 | Tools                     | `connections:propose --scope`, the Hebrew (TAHOT ↔ TAHOT) and New Testament (TAGNT ↔ TAGNT) shared-word signals, TIPNR names, a parallel-block detector (long matching runs verse by verse, for Kings/Chronicles and Gospel parallels), `connections:echo` / `draft` for Hebrew, TAHOT rows in verify; sizing report of the pool per scope | Unit tests on fixture excerpts (as `tests/fixtures/terms/`); a sizing report in `docs/connections/expansion-sizing.md`   |
| TX3 | Reader columns            | Two-column Threads list and grouped dialog, with current data; phone stacking; no-JS lists                                                                                                                                                                                                                                                 | Axe clean at 390×844 and 1440×900; e2e follows a thread from each column; page-size check                                |
| TX4 | Vault scope toggles       | Chips in `ThreadsMode` (hidden while a scope is empty), arc styles per scope, the interaction with the Testament switch, canvas arcs if the sizing says so                                                                                                                                                                                 | First load still under 150 KB; under 300 nodes; 60 fps with all scopes on; e2e for each toggle and Testament combination |
| TX5 | Within the Old: proposals | Path books in path order, one book per PR (Gen, Job, Exod, … 1 Macc), candidates → write-ups → verify → approval                                                                                                                                                                                                                           | Approved connections only on the site; each cites its rows; typology cites a Father                                      |
| TX6 | Within the New: proposals | Luke, John 11 and Acts, against the whole New Testament                                                                                                                                                                                                                                                                                    | Same as TX5                                                                                                              |
| TX7 | Stage B (optional)        | Library ↔ library pairs, Old and New                                                                                                                                                                                                                                                                                                       | Same as TX5, plus the performance checks repeated at the larger size                                                     |
| TX8 | QA                        | The full sweep (qa, threads, vault-threads, perf) with every scope on, on Firefox, WebKit and the iPhone profile in CI                                                                                                                                                                                                                     | All green; `docs/qa-checklist.md` gains the new steps                                                                    |

TX3 and TX4 can be built before any new content exists. TX5 and TX6 can run in parallel once TX2 lands.

## 8. Rough size

These are guesses until TX2's sizing report.

- Between took 23 path books to reach 170 connections after curation.
- Within the Old should yield more candidates per book than Between: the cross-references are dense inside the Old Testament, and Kings ↔ Chronicles alone yields dozens of parallel pairs.
- Within the New, Stage A is small (three path books), but Luke alone has many Gospel parallels.
- A first pass of **150–300 Within the Old** and **60–120 Within the New** connections is a realistic target, reviewed a book at a time like the first set.

## 9. Decisions for the owner

1. **Column rule.** Old Testament / New Testament columns by the other end's Testament (as proposed), or "earlier / later" by canon order? With Old ↔ Old threads the two differ: Chronicles is later than Kings but still Old Testament.
2. **Reader filtering.** Should the reader always show every scope (proposed), or follow the Vault's Threads toggles?
3. **Stage B.** Include library ↔ library pairs, and when?
4. **New sources.** Approve the additions in §4: the remaining Septuagint books, TIPNR, the Fathers' volumes, possibly the Eusebian Canons, and the Hebrew and Greek fonts.
5. **A _retelling_ type.** Add it, or keep the seven types?
6. **Scope styling.** How Within the Old and Within the New look on the ceiling (proposed: pale and dashed variants of the gold, never colour alone).
7. **Default.** Between only (proposed), or all scopes on?
