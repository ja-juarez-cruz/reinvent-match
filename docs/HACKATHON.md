# Hackathon plan

🇪🇸 [Versión en español](HACKATHON.es.md)

Reinvent:Match is being built for the AWS Events API hackathon. Submission deadline: **November 6, 2026, 11:59 PM PT**.

## Judging criteria → what Reinvent:Match brings

Four equally weighted criteria (25% each):

| Criterion | How Reinvent:Match addresses it |
|---|---|
| **Creativity and novelty of the integration** | Person ↔ session matching instead of search. Explainable categories (Deep Dive, Growth, Foundation, Discovery, Skip), *irreplaceability* of in-person formats, learning paths across the week, opportunity cost of every choice. A local MCP server that **composes with** the official `awsevents` MCP server: the assistant uses ours to decide and theirs to act. |
| **Utility for re:Invent attendees** | Built for the 47% who are first-timers: turns 2,000+ sessions into ~15 with reasons, avoids sessions that are too basic or too advanced, and gets the agenda into the official portal (favorites, personal time, reservations). Works with Summits too. |
| **Technical depth and use of the API surface** | Uses all 12 operations (table below) and both surfaces (REST in the app, MCP alongside it). Handles OAuth PKCE with refresh and revocation, pagination, per-attendee quotas, per-session partial failures, the `409` before write access opens, and UTC-only personal time. |
| **Quality of the Builder Center project** | Write-up with the problem, the method, the architecture diagram, a demo video and the author's own before/after re:Invent agenda as a real case. |

## API surface coverage

| Operation | Reinvent:Match feature | Status |
|---|---|---|
| `ListEvents` | `reinvent-match events`: choose an event | ✅ |
| `GetEvent` | Event timezone and dates for the agenda | ⬜ |
| `ListSessions` | Full catalog download and cache | ✅ |
| `GetSession` | Refresh seat availability for shortlisted sessions before reserving | ⬜ |
| `GetSchedule` | `reinvent-match schedule`; shortlist shows current favorites; every favorites sync re-reads it; agenda import pending | ✅ |
| `AssociateFavorites` | ❤️ swipe → favorite (batches of 10, `alreadyFavorited` treated as done) | ✅ |
| `DisassociateFavorite` | ❌ on a previously favorited session → remove favorite | ✅ |
| `CreatePersonalTime` | Travel buffers between venues, Expo, meals, Ask the Experts | ⬜ |
| `UpdatePersonalTime` | Move buffers when the agenda changes | ⬜ |
| `DeletePersonalTime` | Remove buffers Reinvent:Match created that are no longer needed | ⬜ |
| `ReserveSessions` | Reserve the confirmed agenda | ⬜ |
| `CancelReservation` | Swap to a better-matching session, with confirmation | ⬜ |

Reinvent:Match only touches personal time entries it created (tagged in the description), never the attendee's own.

## Timeline

Goal: **the tool is complete before reserved seating opens on October 6**, so the author can use it for their own agenda on day one.

Reserved seating opens on **October 6** in the portal, but write access through the API (reserve/cancel) only opens on **October 8**. The plan for opening day accounts for that gap:

- **By October 5:** favorites are already synced to the official portal, and Reinvent:Match produces a *reservation plan*: the conflict-free agenda ordered by value × scarcity, with a backup for every slot. On October 6 the attendee reserves in the portal following that order, starting with the sessions most likely to fill up.
- **From October 8:** `reinvent-match reserve` reserves whatever is still missing through the API, falls back to the pre-approved backup when a session is full (`sessionFull`), reports clashes (`scheduleConflict` + `conflictsWith`), and a watcher polls seat availability for full sessions within the quotas.

| Dates | Milestone |
|---|---|
| Sep 24 | ✅ Match engine against public catalogs, concept docs, Builder ID sign-in |
| Sep 25 – 27 | `reinvent2026` catalog with the author's own profile; calibrate rules and weights on real data |
| Sep 28 – Oct 1 | Swipe (terminal) with ❤️/❌ synced to favorites; `GetSchedule` import |
| Oct 2 – 4 | Agenda builder (conflicts, travel between venues, opportunity cost, backups), personal time, reservation plan |
| **Oct 5** | Tool complete for opening day; dry run end to end |
| Oct 6 | Reserve in the portal following the plan |
| Oct 8 | `reinvent-match reserve` live against the API (first real test of write access) |
| Oct 9 – 20 | Seat watcher, swap suggestions, local swipe UI, MCP server |
| Oct 21 – 31 | Builder Center write-up, demo video with real results from Oct 6–8 |
| Before Nov 6 | Submit |

## Submission checklist

- [ ] Public repository (GitHub) with working code
- [ ] README: setup, dependencies, how to run (English + Spanish)
- [ ] Builder Center project: what, why, how it uses the API and MCP server
- [ ] Architecture diagram
- [ ] Demo video (≤ 3 min): profile → swipe → agenda → official portal
- [ ] No re:Invent catalog data committed (it is not public; tests use public Summit catalogs only)
- [ ] Unofficial project disclaimer; trademark review of the name
