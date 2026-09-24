import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { navigate } from "../App";
import { slugify } from "../format";
import type { Bucket, Goal, Interest, Profile, ProfileTemplate, StoredProfile, VocabEntry } from "../types";

interface Props {
  eventId: string | null;
  profileId: string | null;
  onSelectProfile: (id: string) => void;
}

const BUCKETS: { id: Bucket; title: string; hint: string }[] = [
  { id: "know", title: "🟢 Know", hint: "You use it regularly" },
  { id: "grow", title: "🟡 Grow", hint: "You want to go deeper" },
  { id: "explore", title: "🔵 Explore", hint: "New to you, but interesting" },
  { id: "ignore", title: "⚪ Ignore", hint: "Not relevant right now" },
];

const PROFICIENCY = ["None", "Basic", "Practical", "Advanced"];

const GOALS: { id: Goal; label: string }[] = [
  { id: "architecture-role", label: "Grow toward an architecture role" },
  { id: "deepen-known", label: "Go deeper on what I already use" },
  { id: "learn-new", label: "Learn new technologies" },
  { id: "hands-on", label: "Get hands-on" },
  { id: "networking", label: "Talk with experts and peers" },
];

const FORMATS: { id: string; label: string }[] = [
  { id: "chalk-talk", label: "Chalk talks" },
  { id: "builders-session", label: "Builders' sessions" },
  { id: "workshop", label: "Workshops" },
  { id: "code-talk", label: "Code talks" },
  { id: "lab", label: "Labs" },
  { id: "bootcamp", label: "Bootcamps" },
  { id: "breakout", label: "Breakouts" },
  { id: "lightning-talk", label: "Lightning talks" },
];

const DEFAULT_PROFICIENCY: Record<Bucket, number> = { know: 2, grow: 1, explore: 0, ignore: 0 };

