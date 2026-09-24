# Hackathon plan

🇪🇸 [Versión en español](HACKATHON.es.md)

Re:Match is being built for the AWS Events API hackathon. Submission deadline: **November 6, 2026, 11:59 PM PT**.

## Judging criteria → what Re:Match brings

Four equally weighted criteria (25% each):

| Criterion | How Re:Match addresses it |
|---|---|
| **Creativity and novelty of the integration** | Person ↔ session matching instead of search. Explainable categories (Deep Dive, Growth, Foundation, Discovery, Skip), *irreplaceability* of in-person formats, learning paths across the week, opportunity cost of every choice. A local MCP server that **composes with** the official `awsevents` MCP server: the assistant uses ours to decide and theirs to act. |
| **Utility for re:Invent attendees** | Built for the 47% who are first-timers: turns 2,000+ sessions into ~15 with reasons, avoids sessions that are too basic or too advanced, and gets the agenda into the official portal (favorites, personal time, reservations). Works with Summits too. |
| **Technical depth and use of the API surface** | Uses all 12 operations (table below) and both surfaces (REST in the app, MCP alongside it). Handles OAuth PKCE with refresh and revocation, pagination, per-attendee quotas, per-session partial failures, the `409` before write access opens, and UTC-only personal time. |
| **Quality of the Builder Center project** | Write-up with the problem, the method, the architecture diagram, a demo video and the author's own before/after re:Invent agenda as a real case. |

## API surface coverage

| Operation | Re:Match feature | Status |
|---|---|---|
| `ListEvents` | `rematch events`: choose an event | ✅ |
| `GetEvent` | Event timezone and dates for the agenda | ⬜ |
| `ListSessions` | Full catalog download and cache | ✅ |
| `GetSession` | Refresh seat availability for shortlisted sessions before reserving | ⬜ |
| `GetSchedule` | Import existing favorites/reservations as signals and fixed agenda slots; verify every write | ⬜ |
| `AssociateFavorites` | ❤️ swipe → favorite | ⬜ |
| `DisassociateFavorite` | ❌ on a previously favorited session → remove favorite | ⬜ |
| `CreatePersonalTime` | Travel buffers between venues, Expo, meals, Ask the Experts | ⬜ |
| `UpdatePersonalTime` | Move buffers when the agenda changes | ⬜ |
| `DeletePersonalTime` | Remove buffers Re:Match created that are no longer needed | ⬜ |
| `ReserveSessions` | Reserve the confirmed agenda | ⬜ |
| `CancelReservation` | Swap to a better-matching session, with confirmation | ⬜ |

Re:Match only touches personal time entries it created (tagged in the description), never the attendee's own.

## Timeline

| Dates | Milestone |
|---|---|
| Sep 24 | ✅ Match engine against public catalogs, concept docs |
| Sep 25 – Oct 3 | `rematch login` (Builder ID), `reinvent2026` catalog, `GetSchedule` import, terminal swipe with favorites sync |
| Oct 4 – 8 | Agenda builder (conflicts, travel, opportunity cost), personal time, reservations. **Use it for the author's own agenda on Oct 6–8** |
| Oct 9 – 20 | Local swipe web UI, learning paths, swap suggestions (`CancelReservation` + `ReserveSessions`) |
| Oct 21 – 30 | MCP server, `npx` packaging, hardening (quotas, partial failures, token handling) |
| Oct 31 – Nov 4 | Builder Center write-up, demo video, screenshots, README polish |
| **Nov 5** | Submit (one day of buffer before the deadline) |

## Submission checklist

- [ ] Public repository (GitHub) with working code
- [ ] README: setup, dependencies, how to run (English + Spanish)
- [ ] Builder Center project: what, why, how it uses the API and MCP server
- [ ] Architecture diagram
- [ ] Demo video (≤ 3 min): profile → swipe → agenda → official portal
- [ ] No re:Invent catalog data committed (it is not public; tests use public Summit catalogs only)
- [ ] Unofficial project disclaimer; trademark review of the name
