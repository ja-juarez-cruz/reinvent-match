import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { navigate } from "../App";
import type { Answers, OnboardingOptions, SelfLevel, Vocabulary, VocabularyEntry } from "../types";

interface Props {
  eventId: string | null;
  answersId: string | null;
  onSaved: (id: string) => void;
}

const STEPS = ["What you know", "What you want to learn", "Your level", "Formats"] as const;

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

const EMPTY: Answers = { known: [], learn: [], level: "intermediate", formats: [] };

export function AboutYouPage({ eventId, answersId, onSaved }: Props) {
  const [options, setOptions] = useState<OnboardingOptions | null>(null);
  const [vocab, setVocab] = useState<Vocabulary | null>(null);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.onboarding().then((o) => {
      setOptions(o);
      setAnswers((a) => (a.formats.length ? a : { ...a, formats: o.formats.map((f) => f.id) }));
    });
    api.answers().then((list) => {
      const saved = list.find((a) => a.id === answersId) ?? list[0];
      if (saved) setAnswers(saved.answers);
    });
  }, [answersId]);

  useEffect(() => {
    if (eventId) api.vocabulary(eventId).then(setVocab, (e: Error) => setError(e.message));
  }, [eventId]);

  const labels = useMemo(() => {
    const map = new Map<string, string>();
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

  const canContinue = [answers.known.length > 0, true, true, answers.formats.length > 0][step];

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
        <p className="lead">Four quick questions. Re:Match uses them to build a pre-list of sessions, split by what each one does for you.</p>
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
            <h2>What do you already know?</h2>
            <p className="muted">
              Pick up to <strong>{options.maxKnown}</strong>: the topics, services or practices you work with. Fewer, sharper
              picks give better recommendations.
            </p>
            <TagPicker
              vocab={vocab}
              selected={answers.known}
              exclude={answers.learn}
              max={options.maxKnown}
              labels={labels}
              onChange={(known) => setAnswers({ ...answers, known })}
            />
          </>
        )}
        {step === 1 && (
          <>
            <h2>
              What do you want to learn? <span className="muted small">(optional)</span>
            </h2>
            <p className="muted">
              Up to <strong>{options.maxLearn}</strong>. Leave it empty and Re:Match suggests new ground on its own; AI is in 71% of
              sessions, so naming what you care about keeps the "Learn" list focused.
            </p>
            <TagPicker
              vocab={vocab}
              selected={answers.learn}
              exclude={answers.known}
              max={options.maxLearn}
              labels={labels}
              onChange={(learn) => setAnswers({ ...answers, learn })}
            />
          </>
        )}
        {step === 2 && (
          <>
            <h2>Which level do you identify with?</h2>
            <p className="muted">About the things you picked as known.</p>
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
          </>
        )}
        {step === 3 && (
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
          <button className="primary" disabled={!canContinue || saving || answers.known.length === 0} onClick={finish}>
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
  max,
  labels,
  onChange,
}: {
  vocab: Vocabulary;
  selected: string[];
  exclude: string[];
  max: number;
  labels: Map<string, string>;
  onChange: (keys: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [allTech, setAllTech] = useState(false);
  const full = selected.length >= max;
  const q = query.trim().toLowerCase();
  const visible = (e: VocabularyEntry) => !exclude.includes(e.key) && (!q || e.label.toLowerCase().includes(q));

  const toggle = (key: string) =>
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : full ? selected : [...selected, key]);

  const group = (title: string, entries: VocabularyEntry[]) => {
    const shown = entries.filter(visible);
    if (shown.length === 0) return null;
    return (
      <div className="tag-group">
        <h3 className="small muted">{title}</h3>
        <div className="chips">
          {shown.map((e) => {
            const on = selected.includes(e.key);
            return (
              <button
                key={e.key}
                className={`chip small ${on ? "on" : ""}`}
                disabled={!on && full}
                onClick={() => toggle(e.key)}
                title={`${e.count} sessions`}
              >
                {on ? "✓ " : ""}
                {e.label} <span className="muted">{e.count}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const technologies = q || allTech ? vocab.technologies : vocab.technologies.slice(0, 30);

  return (
    <div className="tag-picker">
      <div className="selected-bar">
        <span className={`counter ${full ? "full" : ""}`}>
          {selected.length} / {max}
        </span>
        {selected.map((key) => (
          <button key={key} className="chip on small" onClick={() => toggle(key)}>
            {labels.get(key) ?? key} ×
          </button>
        ))}
      </div>
      <input placeholder="Search: DynamoDB, event-driven, Kubernetes…" value={query} onChange={(e) => setQuery(e.target.value)} />
      {group("Topics", vocab.domains)}
      {group("Technologies", technologies)}
      {!q && !allTech && (
        <button className="link small" onClick={() => setAllTech(true)}>
          Show all {vocab.technologies.length} technologies
        </button>
      )}
      {group("Practices & concepts", vocab.concepts)}
    </div>
  );
}
