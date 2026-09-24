import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "./api";
import type { Decision, MatchResponse } from "./types";

export function useMatch(eventId: string | null, profileId: string | null) {
  const [data, setData] = useState<MatchResponse | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    if (!eventId || !profileId) return;
    api.match(eventId, profileId).then(setData, setError);
  }, [eventId, profileId]);

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
