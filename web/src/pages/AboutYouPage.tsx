import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api";
import { navigate } from "../App";
import type { Answers, OnboardingOptions, SelfLevel, Vocabulary, VocabularyEntry } from "../types";

interface Props {
  eventId: string | null;
  answersId: string | null;
  onSaved: (id: string) => void;
}

const STEPS = ["What you want to learn", "What you know & your level", "Your platforms", "AI background", "Formats"] as const;

const LEVEL_CARDS: { id: SelfLevel; title: string; body: string }[] = [
  {
    id: "basic",
    title: "Basic",
    body: "You have used these services and follow guides or examples. Re:Match aims at 200-level on what you know and 100–200 on new topics.",
  },
  {
    id: "intermediate",
    title: "Intermediate",
    body: "You build and run production workloads with them. Re:Match aims at 300-level on what you know and 200–300 on new topics.",
  },
  {
    id: "advanced",
    title: "Advanced",
    body: "You design systems and make trade-offs with them. Re:Match aims at 400-level on what you know and 300 on new topics.",
  },
];

const EMPTY: Answers = { known: [], learn: [], level: "intermediate", ignore: [], ai: {}, formats: [] };

export function AboutYouPage({ eventId, answersId, onSaved }: Props) {
  const [options, setOptions] = useState<OnboardingOptions | null>(null);
  const [vocab, setVocab] = useState<Vocabulary | null>(null);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  /** The platforms step needs an explicit answer: new attendees start with nothing marked as used. */
  const [platformsAnswered, setPlatformsAnswered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.onboarding().then((o) => {
      setOptions(o);
      setAnswers((a) => (a.formats.length ? a : { ...a, formats: o.formats.map((f) => f.id) }));
    });
    api.answers().then((list) => {
      const saved = list.find((a) => a.id === answersId) ?? list[0];
      if (saved) {
        setAnswers({ ...EMPTY, ...saved.answers, ai: saved.answers.ai ?? {}, ignore: saved.answers.ignore ?? [] });
        setPlatformsAnswered(true);
      }
    });
  }, [answersId]);

  useEffect(() => {
    if (eventId) api.vocabulary(eventId).then(setVocab, (e: Error) => setError(e.message));
  }, [eventId]);

  const labels = useMemo(() => {
    // Tags outside the listed vocabulary still read well: "tech:AWS AppSync" → "AWS AppSync".
    const map = new Map<string, string>();
    for (const d of vocab?.domains ?? []) {
      for (const key of d.related ?? []) map.set(key, key.slice(key.indexOf(":") + 1));
    }
    for (const e of [...(vocab?.domains ?? []), ...(vocab?.technologies ?? []), ...(vocab?.concepts ?? [])]) {
      map.set(e.key, e.label);
    }
    return map;
  }, [vocab]);

  if (!eventId) {
    return (
      <section className="page">
        <div className="panel">
          <p>Choose an event and download its catalog first.</p>
          <button className="primary" onClick={() => navigate("home")}>
            Choose event →
          </button>
        </div>
      </section>
    );
  }
  if (!options || !vocab) return <section className="page muted">{error ?? "Loading the catalog's topics…"}</section>;

  const canContinue = [answers.learn.length > 0, answers.known.length > 0, platformsAnswered, true, answers.formats.length > 0][step];
  const platformIds = vocab.platforms.map((p) => p.id);
  // Stored as the platforms to leave out; asked as the ones the attendee works with.
  const usedPlatforms = platformsAnswered ? platformIds.filter((id) => !answers.ignore.includes(id)) : [];
  const setUsedPlatforms = (used: string[]) => {
    setPlatformsAnswered(true);
    setAnswers({ ...answers, ignore: platformIds.filter((id) => !used.includes(id)) });
  };
  const leftOut = new Set(
    vocab.platforms.filter((p) => !usedPlatforms.includes(p.id)).flatMap((p) => p.sessionIds),
  ).size;
  const aiShare = Math.round((100 * (vocab.domains.find((d) => d.key === "domain:ai")?.count ?? 0)) / Math.max(vocab.total, 1));

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      const id = answersId ?? "me";
      await api.saveAnswers(id, answers);
      onSaved(id);
      navigate("swipe");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page">
      <div>
        <h1>Tell us about you</h1>
        <p className="lead">Five quick questions. Re:Match uses them to build a pre-list of sessions, split by what each one does for you.</p>
      </div>

      <ol className="wizard-steps">
        {STEPS.map((label, i) => (
          <li key={label} className={i === step ? "active" : i < step ? "done" : ""}>
            <button className="link" onClick={() => setStep(i)}>
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      <div className="panel wizard-body">
        {step === 0 && (
          <>
            <h2>What do you want to learn or go deeper on?</h2>
            <p className="muted">
              Pick 1 to <strong>{options.maxLearn}</strong> topics. They can be new to you or ones you already know and
              want to master; Re:Match builds your pre-list around them.
            </p>
            <TagPicker
              vocab={vocab}
              selected={answers.learn}
              exclude={[]}
              max={options.maxLearn}
              labels={labels}
              onChange={(learn) => setAnswers({ ...answers, learn })}
            />
          </>
        )}
        {step === 1 && (
          <>
            <h2>What are you already familiar with?</h2>
            <p className="muted">
              Pick up to <strong>{options.maxKnown}</strong> topics you work with. Each topic brings its technologies and
              practices along. Topics marked 📈 are ones you want to go deeper on: pick them here too if you already work
              with them, and Re:Match will look for sessions that take you further.
            </p>
            <TagPicker
              vocab={vocab}
              selected={answers.known}
              exclude={[]}
              wanted={answers.learn}
              max={options.maxKnown}
              labels={labels}
              onChange={(known) => setAnswers({ ...answers, known })}
              afterTopics={
                <div>
                  <h3 className="level-title">Which level do you identify with in these topics?</h3>
                  <div className="level-grid">
                    {LEVEL_CARDS.map((l) => (
                      <button
                        key={l.id}
                        className={`level-card ${answers.level === l.id ? "selected" : ""}`}
                        onClick={() => setAnswers({ ...answers, level: l.id })}
                      >
                        <strong>{l.title}</strong>
                        <span className="muted small">{l.body}</span>
                      </button>
                    ))}
                  </div>
                </div>
              }
            />
          </>
        )}
        {step === 2 && (
          <>
            <h2>Which of these platforms do you work with?</h2>
            <p className="muted">
              Many sessions are built around one vendor platform. Mark the ones you use (or want to learn); sessions built
              around the others are left out, and sessions that only mention them move down.
            </p>
            <div className="chips">
              {vocab.platforms.map((p) => {
                const on = usedPlatforms.includes(p.id);
                return (
                  <button
                    key={p.id}
                    className={`chip ${on ? "on" : ""}`}
                    onClick={() =>
                      setUsedPlatforms(on ? usedPlatforms.filter((x) => x !== p.id) : [...usedPlatforms, p.id])
                    }
                  >
                    {on ? "✓ " : ""}
                    {p.label} <span className="muted small">{p.sessionIds.length} sessions</span>
                  </button>
                );
              })}
              <button
                className={`chip ${platformsAnswered && usedPlatforms.length === 0 ? "on" : ""}`}
                onClick={() => setUsedPlatforms([])}
              >
                {platformsAnswered && usedPlatforms.length === 0 ? "✓ " : ""}None of these
              </button>
            </div>
            <p className="small muted platform-impact">
              {!platformsAnswered
                ? "Mark the platforms you use, or choose None of these."
                : leftOut === 0
                  ? "No sessions will be left out."
                  : `ℹ️ We'll leave out ${leftOut} sessions built around platforms you don't use.`}
            </p>
          </>
        )}
        {step === 3 && (
          <>
            <h2>
              AI background <span className="muted small">(optional, but it makes a big difference)</span>
            </h2>
            <div className="callout">
              <strong>{aiShare}% of the sessions in this catalog involve AI.</strong> Telling Re:Match what you already
              understand helps it find the best AI sessions for you: the goal is that every AI session you pick is one
              you can really get the most out of. Sessions that match your background move up in your swipes; the ones
              that assume more than you have yet are left out.
            </div>
            <p className="muted small">Skip any you are unsure about; unanswered ones do not affect your results.</p>
            <div className="ai-grid">
              {options.aiPrerequisites.map((p) => (
                <div key={p.id} className="ai-row">
                  <div>
                    <strong className="small">{p.label}</strong>
                    <div className="muted small">{p.hint}</div>
                  </div>
                  <div className="segmented">
                    {options.aiFamiliarity.map((label, value) => (
                      <button
                        key={label}
                        className={answers.ai[p.id] === value ? "on" : ""}
                        onClick={() => {
                          const ai = { ...answers.ai };
                          if (ai[p.id] === value) delete ai[p.id];
                          else ai[p.id] = value;
                          setAnswers({ ...answers, ai });
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {step === 4 && (
          <>
            <h2>Which formats do you want?</h2>
            <p className="muted">Pick one, several or all. Only these formats go into your pre-list.</p>
            <div className="row">
              <button className="ghost small" onClick={() => setAnswers({ ...answers, formats: options.formats.map((f) => f.id) })}>
                Select all
              </button>
              <button className="ghost small" onClick={() => setAnswers({ ...answers, formats: [] })}>
                Clear
              </button>
            </div>
            <div className="chips format-chips">
              {options.formats.map((f) => {
                const on = answers.formats.includes(f.id);
                return (
                  <button
                    key={f.id}
                    className={`chip ${on ? "on" : ""}`}
                    onClick={() =>
                      setAnswers({
                        ...answers,
                        formats: on ? answers.formats.filter((x) => x !== f.id) : [...answers.formats, f.id],
                      })
                    }
                  >
                    {on ? "✓ " : ""}
                    {f.label}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="row sticky-actions">
        {error && <span className="error">{error}</span>}
        {step > 0 && (
          <button className="ghost" onClick={() => setStep(step - 1)}>
            ← Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button className="primary" disabled={!canContinue} onClick={() => setStep(step + 1)}>
            Next →
          </button>
        ) : (
          <button
            className="primary"
            disabled={!canContinue || saving || answers.known.length === 0 || answers.learn.length === 0}
            onClick={finish}
          >
            {saving ? "Building…" : "Build my pre-list →"}
          </button>
        )}
      </div>
    </section>
  );
}

function TagPicker({
  vocab,
  selected,
  exclude,
  wanted = [],
  max,
  labels,
  onChange,
  afterTopics,
}: {
  vocab: Vocabulary;
  selected: string[];
  exclude: string[];
  /** Topics the attendee wants to go deeper on, flagged so they can also mark them as known. */
  wanted?: string[];
  /** Rendered between the clickable topics and the read-only technologies and practices. */
  afterTopics?: ReactNode;
  max: number;
  labels: Map<string, string>;
  onChange: (keys: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [allTech, setAllTech] = useState(false);
  const full = selected.length >= max;
  const q = query.trim().toLowerCase();

  const relatedOf = useMemo(() => new Map(vocab.domains.map((d) => [d.key, d.related ?? []])), [vocab]);
  // Which picked topic brings each technology or concept along; tags already claimed by excluded topics stay out.
  const includedBy = useMemo(() => {
    const taken = new Set(exclude.flatMap((k) => relatedOf.get(k) ?? []));
    const map = new Map<string, string[]>();
    for (const topic of selected) {
      for (const key of relatedOf.get(topic) ?? []) {
        if (!taken.has(key)) map.set(key, [...(map.get(key) ?? []), labels.get(topic) ?? topic]);
      }
    }
    return map;
  }, [selected, exclude, relatedOf, labels]);
  const topicsOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const d of vocab.domains) {
      for (const key of d.related ?? []) map.set(key, [...(map.get(key) ?? []), d.label]);
    }
    return map;
  }, [vocab]);

  const matches = (e: VocabularyEntry) => !q || e.label.toLowerCase().includes(q);
  const toggle = (key: string) =>
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : full ? selected : [...selected, key]);

  const topics = vocab.domains.filter((e) => !exclude.includes(e.key) && matches(e));
  const technologies = (q || allTech ? vocab.technologies : vocab.technologies.slice(0, 30)).filter(matches);
  const concepts = vocab.concepts.filter(matches);
  const included = [...includedBy.keys()];

  const readOnly = (title: string, entries: VocabularyEntry[]) =>
    entries.length === 0 ? null : (
      <div className="tag-group">
        <h3 className="small muted">{title}</h3>
        <div className="chips">
          {entries.map((e) => {
            const by = includedBy.get(e.key);
            const from = topicsOf.get(e.key);
            return (
              <span
                key={e.key}
                className={`chip small readonly ${by ? "on" : ""}`}
                title={
                  by
                    ? `Included by ${by.join(", ")}`
                    : from
                      ? `Comes with ${from.join(", ")}`
                      : "Not tied to a single topic"
                }
              >
                {by ? "✓ " : ""}
                {e.label} <span className="muted">{e.count}</span>
              </span>
            );
          })}
        </div>
      </div>
    );

  return (
    <div className="tag-picker">
      <div className="selected-bar">
        <span className={`counter ${full ? "full" : ""}`}>
          {selected.length} / {max} topics
        </span>
        {selected.map((key) => (
          <button key={key} className="chip on small" onClick={() => toggle(key)}>
            {labels.get(key) ?? key} ×
          </button>
        ))}
      </div>
      {included.length > 0 && (
        <p className="small muted includes">
          Includes {included.length} technologies and practices:{" "}
          {included.map((k) => labels.get(k) ?? k).join(", ")}.
        </p>
      )}
      <input placeholder="Search: Serverless, DynamoDB, event-driven…" value={query} onChange={(e) => setQuery(e.target.value)} />

      {topics.length > 0 && (
        <div className="tag-group">
          <h3 className="small muted">Topics · pick here</h3>
          <div className="chips">
            {topics.map((e) => {
              const on = selected.includes(e.key);
              return (
                <button
                  key={e.key}
                  className={`chip small ${on ? "on" : ""}`}
                  disabled={!on && full}
                  onClick={() => toggle(e.key)}
                  title={`${e.count} sessions · includes ${(e.related ?? []).map((k) => labels.get(k) ?? k).join(", ") || "no specific tags"}`}
                >
                  {on ? "✓ " : wanted.includes(e.key) ? "📈 " : ""}
                  {e.label} <span className="muted">{e.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {afterTopics}
      <p className="small muted">Technologies and practices below are selected through their topic.</p>
      {readOnly("Technologies", technologies)}
      {!q && !allTech && (
        <button className="link small" onClick={() => setAllTech(true)}>
          Show all {vocab.technologies.length} technologies
        </button>
      )}
      {readOnly("Practices & concepts", concepts)}
    </div>
  );
}
