import { useState } from "react";
import type { Axis, Backend } from "./backend";
import type { Edit } from "./edit";
import { ElementEditForm } from "./ElementEditForm";
import { Card, ElementHeading } from "./Section";

/** An element of a picked case, which turns into a form to edit it in place. */
export function ElementCard({
  noun,
  element,
  describe,
  toEdit,
  backend,
  onEdited,
}: {
  /** What the element is called to the user: "Feature" or "Behavior". */
  noun: string;
  element: { uid: string; title: string; id: string; label: string | null };
  /** Whether the description is edited too. */
  describe: boolean;
  toEdit: (values: {
    label: string;
    axis: string[];
    description?: string;
  }) => Edit;
  backend: Backend;
  onEdited: () => void;
}) {
  const [editing, setEditing] = useState<{
    axis: string[];
    description: string | null;
    candidates: Axis[];
  }>();
  const [error, setError] = useState<string>();

  const edit = () =>
    Promise.all([
      backend.getElementDetail(element.uid),
      backend.getAxes(),
    ]).then(
      ([detail, candidates]) =>
        setEditing({
          axis: detail.axis,
          description: detail.description,
          candidates,
        }),
      (reason) => setError(String(reason)),
    );

  return (
    <Card>
      <ElementHeading
        kind={noun}
        source="markharness"
        title={element.title}
        id={element.id}
      />
      {error && <pre role="alert">{error}</pre>}
      {editing ? (
        <ElementEditForm
          noun={noun}
          element={{
            label: element.label,
            axis: editing.axis,
            ...(describe && { description: editing.description }),
          }}
          candidates={editing.candidates}
          save={(values) => backend.editKnowledge(toEdit(values))}
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
          {noun}を編集
        </button>
      )}
    </Card>
  );
}
