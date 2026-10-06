import { useState } from "react";
import type { Axis, Backend } from "./backend";
import { FeatureEditForm } from "./FeatureEditForm";
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
    Promise.all([backend.getAxis(feature.uid), backend.getAxes()]).then(
      ([axis, candidates]) => setEditing({ axis, candidates }),
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
        <FeatureEditForm
          feature={{
            uid: feature.uid,
            label: feature.label,
            axis: editing.axis,
          }}
          candidates={editing.candidates}
          save={(e) => backend.editKnowledge(e)}
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
