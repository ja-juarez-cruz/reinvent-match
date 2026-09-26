import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api } from "./api";
import { repeatsOf } from "./repeats";
import type { Decision, PlanResponse } from "./types";

export function usePlan(eventId: string | null, answersId: string | null) {
  const [data, setData] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    if (!eventId || !answersId) return;
    api.plan(eventId, answersId).then(setData, setError);
  }, [eventId, answersId]);

  // Other times of each session, to keep one decision per session (see decide).
  const repeats = useMemo(() => repeatsOf(data?.results ?? []), [data?.results]);
  const current = useRef({ repeats, swipes: data?.swipes ?? {} });
  current.current = { repeats, swipes: data?.swipes ?? {} };

  const decideOne = useCallback(
    async (sessionId: string, decision: Decision | null) => {
      if (!eventId) return;
      // Optimistic: the card moves on immediately; the server response is the source of truth.
      setData((d) => {
        if (!d) return d;
        const swipes = { ...d.swipes };
        if (decision === null) delete swipes[sessionId];
        else swipes[sessionId] = { decision, at: new Date().toISOString() };
        return { ...d, swipes };
      });
      const swipes = await api.swipe(eventId, sessionId, decision);
      setData((d) => (d ? { ...d, swipes } : d));
    },
    [eventId],
  );

  /**
   * Records a decision. ❤️ on one time of a session clears whatever was decided on its other times (a 🔖 there, or
   * a ❤️ being moved), so each session is picked once.
   */
  const decide = useCallback(
    async (sessionId: string, decision: Decision | null) => {
      const { repeats, swipes } = current.current;
      await decideOne(sessionId, decision);
      if (decision !== "like") return;
      for (const other of repeats.get(sessionId) ?? []) {
        if (swipes[other.session.id]) await decideOne(other.session.id, null);
      }
    },
    [decideOne],
  );

  return { data, error, decide };
}
