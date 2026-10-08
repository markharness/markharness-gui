import { useState } from "react";
import { ignoreEnterInOneLineFields } from "./ignoreEnter";

/** Edits how a case is verified: by what means, and where the thing that verifies it is. */
export function VerificationEditor({
  mode,
  reference,
  save,
  onSaved,
  onCancel,
}: {
  /** The means the case declares; none for a case that declares nothing. */
  mode: string | null;
  reference: string | null;
  save: (mode: string, reference: string | null) => Promise<void>;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [means, setMeans] = useState(mode ?? "automated");
  const [target, setTarget] = useState(reference ?? "");
  const [error, setError] = useState<string>();

  return (
    <form
      className="edit-form"
      onKeyDown={ignoreEnterInOneLineFields}
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        save(means, target === "" ? null : target).then(onSaved, (reason) =>
          setError(String(reason)),
        );
      }}
    >
      {error && <pre role="alert">{error}</pre>}
      <label className="field">
        <span>方法</span>
        <select value={means} onChange={(e) => setMeans(e.target.value)}>
          <option value="automated">自動</option>
          <option value="manual">手動</option>
        </select>
      </label>
      <label className="field">
        <span>参照先</span>
        <input value={target} onChange={(e) => setTarget(e.target.value)} />
      </label>
      <fieldset
        aria-label="検証方法の保存とキャンセル"
        className="form-actions"
      >
        <button type="submit" className="primary">
          保存
        </button>
        <button type="button" onClick={onCancel}>
          キャンセル
        </button>
      </fieldset>
    </form>
  );
}
