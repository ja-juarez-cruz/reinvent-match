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

The full design is in [docs/CONCEPT.md](docs/CONCEPT.md).

## Quick start

Requires Node.js 20+.

```bash
npm install
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

The re:Invent catalog is only readable by registered attendees. Built-in Builder ID sign-in (`rematch login`) is in progress. Until then, `fetch` uses a token from the `REMATCH_ACCESS_TOKEN` environment variable if one is set.

## Development

```bash
npm test          # unit tests + regression against a public catalog snapshot
npm run typecheck
npm run build     # emits dist/ with the `rematch` binary
```

```
src/
├── api/        AWS Events API client and types
├── catalog/    session normalization and local cache
├── profile/    profile schema and loading
├── match/      match engine, label aliasing, topic neighbor graph
└── cli.ts
```

## Roadmap

- [x] Match engine against public catalogs
- [ ] Builder ID sign-in (OAuth PKCE on `localhost:8484`) and `reinvent2026` catalog
- [ ] Swipe ❤️ → official favorites
- [ ] Agenda: conflicts, travel between venues, opportunity cost, personal time
- [ ] Reservations with explicit confirmation (from October 8, 2026)
- [ ] Local swipe UI and MCP server
