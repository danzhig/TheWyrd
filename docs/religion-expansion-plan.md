# Religion Expansion plan

_Begun 2026-11-19 at the owner's request, as a separate lift for another day. A plan only: nothing here is built, and nothing here is approved. It depends on the threads work in `docs/threads-expansion-plan.md` (Part A especially) and follows every rule in PLAN §1. Every source named below must have its licence checked before first use; where this plan says "to verify", nothing has been checked yet._

## 1. The vision

**Two more scriptures, in English, around the outer ring of the Vault: Judaism's on one side and Islam's on the other. Each has its own readings, themes and threads, all joined to the Bible and to each other by threads you can filter by pair. In the long run the whole set becomes a cited data set an LLM can answer from, one tradition at a time and then together.**

- **On the ceiling:** two half-moon sections outside the outer ring, one on the left for Judaism and one on the right for Islam (sides to be chosen, §11). The spiral and its ring stay as they are in the middle.
- **English only.** This is an English reading site. Hebrew, Aramaic and Arabic come only in the distant future, and then only from tagged source data with citations, as for the Bible's Hebrew and Greek (PLAN §1 rule 3).
- **Themes:** each tradition's readings join the themes, which can be viewed two ways:
  - **separately**, as three sets of constellations, flown apart star by star;
  - **together**, as one set where a sub-theme gathers readings from all three.
- **Threads between traditions**, filtered by corpus pair, for example Quran ↔ Quran, Quran ↔ Torah, Torah ↔ Old Testament, New Testament ↔ Torah. This is the main point and the hardest part: it needs the threads' density work first (threads plan Part A) and wider sourcing.
- **A thought database.** With every reading placed in sub-themes and every thread cited, someone could ask an LLM: "Look at the _Hope_ sub-theme in each of the three traditions and answer from each one's perspective, then from all three together." It would answer from the site's data, with citations, not from memory (§9).

## 2. What must come first

**The expansion rests on three things the threads plan builds: direction kept apart from dependence, corpus-pair filters, and a card dense enough to carry a cross-tradition thread.**

| Prerequisite                       | Where it is built                                   | Why the expansion needs it                                                                                                                                                                                                                                                                     |
| ---------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chronology separate from "uses"    | Threads plan §2.3 (`order.older`, `order.uses`)     | Between traditions, "which text is older" is a fact about dates, but "the later text uses the earlier one" can be a claim one tradition rejects. For example, Muslims hold the Quran to be revelation, not drawn from earlier books. The card must be able to show order without claiming use. |
| Corpora and pair filters           | Threads plan §5 (`lib/corpora.ts`)                  | New corpora become rows in one table; the chips "Quran ↔ Torah" and the rest appear without new control code                                                                                                                                                                                   |
| The card, summary and wording rule | Threads plan §2–§3                                  | A cross-tradition thread needs to say in one sentence exactly what is shared and on whose terms. The wording rule gains a cross-tradition form (§7.3).                                                                                                                                         |
| Books as data, not as the path     | Phase 5 library (`library.json`, `getFullManifest`) | The new scriptures are read like the library: readable, searchable and themed, never stops on the Christian path or targets of Next                                                                                                                                                            |
| One star per reading               | Phase 6 (P6.5, P6.6)                                | A reading from any corpus becomes stars the same way                                                                                                                                                                                                                                           |

Recommended order: the threads plan's Part A, then its Part B (at least within the Old Testament, which tests the tools on Hebrew evidence), then this plan.

## 3. What "Torah" means here: the first decision

**"Torah" can mean three different bodies of text. The choice decides the sources, the sections and what the threads can say, so it comes first (§11, decision 1).**

