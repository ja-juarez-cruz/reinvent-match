# Re:Match: concept and initial design

🇪🇸 [Versión en español](CONCEPT.es.md)

> Tinder for **person ↔ session**: it doesn't look for *the best session at re:Invent*, it looks for *the session that fits you best*, and explains why.

Unofficial community project, not affiliated with AWS.

---

## 1. Problem

re:Invent has more than 2,000 sessions spread across several venues. First-time attendees:

- don't know which level (100–500) is right for them **per topic**;
- pick by title and end up in sessions that explain from scratch what they already know, or in 400-level sessions on topics they have never touched;
- don't account for overlapping sessions, travel time between venues, or what they give up by choosing one session;
- spend in-person time on content that gets published as a recording later.

**The question the product answers:** *given what I know, what I want to learn and the time I have, which sessions give me the most value?*

## 2. Principles

1. **Profile first.** Matching starts from the person, not the catalog.
2. **Personal fit, not absolute ratings.** The same session can be a *Deep Dive* for one person and a *Skip* for another.
3. **Every recommendation says why.** Each result shows reasons in favor and potential issues.
4. **Prioritize what is hard to get outside the event.** Workshops, chalk talks and builders' sessions are worth more than a breakout that ends up on YouTube.
5. **Rules before AI.** v1 runs on metadata, rules and scoring. An LLM may enrich data and interpret the profile, never decide.

## 3. Attendee profile

Each topic or service goes into one of four buckets:

| Bucket | Meaning | Example |
|---|---|---|
| 🟢 **Know** | I use it regularly | Lambda, DynamoDB, API Gateway, SQS, Step Functions |
| 🟡 **Grow** | I want to go deeper | Distributed systems, resiliency, multi-region, EDA |
| 🔵 **Explore** | I barely know it, but I'm interested | EKS, Bedrock, Kafka, SageMaker |
| ⚪ **Ignore** | Not relevant right now | (whatever the person decides) |

Plus:

- **Proficiency per topic** (0–3): `0` none · `1` basic · `2` practical · `3` advanced.
- **Goals** (several): deepen what I know · learn new technologies · prepare for an architecture role · hands-on · networking.
- **Format preferences**: workshop, chalk talk, builders, code talk, lab, breakout.
- **Capacity**: sessions per day, days attending, reserved blocks (Expo, meals, keynotes).

```json
{
  "goals": ["architecture-role", "learn-new", "hands-on"],
  "interests": [
    { "name": "AWS Lambda", "bucket": "know", "proficiency": 3 },
    { "name": "Amazon DynamoDB", "bucket": "know", "proficiency": 3 },
    { "name": "Multi-Region", "bucket": "grow", "proficiency": 1, "keywords": ["cross-region"] },
    { "name": "EKS", "bucket": "explore" },
    { "name": "SAP", "bucket": "ignore" }
  ],
  "formatPreferences": { "chalk-talk": 1, "workshop": 0.9, "breakout": 0.4 }
}
```

Each `name` can be a catalog label (`"AWS Lambda"`, `"Agentic AI"`) or a free concept (`"Multi-Region"`) searched in titles and abstracts. Aliases resolve automatically: `"EKS"` finds `"Amazon Elastic Kubernetes Service (Amazon EKS)"`. Full example: [`examples/profile.example.json`](../examples/profile.example.json).

## 3b. Onboarding v2: answers instead of a profile editor (implemented)

The web app asks four questions instead of exposing the Know/Grow/Explore/Ignore editor:

1. **What you know:** up to 8 tags from the taxonomy (topics, technologies, practices). The cap forces sharp picks.
2. **What you want to learn:** optional, up to 5. Without it, "Learn" is inferred; AI is in 71% of re:Invent sessions, so naming a goal keeps that list focused.
3. **Level:** basic, intermediate or advanced, applied to what you know (targets 200 / 300 / 400) and to new topics (100–200 / 200–300 / 300).
4. **Formats:** one, several or all; a hard filter.

Every session in the chosen formats gets one intent (see [`src/plan/plan.ts`](../src/plan/plan.ts)):

| Intent | Rule |
|---|---|
| 💪 Reinforce | a known tag is central to the session and its main topic is one you know; hidden if two or more levels below yours |
| 🌱 Learn (explicit) | the session covers something you want to learn |
| 🧭 Broaden | uses what you know in another topic, or its main topic is known or next to a known one |
| 🌱 Learn (inferred) | everything else, only when you did not name learning goals |

**Your learning plan** turns every ❤️ into four groups: what you **reinforce** (known tags, and technologies inside a known topic), what you **broaden** (new tags next to what you know), what you **learn** (your goals and new ground) and the **skills** you develop (architecture and engineering concepts). The CLI `rematch match` still uses the profile model in §3.

