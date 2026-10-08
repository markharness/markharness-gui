import { useState } from "react";
import type { Backend } from "./backend";
import { ProceduresEditor } from "./ProceduresEditor";

/** The button that turns the common procedures of a behavior into a form, saved apart from the behavior's other fields. */
export function BehaviorProcedures({
  featureUid,
  uid,
  backend,
  onEdited,
}: {
  featureUid: string;
  uid: string;
  backend: Backend;
  onEdited: () => void;
}) {
  const [procedures, setProcedures] =
    useState<Record<string, { steps: string[] }>>();
  const [error, setError] = useState<string>();

  if (procedures) {
    return (
      <ProceduresEditor
        procedures={procedures}
        save={(edited) =>
          backend.editKnowledge({
            kind: "behavior",
            feature_uid: featureUid,
            uid,
            procedures: edited,
          })
        }
        onSaved={() => {
          setProcedures(undefined);
          onEdited();
        }}
        onCancel={() => setProcedures(undefined)}
      />
    );
  }
  return (
    <>
      {error && <pre role="alert">{error}</pre>}
      <button
        type="button"
        onClick={() =>
          backend.getElementDetail(uid).then(
            (detail) => setProcedures(detail.procedures),
            (reason) => setError(String(reason)),
          )
        }
      >
        共通手順を編集
      </button>
    </>
  );
}