| Meaning                                               | What it holds                                                                              | Overlap with the site                                                                               | Consequence                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. The Written Torah / Tanakh as Judaism reads it** | The Hebrew Bible in Jewish order (Torah, Nevi'im, Ketuvim) in a Jewish English translation | The same books as the protocanonical Old Testament, in a different order, translation and numbering | The crescent would repeat books the spiral already has. Tanakh ↔ Old Testament threads would mostly be "the same verse in two translations", which is little value. Worth it only as a translation, through the reader's Bible picker (`lib/translations.ts`), not as a crescent. |
| **B. The Oral Torah: rabbinic literature**            | The Mishnah, then in time Midrash and the Talmud                                           | None: these are separate books                                                                      | A real second corpus with its own readings and themes. Threads to the Bible are rich and well studied (rabbinic readings of Genesis; New Testament ↔ Mishnah parallels).                                                                                                          |
| **C. Both**                                           | The Tanakh as a reading of the shared books, plus the Mishnah as the crescent              | As A and B                                                                                          | The richest, and the largest lift                                                                                                                                                                                                                                                 |

**Recommendation: C, in that order.**

1. A Jewish translation of the Tanakh joins the Bible picker, so the shared books can be read as Judaism reads them, with Tanakh numbering mapped through TVTMS as the Douay-Rheims is.
2. The **Mishnah** is the Judaism crescent, with its six orders as its groups, the way the outer ring groups the library.
3. Midrash and the Talmud come later, if ever: they are very large, and openly licensed English is scarce.

The rest of this plan assumes C. The owner may choose otherwise.

## 4. The corpora

### 4.1 Islam: the Quran

- **Shape:** 114 suras of very different lengths.
- **Readings:** the traditional division of each sura into _ruku'_ (sections marked in printed Qurans for recitation) gives roughly 550 readings. These boundaries are part of the tradition, not drawn by this site, which keeps to the spirit of "never invent a range" (PLAN §1 rule 1). Short suras are one reading each. Titles are original, one line, owner-approved, as for the library.
- **Groups on the crescent:**
  - the 30 _juz'_ (equal parts for reading through in a month), as a neutral grouping;
  - or the Meccan / Medinan classification, which is traditional but debated for some suras (decision 4).
- **Numbering:** sura:aya in the standard Kufan count (the Hafs reading, used in most printed Qurans). Some older European translations number differently (Flügel's numbering). A translation is used only if its numbering is checked against the standard count verse by verse, and differences are logged as `docs/versification-log.md` logs the Bible's.
- **The translation is an interpretation of the meanings.** Many Muslims hold that the Quran is the Quran only in Arabic. The site names every English text "an interpretation of the meanings" (as Pickthall titled his: _The Meaning of the Glorious Koran_), on the reader and on `/sources`.

### 4.2 Judaism: the Mishnah (and the Tanakh as a translation)

- **Shape:** six orders, 63 tractates, chapters and _mishnayot_.
- **Readings:** a chapter of a tractate as one reading (about 525 chapters), divided at mishnah boundaries where a chapter is long. The text's own structure sets the boundaries.
- **Groups on the crescent:** the six orders (Zera'im, Mo'ed, Nashim, Nezikin, Kodashim, Tohorot), each with its English name.
- **The Tanakh as a Bible translation:** a Jewish English translation in the picker. It aligns verse by verse with the WEBC through TVTMS for the shared books, as `scripts/drc/` does for the Douay-Rheims. It has no new sections and no new medallions.

### 4.3 What stays fixed

- The path, Next, progress and the spiral are Christian and stay exactly as they are. The new corpora are libraries: read, searched, themed and threaded, never on the path.
- `reading-plan.json` is untouched. Each new corpus gets its own section file (`content/quran/sections.json`, `content/mishnah/sections.json`) with the owner's approval and a fingerprint, as `library.json` has.
- Each corpus has its own reader progress ledger (`sas:v1:quran`, `sas:v1:mishnah`), as the library has `sas:v1:library`.

## 5. Sources (all to verify)

**English texts with open licences are the hard constraint. Every candidate below must have its licence confirmed for the specific edition and digital transcription before it is pinned (PLAN §1 rule 5), and every one is credited on `/sources`.**

| Need                                 | Candidates                                                                                                                                                                                                                                                  | What to verify                                                                                                                                                                                                                                                                                             |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quran in English                     | Pickthall (1930); Yusuf Ali (the original 1934–1937 edition, not later revisions); Sale (1734); Rodwell (1861); Palmer (1880)                                                                                                                               | Copyright status by country, and the licence of the digital transcription. Sale and Rodwell carry polemical notes, and Rodwell reorders the suras, so they are poor primary texts. Pickthall and the original Yusuf Ali are widely used and respected by Muslim readers, which is a reason to prefer them. |
| Quran structure data                 | Tanzil.net metadata (sura, aya, juz', hizb, ruku' boundaries, Meccan/Medinan); the Quranic Arabic Corpus (for the far-future Arabic layer)                                                                                                                  | Licences and their conditions: the Tanzil text has conditions on modification; the Quranic Arabic Corpus has its own licence. Only metadata is needed at first, not Arabic.                                                                                                                                |
| Tanakh in English (Jewish)           | The JPS 1917 translation                                                                                                                                                                                                                                    | Public domain in the United States; check the transcription's licence and its versification against TVTMS                                                                                                                                                                                                  |
| Mishnah in English                   | Openly licensed community translations hosted by Sefaria; older public-domain partial translations                                                                                                                                                          | Each text on Sefaria carries its own licence, and some are non-commercial (CC BY-NC), which may not fit PLAN §3. Check each one. Danby's 1933 translation is likely still in copyright.                                                                                                                    |
| Topics for themes                    | For the Quran: an index of subjects in a public-domain translation or reference work, or the Quranic Arabic Corpus's concept ontology. For the Mishnah: the tractates' own subjects.                                                                        | Licence, and whether a 19th-century European reference work's framing is acceptable (it often is not, §8)                                                                                                                                                                                                  |
| Cross-references between traditions  | The Quran's own named figures (matched by name with STEPBible TIPNR, threads plan §8); Lightfoot, _Horae Hebraicae et Talmudicae_ (17th century, New Testament ↔ rabbinic parallels); a public-domain commentary on the Quran that notes biblical parallels | Edition and licence of each digital copy. Modern scholarship (for example on the Quran's dialogue with biblical tradition, or rabbinic parallels to the Gospels) is usually copyrighted; it can only be cited by bibliography, never copied (threads plan §2.5).                                           |
| Traditional commentary (perspective) | Rashi in English (for the Torah); a classical _tafsir_ in English (for the Quran)                                                                                                                                                                           | Translations of both are mostly modern and copyrighted; look for public-domain or openly licensed editions. Without one, the site can't say how a tradition itself reads a passage, only what the texts share.                                                                                             |

**Network.** Each new host must be allowed in the cloud environment before its fetch, as for OpenBible.

## 6. The Vault: two half-moons

**Two arcs of medallions just outside the outer ring, left and right, each holding one corpus's groups. They are drawn, named and lazily loaded so the Vault keeps its first-load budget and its node limit.**

- **Shape:** each half-moon is a band about 140° wide at a radius beyond `OFFPATH_RADIUS`, centred on the horizontal axis. It holds the corpus's groups (the six orders; the 30 juz' or the Meccan / Medinan halves) as medallions, with the books (tractates, suras) on a second, finer band that appears on zoom.
- **The opening view** (`fit()` on wide screens) still shows the whole ceiling, now wider than it is tall. Phones still open on the spiral.
- **Budgets:**
  - Node limit: 114 suras + 63 tractates + their names would pass the 300-node limit on their own. At overview the half-moons show only their groups (about 36 medallions). Book medallions load and draw on zoom, possibly on one canvas, as the theme stars are.
  - First-load JavaScript: under 160 KB with 10 KB to spare. The half-moons' code and data load after first paint, as the zoom library does.
