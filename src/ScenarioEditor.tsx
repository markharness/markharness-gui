import { useState } from "react";
import type { Backend, ScenarioDetail } from "./backend";
import { scenarioEdit } from "./edit";
import { Modal } from "./Modal";
import { ScenarioForm } from "./ScenarioForm";

/** The button that opens the whole scenario, its fields and its phases, as one form to edit. */
export function ScenarioEditor({
  featureUid,
  behaviorUid,
  uid,
  id,
  label,
  backend,
  onEdited,
}: {
  featureUid: string;
  behaviorUid: string;
  uid: string;
  id: string;
  label: string | null;
  backend: Backend;
  onEdited: () => void;
}) {
  const [editing, setEditing] = useState<{
    detail: ScenarioDetail;
    procedures: Record<string, { steps: string[] }>;
  }>();
  const [error, setError] = useState<string>();

  if (editing) {
    const { detail, procedures } = editing;
    return (
      <Modal title="Scenarioを編集" onClose={() => setEditing(undefined)}>
        <ScenarioForm
          initial={{
            id,
            label: label ?? "",
            description: detail.description ?? "",
            implementationNote: detail.implementation_note ?? "",
            phases: detail.phases,
          }}
          procedures={procedures}
          save={(values) =>
            backend.editKnowledge(
              scenarioEdit(
                { featureUid, behaviorUid, uid },
                { implementationNote: detail.implementation_note },
                values,
              ),
            )
          }
          onSaved={() => {
            setEditing(undefined);
            onEdited();
          }}
          onCancel={() => setEditing(undefined)}
        />
      </Modal>
    );
  }
  return (
    <>
      {error && <pre role="alert">{error}</pre>}
      <button
        type="button"
        onClick={() =>
          Promise.all([
            backend.getScenarioDetail(uid),
            backend.getElementDetail(behaviorUid),
          ]).then(
            ([detail, behavior]) => {
              setError(undefined);
              setEditing({ detail, procedures: behavior.procedures });
            },
            (reason) => setError(String(reason)),
          )
        }
      >
        Scenarioを編集
      </button>
    </>
  );
}
