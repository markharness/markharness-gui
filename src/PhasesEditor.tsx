import { useState } from "react";
import type { ScenarioPhase } from "./backend";
import { ignoreEnterInOneLineFields } from "./ignoreEnter";
import { PhasesFields } from "./PhasesFields";

/** Edits the phases of a scenario as rows, and saves them whole, as the core replaces them whole. */
export function PhasesEditor({
  phases,
  procedures,
  save,
  onSaved,
  onCancel,
}: {
  phases: ScenarioPhase[];
  /** The common procedures the scenario's behavior declares, by name. */
  procedures: Record<string, { steps: string[] }>;
  save: (phases: ScenarioPhase[]) => Promise<void>;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string>();
  const [current, setCurrent] = useState(phases);

  return (
    <form
      className="edit-form phases-form"
      onKeyDown={ignoreEnterInOneLineFields}
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        save(current).then(onSaved, (reason) => setError(String(reason)));
      }}
    >
      {error && <pre role="alert">{error}</pre>}
      <PhasesFields
        phases={phases}
        procedures={procedures}
        onChange={setCurrent}
      />
      <fieldset
        aria-label="手順と期待結果の保存とキャンセル"
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