- **The Testament switch becomes a corpus switch:** Old · New · Torah · Quran, each a toggle. It filters what the Vault shows, as now, and the path is untouched.
- **Names and styling:** each half-moon is named on the ceiling ("Judaism · Mishnah", "Islam · Quran", decision 2). Each corpus has its own medallion material from the design tokens, distinct from the gilt of the path and the grey of the library, and never told apart by colour alone.
- **A caution on the shape.** A crescent is widely read as a symbol of Islam. Using the same half-moon for Judaism's section may read oddly, so the two sections may need different outlines (decision 3).

## 7. Themes and threads across traditions

### 7.1 Themes: separate or together

**One taxonomy with every corpus's readings placed in it, viewed separately (three sets of constellations) or together (one).**

- **Placement:** each new reading is placed in a home sub-theme and at most one second, by the same rule as `pnpm themes:readings` (P6.5). The evidence is each corpus's own topical data (§5). Uncited readings are placed by TF-IDF similarity and never given a second.
- **Taxonomy:** the 13 themes and 58 sub-themes were built for the Bible. Some carry across directly (_Hope_, _Mercy and forgiveness_, _Covenant_). Some need a corpus's own sub-themes:
  - the oneness of God as the Quran speaks of it;
  - the Mishnah's purity and the agricultural laws.

  New sub-themes are added, approved and fingerprinted as Phase 6 did. A sub-theme may be **shared** (readings from several corpora) or **own** (one corpus).

