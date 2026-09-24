# Re:Match

🇪🇸 [Versión en español](README.es.md)

**Tinder for person ↔ session.** AWS re:Invent has 2,000+ sessions. Re:Match doesn't tell you which ones are *the best*, it tells you which ones *fit you*: based on what you already know, what you want to grow and what you want to explore. Every recommendation says why.

> Unofficial community project, not affiliated with AWS. Uses the official [AWS Events API](https://docs.aws.amazon.com/events/latest/devguide/what-is-events-api.html).

```
🔥 Deep Dive
   79%  ARC401     The Shapeshifting Application: Architecture That Transforms Across AWS
        Code talk · 400 – Expert · 2026-09-30 15:15 · Floor 0, Code Talks
        ✅ About "AWS Lambda" (you know it), tagged "AWS Lambda".
        ℹ️  Level 400 matches your proficiency in "AWS Lambda" (advanced); expect depth, not new ground.
        ✅ Code talk: interactive and hard to get outside the event.
        ✅ Discusses design trade-offs (architecture depth 2/3), aligned with your architecture goal.
```

## How it works

1. **Profile.** You sort topics and services into four buckets: 🟢 *Know*, 🟡 *Grow*, 🔵 *Explore*, ⚪ *Ignore*, each with a proficiency from 0 to 3.
2. **Level fit.** For each session, `stretch = session level − your proficiency`. One step above what you know is the sweet spot; below it is a skip.
3. **Categories.** Each session lands in 🔥 Deep Dive, 🚀 Growth, 📚 Foundation, 🧭 Discovery or ⏭️ Skip.
4. **Ranking.** Within a category, sessions are ranked by goal alignment, level fit, *irreplaceability* (chalk talks and workshops over recorded breakouts), format preference and architecture depth.

The full design is in [docs/CONCEPT.md](docs/CONCEPT.md). Built for the AWS Events API hackathon: see [docs/HACKATHON.md](docs/HACKATHON.md).

## Quick start

Requires Node.js 20+.

```bash
npm install
npm run ui
```

This builds the web UI and opens Re:Match in your browser at `http://127.0.0.1:8484`. It runs entirely on your machine:

1. **Event:** pick re:Invent (sign in with your AWS Builder ID) or a public Summit catalog, and download it.
   **Insights:** every session tagged on nine dimensions (topic, technology, audience, learning style, content type, concept, level…) with drill-down charts. See [docs/TAXONOMY.md](docs/TAXONOMY.md).
2. **About you:** four questions. What you already know (up to 8 topics; each one brings its technologies and practices along, e.g. Serverless → Lambda, Step Functions, API Gateway, event-driven), what you want to learn (optional, up to 5 topics), the level you identify with (basic, intermediate, advanced) and the formats you want (one, several or all).
3. **Swipe:** your pre-list split into 💪 **Reinforce** (what you know, at your level or above), 🧭 **Broaden** (what you know, into neighboring topics) and 🌱 **Learn** (new ground at an entry level that fits you). Each card says why. ← not for me · ↓ maybe · → interested · U undo. Beside it, **Your learning plan** fills in with every ❤️: what you will reinforce, broaden and learn, the skills you will develop, hours, hands-on sessions and overlaps.
4. **Shortlist:** your picks by day with overlaps flagged, the learning plan, and one click to send ❤️ to your official re:Invent favorites.

Your data stays in `~/.rematch/` (tokens readable only by you, catalogs, profiles, swipes).

### Command line

```bash
npm run dev -- events                                   # list AWS events
npm run dev -- fetch Summit-Dubai-2026                  # public catalog, no sign-in needed
npm run dev -- vocab Summit-Dubai-2026                  # labels you can use in your profile
npm run dev -- match Summit-Dubai-2026 -p examples/profile.example.json --explain
```

Match options:

| Option | Description |
|---|---|
| `-p, --profile <file>` | Profile JSON ([example](examples/profile.example.json)) |
| `-c, --category <list>` | `deep-dive,growth,foundation,discovery,skip` |
| `-n, --top <n>` | Sessions per category (default 10) |
| `-e, --explain` | Show the reasons behind each match |
| `--json` | Machine-readable output |

### re:Invent 2026

The re:Invent catalog is only readable by registered attendees. Sign in with your AWS Builder ID first:

```bash
npm run dev -- login                    # opens the browser; callback on 127.0.0.1:8484
npm run dev -- schedule reinvent2026    # check access: your reservations and favorites
npm run dev -- fetch reinvent2026
npm run dev -- match reinvent2026 -p my-profile.json --explain
npm run dev -- logout --browser         # revoke tokens and end the Builder ID session
```

Tokens are stored in `~/.rematch/credentials.json` (readable only by you) and refreshed automatically. The downloaded catalog stays in `~/.rematch/cache/`, outside the repository: the re:Invent catalog is not public and must never be committed.

## Development

```bash
npm test          # unit tests + regression against a public catalog snapshot
npm run typecheck
npm run build     # emits dist/ with the `rematch` binary
```

```
web/            React UI served by the local server
src/
├── server/     local HTTP server: UI, /api for the UI, sign-in callback
├── store/      profiles and swipes in ~/.rematch
├── sync/       favorites sync (AssociateFavorites / DisassociateFavorite)
├── auth/       Builder ID sign-in (OAuth PKCE), token storage and refresh
├── api/        AWS Events API client and types
├── catalog/    session normalization and local cache
├── profile/    profile schema and loading
├── match/      match engine, label aliasing, topic neighbor graph
├── taxonomy/   session tagging on nine dimensions and the catalog report
├── plan/       onboarding answers and the Reinforce / Broaden / Learn pre-list
└── cli.ts
```

## Roadmap

- [x] Match engine against public catalogs
- [x] Builder ID sign-in (OAuth PKCE on `127.0.0.1:8484`)
- [ ] `reinvent2026` catalog calibrated with a real profile
- [x] Local web app: profile editor, swipe, shortlist
- [x] Swipe ❤️ → official favorites
- [ ] Agenda: conflicts, travel between venues, opportunity cost, personal time
- [ ] Reservations with explicit confirmation (from October 8, 2026)
- [ ] Local swipe UI and MCP server
