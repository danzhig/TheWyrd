# Threads: connections from Sirach (Old ↔ New, between library books)

Written by `pnpm connections:verify` from `content/connections/library-ot-nt.json`: the connections drafted from `docs/connections/Sir-library-ot-nt-candidates.md` (threads plan §7), each with its type, strength (3 = explicit quotation or named reference), sections, explanation (original prose; no scripture beyond a few words) and every citation, checked against the pinned sources: OpenBible.info cross-reference rows, words the WEBC text carries at a verse (also checked by `pnpm content:build`), Greek words at their Septuagint and TAGNT rows, and Church Fathers in the pinned public-domain CCEL editions, by work and section with a phrase that must occur there.

Nothing here is on the site until the owner approves it: then each approved connection is `verified` with a fingerprint of its content (`pnpm connections:verify --approve <ids|all>`), and any later edit hides it until approved again.

3 connections; 0 verified; 0 failing a check.

## `sir-x01` Forgive, and you will be forgiven

- **Sir.28.2 → Matt.6.12-Matt.6.14** · echo · strength 3 · draft · fingerprint `db0cfc09798f4063`
- From: Anger, Lending and Hospitality (`sir-11`, library)
- To: The Sermon on the Mount: Prayer and Trust (`matt-04`, library)
- Order: older end from; the later end uses it; basis canon

> Matthew 6:12–14 echoes Sirach 28:2: in the Lord's Prayer the disciples ask to be forgiven as they forgive, and Jesus adds that the Father forgives those who forgive others. Ben Sira ties the pardon of one's own sins in prayer to forgiving a neighbour's wrong first.

- Sir.28.2 carries: Forgive, pray

## `sir-x02` Swift to hear

- **Sir.5.11 → Jas.1.19** · echo · strength 2 · draft · fingerprint `78c215ed373f5eb0`
- From: Speech and Friendship (`sir-03`, library)
- To: Trials; Hearing and Doing; Faith and Works (`jas-01`, library)
- Order: older end from; the later end uses it; basis canon

> James 1:19 echoes Sirach 5:11: James tells every believer to be swift to hear, slow to speak and slow to anger. Ben Sira says be swift to hear and answer with patience.

- Sir.5.11 carries: swift, hear

## `sir-x03` The yoke and rest

- **Sir.51.23-Sir.51.27 → Matt.11.28-Matt.11.30** · echo · strength 3 · draft · fingerprint `5cc1bfd2efb89314`
- From: Simon the High Priest; Ben Sira’s Prayer (`sir-19`, library)
- To: John’s Question; Sabbath Controversies (`matt-07`, library)
- Order: older end from; the later end uses it; basis canon

> Matthew 11:28–30 echoes Sirach 51:23–27: Jesus calls the weary to come to him and take his yoke, and find rest for their souls. Ben Sira ends his book calling the untaught to draw near, put their necks under wisdom's yoke, and see how little he laboured to find much rest.

- Sir.51.26 carries: yoke
- Sir.51.27 carries: rest
