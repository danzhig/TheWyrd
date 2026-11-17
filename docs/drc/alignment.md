# The Douay-Rheims alignment

Written by `pnpm drc:align` (Phase 7, step 1). For the reading toggle, every WEBC verse is paired with the Douay-Rheims (Challoner) verses that hold the same words, so a page can switch translation while the plan, sections, threads and themes keep the WEBC numbering. Nothing here is on the site yet.

**How a pair is found**

1. **Numbering.** Most verses keep their number. Where the Latin tradition numbers differently (the Psalms, Malachi, parts of Kings, Sirach…), STEPBible TVTMS gives the change; each TVTMS record is used only after its own tests, run on both texts, show which column each text follows there.
2. **Content.** Within four verses of that numbering, an order-keeping alignment on the words two verses share may move a pair, where the Latin divides verses differently and TVTMS records nothing (Baruch 6, 1 Maccabees 1, Daniel 3). A pair the numbering proposes is kept unless the words clearly say otherwise.
3. **Maps** (`content/drc/maps.json`, owner-approved). Where the Douay-Rheims is another form of the book (the Vulgate’s Tobit and Judith; Esther, whose additions it gathers after 10:3), or holds a passage elsewhere (the doxology of Romans), the map pairs stretches of the two texts and verses inside each stretch are paired by content.

A Douay-Rheims verse that pairs with nothing on its own goes with the WEBC verse beside it, so every Douay-Rheims verse is shown somewhere. A WEBC verse can be left without Douay-Rheims words of its own when the Latin merges it into a neighbour or lacks it; on such a verse the toggle shows nothing extra. **Score** is the share of words (common words aside) a WEBC verse and its Douay-Rheims verses have in common: about 0.6 is typical, as the two translations word things differently; a **doubt** is a pair whose neighbour shares clearly more words.

**Totals.** 35,409 WEBC verses and 35,811 Douay-Rheims verses in 73 books. Douay-Rheims verses left unplaced: 0. WEBC verses without Douay-Rheims words of their own: 239. Pairs moved by content: 438. Doubts: 137.

**Maps (owner-approved):** Esth — approved 2026-11-17 (`02c04d2f600bf0de`); Tob — approved 2026-11-17 (`4c2e5057c3c88761`); Jdt — approved 2026-11-17 (`d79d26c063d39b80`); Rom — approved 2026-11-17 (`82802900202fe78b`)

