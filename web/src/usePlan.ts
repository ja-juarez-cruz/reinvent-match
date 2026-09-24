import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "./api";
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

  const decide = useCallback(
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

  return { data, error, decide };
}