- **Together view:** today's constellations, each sub-theme's stars drawn from every corpus that has readings there. Stars are told apart by shape and material as well as colour (for example the gilt round star for the Bible's path, a pale round star for its library, a six-rayed star for the Mishnah, an eight-rayed star for the Quran). The exact glyphs are a design decision (decision 6).
- **Separate view:** three sets of constellations, Judaism on its side, the Bible in the middle, Islam on its side. A shared sub-theme appears in each set where that corpus has readings. The switch between Together and Separate is a flight, star by star, like the Spiral ⇄ Themes switch: each star flies from its place in the combined constellation to its place in its own corpus's set.
- **Performance:** 1,406 stars fly today, with long frames held under 35% on a throttled phone. About 550 Quran readings and about 525 Mishnah chapters, each with one or two sub-themes, would add roughly 1,500–2,000 stars. Before the design is fixed, measure a flight at about 3,500 stars. If it fails, fly only the stars on screen, or fly groups.

### 7.2 Threads: pairs and evidence

**The pairs the owner named, and what each can honestly rest on.**

| Pair                            | Strongest evidence                                                                                                                                                    | Notes                                                                                                                                                                                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quran ↔ Quran                   | Shared phrases and repeated accounts (the Quran retells Moses, Abraham and Joseph in several suras); a Quran cross-reference dataset if an openly licensed one exists | Like Old ↔ Old: parallel accounts, a direction often unknown                                                                                                                                                                                                      |
| Quran ↔ Torah / Old Testament   | Named figures (TIPNR ids for Adam, Noah, Abraham, Moses, Joseph …); accounts of the same events; the Quran's own references to the Torah (_Tawrat_)                   | Order: the Torah is older, a fact about dates. "Uses": never claimed by default, since it is a theological claim Islam rejects. The arrow is dotted (earlier · later), and the relation is "tells also", "names" or "refers to" (when the Quran names the Torah). |
| Quran ↔ New Testament           | Named figures (Jesus, Mary, John, Zechariah); the same events (the annunciation, Mary's story)                                                                        | As above. Accounts outside the canon (infancy narratives) are out of scope unless a source is pinned for them.                                                                                                                                                    |
| Mishnah ↔ Torah / Old Testament | The Mishnah's own citations of scripture ("as it is said …"), which are explicit and machine-detectable in a tagged text                                              | A genuine "uses" with basis `text`: the Mishnah quotes the verse                                                                                                                                                                                                  |
| Mishnah ↔ New Testament         | Shared practice and sayings (the Sabbath, purity, Passover, oaths); Lightfoot's parallels                                                                             | Dating is the risk: the Mishnah was compiled around 200 AD and the traditions in it are older. The order is "disputed" unless a tradition is datable. "Uses" is not claimed in either direction.                                                                  |
| Mishnah ↔ Quran                 | Shared legal and narrative material                                                                                                                                   | The least sourced; Stage B at best                                                                                                                                                                                                                                |

### 7.3 Wording across traditions

The threads plan's wording rule (§3) gains one form and one constraint:

- **Form for shared figures or accounts with no use claimed:** "Sura 19:16–21 and Luke 1:26–38 both tell of the angel sent to Mary: …".
- **Constraint:**
  - An explanation says what each text says, in each text's own terms, and what they share.
  - It never says one tradition's reading is right, and never calls the later text a borrowing.
  - Where a tradition's own reading of the link matters (Muslims read the Quran as confirming earlier revelation, and Christian writers have read it otherwise), a sentence may report that view, attributed and cited, as the Fathers are cited for typology. It never stands as the site's own view.

## 8. Risks

**The site was built on one tradition's canon and voice; adding two more is mostly a question of fairness and sourcing, then performance.**

| Risk                                                                    | Mitigation                                                                                                                                                                                                |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One tradition framed in another's terms                                 | The wording rule (§7.3); no "borrowing" language; dotted arrows by default between traditions; each corpus's own sub-themes; titles for its readings written in its own vocabulary (with English glosses) |
| Old European sources carry polemic                                      | Prefer translations respected within the tradition; reference works from the 18th and 19th centuries are cited only for facts, and never quoted for framing                                               |
| Licences (non-commercial terms, modified texts, unclear transcriptions) | Nothing pinned without a recorded licence check; non-commercial texts excluded unless the owner decides the site may use them (decision 7)                                                                |
| Scholarly interpretation is contested                                   | Disputed order notes name the positions (threads plan §2.5); bibliographic citations marked in every review document                                                                                      |
| Review by readers of each tradition                                     | Before launch, someone at home in each tradition reviews the reading titles, the sub-themes and a sample of threads (decision 8)                                                                          |
| Scale                                                                   | Node limit, first-load budget and flight frames measured before each design is fixed (§6, §7.1)                                                                                                           |
| Ground rule 2 (no scripture from memory) for new scriptures             | Applies unchanged: every verse of the Quran or the Mishnah shown comes from a pinned file, processed at build time. Check 7 extends to the new texts.                                                     |

## 9. The thought database

**The site's data, made readable by an LLM: every reading, sub-theme and thread with its citations, so an answer can be traced to its rows. Static first; an ask box only if the owner relaxes PLAN §1 rule 4.**

- **The export (static, no server):**
  - `public/data/llm/` holds one file per sub-theme: its description and, for each corpus, its readings (reference, title, the built text) and the threads among them, each with its explanation and citations.
  - An index file (in the manner of `llms.txt`) lists them.
  - A reader can point any LLM at the files, or download a sub-theme's bundle from the theme tree.
- **The question pattern the owner described:** "Look at _Hope_ in each of the three traditions, answer from each one's perspective, then from all three together." With the export this becomes:
  1. retrieve the _Hope_ bundle;
  2. answer per corpus from that corpus's readings only;
  3. answer together from all readings and the threads between them;
  4. cite a reading or thread row for every claim.
- **Guardrails, carried from PLAN §1:**
  - Quote only from the bundle, never from memory.
  - Name the tradition behind each perspective, and say "the texts here say", not "Judaism teaches", unless a cited source from the tradition says so.
  - State plainly what the data does not cover (for example, that the Talmud is not included).
- **An ask box on the site** would need a server or the reader's own API key, which Phases 1–2 rule out (PLAN §1 rule 4). That is a later decision for the owner (decision 9). The export works without it.

## 10. Milestones

| #   | Milestone                   | Scope                                                                                                                                                          | Acceptance                                                                                                  |
| --- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| RE0 | Decisions and licences      | The owner's decisions (§11); a licence check for each candidate source, recorded in `docs/religion/sources.md`                                                 | Every source to be pinned has a recorded licence that fits PLAN §3                                          |
| RE1 | The Tanakh as a translation | A Jewish English Tanakh in the Bible picker, aligned through TVTMS (as `drc:align`)                                                                            | Every WEBC verse of the shared books placed; alignment report; e2e switches translation and keeps the place |
| RE2 | The Quran's readings        | Pin the text and the structure data; `content/quran/sections.json` (ruku' readings, original titles), owner-approved; the reader, search and a progress ledger | Every aya placed once; no unapproved section; numbering checked against the standard count; axe clean       |
| RE3 | The Mishnah's readings      | As RE2, by order, tractate and chapter                                                                                                                         | As RE2                                                                                                      |
| RE4 | The half-moons              | Vault bands, groups at overview, books on zoom, the corpus switch                                                                                              | Under 300 nodes; first load under 160 KB; 60 fps flights; e2e opens a sura and a tractate from the ceiling  |
| RE5 | Themes                      | Taxonomy additions; readings placed (`themes:readings`, per corpus); Together and Separate views and the flight between them                                   | Every reading placed once; flight measured at full size; theme tree lists every corpus                      |
| RE6 | Threads within each corpus  | Quran ↔ Quran and Mishnah ↔ Mishnah, by the threads method                                                                                                     | Approved only; cited; check 14 with the cross-tradition form                                                |
| RE7 | Threads between traditions  | The pairs in §7.2, one pair per PR, owner-approved; review by a reader at home in each tradition                                                               | Approved only; no "uses" across traditions without basis `text`; every disputed order cited                 |
| RE8 | The thought database        | The static export and its index; a sample Q&A in `docs/religion/llm-sample.md`, every claim traced to a row                                                    | Every bundle file validates against its schema; nothing in a bundle lacks a citation                        |

## 11. Decisions for the owner

1. **What "Torah" means** (§3): the Tanakh as a translation, the Mishnah as the crescent, or both (recommended, in that order)? Or did you mean something else by "hav torah"?
2. **Names on the ceiling:** "Judaism · Mishnah" and "Islam · Quran", or the traditions' names alone?
3. **Sides and shapes:** which tradition goes on the left, and should the two sections share the half-moon outline (§6 caution)?
4. **Quran groups:** the 30 juz' (neutral), or Meccan / Medinan (traditional, debated for some suras)?
5. **Quran translation:** Pickthall, the original Yusuf Ali, or another, once the licences are checked?
6. **Star glyphs** for each corpus in the Together view.
7. **Non-commercial licences:** exclude them (as PLAN §3 implies), or allow them for some texts?
8. **Review:** who reviews each tradition's titles, sub-themes and threads before launch?
9. **The ask box:** keep the thought database as a static export only, or plan for an on-site LLM (which needs a server or the reader's own key)?
