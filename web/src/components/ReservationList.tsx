import { useState } from "react";
import { formatWhen, venueOf } from "../format";
import type { Reservation } from "../reservations";
import { useStored } from "../useStored";

/**
 * The ❤️ sessions that need a seat, in the order to book them when reserved seating opens, with a backup for each.
 * Ticking "reserved" is a note for this browser only; the portal is the record.
 */
export function ReservationList({ eventId, plan }: { eventId: string; plan: Reservation[] }) {
  const [stored, setStored] = useStored(`rematch.reserved.${eventId}`, "[]");
  const [copied, setCopied] = useState(false);
  const reserved = new Set<string>(safeParse(stored));
  const toggle = (id: string) => {
    const next = new Set(reserved);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setStored(JSON.stringify([...next]));
  };

  async function copy() {
    const text = plan
      .map((r, i) => `${i + 1}. ${r.item.session.code} ${r.item.session.title} (${formatWhen(r.item.session)})`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (plan.length === 0) {
    return (
      <div className="panel">
        <p className="muted">None of your ❤️ sessions needs a reserved seat. Walk-ins only: nothing to book.</p>
      </div>
    );
  }

  const done = plan.filter((r) => reserved.has(r.item.session.id)).length;
  return (
    <div className="panel reservations">
      <div className="row between">
        <p className="muted small">
          Book in this order when reserved seating opens (October 6 in the re:Invent portal): sessions offered only once
          first, then hands-on ones, which fill fastest. {done}/{plan.length} reserved.
        </p>
        <button className="ghost small" onClick={copy}>
          {copied ? "✓ Copied" : "Copy list"}
        </button>
      </div>
      <ol className="reservation-list">
        {plan.map(({ item, onlyTime, backups }) => {
          const s = item.session;
          const isReserved = reserved.has(s.id);
          return (
            <li key={s.id} className={isReserved ? "reserved" : ""}>
              <div className="reservation-row">
                <label className="reservation-check" title="Mark as reserved (this browser only)">
                  <input type="checkbox" checked={isReserved} onChange={() => toggle(s.id)} />
                </label>
                <div>
                  <div>
                    <strong className="code">{s.code}</strong> {s.title}
                  </div>
                  <div className="muted small">
                    {formatWhen(s)} · {venueOf(s)} · {s.formatLabel ?? s.format}
                    {onlyTime ? " · ⚠️ only time offered" : ""}
                  </div>
                  {backups.length > 0 && (
                    <div className="small">
                      If full: {backups.map((b) => `${b.session.code} (${formatWhen(b.session)})`).join(" · ")}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function safeParse(value: string | null): string[] {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}
