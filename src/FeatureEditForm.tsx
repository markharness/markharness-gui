import { useState } from "react";
import type { Axis } from "./backend";
import type { FeatureEdit } from "./edit";

export function FeatureEditForm({
  feature,
  candidates: initialCandidates,
  save,
  addAxis,
  onSaved,
  onCancel,
}: {
  feature: { uid: string; label: string | null; axis: string[] };
  candidates: Axis[];
  save: (edit: FeatureEdit) => Promise<void>;
  /** Registers a new axis and returns the axes to choose from, the new one included. */
  addAxis: (id: string, label: string) => Promise<Axis[]>;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(feature.label ?? "");
  const [axis, setAxis] = useState(feature.axis);
  const [error, setError] = useState<string>();
  const [candidates, setCandidates] = useState(initialCandidates);
  const [newId, setNewId] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [axisError, setAxisError] = useState<string>();
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
        <label>
          軸のID
          <input value={newId} onChange={(e) => setNewId(e.target.value)} />
        </label>
        <label>
          軸のラベル(省略可)
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setAxisError(undefined);
            addAxis(newId, newLabel).then(
              (axes) => {
                setCandidates(axes);
                setAxis((current) => [...current, newId]);
                setNewId("");
                setNewLabel("");
              },
              (reason) => setAxisError(String(reason)),
            );
          }}
        >
          軸を追加
        </button>
        {axisError && <pre role="alert">{axisError}</pre>}
      </fieldset>
      <button type="submit">保存</button>
      <button type="button" onClick={onCancel}>
        キャンセル
      </button>
    </form>
  );
}
