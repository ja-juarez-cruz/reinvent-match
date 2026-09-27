# Hackathon plan

🇪🇸 [Versión en español](HACKATHON.es.md)

Reinvent:Match is being built for the AWS Events API hackathon. Submission deadline: **November 6, 2026, 11:59 PM PT**.

## Judging criteria → what Reinvent:Match brings

Four equally weighted criteria (25% each):

| Criterion | How Reinvent:Match addresses it |
|---|---|
| **Creativity and novelty of the integration** | Person ↔ session matching instead of search. Explainable categories (Deep Dive, Growth, Foundation, Discovery, Skip), *irreplaceability* of in-person formats, learning paths across the week, opportunity cost of every choice. A local MCP server that **composes with** the official `awsevents` MCP server: the assistant uses ours to decide and theirs to act. |
| **Utility for re:Invent attendees** | Built for the 47% who are first-timers: turns 2,000+ sessions into ~15 with reasons, avoids sessions that are too basic or too advanced, fills the week around real schedules and walks between venues, and gets the agenda into the official portal (favorites and reservations today, personal time next). Works with Summits too. |
| **Technical depth and use of the API surface** | Uses 7 of the 12 operations today, with the other 5 planned (table below), and aims at both surfaces (REST in the app, MCP alongside it). Handles OAuth PKCE with refresh and revocation, pagination, per-attendee quotas, per-session partial failures, the `409` before write access opens, and UTC-only personal time. |
| **Quality of the Builder Center project** | Write-up with the problem, the method, the architecture diagram, a demo video and the author's own before/after re:Invent agenda as a real case. |

## API surface coverage

| Operation | Reinvent:Match feature | Status |
|---|---|---|
| `ListEvents` | `reinvent-match events`: choose an event | ✅ |
| `GetEvent` | 📅 Calendar reads the event's own time zone to write personal time and the .ics in UTC | ✅ |
| `ListSessions` | Full catalog download and cache | ✅ |
| `GetSession` | 🎟 Reservations → ↻ Check seats: fresh seat band (available, limited, very limited, full) for each session still to book | ✅ |
| `GetSchedule` | `reinvent-match schedule`; My Match shows current favorites and reservations; every sync re-reads it; Import from re:Invent brings portal favorites back as picks | ✅ |
| `AssociateFavorites` | ❤️ swipe → favorite (batches of 10, `alreadyFavorited` treated as done) | ✅ |
| `DisassociateFavorite` | ❌ on a previously favorited session → remove favorite | ✅ |
| `CreatePersonalTime` | My Match → 📅 Calendar: lunch, walks between venues and free time around the picks, as personal time. Sent in the event's local time: the API reference says UTC, but the AWS Events app shows the value as local time | ✅ |
| `UpdatePersonalTime` | Re-syncing moves a block that changed time (same kind, same day) in place | ✅ |
| `DeletePersonalTime` | Re-syncing removes the blocks Reinvent:Match added that no longer apply; the attendee's own are never touched | ✅ |
| `ReserveSessions` | My Match → Reservations: books the ❤️ sessions in priority order, ten at a time, and a backup when one is full (live from October 8) | ✅ |
| `CancelReservation` | Cancel a reservation from the Reservations view, with an inline confirmation | ✅ |

Reinvent:Match only touches personal time entries it created (tagged in the description), never the attendee's own.

## Timeline

Goal: **the tool is complete before reserved seating opens on October 6**, so the author can use it for their own agenda on day one.

Reserved seating opens on **October 6** in the portal, but write access through the API (reserve/cancel) only opens on **October 8**. The plan for opening day accounts for that gap:

- **By October 5:** favorites are already synced to the official portal, and Reinvent:Match produces a *reservation plan*: the conflict-free agenda ordered by value × scarcity, with a backup for every slot. On October 6 the attendee reserves in the portal following that order, starting with the sessions most likely to fill up.
- **From October 8:** My Match → 🎟 Reservations → **Reserve N in this order** reserves whatever is still missing through the API, offers the backup when a session is full (`sessionFull`) and reports clashes (`scheduleConflict` + `conflictsWith`). Next: a watcher that polls seat availability for full sessions within the quotas.

| Dates | Milestone |
|---|---|
| Sep 24 | ✅ Match engine against public catalogs, concept docs, Builder ID sign-in |
| Sep 25 – 27 | ✅ Rules and weights calibrated with seven test personas; `reinvent2026` with the author's own profile still to do |
| Sep 28 – Oct 1 | ✅ Swipe (web) with ❤️ synced to favorites; import from the portal (`GetSchedule`) |
| Oct 2 – 4 | ✅ My Match (clashes, travel between venues, free time, backups), Fill my week, reservation plan, booking through the API, personal time and .ics |
| **Oct 5** | Tool complete for opening day; dry run end to end |
| Oct 6 | Reserve in the portal following the plan |
| Oct 8 | `reinvent-match reserve` live against the API (first real test of write access) |
| Oct 9 – 20 | Seat watcher, swap suggestions, local swipe UI, MCP server |
| Oct 21 – 31 | Builder Center write-up, demo video with real results from Oct 6–8 |
| Before Nov 6 | Submit |

## Submission checklist

- [x] Public repository (GitHub) with working code
- [x] README: setup, dependencies, how to run (English + Spanish)
- [ ] Builder Center project: what, why, how it uses the API and MCP server
- [ ] Architecture diagram
- [ ] Demo video (≤ 3 min): profile → swipe → agenda → official portal
- [x] No re:Invent catalog data committed (it is not public; tests use public Summit catalogs only)
- [ ] Unofficial project disclaimer; trademark review of the name
