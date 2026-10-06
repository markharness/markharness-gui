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
  const [adding, setAdding] = useState(false);
  const closeNewCategory = () => {
    setAdding(false);
    setNewId("");
    setNewLabel("");
    setAxisError(undefined);
  };
  return (
    <form
      className="edit-form"
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
      <label className="field">
        <span>ラベル</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>
      <fieldset>
        <legend>分類</legend>
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
      <button type="button" onClick={() => setAdding(true)}>
        ＋ 分類を追加
      </button>
      {adding && (
        <fieldset className="new-category">
          <legend>新しい分類</legend>
          <label className="field">
            <span>id</span>
            <input
              value={newId}
              placeholder="例: performance(半角の小文字英数字とハイフン)"
              onChange={(e) => setNewId(e.target.value)}
            />
          </label>
          <label className="field">
            <span>ラベル</span>
            <input
              value={newLabel}
              placeholder="省略可"
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
                  closeNewCategory();
                },
                (reason) => setAxisError(String(reason)),
              );
            }}
          >
            追加
          </button>
          <button type="button" onClick={closeNewCategory}>
            閉じる
          </button>
          {axisError && <pre role="alert">{axisError}</pre>}
        </fieldset>
      )}
      <button type="submit">保存</button>
      <button type="button" onClick={onCancel}>
        キャンセル
      </button>
    </form>
  );
}