| Book | WEBC verses | Douay-Rheims verses | Method | TVTMS records used | Moved by content | WEBC without own words | Doubts | Mean score |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| Genesis | 1533 | 1531 | numbering | 2 | 1 | 2 | 10 | 0.59 |
| Exodus | 1213 | 1211 | numbering | 2 | 5 | 4 | 13 | 0.61 |
| Leviticus | 859 | 858 | numbering | 1 | 3 | 2 | 18 | 0.56 |
| Numbers | 1288 | 1288 | numbering | 4 | 6 | 3 | 15 | 0.56 |
| Deuteronomy | 959 | 959 | numbering | 0 | 0 | 0 | 3 | 0.58 |
| Joshua | 658 | 658 | numbering | 5 | 2 | 2 | 2 | 0.51 |
| Judges | 618 | 618 | numbering | 2 | 1 | 1 | 6 | 0.54 |
| Ruth | 85 | 85 | numbering | 0 | 0 | 0 | 1 | 0.51 |
| 1 Samuel | 810 | 811 | numbering | 2 | 0 | 0 | 2 | 0.67 |
| 2 Samuel | 695 | 695 | numbering | 0 | 2 | 1 | 0 | 0.65 |
| 1 Kings | 816 | 817 | numbering | 1 | 0 | 0 | 1 | 0.68 |
| 2 Kings | 719 | 719 | numbering | 0 | 0 | 0 | 0 | 0.65 |
| 1 Chronicles | 942 | 940 | numbering | 2 | 2 | 2 | 1 | 0.53 |
| 2 Chronicles | 822 | 822 | numbering | 0 | 0 | 0 | 2 | 0.63 |
| Ezra | 280 | 280 | numbering | 0 | 0 | 0 | 0 | 0.64 |
| Nehemiah | 406 | 404 | numbering | 2 | 5 | 3 | 0 | 0.56 |
| Tobit | 244 | 298 | map | 0 | 0 | 48 | 1 | 0.40 |
| Judith | 339 | 345 | map | 0 | 0 | 93 | 2 | 0.44 |
| Esther | 206 | 275 | map | 0 | 0 | 0 | 4 | 0.42 |
| 1 Maccabees | 924 | 929 | numbering | 3 | 40 | 2 | 0 | 0.66 |
| 2 Maccabees | 555 | 558 | numbering | 2 | 13 | 1 | 0 | 0.52 |
| Job | 1070 | 1070 | numbering | 3 | 1 | 1 | 2 | 0.52 |
| Psalms | 2461 | 2530 | numbering | 145 | 10 | 6 | 11 | 0.55 |
| Proverbs | 915 | 915 | numbering | 0 | 0 | 0 | 0 | 0.52 |
| Ecclesiastes | 222 | 222 | numbering | 2 | 0 | 0 | 0 | 0.57 |
| Song of Songs | 117 | 116 | numbering | 2 | 0 | 1 | 0 | 0.61 |
| Wisdom | 436 | 439 | numbering | 6 | 7 | 3 | 1 | 0.51 |
| Sirach | 1383 | 1591 | numbering | 38 | 223 | 47 | 15 | 0.56 |
| Isaiah | 1292 | 1292 | numbering | 1 | 2 | 1 | 2 | 0.60 |
| Jeremiah | 1364 | 1363 | numbering | 1 | 1 | 1 | 0 | 0.65 |
| Lamentations | 154 | 154 | numbering | 0 | 0 | 0 | 0 | 0.61 |
| Baruch | 213 | 213 | numbering | 2 | 41 | 2 | 1 | 0.68 |
| Ezekiel | 1273 | 1272 | numbering | 1 | 1 | 1 | 1 | 0.67 |
| Daniel | 530 | 531 | numbering | 2 | 45 | 0 | 6 | 0.68 |
| Hosea | 197 | 198 | numbering | 2 | 2 | 1 | 0 | 0.59 |
| Joel | 73 | 73 | numbering | 0 | 0 | 0 | 0 | 0.66 |
| Amos | 146 | 147 | numbering | 1 | 0 | 0 | 0 | 0.63 |
| Obadiah | 21 | 21 | numbering | 0 | 0 | 0 | 0 | 0.61 |
| Jonah | 48 | 48 | numbering | 1 | 0 | 0 | 0 | 0.63 |
| Micah | 105 | 104 | numbering | 1 | 1 | 1 | 0 | 0.57 |
| Nahum | 47 | 47 | numbering | 0 | 0 | 0 | 0 | 0.53 |
| Habakkuk | 56 | 56 | numbering | 0 | 0 | 0 | 0 | 0.52 |
| Zephaniah | 53 | 53 | numbering | 0 | 0 | 0 | 0 | 0.54 |
| Haggai | 38 | 38 | numbering | 2 | 0 | 0 | 0 | 0.61 |
| Zechariah | 211 | 211 | numbering | 0 | 0 | 0 | 0 | 0.62 |
| Malachi | 55 | 55 | numbering | 0 | 0 | 0 | 0 | 0.61 |
| Matthew | 1071 | 1070 | numbering | 1 | 1 | 1 | 3 | 0.73 |
| Mark | 678 | 677 | numbering | 2 | 1 | 1 | 1 | 0.69 |
| Luke | 1151 | 1151 | numbering | 0 | 0 | 0 | 3 | 0.70 |
| John | 879 | 880 | numbering | 1 | 0 | 0 | 1 | 0.76 |
| Acts | 1007 | 1004 | numbering | 3 | 5 | 4 | 1 | 0.69 |
| Romans | 434 | 433 | numbering + map | 0 | 1 | 1 | 0 | 0.69 |
| 1 Corinthians | 437 | 437 | numbering | 0 | 0 | 0 | 4 | 0.68 |
| 2 Corinthians | 257 | 256 | numbering | 1 | 1 | 1 | 0 | 0.63 |
| Galatians | 149 | 149 | numbering | 0 | 0 | 0 | 0 | 0.69 |
| Ephesians | 155 | 155 | numbering | 0 | 0 | 0 | 0 | 0.74 |
| Philippians | 104 | 104 | numbering | 0 | 0 | 0 | 0 | 0.66 |
| Colossians | 95 | 95 | numbering | 0 | 0 | 0 | 0 | 0.72 |
| 1 Thessalonians | 89 | 88 | numbering | 0 | 7 | 1 | 0 | 0.65 |
| 2 Thessalonians | 47 | 46 | numbering | 0 | 7 | 1 | 0 | 0.64 |
| 1 Timothy | 113 | 113 | numbering | 0 | 0 | 0 | 0 | 0.64 |
| 2 Timothy | 83 | 83 | numbering | 0 | 0 | 0 | 0 | 0.65 |
| Titus | 46 | 46 | numbering | 0 | 0 | 0 | 0 | 0.63 |
| Philemon | 25 | 25 | numbering | 0 | 0 | 0 | 0 | 0.60 |
| Hebrews | 303 | 303 | numbering | 0 | 0 | 0 | 1 | 0.66 |
| James | 108 | 108 | numbering | 0 | 0 | 0 | 0 | 0.63 |
| 1 Peter | 105 | 105 | numbering | 0 | 0 | 0 | 0 | 0.63 |
| 2 Peter | 61 | 61 | numbering | 0 | 0 | 0 | 0 | 0.58 |
| 1 John | 105 | 105 | numbering | 0 | 0 | 0 | 1 | 0.70 |
| 2 John | 13 | 13 | numbering | 0 | 0 | 0 | 0 | 0.63 |
| 3 John | 14 | 14 | numbering | 0 | 0 | 0 | 0 | 0.62 |
| Jude | 25 | 25 | numbering | 0 | 0 | 0 | 0 | 0.62 |
| Revelation | 404 | 405 | numbering | 0 | 1 | 0 | 2 | 0.76 |

Every pair that is not simply a verse with its own number is listed in [details.md](details.md).