export function ProfilePage({ eventId, profileId, onSelectProfile }: Props) {
  const [profiles, setProfiles] = useState<StoredProfile[]>([]);
  const [templates, setTemplates] = useState<ProfileTemplate[]>([]);
  const [vocab, setVocab] = useState<VocabEntry[]>([]);
  const [draft, setDraft] = useState<Profile | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [addTo, setAddTo] = useState<Bucket>("grow");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.templates().then(setTemplates);
    api.profiles().then((list) => {
      setProfiles(list);
      const current = list.find((p) => p.id === profileId);
      if (current) {
        setDraft(current.profile);
        setDraftId(current.id);
      }
    });
  }, [profileId]);

  useEffect(() => {
    if (eventId) api.vocab(eventId).then(setVocab, () => setVocab([]));
  }, [eventId]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !draft) return [];
    const taken = new Set(draft.interests.map((i) => i.name.toLowerCase()));
    return vocab.filter((v) => v.label.toLowerCase().includes(q) && !taken.has(v.label.toLowerCase())).slice(0, 8);
  }, [query, vocab, draft]);

  function update(patch: Partial<Profile>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }

  function updateInterest(index: number, patch: Partial<Interest>) {
    if (!draft) return;
    update({ interests: draft.interests.map((it, i) => (i === index ? { ...it, ...patch } : it)) });
  }

  function addInterest(name: string) {
    if (!draft || !name.trim()) return;
    update({
      interests: [...draft.interests, { name: name.trim(), bucket: addTo, proficiency: DEFAULT_PROFICIENCY[addTo] }],
    });
    setQuery("");
  }

  function startFrom(template: ProfileTemplate) {
    setDraft(structuredClone(template.profile));
    setDraftId(null);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const id = draftId ?? slugify(draft.name ?? "my-profile");
      await api.saveProfile(id, draft);
      onSelectProfile(id);
      navigate("swipe");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const countFor = (name: string) => vocab.find((v) => v.label.toLowerCase() === name.toLowerCase())?.count;

  return (
    <section className="page">
      <h1>Your profile</h1>
      <p className="lead">
        Tell Re:Match what you already know and where you want to grow. Topics come from the catalog itself, so they
        match how sessions are tagged. Everything stays on your machine.
      </p>

      <div className="panel">
        <h3>Start from</h3>
        <div className="template-grid">
          {profiles.map((p) => (
            <button
              key={p.id}
              className={`template-card ${draftId === p.id ? "selected" : ""}`}
              onClick={() => {
                setDraft(p.profile);
                setDraftId(p.id);
              }}
            >
              <strong>{p.profile.name ?? p.id}</strong>
              <span className="muted small">Your saved profile · {p.profile.interests.length} topics</span>
            </button>
          ))}
          {templates.map((t) => (
            <button key={t.id} className="template-card" onClick={() => startFrom(t)}>
              <strong>{t.title}</strong>
              <span className="muted small">{t.description}</span>
            </button>
          ))}
        </div>
      </div>

      {draft && (
        <>
          <div className="panel">
            <label className="field">
              <span>Profile name</span>
              <input value={draft.name ?? ""} onChange={(e) => update({ name: e.target.value })} />
            </label>

            <h3>What do you want from this event?</h3>
            <div className="chips">
              {GOALS.map((g) => {
                const on = draft.goals.includes(g.id);
                return (
                  <button
                    key={g.id}
                    className={`chip ${on ? "on" : ""}`}
                    onClick={() =>
                      update({ goals: on ? draft.goals.filter((x) => x !== g.id) : [...draft.goals, g.id] })
                    }
                  >
                    {on ? "✓ " : ""}
                    {g.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="panel">
            <h3>Topics and services</h3>
            <div className="add-row">
              <select value={addTo} onChange={(e) => setAddTo(e.target.value as Bucket)}>
                {BUCKETS.map((b) => (
                  <option key={b.id} value={b.id}>
                    Add to {b.title}
                  </option>
                ))}
              </select>
              <div className="autocomplete">
                <input
                  placeholder="Search the catalog: Lambda, Resilience, Kafka…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addInterest(suggestions[0]?.label ?? query)}
                />
                {suggestions.length > 0 && (
                  <ul className="suggestions">
                    {suggestions.map((s) => (
                      <li key={s.label}>
                        <button onClick={() => addInterest(s.label)}>
                          {s.label}
                          <span className="muted small">
                            {s.kind} · {s.count} sessions
                          </span>
                        </button>
                      </li>
                    ))}
                    <li>
                      <button onClick={() => addInterest(query)}>
                        Add “{query}” as a free concept <span className="muted small">searched in titles</span>
                      </button>
                    </li>
                  </ul>
                )}
              </div>
            </div>

            <div className="bucket-grid">
              {BUCKETS.map((b) => (
                <div key={b.id} className={`bucket bucket-${b.id}`}>
                  <div className="bucket-head">
                    <strong>{b.title}</strong>
                    <span className="muted small">{b.hint}</span>
                  </div>
                  {draft.interests.map((it, index) =>
                    it.bucket !== b.id ? null : (
                      <div key={`${it.name}-${index}`} className="interest">
                        <div className="interest-top">
                          <span className="interest-name">{it.name}</span>
                          <button
                            className="icon"
                            title="Remove"
                            onClick={() => update({ interests: draft.interests.filter((_, i) => i !== index) })}
                          >
                            ×
                          </button>
                        </div>
                        {countFor(it.name) !== undefined && (
                          <span className="muted small">{countFor(it.name)} sessions tagged</span>
                        )}
                        {b.id !== "ignore" && (
                          <div className="proficiency" title="Your proficiency">
                            {PROFICIENCY.map((label, level) => (
                              <button
                                key={label}
                                className={(it.proficiency ?? DEFAULT_PROFICIENCY[it.bucket]) === level ? "on" : ""}
                                onClick={() => updateInterest(index, { proficiency: level })}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                        <select
                          className="small"
                          value={it.bucket}
                          onChange={(e) => updateInterest(index, { bucket: e.target.value as Bucket })}
                        >
                          {BUCKETS.map((o) => (
                            <option key={o.id} value={o.id}>
                              Move to {o.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <h3>Formats you value</h3>
            <p className="muted small">
              Chalk talks, builders' sessions and workshops are rarely recorded; breakouts usually are.
            </p>
            <div className="format-grid">
              {FORMATS.map((f) => (
                <label key={f.id} className="format-row">
                  <span>{f.label}</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={draft.formatPreferences[f.id] ?? 0.5}
                    onChange={(e) =>
                      update({ formatPreferences: { ...draft.formatPreferences, [f.id]: Number(e.target.value) } })
                    }
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="row sticky-actions">
            {error && <span className="error">{error}</span>}
            <button className="primary" disabled={saving || draft.interests.length === 0} onClick={save}>
              {saving ? "Saving…" : "Save and start matching →"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
