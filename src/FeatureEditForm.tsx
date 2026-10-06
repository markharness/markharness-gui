import { useState } from "react";
import { changedFeatureEdit, type EditError, type FeatureEdit } from "./edit";

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
  const [error, setError] = useState<EditError>();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        save(changedFeatureEdit(feature, { label, axis })).then(
          onSaved,
          setError,
        );
      }}
    >
      {error && (
        <div role="alert">
          {error.kind === "rejected" ? (
            error.detail.map((d) => (
              <p key={`${d.location}: ${d.message}`}>
                {d.location}: {d.message}
              </p>
            ))
          ) : error.kind === "cannot_run" ? (
            <p>{error.detail}</p>
          ) : (
            <>
              {error.kind === "generate_failed" && (
                <p>保存はできましたが、テストの生成に失敗しました。</p>
              )}
              <pre>{error.detail.stderr}</pre>
            </>
          )}
        </div>
      )}
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
