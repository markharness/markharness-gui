import { useState } from "react";
import type { Backend, ScenarioPhase } from "./backend";
import { Modal } from "./Modal";
import { ScenarioForm } from "./ScenarioForm";

const EMPTY_PHASES: ScenarioPhase[] = [
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

  if (procedures) {
    return (
      <Modal title="Scenarioを追加" onClose={() => setProcedures(undefined)}>
        <ScenarioForm
          initial={{
            id: "",
            label: "",
            description: "",
            implementationNote: "",
            phases: EMPTY_PHASES,
          }}
          procedures={procedures}
          save={async (values) => {
            const uid = await backend.createElement({
              kind: "scenario",
              feature_uid: featureUid,
              behavior_uid: behaviorUid,
              id: values.id,
              label: values.label,
              description: values.description,
              implementation_note:
                values.implementationNote === ""
                  ? undefined
                  : values.implementationNote,
              phases: values.phases,
            });
            setProcedures(undefined);
            onCreated(uid);
          }}
          onSaved={() => {}}
          onCancel={() => setProcedures(undefined)}
        />
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
