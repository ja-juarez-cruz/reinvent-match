import { useEffect, useState } from "react";
import { formatDay } from "../format";
import type { FavoritesImportPreview, SessionBrief } from "../types";

/**
 * What the re:Invent portal's favorites would change here, to review before applying: new portal favorites become ❤️,
 * and ❤️ picks removed in the portal move to 🔖 maybe (kept as backups, never deleted).
 */
export function ImportFavoritesModal({
  preview,
  onApply,
  onClose,
}: {
  preview: FavoritesImportPreview;
  onApply: (like: string[], downgrade: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [like, setLike] = useState(() => new Set(preview.toLike.map((s) => s.id)));
  const [downgrade, setDowngrade] = useState(() => new Set(preview.notInPortal.map((s) => s.id)));
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = (set: Set<string>, update: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    update(next);
  };
  const nothing = preview.toLike.length === 0 && preview.notInPortal.length === 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal panel fill-week"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="import-title">⬇ Import from your re:Invent favorites</h2>
        {nothing ? (
          <p className="muted">Your picks here already match your favorites in the re:Invent portal and app.</p>
        ) : (
          <>
            {preview.toLike.length > 0 && (
              <>
                <h3>New in the portal · become ❤️</h3>
                {preview.toLike.map((s) => (
                  <Row key={s.id} session={s} checked={like.has(s.id)} onChange={() => toggle(like, setLike, s.id)} />
                ))}
              </>
            )}
            {preview.notInPortal.length > 0 && (
              <>
                <h3>Removed in the portal · ❤️ becomes 🔖 maybe</h3>
                {preview.notInPortal.map((s) => (
                  <Row
                    key={s.id}
                    session={s}
                    checked={downgrade.has(s.id)}
                    onChange={() => toggle(downgrade, setDowngrade, s.id)}
                  />
                ))}
              </>
            )}
          </>
        )}
        <div className="modal-actions">
          {!nothing && (
            <button
              className="primary"
              disabled={applying || like.size + downgrade.size === 0}
              onClick={async () => {
                setApplying(true);
                await onApply([...like], [...downgrade]);
                setApplying(false);
              }}
            >
              {applying
                ? "Applying…"
                : `Apply ${like.size + downgrade.size} change${like.size + downgrade.size === 1 ? "" : "s"}`}
            </button>
          )}
          <button className="link" onClick={onClose}>
            {nothing ? "Close" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ session, checked, onChange }: { session: SessionBrief; checked: boolean; onChange: () => void }) {
  return (
    <label className="fill-row">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="code small">
        {session.date ? `${formatDay(session.date)} ${session.startTime ?? ""}` : "Time TBA"}
      </span>
      <span>
        <strong>{session.title}</strong>
        <span className="muted small">
          {" "}
          · {session.code}
          {session.decision === "save" ? " · 🔖 your maybe" : session.decision === "pass" ? " · ❌ you passed it" : ""}
        </span>
      </span>
    </label>
  );
}
