# Phase 1 device checklist (M7)

Automated checks cover Chromium (phone and desktop sizes, an emulated Pixel 7), and in CI Firefox,
desktop Safari (WebKit) and an emulated iPhone 14. Emulation is not a real device: run this list
once on a real **iPhone (Safari)** and a real **Android phone (Chrome)** using the PR's Vercel
preview, and note anything odd in the PR.

| #   | Do this                                                                                                    | Expect                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | Open the preview. Pinch and drag the map of books.                                                         | Smooth zoom and pan; names appear as you zoom in; no page scroll fights the map.                            |
| 2   | Tap Exodus.                                                                                                | A closed book lifts out, flies to the centre and opens onto cream pages. No blur or pixelation.             |
| 3   | Tap a station.                                                                                             | A page grows out of the dot; the verses appear.                                                             |
| 4   | Scroll to the end, tap Next, then the ← arrow at the top.                                                  | The next section opens; the arrow returns to the book map at the same place; the page shrinks into its dot. |
| 5   | Tap "All books".                                                                                           | The cover closes; the book shrinks back into its medallion on the map.                                      |
| 6   | On Luke 17:11–19:27 (Lepers, the Widow, Zacchaeus), tap the "Optional detour" card.                        | John 11 opens; its Next returns to Luke.                                                                    |
| 7   | Open Aa; switch theme and text size.                                                                       | Changes apply at once and survive a reload.                                                                 |
| 8   | Turn on Reduce Motion (iOS: Settings → Accessibility → Motion; Android: Remove animations) and repeat 2–5. | No flights or swings; pages simply change.                                                                  |
| 9   | Open a private / incognito tab and repeat 1–4.                                                             | Everything works; progress is simply not remembered after closing.                                          |
| 10  | Open The path, About and Sources from the map.                                                             | Each page reads well at phone width with no sideways scrolling.                                             |
| 11  | Rotate the phone on the map and on a book.                                                                 | The layout adapts; nothing is cut off.                                                                      |

## Threads (threads plan TX8)

Automated: `tests/e2e/threads-qa.spec.ts` runs the whole of Threads with every corpus pair on
(every arc drawn and listed, each pair's busiest arc followed into the reader and back, a library
book's panel, the reader's list and dialog, search, storage blocked, reduced motion, with axe at
each stop), together with `threads.spec.ts` and `vault-threads.spec.ts`, on Chromium (phone,
desktop, Pixel 7) and in CI on Firefox, desktop Safari and an iPhone 14. Frame timing with every
pair on (`perf.spec.ts`) runs on Chromium only. On a real phone:

| #   | Do this                                                                         | Expect                                                                                                             |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 12  | On the map, tap Threads.                                                        | Gold arcs fade in between the books; only Old ↔ New at first. A "Filters" tab sits on the right edge.              |
| 13  | Open Filters; turn on Old ↔ Old and New ↔ New.                                  | Paler arcs bowing outward join the others; the map still pans and zooms smoothly.                                  |
| 14  | Reload the page and turn Threads on again.                                      | The same pairs are still on.                                                                                       |
| 15  | Tap Isaiah once, then once more.                                                | The first tap opens Isaiah's threads in a sheet (Draws on · Drawn on by · Alongside); the second opens the book.   |
| 16  | Back on the map, tap an arc; open a card's arrow; tap "Read …".                 | The arc's threads list; the card opens to its explanation; the reading opens at the verse with a "Back to …" pill. |
| 17  | In a reading with threads (e.g. Luke 1), tap a gold thread mark beside a verse. | Its threads open in a dialog grouped by direction; closing it returns to the verse.                                |
| 18  | Repeat 12–16 with Reduce Motion on, and in a private tab.                       | Arcs appear without fading; in a private tab the filters start at Old ↔ New after each reload.                     |
