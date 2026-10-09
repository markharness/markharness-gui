import { useState } from "react";
import type { Axis, Backend } from "./backend";
import type { Edit, NamedProcedure } from "./edit";
import { ElementEditForm } from "./ElementEditForm";
import { Modal } from "./Modal";

/** What an element has to start an edit from; a field it does not have is left out. */
export interface EditableDetail {
  axis?: string[];
  description?: string | null;
  implementationNote?: string | null;
  procedures?: Record<string, { steps: string[] }>;
}

export interface EditedValues {
  id: string;
  label: string;
  axis?: string[];
  description?: string;
  implementationNote?: string;
  procedures?: NamedProcedure[];
}

/** The button that turns an element of a picked case into a form to edit it in place. */
export function ElementEditor({
  noun,
  id,
  label,
  load,
  toEdit,
  backend,
  onEdited,
}: {
  /** What the element is called to the user: "Feature", "Behavior" or "Scenario". */
  noun: string;
  /** The display id the element has now. */
  id: string;
  label: string | null;
  /** Reads what the form starts from, when the edit button is pressed. */
  load: () => Promise<EditableDetail>;
  toEdit: (values: EditedValues, detail: EditableDetail) => Edit;
  backend: Backend;
  onEdited: () => void;
}) {
  const [editing, setEditing] = useState<{
    detail: EditableDetail;
    candidates: Axis[];
  }>();
  const [error, setError] = useState<string>();

  const edit = async () => {
    try {
      const detail = await load();
      const candidates =
        detail.axis === undefined ? [] : await backend.getAxes();
      setEditing({ detail, candidates });
    } catch (reason) {
      setError(String(reason));
    }
  };

  if (editing) {
    const { detail, candidates } = editing;
    return (
      <Modal title={`${noun}を編集`} onClose={() => setEditing(undefined)}>
        <ElementEditForm
          noun={noun}
          element={{
            id,
            label,
            ...(detail.axis !== undefined && { axis: detail.axis }),
            ...(detail.description !== undefined && {
              description: detail.description,
            }),
            ...(detail.implementationNote !== undefined && {
              implementationNote: detail.implementationNote,
            }),
            ...(detail.procedures !== undefined && {
              procedures: detail.procedures,
            }),
          }}
          candidates={candidates}
          save={(values) => backend.editKnowledge(toEdit(values, detail))}
          unusedAxes={() => backend.getUnusedAxes()}
          deleteUnusedAxes={async () => {
            await backend.deleteUnusedAxes();
            return backend.getAxes();
          }}
          addAxis={async (id, newLabel) => {
            await backend.addAxis(id, newLabel === "" ? undefined : newLabel);
            return backend.getAxes();
          }}
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
      <button type="button" onClick={edit}>
        {noun}を編集
      </button>
    </>
  );
}
