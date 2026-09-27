import { useEffect, useMemo, useState } from "react";
import { ApiError, api } from "../api";
import { navigate } from "../App";
import type { Answers, OnboardingOptions, TopicLevel, Vocabulary } from "../types";

interface Props {
  eventId: string | null;
  answersId: string | null;
  onSaved: (id: string) => void;
}

const STEPS = ["Your topics", "Your level in each", "Your platforms", "AI background", "Formats"] as const;

const TOPIC_LEVEL_OPTIONS: { id: TopicLevel; label: string; hint: string }[] = [
  { id: "new", label: "New to me", hint: "Learn it: entry sessions (100–200, or 300 if you are advanced elsewhere)" },
  { id: "basic", label: "Basic", hint: "You follow guides and examples: aims at 200-level sessions" },
  { id: "intermediate", label: "Intermediate", hint: "You build and run it in production: aims at 300-level" },
  { id: "advanced", label: "Advanced", hint: "You design with it and make trade-offs: aims at 300 and 400-level" },
];

/** While editing, a topic can be picked before its level is chosen. */
type Draft = Omit<Answers, "topics"> & { topics: { key: string; level?: TopicLevel }[] };

const EMPTY: Draft = { topics: [], ignore: [], ai: {}, formats: [] };

export function AboutYouPage({ eventId, answersId, onSaved }: Props) {
  const [options, setOptions] = useState<OnboardingOptions | null>(null);
  const [vocab, setVocab] = useState<Vocabulary | null>(null);
  const [answers, setAnswers] = useState<Draft>(EMPTY);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  /** The platforms step needs an explicit answer: new attendees start with nothing marked as used. */
  const [platformsAnswered, setPlatformsAnswered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Preferences saved before: this page edits them instead of onboarding. */
  const [editing, setEditing] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  /** Saved answers have been looked up, so we know whether this is a first visit. */
  const [loaded, setLoaded] = useState(false);
  /** First visit with favorites in AWS Events: a draft of the answers built from them. */
  const [fromFavorites, setFromFavorites] = useState<{
    favorites: string[];
    answers: Answers;
    basis: { key: string; favorites: number }[];
  } | null>(null);
  /** The favorites the draft came from, added as ❤️ when the answers are saved. */
  const [usedFavorites, setUsedFavorites] = useState<string[] | null>(null);

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
        setEditing(true);
      }
      setLoaded(true);
    });
  }, [answersId]);

  // A first visit by someone who already picked favorites in the AWS Events app: offer to start from them.
  useEffect(() => {
    if (!eventId || !loaded || editing) return;
    api.fromFavorites(eventId).then(
      (draft) =>
        setFromFavorites(draft.answers && draft.favorites.length > 0 ? { ...draft, answers: draft.answers } : null),
      () => setFromFavorites(null), // not signed in, or no catalog yet: nothing to offer
    );
  }, [eventId, loaded, editing]);

  function startFromFavorites() {
    if (!fromFavorites) return;
    setAnswers({ ...EMPTY, ...fromFavorites.answers });
    setPlatformsAnswered(true);
    setUsedFavorites(fromFavorites.favorites);
    setStep(0);
  }

  useEffect(() => {
    if (!eventId) return;
    // The first time, the catalog may not be on this machine yet: fetch it, then read its topics.
    api
      .vocabulary(eventId)
      .catch((e: unknown) => {
        if (!(e instanceof ApiError && e.code === "catalog-missing")) throw e;
        setError("Downloading the catalog…");
        return api.refreshCatalog(eventId).then(() => api.vocabulary(eventId));
      })
      .then(
        (v) => {
          setError(null);
          setVocab(v);
        },
        (e: unknown) =>
          setError(
            e instanceof ApiError && (e.code === "signin" || e.code === "not-registered")
              ? "Sign in with your AWS Builder ID to load this event's topics."
              : e instanceof Error
                ? e.message
                : String(e),
          ),
      );
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

  const topicKeys = answers.topics.map((t) => t.key);
  const allLevelsSet = answers.topics.length > 0 && answers.topics.every((t) => t.level);
  const complete = allLevelsSet && platformsAnswered && answers.formats.length > 0;
  const canContinue = [answers.topics.length > 0, allLevelsSet, platformsAnswered, true, answers.formats.length > 0][
    step
  ];
  const setTopicKeys = (keys: string[]) =>
    setAnswers({ ...answers, topics: keys.map((key) => answers.topics.find((t) => t.key === key) ?? { key }) });
  const setTopicLevel = (key: string, level: TopicLevel) =>
    setAnswers({ ...answers, topics: answers.topics.map((t) => (t.key === key ? { ...t, level } : t)) });
  const platformIds = vocab.platforms.map((p) => p.id);
  // Stored as the platforms to leave out; asked as the ones the attendee works with.
  const usedPlatforms = platformsAnswered ? platformIds.filter((id) => !answers.ignore.includes(id)) : [];
  const setUsedPlatforms = (used: string[]) => {
    setPlatformsAnswered(true);
    setAnswers({ ...answers, ignore: platformIds.filter((id) => !used.includes(id)) });
  };
  const leftOut = new Set(vocab.platforms.filter((p) => !usedPlatforms.includes(p.id)).flatMap((p) => p.sessionIds))
    .size;
  const aiShare = Math.round(
    (100 * (vocab.domains.find((d) => d.key === "domain:ai")?.count ?? 0)) / Math.max(vocab.total, 1),
  );

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      const id = answersId ?? "me";
      await api.saveAnswers(id, { ...answers, topics: answers.topics.map((t) => ({ key: t.key, level: t.level! })) });
      onSaved(id);
      if (editing) setSavedAt(Date.now());
      else if (usedFavorites && eventId) {
        // The favorites the answers came from become the first ❤️ picks.
        await api.applyFavoritesImport(eventId, usedFavorites, []);
        navigate("match");
      } else navigate("swipe");
      setEditing(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page">
      <div>
        <h1>{editing ? "⚙️ Your preferences" : "👋 Welcome! Tell us about you"}</h1>
        <p className="lead">
          {editing
            ? "Changes re-rank your swipes and My Match; your picks are kept."
            : "Five quick steps, only once. You can change them anytime from ⚙️ Preferences."}
        </p>
      </div>

      {!editing && fromFavorites && !usedFavorites && (
        <div className="panel notice">
          <p>
            ⭐ <strong>You already have {fromFavorites.favorites.length} favorites in AWS Events.</strong> Start from
            them: your topics, levels, formats and platforms are filled in from those sessions, and they become your
            first ❤️ picks. You review every step before saving.
          </p>
          <div className="row">
            <button className="primary" onClick={startFromFavorites}>
              ⭐ Use my {fromFavorites.favorites.length} favorites
            </button>
            <button className="link" onClick={() => setFromFavorites(null)}>
              Start from scratch
            </button>
          </div>
        </div>
      )}
      {!editing && usedFavorites && fromFavorites && (
        <p className="muted small">
          ⭐ Filled from your {usedFavorites.length} favorites:{" "}
          {fromFavorites.basis.map((b) => `${labels.get(b.key) ?? b.key} (${b.favorites})`).join(", ")}. Check each
          step; the AI background is yours to fill.
        </p>
      )}

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
            <TagPicker
              vocab={vocab}
              selected={topicKeys}
              max={options.maxTopics}
              labels={labels}
              onChange={setTopicKeys}
            />
          </>
        )}
        {step === 1 && (
          <>
            <h2>What is your level in each topic?</h2>
            <div className="topic-levels">
              {answers.topics.map((t) => {
                const hint = TOPIC_LEVEL_OPTIONS.find((o) => o.id === t.level)?.hint;
                return (
                  <div key={t.key} className="topic-level-row">
                    <div>
                      <strong>{labels.get(t.key) ?? t.key}</strong>
                      <div className={`small ${hint ? "muted" : "warn"}`}>{hint ?? "Choose your level"}</div>
                    </div>
                    <div className="segmented">
                      {TOPIC_LEVEL_OPTIONS.map((o) => (
                        <button
                          key={o.id}
                          className={t.level === o.id ? "on" : ""}
                          onClick={() => setTopicLevel(t.key, o.id)}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h2>Which of these platforms do you work with?</h2>
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
              AI background <span className="muted small">(optional)</span>
            </h2>
            <div className="callout">
              <strong>{aiShare}% of the sessions involve AI.</strong> Tell us what you know so every AI session you pick
              is one you can get the most out of.
            </div>
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
            <p className="muted">Only these formats go into your pre-list.</p>
            <div className="row">
              <button
                className="ghost small"
                onClick={() => setAnswers({ ...answers, formats: options.formats.map((f) => f.id) })}
              >
                Select all
              </button>
              <button className="ghost small" onClick={() => setAnswers({ ...answers, formats: [] })}>
                Clear
              </button>
            </div>
            <div className="format-groups">
              {options.formatGroups.map((group) => {
                const all = group.formats.every((id) => answers.formats.includes(id));
                return (
                  <div key={group.id} className="format-group">
                    <div className="format-group-head">
                      <div>
                        <strong>{group.title}</strong>
                        <div className="muted small">For {group.audience}</div>
                      </div>
                      <button
                        className="link small"
                        onClick={() =>
                          setAnswers({
                            ...answers,
                            formats: all
                              ? answers.formats.filter((id) => !group.formats.includes(id))
                              : [...new Set([...answers.formats, ...group.formats])],
                          })
                        }
                      >
                        {all ? "Clear group" : "Select group"}
                      </button>
                    </div>
                    <div className="chips">
                      {options.formats
                        .filter((f) => group.formats.includes(f.id))
                        .map((f) => {
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
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="row sticky-actions">
        {error && <span className="error">{error}</span>}
        {!editing && step > 0 && (
          <button className="ghost" onClick={() => setStep(step - 1)}>
            ← Back
          </button>
        )}
        {savedAt && <span className="small">✓ Saved</span>}
        {editing ? (
          <button className="primary" disabled={!complete || saving} onClick={finish}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        ) : step < STEPS.length - 1 ? (
          <button className="primary" disabled={!canContinue} onClick={() => setStep(step + 1)}>
            Next →
          </button>
        ) : (
          <button className="primary" disabled={!canContinue || saving || !allLevelsSet} onClick={finish}>
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
  max,
  labels,
  onChange,
}: {
  vocab: Vocabulary;
  selected: string[];
  max: number;
  labels: Map<string, string>;
  onChange: (keys: string[]) => void;
}) {
  const full = selected.length >= max;
  const relatedOf = useMemo(() => new Map(vocab.domains.map((d) => [d.key, d.related ?? []])), [vocab]);
  // The technologies and practices the picked topics bring along.
  const included = useMemo(
    () => [...new Set(selected.flatMap((topic) => relatedOf.get(topic) ?? []))],
    [selected, relatedOf],
  );
  const toggle = (key: string) =>
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : full ? selected : [...selected, key]);

  return (
    <div className="tag-picker">
      <span className={`counter ${full ? "full" : ""}`}>
        {selected.length} / {max} topics
      </span>
      <div className="chips">
        {vocab.domains.map((e) => {
          const on = selected.includes(e.key);
          return (
            <button
              key={e.key}
              className={`chip small ${on ? "on" : ""}`}
              disabled={!on && full}
              onClick={() => toggle(e.key)}
              title={`${e.count} sessions · includes ${(e.related ?? []).map((k) => labels.get(k) ?? k).join(", ") || "no specific tags"}`}
            >
              {on ? "✓ " : ""}
              {e.label} <span className="muted">{e.count}</span>
            </button>
          );
        })}
      </div>
      {included.length > 0 && (
        <details className="small muted includes">
          <summary>Includes {included.length} technologies and practices</summary>
          {included.map((k) => labels.get(k) ?? k).join(", ")}.
        </details>
      )}
    </div>
  );
}
