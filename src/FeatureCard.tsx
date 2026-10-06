import { useState } from "react";
import type { Axis, Backend } from "./backend";
import { ElementEditForm } from "./ElementEditForm";
import { Card, ElementHeading } from "./Section";

/** The feature of a picked case, which turns into a form to edit it in place. */
export function FeatureCard({
  feature,
  backend,
  onEdited,
}: {
  feature: { uid: string; title: string; id: string; label: string | null };
  backend: Backend;
  onEdited: () => void;
}) {
  const [editing, setEditing] = useState<{
    axis: string[];
    candidates: Axis[];
  }>();
  const [error, setError] = useState<string>();

  const edit = () =>
    Promise.all([
      backend.getElementDetail(feature.uid),
      backend.getAxes(),
    ]).then(
      ([detail, candidates]) => setEditing({ axis: detail.axis, candidates }),
      (reason) => setError(String(reason)),
    );

  return (
    <Card>
      <ElementHeading
        kind="Feature"
        source="markharness"
        title={feature.title}
        id={feature.id}
      />
      {error && <pre role="alert">{error}</pre>}
      {editing ? (
        <ElementEditForm
          noun="Feature"
          element={{ label: feature.label, axis: editing.axis }}
          candidates={editing.candidates}
          save={(values) =>
            backend.editKnowledge({
              kind: "feature",
              uid: feature.uid,
              ...values,
            })
          }
          unusedAxes={() => backend.getUnusedAxes()}
          deleteUnusedAxes={async () => {
            await backend.deleteUnusedAxes();
            return backend.getAxes();
          }}
          addAxis={async (id, label) => {
            await backend.addAxis(id, label === "" ? undefined : label);
            return backend.getAxes();
          }}
          onSaved={() => {
            setEditing(undefined);
            onEdited();
          }}
          onCancel={() => setEditing(undefined)}
        />
      ) : (
        <button type="button" onClick={edit}>
          Featureを編集
        </button>
      )}
    </Card>
  );
}
