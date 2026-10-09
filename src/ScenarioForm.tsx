import { useState } from "react";
import type { ScenarioPhase } from "./backend";
import { ignoreEnterInOneLineFields } from "./ignoreEnter";
import { PhasesFields } from "./PhasesFields";

export interface ScenarioValues {
  id: string;
  label: string;
  description: string;
  implementationNote: string;
  phases: ScenarioPhase[];
}

/**
 * The form of a scenario, to create it or to edit it: its id, label, description and note, and its
 * phases as rows. It saves them all in one go, as the core replaces the phases whole.
 */
export function ScenarioForm({
  initial,
  procedures,
  save,
  onSaved,
  onCancel,
}: {
  initial: ScenarioValues;
  /** The common procedures the scenario's behavior declares, by name. */
  procedures: Record<string, { steps: string[] }>;
  save: (values: ScenarioValues) => Promise<void>;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [id, setId] = useState(initial.id);
  const [label, setLabel] = useState(initial.label);
  const [description, setDescription] = useState(initial.description);
  const [implementationNote, setImplementationNote] = useState(
    initial.implementationNote,
  );
  const [phases, setPhases] = useState(initial.phases);
  const [error, setError] = useState<string>();

  return (
    <form
      className="edit-form phases-form"
      onKeyDown={ignoreEnterInOneLineFields}
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        save({ id, label, description, implementationNote, phases }).then(
          onSaved,
          (reason) => setError(String(reason)),
        );
      }}
    >
      {error && <pre role="alert">{error}</pre>}
      <label className="field">
        <span>ID</span>
        <input value={id} onChange={(e) => setId(e.target.value)} />
      </label>
      <label className="field">
        <span>ラベル</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>
      <label className="field">
        <span>説明</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <label className="field">
        <span>実装メモ</span>
        <textarea
          value={implementationNote}
          onChange={(e) => setImplementationNote(e.target.value)}
        />
      </label>
      <PhasesFields
        phases={initial.phases}
        procedures={procedures}
        onChange={setPhases}
      />
      <fieldset
        aria-label="Scenarioの保存とキャンセル"
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
