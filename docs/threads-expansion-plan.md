# Threads expansion plan

_Drafted 2026-11-17 at the owner's request; refined 2026-11-19 (owner: build the threads' functionality out to a high density of value first, then the connections inside each Testament). A plan only: nothing here is built yet. It extends PLAN §14 (Phase 4) and follows every rule in PLAN §1 and §18. It is the groundwork for the later, separate Religion Expansion (`docs/religion-expansion-plan.md`), so everything below is designed to hold more than two corpora._

## 1. What this adds

**First, make each thread worth opening: a card that says at a glance which text uses which and how, opens to the full explanation, and leads straight to both readings. Then add threads inside each Testament, chosen by corpus pair.**

The expansion now has two parts, built in this order.

**Part A: function and density (TD1–TD6).** This uses today's 170 connections; no new content is needed.

1. **The card.** Every thread, wherever it appears (the Vault's arc panel, the reader's dialog, the reader's list), is shown by one shared card with:
   - a **direction line** showing which passage came first and which uses it;
   - a **one-sentence summary**;
   - an **arrow that opens** the full explanation, the shared words and the sources;
   - **links to both readings** at the foot.

   Today the arc panel shows only the type, the label and the two references (see the "Up to half my kingdom" card). The reader shows everything at once, with no direction.

2. **Wording that says who uses whom.** Every explanation opens with one sentence of a fixed shape: "_Mark 6:22–23 echoes Esther 5:3: …_". It names the later passage, the verb of the relation and the earlier passage, then says what is taken. That sentence is the card's summary. A build check enforces the shape.
3. **Direction as data.** Each thread knows which end is older and whether a use is claimed, so the card, the reader's columns and the arcs can all show it.
4. **Many threads, little noise.** The arc panel is a list of closed cards, grouped and counted by type, strongest first. Only one card is open at a time.
5. **A book's threads at a tap.** With Threads on, the first tap on a book opens the panel of all its threads (what it draws on, and what draws on it). A second tap goes into the book.
6. **Filters by corpus pair.** Today the pairs are Old ↔ New, Old ↔ Old and New ↔ New. Each book is tagged with a corpus, and the filter chips come from the pairs present in the approved data. A new corpus (the Religion Expansion's Tanakh or Quran, for example) then needs no new control code.

**Part B: content inside each Testament (TX1–TX8, as planned on 2026-11-17).**

- **Within the Old Testament:** Samuel–Kings retold in Chronicles, the Law cited by the prophets, the Exodus sung in the Psalms, Joshua crossing the Jordan as Moses crossed the sea.
- **Within the New Testament:** the same event in two Gospels, Paul's letters beside Acts, a saying of Jesus repeated in a letter.

They are written to the new card's wording rule from the start.

Today 168 of the 170 connections run Old ↔ New. Two run New ↔ New (Galatians ↔ Acts) and none run Old ↔ Old, which is why turning off either Testament in the Vault leaves almost no threads. This was not a fault: the candidate tools looked for the New Testament's use of the Old.

## 2. The card (Part A)

### 2.1 What a closed card shows

**A closed card is five short lines: kind, title, direction, summary, and the way to read more or to go there.**

```
QUOTATION · named or quoted                                  ▾
Up to half my kingdom
Esther 5:3  ── echoed in ──▸  Mark 6:22–23
Mark 6:22–23 echoes Esther 5:3: Herod's oath to the dancing girl repeats the king's
promise to Esther.
Read Esther 5:3 · Read Mark 6:22–23
```

_(The wording above shows the shape only. Real summaries are written and approved per thread, §3.)_

| Line      | Content                                                                                                                                                                                                  | Notes                                                                                                                                                                                                                                     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kind      | Type and strength, in small caps, and the open/close arrow (`▾` / `▴`) at the right                                                                                                                      | The arrow is a real `button` with `aria-expanded` and `aria-controls`. The whole head row is its hit area (at least 44 px tall).                                                                                                          |
| Title     | The connection's `label`                                                                                                                                                                                 | A heading, at the level of the place it sits in                                                                                                                                                                                           |
| Direction | The older end on the left, an arrow pointing to the end that uses it, and the relation's verb on the arrow (§2.3). A badge follows when the dating is disputed.                                          | A line only, never colour alone: solid for a claimed use, dotted for "earlier · later" with no use claimed, and a plain "↔" with "order uncertain" when the order isn't known. On phones the arrow turns down between the two references. |
| Summary   | The explanation's first sentence (§3), at most 200 characters                                                                                                                                            | Computed from `explanation`, never stored twice, so the approval fingerprint is unchanged                                                                                                                                                 |
| Links     | "Read <older>" · "Read <later>", each a `threadHref` link (with `?thread=`, so the page it opens shows the "Back to …" pill). In the reader, the end on the current page is a "here" anchor, not a link. | At the foot, so the eye reads what the thread is before deciding to go                                                                                                                                                                    |

### 2.2 What an open card adds

- The rest of the explanation (sentences 2–4).
- Both passages' opening words, from the built text (the `excerpt`s the build already writes). They sit side by side on wide screens, older first, and stack on phones.
- **Shared words:** Greek today (Septuagint and TAGNT, at their rows), and Hebrew once Part B adds TAHOT.
- **Basis:** how the direction is known (§2.3), and the dating note when it is disputed.
- **Sources** as now: cross-reference rows, the WEBC words checked at a verse, and the Father with work, locator and edition.
- **"More from here":** "3 more threads from Mark 6:22", counted at build time, leads to that verse's threads in its reader. It points the way along a chain of threads without opening a second panel.

### 2.3 Direction

**Every thread has an order: which text is older, and whether the later one is said to use it. The card shows both, and never claims a use the evidence doesn't support.**

There are two separate questions:

- **Chronology:** which passage was written first.
- **Dependence:** whether the later passage uses the earlier one (quotes it, alludes to it, retells it), or whether a Father reads one as a figure of the other.

A parallel account can have a clear chronology and no claimed use: Galatians and Acts tell the same events independently. Keeping the two questions apart matters even more in the Religion Expansion, where "earlier and later" is a fact about dates but "uses" can be a claim one tradition rejects.

**Data.** A new optional field on a connection:

```ts
order?: {
  older: 'from' | 'to' | 'unknown'; // chronology of composition
  uses: boolean; // the later end is said to use the older one
  basis: 'canon' | 'text' | 'consensus' | 'father' | 'disputed';
  note?: string; // one sentence, original prose, shown when basis is 'disputed'
  sources?: Citation[]; // required for 'consensus', 'father' and 'disputed'
};
```

- **The basis values:**
  - `canon`: one end is in the Old Testament and the other in the New, so the Old is older. This is never in doubt for the 170 threads, deuterocanonical books included.
  - `text`: the later passage names or introduces the earlier one ("as it is written in the prophet Isaiah"); a `verse` citation backs it.
  - `consensus`: scholarly agreement, such as Chronicles written after Kings and drawing on it, cited.
  - `father`: typology, where the direction is the Father's reading of a figure and its fulfilment.
  - `disputed`: the order of composition is argued (§2.6), and the note names the main positions in one sentence.
- **Default, so the 170 threads keep their approvals.** When `order` is absent the build computes it:
  - Old ↔ New threads get `older` = the Old Testament end and `basis: canon`. `uses` comes from the type: true for quotation, allusion, echo, fulfilment and contrast; false for typology, where the Father's reading is the claim (so `basis` is `father`); false for parallel.
  - The fingerprint function appends `order` only when it is present, so no existing fingerprint changes. A unit test pins this.
- **Required where it can't be computed:** inside a Testament, and for every parallel. For example, `s19` Stephen retelling Genesis–Kings is a use (`uses: true`). `act12`/`act13` Galatians and Acts are two accounts with no claimed use (`uses: false`), and their chronology is cited.

**The verb on the arrow** comes from the type and the direction:

| Type       | Use claimed (solid arrow)                     | No use claimed                         |
| ---------- | --------------------------------------------- | -------------------------------------- |
| quotation  | quoted in                                     | (does not occur)                       |
| allusion   | alluded to in                                 | (does not occur)                       |
| echo       | echoed in                                     | (does not occur)                       |
| fulfilment | fulfilled in (the later text's own claim)     | (does not occur)                       |
| contrast   | reversed in                                   | set against                            |
| parallel   | retold in                                     | told also in (dotted: earlier · later) |
| typology   | read as a figure of (named Father, on "More") | read as a figure of                    |
| retelling  | retold in (if the owner adds the type, §10)   | (does not occur)                       |

### 2.4 Many threads: the arc panel

**The panel answers "what joins these two books?" in a glance, and lets the reader open one thread at a time.**

- **Head:** "Exodus ↔ Luke · 8 threads", a direction summary ("Luke draws on Exodus in all 8") and chips counting each type ("Quotation 3 · Allusion 3 · Typology 2"). The chips filter the list inside the panel.
- **Order:** strongest first, then by the later end's place in its book, so the list reads through the later book.
- **One card open at a time** (an accordion). Opening a card scrolls it to the top of the panel. An arc with one thread opens with that card closed: its summary is already the answer.
- **Phones:** the panel is a bottom sheet at 60% of the screen, dragged or tapped to full height. Its close button and Esc work as now. Esc closes an open card first, then the panel (the same one-level-at-a-time rule as Themes).
- **Size:** today's largest arc holds 8 threads (Exodus ↔ Luke). The heaviest sections hold 10 (Luke 1 "Two Annunciations", Hebrews 4). With Part B an arc may hold 30 or more. The panel then shows the first 12 and a "Show all 34" button, never a virtual list.

### 2.5 A book's threads: first tap shows them, second tap opens the book

**With Threads on, tapping a book on the ceiling first opens the panel of all its threads. Tapping the same book again (or "Open <book>" in the panel) goes into the book, as a single tap does today (owner, 2026-11-19).**

- **First tap:**
  - The book's arcs stay lit and every other arc dims.
  - The medallion is ringed.
  - The **book panel** opens in the same place as the arc panel (a bottom sheet on phones).
- **What the book panel shows:**
  - Head: "Luke · 64 threads", with type chips and pair chips counting what follows.
  - Two groups: **Draws on** (older books it uses: "Exodus 8 · Genesis 6 · Psalms 5 …") and **Drawn on by** (later books that use it). Threads with no use claimed go in a third group, **Alongside**.
  - Each partner book is a row, strongest pair first. A row expands to that pair's closed cards (§2.1), so you can read every thread of a book without leaving the panel. Opening a card works as in the arc panel.
  - At the head, **"Open Luke →"**, the same link as the medallion, for keyboard and screen-reader users and for anyone who doesn't think to tap twice.
- **Second tap** on the same medallion while its panel is open goes into the book with the usual flight (Vault → book, `lib/transition.ts`). A tap on another book switches the panel to that book. Esc closes an open card, then the panel; a tap on the empty sky closes the panel.
- **Following the filters:** the panel counts only threads whose pair and type are on and whose other end's Testament is shown.
- **A book with no threads under the current filters** goes straight in on the first tap, since its panel would be empty. Its medallion is drawn dimmed in Threads mode, so the difference is visible before the tap.
- **Threads off:** nothing changes; one tap opens the book.
- **Every book counts:** path books, John 11 and the library's off-path medallions alike (Part B adds library ends, and Stage B library pairs).
- **Without JavaScript, and in the list:**
  - The medallion stays a real link to `/book/<id>`; the first-tap behaviour is added by script, so middle-click and "open in new tab" still open the book.
  - In the accessible list (`thread-list`), each book has a button that opens its panel. The link to the book sits beside it.
- **Implementation note:** the click is caught on the medallion links (`a[data-book]`) only while Threads mode is mounted, inside the lazily loaded `ThreadsMode` chunk, so the Vault's first load is unchanged. The panel's data is grouped from `connections.json` already in memory.
- **Tests (e2e):**
  - In Threads mode, the first tap opens `book-panel` and the URL stays `/`; the second tap lands on `/book/<id>`.
  - "Open <book>" does the same.
  - A book with no threads goes straight in.
  - With Threads off, one tap opens the book.
  - Axe is clean with the panel open.

### 2.6 Dating and disputed order

**Where scholars argue about the order of composition, the site says so in one sentence and cites the positions. It does not pick a winner.**

- **Not disputed:** Old ↔ New, the 170 threads.
- **Disputed (Part B):** the Synoptic Gospels.
  - Most modern scholars hold that Mark was written first.
  - Augustine (_The Harmony of the Gospels_, pinned in TX1) held the canonical order, Matthew first.
  - The Pontifical Biblical Commission's responses of 1911–1912 also favoured Matthew first; a 1955 clarification from the Commission left scholars free on such questions.
  - Gospel parallels therefore get `uses: false`, a dotted arrow, `basis: disputed` and a note naming both views, unless the owner decides otherwise (§10).
- **Disputed (Part B):** some Old Testament pairs:
  - Isaiah 2 and Micah 4;
  - the dating of Job, of Daniel, and of the parts of Isaiah;
  - psalms against the histories they recall.
- **Citations.** Dating claims need citations. A Father or a public-domain reference work can be pinned and checked like the other sources. Modern scholarship is usually not openly licensed, so it can only be cited by bibliography (author, title, year, page), not copied, and such a citation can't be machine-checked. This is the "risk on scholars' interpretation" the owner accepted on 2026-11-19. Each such citation is marked `bibliographic` in the review documents, so the owner sees exactly which claims rest on a reference the verify step can't check.

## 3. Wording rule (Part A)

**Every explanation says, in its first sentence, which passage uses which and how. The rest says what is shared and what the later text does with it, and nothing more.**

**Sentence 1, the summary:**

- Shape: `<later ref> <verb> <older ref>: <what is taken, in plain words>.`
- With no use claimed: `<ref> and <ref> <relation>: …`, for example "Galatians 1:13–17 and Acts 9:1–22 tell Paul's call twice: …".
- At most 200 characters.
- The references are written exactly as the card displays them.

**Sentences 2–4:**

- What is shared: the words (the Greek or Hebrew is shown below the text, never typed in it), the structure, or the event.
- What the later text does with it: repeats, reverses, applies to Jesus, sets in a new place.
- The basis, if it isn't obvious: "Augustine reads…".
- No teaching, no doctrine, no application to the reader (owner, 2026-11-17).

**Check 14** is new, in `scripts/connections/schema.ts` and `emit-connections.ts`. The first sentence must:

- contain both ends' display references, in the order the direction gives;
- contain a verb from that type's list (§2.3);
- end within 200 characters.

The existing checks still apply: check 7 (no reproduced scripture, extended to KJV and Brenton) and the two-to-four sentence count.

**The 170 existing explanations** are rewritten to this rule (TD2). Most need only a new first sentence, with the current first sentence moved into the second place or merged with it:

- `dan07` now opens "The one like a son of man is given a kingdom…". It would open "Luke 1:33 echoes Daniel 7:14: Gabriel promises Mary's son the endless kingdom Daniel saw given to the son of man." (Shape only; the real wording goes through approval.)
- A rewrite changes the fingerprint. The new wording is drafted in one batch, reviewed in `docs/connections/rewording.md` (old and new side by side), and approved and re-fingerprinted in the same PR. The site therefore never shows a thread without its approval, and never goes without one.

## 4. Information density elsewhere (Part A)

| Where              | What changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vault: arcs        | Arcs stay plain lines; direction is read on the cards in the arc and book panels (owner, 2026-11-19). A band tapering toward the later book was built first (TD5) and cost 20–33% of the camera's frames on the throttled phone against a 5% limit; the midpoint chevrons that replaced it were then taken off as too much.                                                                                                                                                                                                                                                                                       |
| Vault: book panel  | With Threads on, the first tap on a book opens its panel of every thread, and a second tap goes into the book (§2.5).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Vault: hover/focus | An arc's tooltip (pointer) or the list (keyboard) names the pair and count: "Exodus → Luke · 8".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Reader: margin     | The thread glyph shows a count when a verse has more than one thread (a small numeral, `oldstyle-nums`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Reader: dialog     | The same closed cards, grouped by direction ("Draws on" first, then "Taken up in"), one open at a time.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Reader: page list  | Two columns by **direction**, not Testament: **Draws on** (the other end is older and is used here) and **Taken up in** (the other end uses this passage). A third group, **Alongside**, holds threads with no use claimed. Each card still names its other end's book and corpus. This replaces the earlier proposal of Old / New columns: with direction stored, the columns say what a reader actually wants to follow (back to sources, or on to echoes), and stay correct for Old ↔ Old and for any future corpus. On phones the groups stack with headings and a jump link. An empty group says so plainly. |
| Search             | Thread results show the direction line under their label.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

## 5. Corpora and pair filters (Part A)

**Each book belongs to a corpus. A thread's pair is the two corpora of its ends. The Vault's chips are the pairs that occur in approved data.**

- **Corpora today:** `ot` (the Old Testament, deuterocanonical books included) and `nt`. The corpus is computed from the manifest's `testament`, never stored on a connection, so no fingerprint changes.
- **Pairs today:** Old ↔ New ("Between", on by default), Old ↔ Old and New ↔ New. A pair with no approved threads has no chip, so the Vault looks exactly as it does now until Part B lands.
- **A separate row.** In Threads mode the pair chips are their own row, beside the type chips. Each is a toggle button (`aria-pressed`), remembered for the session in `camera`.
- **Interplay with the Testament switch:** a thread shows only when both of its ends are shown and its pair is on. With the New Testament hidden and Old ↔ Old on, the map shows Old ↔ Old threads only. Each combination gets an e2e check.
- **Corpus-agnostic by design.** The corpus list, its names and the pair labels live in one table (`lib/corpora.ts`), as `lib/translations.ts` does for Bibles. The Religion Expansion adds a corpus by adding a row and its data (for example Tanakh or Quran), and the chips "Quran ↔ Torah", "Torah ↔ New" and so on then appear without new control code. Each pair's arcs get a distinct line treatment from the design tokens, never colour alone.

## 6. Protecting what exists

**The expansion is additive: the 170 approved connections, the Vault's default look, its first-load budget and every current test stay as they are. The one deliberate exception is the TD2 rewording, approved in the same PR.**

| Risk                                                                    | Protection                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Approved connections change by accident                                 | New connections go in **new files**: `content/connections/within-ot.json` and `within-nt.json`. A unit test pins the count and the approval fingerprints of the verified set. TD2 updates that pin deliberately, with the owner's approval recorded in the same commit.                                                                                          |
| A new field changes old fingerprints                                    | `order` joins the fingerprint only when present (§2.3); a test checks that the 170 fingerprints are unchanged by TD1.                                                                                                                                                                                                                                            |
| A new kind of link slips onto the site unreviewed                       | Same rule as now: `draft` until the owner approves, and an approval fingerprint covering ends, type, strength, wording, order, evidence and citations. Any edit hides the connection again (PLAN §18 check 13).                                                                                                                                                  |
| The Vault's first load grows past its 160 KB budget (it is at 150.0 KB) | The card, panel, pair chips and book panel live inside the lazily loaded `ThreadsMode` chunk; the reader's card is in the reader bundle. `Vault.tsx` keeps only the existing Threads button. The perf test already checks this budget.                                                                                                                           |
| The Vault downloads more data before anyone asks                        | `public/data/connections.json` keeps the Old ↔ New set (with `order` and the "more from here" counts added). The within sets are emitted as `connections-within-ot.json` and `connections-within-nt.json`, fetched only when their pair chip is first switched on.                                                                                               |
| Too many nodes on the ceiling (limit: 300)                              | Today 93 arcs carry 170 connections, one `path` per pair of books. With all pairs on, the number of book pairs could pass the limit. Before content lands, measure the arc count with every pair on. If it would pass about 200, draw the arcs on one canvas, as the theme star field already does, and keep the DOM for the accessible list and the tap target. |
| Frame rate                                                              | `perf.spec.ts` gains a camera move with every pair on, held to the same 60 fps rule; the tapered arcs are measured in TD5 before they ship.                                                                                                                                                                                                                      |
| Reader pages get heavy                                                  | Thread lists are rendered into each page's HTML; closed cards are lighter than today's full ones. A test keeps the HTML of the heaviest section (likely Luke 1 or Hebrews 4) under an agreed size.                                                                                                                                                               |
| Search changes                                                          | Search's extra results read `connections.json`. They gain the within files only behind the same rule: approved only, and loaded only on `/search`.                                                                                                                                                                                                               |

Nothing in the expansion needs a new npm dependency.

## 7. Method for new connections (Part B): the same as Phase 4

**Every new connection is found in the data, checked against pinned sources, written up in original prose to the wording rule (§3), and approved by the owner, exactly as P4.4 did for the first 170.**

**The site is the Bible as a data set, not a commentary (owner, 2026-11-17).** Whether two passages are connected is itself a judgement, so a Church Father may be cited as support that a connection exists, as the typology threads already do. The Fathers are never used to add teaching: no doctrine, no account of what a passage requires of the reader, and no reading layer of their writings. A thread's explanation says what the texts and the data show about the link, and stops there.

The pipeline per book, unchanged in shape:

1. **Candidates.** Run `pnpm connections:propose <bookId> --pair ot-ot|nt-nt`. It writes `docs/connections/<bookId>-<pair>-candidates.md`: cross-reference rows grouped by the two sections they join, ranked by votes, each with what the data shows.
2. **Only pairs the data supports are written up:**
   - a quotation or a long shared run of words;
   - a named reference;
   - an uncommon shared word in the original language;
   - a parallel account;
   - typology only where a Church Father makes the reading, cited to a pinned volume.
3. **Write-up.** Type, strength, `order` (with its basis and sources), a 2–4 sentence original explanation that opens with the summary sentence, and citations. Original-language evidence comes from `pnpm connections:draft` / `connections:echo` output and is never typed (PLAN §1 rules 2 and 3).
4. **Verify.** `pnpm connections:verify` checks every row, token and phrase against `sources/raw`, plus check 14. It writes the review document `docs/connections/<bookId>-<pair>-connections.md`, listing bibliographic citations separately.
5. **Approval.** The owner approves, then `--approve`. One book per PR, in path order.

**Ids.** The book prefix stays, with the pair marked: `kgs1-o01` (Old ↔ Old), `luke-n01` (New ↔ New). The id pattern already allows hyphens.

**Types.** The seven current types cover both new pairs:

- _parallel_: Kings ↔ Chronicles, Luke ↔ Mark;
- _quotation_: a psalm quoting the Law; 1 Timothy 5:18 quoting Luke 10:7;
- _allusion_, _echo_, _typology_, _fulfilment_, _contrast_.

One possible addition is _retelling_, for passages that retell the whole story (Nehemiah 9, Psalm 78, Psalm 105, Stephen's speech, which is filed as _parallel_ today). This is the owner's call (§10); without a decision, keep the seven.

**Strength.** Unchanged: 3 = quoted or named, 2 = strong, 1 = proposed.

**Scope of the first pass (Stage A).** As now, at least one end must be in a **path** section; the other end may be anywhere, library included. **Stage B** (optional, later) opens library ↔ library pairs, such as Matthew ↔ Mark or Isaiah ↔ Jeremiah, for full depth.

## 8. Sources

**Most of what Part B needs is already pinned. A few additions need the owner's approval and a licence check before first use (PLAN §1 rule 5), and every addition is credited on `/sources`. Part A needs no new source.**

### Already pinned and usable as is

| Source                                                                                                                          | Use in the expansion                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenBible.info cross-references (CC BY 4.0, mostly the Treasury of Scripture Knowledge)                                         | The candidate pool for both new pairs. It covers Old ↔ Old and New ↔ New as densely as it covers Between.                                                                                                     |
| WEBC (public domain)                                                                                                            | Display text, excerpts, the shared-run signal, `verse` citations                                                                                                                                              |
| STEPBible TAHOT (CC BY 4.0)                                                                                                     | **New signal:** uncommon Hebrew/Aramaic lemmas two Old Testament passages share, by extended Strong's number, with token rows as evidence. This is the Old ↔ Old counterpart of the Septuagint ↔ TAGNT check. |
| STEPBible TAGNT (CC BY 4.0)                                                                                                     | **New signal:** uncommon Greek lemmas two New Testament passages share (TAGNT ↔ TAGNT)                                                                                                                        |
| STEPBible TBESH / TBESG lexicons                                                                                                | Rarity counts and glosses for the review documents (not shown as claims)                                                                                                                                      |
| Swete's Septuagint (CC BY-SA 4.0)                                                                                               | Old ↔ Old for the books with no Hebrew in TAHOT (Tobit, Judith, 1 Maccabees, the Greek parts of Esther and Daniel)                                                                                            |
| STEPBible TVTMS                                                                                                                 | Lining up verse numbers across Hebrew, Greek, Latin and English (§9)                                                                                                                                          |
| CCEL Fathers already pinned: Augustine on John; Chrysostom on Matthew, Acts and Romans, Corinthians; Tertullian against Marcion | Typology and New ↔ New readings, where they apply                                                                                                                                                             |

### To add, each needing the owner's approval

| Source                                                                                                                        | Why                                                                                                                                                                                                                      | Notes                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| **Swete's Septuagint for the rest of the Old Testament** (same TEI transcription and licence as now)                          | Only the path books' Septuagint files are pinned. Old ↔ Old links into Psalms, Isaiah, the other prophets, Wisdom, Sirach, Baruch and 2 Maccabees need the rest, and the deuterocanonical books have no Hebrew in TAHOT. | Same pipeline (`terms` in `sources/manifest.json`), more files                                                      |
| **STEPBible TIPNR** (proper names, CC BY 4.0; already listed in PLAN §3 for phase 4+)                                         | A better "shared names" signal: the same person or place by its TIPNR id, not just by spelling. The Religion Expansion reuses it for figures the Quran names.                                                            | New reader in `scripts/terms/`                                                                                      |
| **Augustine, _The Harmony of the Gospels_** (NPNF1-06, CCEL, public domain)                                                   | The classic patristic source for New ↔ New Gospel parallels, and one side of the Synoptic dating note (§2.6)                                                                                                             | Same `father` citation kind                                                                                         |
| **Augustine, _City of God_** (NPNF1-02, CCEL) and a volume of **Jerome** or **Ambrose** on the Old Testament (NPNF2 series)   | Fathers who read Old Testament figures as figures of each other, needed before any Old ↔ Old _typology_ goes up (check 12)                                                                                               | Choose volumes when the first typology candidates appear                                                            |
| **A public-domain Bible reference work for dating** (for example the _Catholic Encyclopedia_, 1907–1914, or the _ISBE_, 1915) | A checkable citation for `consensus` and `disputed` order notes, beside bibliographic citations of modern work (§2.6)                                                                                                    | Old: the order note says what the work held and when, never that it is the current view                             |
| **The Eusebian Canons** (4th-century Gospel parallel tables; the text itself is public domain)                                | An ancient, independent check on which Gospel passages are parallels                                                                                                                                                     | Only if a digital edition with a clear open licence is found. Otherwise rely on Augustine and the cross-references. |
| **A Hebrew font** (Ezra SIL or Taamey Frank CLM, OFL; listed in PLAN §3) and **Gentium Plus** for polytonic Greek             | Cards would show "Shared Hebrew" for the first time, and Greek has no dedicated font yet (the site self-hosts only EB Garamond and Cormorant Garamond)                                                                   | `pnpm fonts` pipeline. Hebrew is right-to-left and needs `dir="rtl"`.                                               |

**Approved and pinned (owner, 2026-11-19; TX1).** All the additions above were approved. Pinned now:

- The rest of Swete's Septuagint: 30 more books (text and Morpheus analysis), so every book in the transcription's list is pinned. Ecclesiastes is not in that list and has no Greek here.
- STEPBible TIPNR, at the same commit as TAHOT.
- Augustine, _The Harmony of the Gospels_ (NPNF1-06) and _The City of God_ (NPNF1-02), from CCEL.

Pinned when first needed, so nothing unused ships:

- The Jerome or Ambrose volume: with the first Old ↔ Old typology candidate.
- The public-domain dating reference: with the first `consensus` or `disputed` order that needs a checkable citation.
- The Eusebian Canons: only if an openly licensed edition turns up.
- The Hebrew and Greek fonts: with the first card that shows Hebrew (TX2's evidence).

**Network.** On 2026-11-17 the cross-references' download host (`a.openbible.info`) was blocked in the cloud environment, so `pnpm connections:fetch` failed there. Before TX1, check the host again, then add it to that environment's allowed list or run the fetch steps locally.

## 9. Bible versions and numbering

**Every connection is stored, anchored and displayed in WEBC's English numbering, as now. Other versions are used as evidence or reading aids at their own numbering, lined up through TVTMS.**

| Text                              | Numbering                                                                                                                                                                                        | Role in the expansion                                                                                                                                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WEBC                              | English                                                                                                                                                                                          | Ends (`from`/`to`), anchors, excerpts, `verse` citations, the summary sentence's references. It is the only text the card shows.                                                                                                                  |
| OpenBible cross-references        | English                                                                                                                                                                                          | Matches WEBC directly                                                                                                                                                                                                                             |
| TAHOT                             | English, with the Hebrew in brackets (`Gen.31.55(32.1)`)                                                                                                                                         | Lines up with WEBC; evidence keeps the dataset's own reference                                                                                                                                                                                    |
| TAGNT                             | English, with a few known differences (for example 3 John 14–15, Revelation 12:18)                                                                                                               | Checked through TVTMS where they occur                                                                                                                                                                                                            |
| Septuagint (Swete)                | Its own: the Kingdoms books, a different order for Jeremiah 25–51, Psalms numbered one lower over most of the Psalter, Sirach 30–36 in a different order, and the additions to Esther and Daniel | Evidence at its own reference, mapped with TVTMS. `terms:lookup` already tries the Hebrew number too. Every Old ↔ Old Septuagint citation is checked through TVTMS before it is written.                                                          |
| Douay-Rheims (the reading toggle) | Its own (the Greek numbering in the Psalms, and other differences TVTMS records)                                                                                                                 | Never evidence. With the Douay-Rheims shown, thread anchors stay at their WEBC verse (`v-c-v`), which the Douay-Rheims body keeps (Phase 7). The card's references stay WEBC, with the Douay-Rheims reference added in brackets where it differs. |
| KJV, Brenton                      | English; Brenton follows the Septuagint                                                                                                                                                          | Reading aids while drafting, never evidence. **Extend check 7** to scan KJV and Brenton as well, since writers will now read them closely.                                                                                                        |
| The plan's references             | Catholic, Hebrew-based (NABRE)                                                                                                                                                                   | Used only for placing an end in a section, as now (`sectionFor`)                                                                                                                                                                                  |

Two cases to watch:

- **Esther and Daniel** are mapped by content (`structure-maps.json`). An Old ↔ Old link into a Greek addition must use WEBC's place for it and cite the Septuagint, since TAHOT has no Hebrew there.
- **Psalms** will carry many Old ↔ Old links. Its Hebrew/Greek/Latin numbering offset is the most likely source of a wrong reference, so verify checks each Psalm end against TVTMS.

## 10. Milestones

**Part A (function and density) ships first, on today's data. Part B (content) follows, written to Part A's rules.**

| #   | Milestone                       | Scope                                                                                                                                                                                                                                                                                                                                    | Acceptance                                                                                                                                                                                                   |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TD0 | Lock the baseline               | Fingerprint-pin test for the 170; corpus and pair computed in the build (`lib/corpora.ts`); the within files and their emitted outputs wired in, empty; `order` in the schema (optional, fingerprinted only when present) and computed for Old ↔ New                                                                                     | All current tests green; the 170 fingerprints unchanged; `content:check` passes                                                                                                                              |
| TD1 | The card                        | One `ThreadCard` for the arc panel, the reader dialog and the reader list: kind, title, direction line, summary, open arrow, links at the foot; open state with the rest of the explanation, excerpts, shared words, basis, sources, "more from here"                                                                                    | Unit tests for the summary and the verb table; e2e opens an arc, reads the direction line (older end first), opens and closes a card (`aria-expanded`), follows each link; axe clean at 390×844 and 1440×900 |
| TD2 | Rewording                       | The 170 explanations rewritten to §3 in one batch; `docs/connections/rewording.md` (old beside new); check 14; `order` written explicitly for the parallels and typology; the owner's approval and new fingerprints in the same PR                                                                                                       | Check 14 passes for every verified thread; check 7 (with KJV and Brenton) passes; no thread is ever unapproved on `main`                                                                                     |
| TD3 | The panels                      | Panel head with counts, direction summary and type chips; order; one card open at a time; phone bottom sheet; Esc one level at a time; the book panel (§2.5): first tap on a book shows all its threads ("draws on" / "drawn on by" / "alongside"), second tap or "Open <book>" goes in                                                  | e2e for each; under 300 nodes; first load unchanged                                                                                                                                                          |
| TD4 | Reader groups                   | The page list in **Draws on · Taken up in · Alongside**; the dialog grouped the same way; the glyph's count; no-JS lists; page-size check                                                                                                                                                                                                | Axe clean at both sizes; e2e follows a thread from each group; heaviest page under the agreed size                                                                                                           |
| TD5 | Arcs and pair chips             | Tapered arcs by direction; the pair chip row (hidden while only Old ↔ New exists, shown once a second pair has approved threads); interplay with the Testament switch; canvas arcs if the sizing says so                                                                                                                                 | 60 fps on the throttled phone with tapered arcs; e2e for each chip and Testament combination; first load still under 160 KB                                                                                  |
| TD6 | Search and the `/path` timeline | Direction line in thread search results; thread counts in the timeline                                                                                                                                                                                                                                                                   | Unit tests on `extras.ts`; e2e                                                                                                                                                                               |
| TX1 | Sources                         | The owner approves the §8 additions; pin them in `sources/manifest.json` with checksums and credit them on `/sources`; the openbible host checked and allowed, or the fetch run locally                                                                                                                                                  | Every new id credited on `/sources` (the existing e2e test covers this); licences recorded                                                                                                                   |
| TX2 | Tools                           | `connections:propose --pair`, the Hebrew (TAHOT ↔ TAHOT) and New Testament (TAGNT ↔ TAGNT) shared-word signals, TIPNR names, a parallel-block detector (long matching runs verse by verse, for Kings/Chronicles and Gospel parallels), `connections:echo` / `draft` for Hebrew, TAHOT rows in verify; sizing report of the pool per pair | Unit tests on fixture excerpts (as `tests/fixtures/terms/`); a sizing report in `docs/connections/expansion-sizing.md`                                                                                       |
| TX5 | Within the Old: proposals       | Path books in path order, one book per PR (Gen, Job, Exod, … 1 Macc): candidates → write-ups (§3, with `order`) → verify → approval                                                                                                                                                                                                      | Approved connections only on the site; each cites its rows; typology cites a Father; every disputed order cites its positions                                                                                |
| TX6 | Within the New: proposals       | Luke, John 11 and Acts, against the whole New Testament                                                                                                                                                                                                                                                                                  | Same as TX5                                                                                                                                                                                                  |
| TX7 | Stage B (optional)              | Library ↔ library pairs, Old and New                                                                                                                                                                                                                                                                                                     | Same as TX5, plus the performance checks repeated at the larger size                                                                                                                                         |
| TX8 | QA                              | The full sweep (qa, threads, vault-threads, perf) with every pair on, on Firefox, WebKit and the iPhone profile in CI                                                                                                                                                                                                                    | All green; `docs/qa-checklist.md` gains the new steps                                                                                                                                                        |

TD1 can start as soon as TD0 lands. TD2 is content work and can run beside TD3 and TD4. TX1 and TX2 can start any time; TX5 and TX6 wait for TD2's wording rule and TX2's tools, and can run in parallel.

**TX8 done (2026-11-20).** `tests/e2e/threads-qa.spec.ts` sweeps Threads with every pair on (every arc drawn and listed, each pair's busiest arc followed into the reader and back, a library book's panel, the reader's list and dialog, search across every file, storage blocked, reduced motion, axe at each stop). It and the other Threads suites run on Chromium phone and desktop, the Pixel 7, and in CI's `browsers` job on Firefox, desktop Safari and the iPhone 14; frame timing with every pair on stays on Chromium. `docs/qa-checklist.md` gains steps 12–18 for real phones.

**TX7 done (owner, 2026-11-20: every book counts the same, as in Themes).** Library ↔ library threads in all three pairs: 66 Old ↔ Old, 59 New ↔ New and 105 Old ↔ New between library books (the last in `library-ot-nt.json`, apart from the pinned 170), every book of the Bible with at least one, 606 threads in all. The orders follow the same rules as TX5 and TX6, with Matthew ↔ Mark `disputed` and Ephesians ↔ Colossians and Jude ↔ 2 Peter `consensus`; the deuterocanonical books' orders cite their Anchor Bible commentaries and their ends cite verse words, since OpenBible has no rows for them. First the Vault: the arcs are drawn as a few joined paths (`bundleArcs`), so the 300-node budget holds at any size; the filters move to a sidebar on the right with only Old ↔ New on at first, the reader's choice kept in `localStorage`; the perf test times the camera with every pair on.

**TX5 and TX6 done (2026-11-20, owner pre-approved, one PR for all books rather than one per book).** 153 Old ↔ Old threads (every Old Testament path book, `content/connections/within-ot.json`) and 53 New ↔ New threads (Luke, John 11 and Acts against the whole New Testament, `within-nt.json`), each approved with its fingerprint. The order of writing, as stated on each:

- `text`: the later passage names, quotes or retells the earlier (Acts 1:1 names Luke's "first book", so Luke → Acts uses are `text`).
- `consensus`: Chronicles drawing on Samuel–Kings and Genesis (Japhet); Paul's undisputed letters older than Acts, no use claimed (Brown); Luke retelling Mark (Brown, with Augustine's order, which also puts Mark before Luke).
- `disputed`: Matthew ↔ Luke, citing Brown (independent use of Mark and a sayings source) and Augustine (_Harmony of the Gospels_ I.2, the order Matthew, Mark, Luke, John).
- `unstated` (new basis: older end unknown, no use claimed): parallels and echoes whose order of writing the texts do not show, among them Luke ↔ John and Acts ↔ the Pastoral letters and Colossians.

Review documents: `docs/connections/<Book>-ot-ot-connections.md` and `<Book>-nt-nt-connections.md`, filed by the id's book prefix. Pairs the WEBC does not support were dropped, not reworded around (for example Esther 3:1, where the WEBC reads "Bougean", not Agagite).

## 11. Rough size

These are guesses until TX2's sizing report.

- Between took 23 path books to reach 170 connections after curation.
- Within the Old should yield more candidates per book than Between: the cross-references are dense inside the Old Testament, and Kings ↔ Chronicles alone yields dozens of parallel pairs.
- Within the New, Stage A is small (three path books), but Luke alone has many Gospel parallels.
- A first pass of **150–300 Within the Old** and **60–120 Within the New** connections is a realistic target, reviewed a book at a time like the first set.
- TD2's rewording: 170 first sentences, reviewed in one document.

## 12. Decisions for the owner

1. **Synoptic order.** Show Gospel parallels as "order disputed" with both views named (proposed), or take one view (modern Markan priority, or Augustine's canonical order)?
2. **Bibliographic citations.** Allow dating notes to cite modern scholarship by bibliography, which can't be machine-checked (proposed, marked in every review document)? Or use only pinned public-domain works?
3. **Reader groups.** **Draws on · Taken up in · Alongside** (proposed, replacing the Old / New columns), or Old / New columns as first planned?
4. **Rewording.** Rewrite all 170 explanations to the wording rule in one batch (proposed), or only the threads whose first sentence doesn't already say who uses whom?
5. **Reader filtering.** Should the reader always show every pair (proposed), or follow the Vault's Threads chips?
6. **Stage B.** Include library ↔ library pairs, and when?
7. **New sources.** Approve the additions in §8.
8. **A _retelling_ type.** Add it, or keep the seven types?
9. **Pair styling.** How Old ↔ Old and New ↔ New look on the ceiling (proposed: pale and dashed variants of the gold, never colour alone), with the taper for direction.
10. **Default.** Old ↔ New only (proposed), or every pair on?
