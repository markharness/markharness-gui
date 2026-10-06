import { useState } from "react";
import type { FeatureEdit } from "./edit";

export function FeatureEditForm({
  feature,
  candidates,
  save,
  onSaved,
  onCancel,
}: {
  feature: { uid: string; label: string | null; axis: string[] };
  candidates: { id: string; label: string }[];
  save: (edit: FeatureEdit) => Promise<void>;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(feature.label ?? "");
  const [axis, setAxis] = useState(feature.axis);
  const [error, setError] = useState<string>();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        save({ kind: "feature", uid: feature.uid, label, axis }).then(
          onSaved,
          (reason) => setError(String(reason)),
        );
      }}
    >
      {error && <pre role="alert">{error}</pre>}
      <label>
        ラベル
        <input value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>
      <fieldset>
        <legend>軸</legend>
        {candidates.map((c) => (
          <label key={c.id}>
            <input
              type="checkbox"
              checked={axis.includes(c.id)}
              onChange={() =>
                setAxis(
                  axis.includes(c.id)
                    ? axis.filter((a) => a !== c.id)
                    : [...axis, c.id],
                )
              }
            />
            {c.label}
          </label>
        ))}
      </fieldset>
      <button type="submit">保存</button>
      <button type="button" onClick={onCancel}>
        キャンセル
      </button>
    </form>
  );
}