## 4. Session model

The source is the `Session` object from the [AWS Events API](https://docs.aws.amazon.com/events/latest/devguide/what-is-events-api.html) (see §8). It already carries almost everything needed, so v1 **needs no LLM** for enrichment.

| Re:Match field | API field | Real example (Summit Dubai 2026) |
|---|---|---|
| `id`, `code` | `sessionId`, `abbreviation` | `AIM201` |
| `title`, `abstract` | `title`, `abstract` | |
| `level` (0–3) | `level` (text) | `"300 – Advanced"` → 2 · `"No Level"` → no level |
| `format` | `type` | Breakout session, Chalk talk, Workshop, Code talk, Lightning talk… |
| `handsOn`, `discussion` | `features` | Lecture-style, Discussion, Hands-on |
| `tags` | `topics` + `areasOfInterest` + `services` | Architecture · Agentic AI · Amazon Bedrock |
| `schedule` | `sessionTime` (date, local time, minutes), `venue`, `room` | |
| `seatAvailability` | `isReservable`, `seatAvailability` | available · limited · veryLimited · unavailable · walkUp |
| `restrictedTo` | `experiences` | "Executive Summit": may be restricted |
| `archDepth` (0–3) | derived | design signals in the text (trade-offs, failure, at scale…) + Architecture topic; optional LLM later |
| `isCustomerStory` | derived | `Customer story` feature or title patterns: "How X…", "Lessons learned…" |
| `isSponsored` | derived | `-S` code suffix or "(sponsored by …)" |

**The profile vocabulary comes from the catalog itself:** the topics and services a person marks as Know, Grow, Explore or Ignore are the same values used in `topics`, `areasOfInterest` and `services`. There is no custom taxonomy to maintain, only the neighbor graph used for Discovery. Catalogs mix English and localized labels (`"Charlas explicativas"`, `"100 (Beginner)"`), and normalization handles both.

## 5. Match engine

### 5.1 Level fit per topic (the core)

Session levels map onto the proficiency scale: `100→0, 200→1, 300→2, 400→3, 500→3`.

```
stretch = session_level − attendee_proficiency   (on the main topics)

stretch ≤ −1  → too basic
stretch =  0  → review; only useful at 300/400
stretch = +1  → sweet spot
stretch ≥ +2  → too advanced; take a Foundation session first
```

This is the rule *"known service → 300/400; unknown service → 100/200"* in a form that can be computed.

### 5.2 Evidence

Each profile interest is searched for in the session. Strength depends on where it appears:

| Where | Strength |
|---|---|
| Exact catalog tag (`services`, `topics`, `areasOfInterest`) | 1.0 |
| Tag that contains it ("Architecture" inside "Event-Driven Architecture") | 0.9 |
| Title | 0.8 |
| Abstract only | 0.5 |
| Neighbor concept (topic graph) | × 0.7 |

**A passing mention in an abstract is not enough for Deep Dive or Growth**: if that is the only evidence, the session becomes Discovery.

### 5.3 Categories (the core UX)

Filtered out first: breaks, keynotes (planned separately), sessions restricted to a program (`experiences`), and sessions where an *Ignore* topic has as much or more evidence than anything else. Then the rules below are evaluated in order and the first one that applies wins:

| Category | Rule |
|---|---|
| 🔥 **Deep Dive** | *Know* topic with `stretch ≥ 0`, and level ≥ 300 or `stretch ≥ +1` |
| 📚 **Foundation** | *Explore/Grow* topic, level 100/200 and `stretch ≥ 0` |
| 🚀 **Growth** | *Grow* topic with `stretch ≥ 0` (warning if `stretch ≥ +2`) |
| 🧭 **Discovery** | *Explore* topic, a **neighbor** of what you know or want to grow (`step functions → saga → distributed transactions`), or abstract-only evidence |
| ⏭️ **Skip** | none of the above; usually `stretch ≤ −1` (too basic) |

Sessions that share nothing with the profile are flagged `unrelated` and hidden.

> Pending for the agenda phase: Foundation should also require being a prerequisite for a high-match session later in the week.

### 5.4 Match percentage (ranks sessions within a category)

```
match = 0.30·goal_alignment     (Grow 1.0 · Explore 0.8 · Know 0.6, × strength, + goal bonuses)
      + 0.25·level_fit          (stretch +1 → 1.0 · 0 → 0.7 at 300+ / 0.4 · +2 → 0.4 · ≤−1 → 0)
      + 0.20·irreplaceability   (builders/workshop 1.0 · chalk 0.95 · code talk 0.8 · breakout 0.3)
      + 0.15·format_preference  (from the profile; 0.5 when not set)
      + 0.10·arch_depth         (archDepth / 3)
× 0.85 for sponsored sessions (-S)
```

Weights can be overridden per profile (`weights`). They are a starting point to calibrate, not ground truth.

### 5.5 Explanations

Each component produces its own reasons, so a percentage never appears without context. Real output against the Summit Dubai 2026 catalog:

```
🔥 Deep Dive
   79%  ARC401     The Shapeshifting Application: Architecture That Transforms Across AWS
        Code talk · 400 – Expert · 2026-09-30 15:15 · Floor 0, Code Talks
        ✅ About "AWS Lambda" (you know it), tagged "AWS Lambda".
        ℹ️  Level 400 matches your proficiency in "AWS Lambda" (advanced); expect depth, not new ground.
        ℹ️  Also touches: Architecture, EKS, Containers.
        ✅ Code talk: interactive and hard to get outside the event.
        ✅ Discusses design trade-offs (architecture depth 2/3), aligned with your architecture goal.
```

### 5.6 Swipe and learning

❤️ interested · ❌ not for me · 🔖 save. Each swipe gradually adjusts the weight of the session's topics in the profile (e.g. 8 ❤️ on EKS moves EKS from *Explore* toward *Grow*). The user sees the change and can undo it.

## 6. From candidates to agenda

```
2,000+ sessions → Skip/Ignore filter → ~80 candidates (match + ❤️ swipes)
  → schedule conflicts and travel → ~30
  → opportunity cost + learning paths → ~15 sessions on the agenda
```

- **Constraints:** no two sessions at once; travel time when the venue changes (configurable, longer for distant venues); a maximum number of sessions per day; reserved blocks (Expo, Ask the Experts, meals) are respected.
- **Opportunity cost:** picking A shows the best alternative lost: *"You chose the 2h workshop; that rules out 2 chalk talks at 88% and 85%"*.
- **Learning paths:** a 72% session that is the Foundation for a 95% session later in the week gets a bonus, with an explanation.
- **v1 algorithm:** greedy weighted interval scheduling with a travel penalty. Enough for ~80 candidates; switch to a constraint solver if needed.
- **Suggested mix** (editable): 35% architecture · 25% deepen known · 25% new technologies · 15% exploration.

## 7. After the event (validation)

For each session attended: did it meet expectations? · too basic or too advanced? · would you attend again? · did the format help? This calibrates the weights and `stretch` rules, and turns *"my agenda"* into *a reproducible method*.

## 8. Data source: AWS Events API

Official API (REST at `https://api.awsevents.com/v1` + MCP server at `https://api.awsevents.com/mcp`). The OpenAPI description is served at `/v1/openapi.json`.

**What it offers**

| Operation | Use in Re:Match |
|---|---|
| `ListEvents`, `GetEvent` | Pick the event (no credentials) |
| `ListSessions` (up to 250 per page, `nextToken`) | Download the full catalog: ~2,200 sessions ≈ 9 pages |
| `GetSchedule` | Read what the attendee already reserved or favorited |
| `AssociateFavorites` | ❤️ swipe → favorite in the official portal |
| `CreatePersonalTime` | Expo, meal and travel blocks, straight into the official agenda |
| `ReserveSessions` | Reserve the final agenda (from October 8) |

**Constraints that shape the architecture**

1. **No hosted option.** Sign-in is OAuth + PKCE with AWS Builder ID, and the callback **only accepts loopback on ports 8484–8489** (`http://localhost:8484/callback`). The app must run on each attendee's machine.
2. **The re:Invent 2026 catalog is not public.** Reading it requires signing in *and* being registered for the event. We cannot download it to a server and redistribute it: each person reads it with their own session.
3. **Catalogs of events without registration (Summits, Cloud Days) are public.** They are used for development and tests without credentials, e.g. `Summit-Dubai-2026` with 95 sessions and every field in §4.
4. **The API does not search or filter**: download everything and filter client-side, which is exactly what the match engine does.
5. **Per-attendee quotas per minute:** ListSessions 120 · GetSession 120 · AssociateFavorites and ReserveSessions **30 sessions** (each session counts, not each request) · CreatePersonalTime 30.
6. **Tokens:** 60-minute access token, 30-day refresh token. Store them securely and offer sign-out (revocation).
7. **Per-session results:** reserving or favoriting can fail for some sessions and succeed for others. Always confirm with `GetSchedule` after writing.
8. **Times:** `sessionTime` is in the event's local time; `PersonalTime` requires **UTC**, in 5-minute increments.

## 9. Proposed architecture: local app

```
┌──────────────────── attendee's machine ───────────────────────┐
│                                                               │
│  rematch (CLI + web UI on 127.0.0.1:8484)                     │
│   ├─ auth      OAuth PKCE Builder ID → ~/.rematch (0600)      │
│   ├─ catalog   ListSessions → local cache (JSON)              │
│   ├─ profile   profile.json (Know/Grow/Explore/Ignore)        │
│   ├─ match     rules + scoring + explanations                 │
│   ├─ agenda    conflicts, travel, opportunity cost            │
│   └─ sync      ❤️→AssociateFavorites · blocks→PersonalTime    │
│                final agenda→ReserveSessions → GetSchedule     │
│                                                               │
└───────────────┬───────────────────────────────────────────────┘
                │ HTTPS (the attendee's own token)
                ▼
      api.awsevents.com  ·  oauth.awsevents.com
```

- **Why a local server and not a web page calling the API:** unauthenticated catalog reads allow any origin (`Access-Control-Allow-Origin: *`), but the CORS preflight for requests carrying `Authorization` returns `404`, and the token endpoint only allows the `127.0.0.1:8484` origin. Signed-in calls must come from a local process. The UI talks to the local server (`/api/...`), which holds the token and calls the AWS Events API; the token never reaches the browser.
- **Local server hardening:** binds to `127.0.0.1` only, rejects any `Host` other than `127.0.0.1:<port>`/`localhost:<port>` (DNS rebinding), and requires an `X-Rematch` header on every write (other websites cannot send it without a CORS preflight the server never approves).
- **Nothing leaves the machine**: profile, swipes and catalog stay local. That solves privacy and respects the catalog not being public.
- **Distribution:** a TypeScript npm package (`npx rematch`) that opens the swipe UI in the browser at `localhost:8484`, the same port as the sign-in callback.
- **MCP companion (Phase 2b):** expose `rematch` as a local MCP server (`match_sessions`, `explain_match`, `build_agenda`) so an assistant (Claude Code, Kiro) can combine it with the official `awsevents` MCP server. Scoring 2,200 sessions happens in code, not in the LLM's context.
- **Optional LLM:** turn a free-text profile into `profile.json` and refine `archDepth`, using the user's own account or assistant, never a backend of ours.
- **If a backend ever exists** (e.g. to calibrate weights from post-event feedback), it only receives anonymous, opt-in Phase 3 data, never the catalog.

## 10. Phased plan

re:Invent 2026: **Nov 30 – Dec 4**, Las Vegas. Reserved seating opens **October 6** in the portal and **October 8** through the API (before then, reserving returns `409`; reading the catalog and favoriting already work). The hackathon deadline is **November 6**; the detailed timeline and API coverage are in [HACKATHON.md](HACKATHON.md).

| Phase | Target date | Deliverable | Why |
|---|---|---|---|
| **0 · Method** | ✅ Sep 24 | This document | Without a solid method, the code doesn't matter |
| **1 · Engine on public data** | ✅ Sep 24 | CLI: `rematch match Summit-Dubai-2026 --profile profile.json` → candidates with category and reasons. Neighbor graph. Tests against Summit catalogs | Calibrate rules without credentials |
| **1b · Your re:Invent** | Oct 3 | Builder ID sign-in + `reinvent2026` catalog + your profile → candidates; terminal swipe; ❤️ → official favorites | Have a shortlist **before** October 6 |
| **2 · Agenda + reservation** | Oct 6–8 | Conflicts, travel, opportunity cost → agenda → `CreatePersonalTime` + `ReserveSessions` with confirmation | Reserve on opening day |
| **2b · Swipe UI + MCP** | Oct–Nov | Local UI on `localhost:8484`, installable package, MCP server | Other first-timers can use it before the event |
| **3 · Validation** | Dec | Post-session survey + recalibration | Makes the method reproducible |
| **4 · Content** | Dec–Jan | Community Builder post: *"2,000+ sessions: how I built my personal learning path"* | Reach |

## 11. Risks and open questions

1. **Very short window.** If Phase 1b isn't ready by October 3, plan B is to use the engine for the shortlist and reserve manually in the portal on October 6.
2. **Sessions without a level or with poor tags** (`"No Level"`, empty `services`): fall back to `topics` and `areasOfInterest`, and lower match confidence (shown in the explanation).
3. **Automatic reservation.** Reserving has real effects (limited seats, time conflicts). Re:Match never reserves without the attendee confirming the final list, and verifies with `GetSchedule` afterwards.
4. **Tokens.** Stored in `~/.rematch/credentials.json`, readable only by the owner (0600); moving to the OS keychain is a later improvement. `rematch logout` revokes the refresh token, and `--browser` also ends the Builder ID session.
5. **Name and trademark.** "Re:Match" plays on an AWS trademark: state that it is unofficial and review the trademark guidelines.
6. **Scope.** The API covers re:Invent, Summits and other AWS events, so the model is generic from day one at no extra cost.
