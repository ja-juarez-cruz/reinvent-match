# How the match percentage works

🇪🇸 [Versión en español](SCORING.es.md)

Every session gets five scores from 0 to 1. Each is multiplied by its weight, a few adjustments follow, and the result is the percentage on the card (capped at 100%). The code is in [`src/plan/plan.ts`](../src/plan/plan.ts).

## The formula

| Component | What it measures | Weight* |
|---|---|---|
| **Relevance** | How squarely it hits your topics: main topic 1.0 · technology 0.9 · practice 0.7 · secondary topic 0.6, +0.08 per extra tag of yours (max 1.0), ×0.75 for a far-away topic | 30 |
| **Level** | Session level vs. your level *in that topic* (Basic → 200, Intermediate → 300, Advanced → 300/400): at level 1.0 · one above 0.6 · one below 0.5 · further 0.3 | 20 |
| **Format** | What only the event gives: hands-on 1.0 · chalk talk 0.95 · code talk 0.8 · breakout / exam prep 0.75 | 20 |
| **Depth** | Architecture signals in the description (trade-offs, failure modes, scale), 0–3 | 15 |
| **Coverage** | How many of your tags it touches (6+ is full) | 15 |

\* With Architecture among your topics. Otherwise relevance weighs 40 and depth 5.

Then, in this order:

1. **Multipliers:** sponsored ×0.7 · mentions a platform you don't use ×0.8 · assumes more AI than you marked ×0.55–1.0.
2. **Bonuses:** needs a reserved seat +3 · each ❤️ pick sharing a specific technology +3 (max +9) · customer story +2.
3. **Cap:** 100% on screen. Ranking uses the uncapped score, so two 100% sessions are still ordered.

Before scoring, your answers also **filter**: formats you didn't pick, sessions built around a platform you don't use, AI sessions that assume background you don't have, and levels two or more steps above you are left out.

## Worked examples

Public catalog of AWS Summit Dubai 2026 (95 sessions) with a sample profile: Intermediate in Networking, Serverless, Observability, Security, Developer tools and Migration; Basic in Containers and Architecture; "Some" AI background; hands-on and interactive formats only. 72 sessions are filtered out by format and 4 by other rules; 19 remain.

| Session | Relevance | Level | Format | Depth | Coverage | Base | Adjustments | **Match** |
|---|---|---|---|---|---|---|---|---|
| **CDN301** ELB cookbook: advanced recipes for ALB and NLB · 300 chalk talk | 30 | 20 | 19 | 10 | 12.5 | 91.5 | seat +3 | **95%** |
| **DVT305** Exploit a software vulnerability, then stop it · 300 workshop | 30 | 20 | 20 | 0 | 7.5 | 77.5 | seat +3 | **81%** |
| **ARC401** The Shapeshifting Application · 400 code talk | 30 | **6** | 16 | 10 | 12.5 | 74.5 | seat +3 | **78%** |
| **AIM302** Build an Agent Factory · 300 code talk | **18** | 20 | 16 | 10 | **0** | 64.0 | AI ×0.83, seat +3 | **56%** |
| **TNC203** AWS Certified Solutions Architect - Associate · 200 exam prep | **13.5** | 16 | **15** | 0 | 2.5 | 47.0 | seat +3 | **50%** |
| **ANT301** Bridging data with generative AI agents · 300 code talk | **13.5** | 20 | 16 | 0 | **0** | 49.5 | AI ×0.83, seat +3 | **44%** |

Why each one lands where it does:

- **CDN301, 95%.** Networking is its main topic, 300 matches Intermediate, it's a discussion format and it talks design (depth 2/3). It touches 5 of your tags; one more would make 100%.
- **DVT305, 81%.** Right topic, level and format, but no architecture depth and only 3 of your tags.
- **ARC401, 78%.** A perfect topic with the wrong level: 400 is two steps above your Basic in Architecture, so level gives 6 of 20 points.
- **AIM302, 56%.** AI is next to your topics but it touches none of your tags. It's a 300 AI session and your "Some" background covers 62% of what it assumes, so ×0.83.
- **TNC203, 50%.** Architecture only appears as a secondary topic of a certification session (far away, ×0.75), and exam prep scores 0.75 on format.
- **ANT301, 44%.** Analytics isn't one of your topics or next to them, none of your tags, and it assumes AI background.

On the full re:Invent catalog the same profile keeps about 1,060 of 2,000+ sessions. There, two more adjustments show up: a migration session that mentions Mainframe drops from 98% to 79% (×0.8), and a 300-level ECS session reaches 100% while Containers is Basic, because two ❤️ picks on Amazon ECS add +6.

## Order in each tab

The percentage is not the only order. In 💪 Reinforce, 🧭 Broaden and 🌱 Learn, sessions at your level always come first, then by uncapped score. Reinforce also deals its first cards topic by topic, so sessions that touch many topics at once can't crowd out any single topic of yours.
