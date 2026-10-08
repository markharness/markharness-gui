import { useState } from "react";
import type { Backend, ScenarioPhase } from "./backend";
import { ignoreEnterInOneLineFields } from "./ignoreEnter";
import { Modal } from "./Modal";
import { PhasesFields } from "./PhasesFields";

const EMPTY_PHASE: ScenarioPhase[] = [
  { steps: [{ action: "" }], results: [""] },
];

/** The button under a behavior that creates a scenario of it, with its phases. */
export function ScenarioCreator({
  featureUid,
  behaviorUid,
  backend,
  onCreated,
}: {
  featureUid: string;
  behaviorUid: string;
  backend: Backend;
  /** Called with the uid the core gave the new scenario. */
  onCreated: (scenarioUid: string) => void;
}) {
  const [procedures, setProcedures] =
    useState<Record<string, { steps: string[] }>>();
  const [loadError, setLoadError] = useState<string>();
  const [id, setId] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [phases, setPhases] = useState(EMPTY_PHASE);
  const [error, setError] = useState<string>();

  const close = () => {
    setProcedures(undefined);
    setId("");
    setLabel("");
    setDescription("");
    setPhases(EMPTY_PHASE);
    setError(undefined);
  };

  if (procedures) {
    return (
      <Modal title="Scenarioを追加" onClose={close}>
        <form
          className="edit-form phases-form"
          onKeyDown={ignoreEnterInOneLineFields}
          onSubmit={(e) => {
            e.preventDefault();
            setError(undefined);
            backend
              .createElement({
                kind: "scenario",
                feature_uid: featureUid,
                behavior_uid: behaviorUid,
                id,
                label,
                description,
                phases,
              })
              .then(
                (uid) => {
                  close();
                  onCreated(uid);
                },
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
          <PhasesFields
            phases={EMPTY_PHASE}
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
            <button type="button" onClick={close}>
              キャンセル
            </button>
          </fieldset>
        </form>
      </Modal>
    );
  }
  return (
    <>
      {loadError && <pre role="alert">{loadError}</pre>}
      <button
        type="button"
        onClick={() =>
          backend.getElementDetail(behaviorUid).then(
            (detail) => {
              setLoadError(undefined);
              setProcedures(detail.procedures);
            },
            (reason) => setLoadError(String(reason)),
          )
        }
      >
        ↓ Scenarioを追加
      </button>
    </>
  );
}
