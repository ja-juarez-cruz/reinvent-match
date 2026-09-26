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
  { route: "profile", label: "2 · About you" },
  { route: "swipe", label: "3 · Swipe" },
  { route: "match", label: "4 · ❤️ My Match" },
];

export function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [events, setEvents] = useState<AwsEvent[]>([]);
  const [eventId, setEventId] = useStored("rematch.event", "reinvent2026");
  const [answersId, setAnswersId] = useStored("rematch.answers", null);
  const [justSignedIn, setJustSignedIn] = useState(window.location.hash.includes("signed-in"));

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
            <>
              <span className="muted small">{session.email ?? "Signed in"}</span>
              <button className="ghost small" onClick={signOut}>
                Sign out
              </button>
            </>
          ) : (
            <button className="primary small" onClick={signIn}>
              Sign in with Builder ID
            </button>
          )}
        </div>
      </header>

      {justSignedIn && <div className="toast">✅ Signed in with your AWS Builder ID.</div>}

      <main className={route === "match" ? "wide" : undefined}>
        {route === "home" && (
          <HomePage
            session={session}
            events={events}
            eventId={eventId}
            onSelectEvent={setEventId}
            onSignIn={signIn}
          />
        )}
        {route === "insights" && <InsightsPage event={event} eventId={eventId} />}
        {route === "profile" && <AboutYouPage eventId={eventId} answersId={answersId} onSaved={setAnswersId} />}
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
