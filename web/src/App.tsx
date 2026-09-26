import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { AboutYouPage } from "./pages/AboutYouPage";
import { HomePage } from "./pages/HomePage";
import { InsightsPage } from "./pages/InsightsPage";
import { ShortlistPage } from "./pages/ShortlistPage";
import { SwipePage } from "./pages/SwipePage";
import type { AwsEvent, SessionInfo } from "./types";
import { useStored } from "./useStored";

type Route = "home" | "insights" | "profile" | "swipe" | "match";

function routeFromHash(): Route {
  const r = window.location.hash.replace(/^#\/?/, "").split("?")[0];
  // "shortlist" was My Match's earlier name; old links still land there.
  if (r === "shortlist") return "match";
  return r === "insights" || r === "profile" || r === "swipe" || r === "match" ? r : "home";
}

export function navigate(route: Route): void {
  window.location.hash = `/${route === "home" ? "" : route}`;
}

const STEPS: { route: Route; label: string }[] = [
  { route: "home", label: "1 · Event" },
  { route: "swipe", label: "2 · Swipe" },
  { route: "match", label: "3 · ❤️ My Match" },
];

export function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [events, setEvents] = useState<AwsEvent[]>([]);
  const [eventId, setEventId] = useStored("rematch.event", "reinvent2026");
  const [answersId, setAnswersId] = useStored("rematch.answers", null);
  const [justSignedIn, setJustSignedIn] = useState(window.location.hash.includes("signed-in"));
  /** Whether preferences (About you) are saved; null until known. They are asked once, right after the first sign-in. */
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    api.answers().then(
      (list) => {
        const saved = list.find((a) => a.id === answersId) ?? list[0];
        setHasProfile(!!saved);
        if (saved && saved.id !== answersId) setAnswersId(saved.id);
      },
      () => setHasProfile(false),
    );
  }, [answersId, setAnswersId]);

  // First sign-in, or no preferences yet: About you comes before anything else that needs them.
  useEffect(() => {
    if (hasProfile === false && (justSignedIn || route === "swipe" || route === "match")) navigate("profile");
  }, [hasProfile, justSignedIn, route]);

  useEffect(() => setMenuOpen(false), [route]);

  const refreshSession = useCallback(() => api.session().then(setSession), []);

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    void refreshSession();
    api.events().then(setEvents, () => setEvents([]));
    if (justSignedIn) {
      navigate("home");
      const t = setTimeout(() => setJustSignedIn(false), 4000);
      return () => clearTimeout(t);
    }
  }, [refreshSession, justSignedIn]);

  const event = events.find((e) => e.eventId === eventId) ?? null;

  async function signIn() {
    const { authorizeUrl } = await api.login();
    window.location.href = authorizeUrl;
  }

  async function signOut() {
    await api.logout();
    await refreshSession();
  }

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">
          <span className="brand-mark">🧭</span> Reinvent:Match
          <span className="brand-sub">find the sessions that fit you</span>
        </a>
        <nav className="steps">
          {STEPS.map((s) => (
            <a key={s.route} href={`#/${s.route === "home" ? "" : s.route}`} className={route === s.route ? "active" : ""}>
              {s.label}
            </a>
          ))}
          <a href="#/insights" className={`nav-aside ${route === "insights" ? "active" : ""}`} title="What the catalog is made of">
            📊 Insights
          </a>
        </nav>
        <div className="auth">
          {session?.signedIn ? (
            <div className="user-menu">
              <button
                className={`ghost small ${route === "profile" ? "active" : ""}`}
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                👤 {session.email?.split("@")[0] ?? "Profile"} ▾
              </button>
              {menuOpen && (
                <div className="menu panel" role="menu">
                  <span className="muted small">{session.email}</span>
                  {hasProfile && (
                    <a href="#/profile" role="menuitem">
                      ⚙️ Preferences
                    </a>
                  )}
                  <button className="link" role="menuitem" onClick={signOut}>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {hasProfile && (
                <a href="#/profile" className="icon-button" title="Preferences" aria-label="Preferences">
                  ⚙️
                </a>
              )}
              <button className="primary small" onClick={signIn}>
                Sign in with Builder ID
              </button>
            </>
          )}
        </div>
      </header>

      {justSignedIn && <div className="toast">✅ Signed in with your AWS Builder ID.</div>}

      <main className={route === "match" ? "wide" : undefined}>
        {route === "home" && (
          <HomePage
            hasProfile={!!hasProfile}
            session={session}
            events={events}
            eventId={eventId}
            onSelectEvent={setEventId}
            onSignIn={signIn}
          />
        )}
        {route === "insights" && <InsightsPage event={event} eventId={eventId} />}
        {route === "profile" && <AboutYouPage
            eventId={eventId}
            answersId={answersId}
            onSaved={(id) => {
              setAnswersId(id);
              setHasProfile(true);
            }}
          />}
        {route === "swipe" && <SwipePage event={event} eventId={eventId} answersId={answersId} />}
        {route === "match" && (
          <ShortlistPage event={event} eventId={eventId} answersId={answersId} session={session} onSignIn={signIn} />
        )}
      </main>

      <footer className="footer muted small">
        Unofficial community project, not affiliated with AWS. Runs on your machine; uses the AWS Events API with your
        own sign-in.
      </footer>
    </div>
  );
}
