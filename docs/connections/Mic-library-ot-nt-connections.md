# Threads: connections from Micah (Old ↔ New, between library books)

Written by `pnpm connections:verify` from `content/connections/library-ot-nt.json`: the connections drafted from `docs/connections/Mic-library-ot-nt-candidates.md` (threads plan §7), each with its type, strength (3 = explicit quotation or named reference), sections, explanation (original prose; no scripture beyond a few words) and every citation, checked against the pinned sources: OpenBible.info cross-reference rows, words the WEBC text carries at a verse (also checked by `pnpm content:build`), Greek words at their Septuagint and TAGNT rows, and Church Fathers in the pinned public-domain CCEL editions, by work and section with a phrase that must occur there.

Nothing here is on the site until the owner approves it: then each approved connection is `verified` with a fingerprint of its content (`pnpm connections:verify --approve <ids|all>`), and any later edit hides it until approved again.

2 connections; 0 verified; 0 failing a check.

## `mic-x01` Bethlehem, least among the rulers of Judah

- **Mic.5.2 → Matt.2.5-Matt.2.6** · quotation · strength 3 · draft · fingerprint `fb98d3ecc933125f`
- From: The Mountain of the Lord; a Ruler from Bethlehem (`mic-02`, library)
- To: The Genealogy and Birth of Jesus (`matt-01`, library)
- Order: older end from; the later end uses it; basis canon

> Matthew 2:5–6 quotes Micah 5:2: asked by Herod where the Christ is to be born, the chief priests and scribes answer Bethlehem of Judea, citing Micah's ruler who will come from there. Matthew adds that he will shepherd God's people Israel.

- `OpenBibleXref:L230634` Matt.2.6 → Mic.5.2, 151 votes
- `OpenBibleXref:L221283` Mic.5.2 → Matt.2.6, 76 votes

## `mic-x02` A man's enemies, his own household

- **Mic.7.6 → Matt.10.35-Matt.10.36** · quotation · strength 2 · draft · fingerprint `9629291f827fb0d4`
- From: The Lord’s Case; Hope after Judgment (`mic-03`, library)
- To: The Twelve Sent Out (`matt-06`, library)
- Order: older end from; the later end uses it; basis canon

> Matthew 10:35–36 quotes Micah 7:6: sending out the twelve, Jesus says he came to set a son against his father and a daughter against her mother. A man's foes will be those of his own household. Micah laments a society where no one can trust even family.

- `OpenBibleXref:L221896` Mic.7.6 → Matt.10.35-Matt.10.36, 30 votes
- `OpenBibleXref:L234991` Matt.10.36 → Mic.7.6, 26 votes
