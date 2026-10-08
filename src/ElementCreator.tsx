import { useState } from "react";
import type { Axis, Backend } from "./backend";
import type { Create } from "./edit";
import { ElementEditForm } from "./ElementEditForm";
import type { EditedValues } from "./ElementEditor";

/** The button that opens a form to create one element; the form starts empty. */
export function ElementCreator({
  noun,
  buttonLabel,
  toCreate,
  backend,
  onCreated,
}: {
  /** What the element is called to the user, as in "要求の保存とキャンセル". */
  noun: string;
  buttonLabel: string;
  toCreate: (values: EditedValues) => Create;
  backend: Backend;
  /** Called with the uid the core gave the new element. */
  onCreated: (uid: string) => void;
}) {
  const [candidates, setCandidates] = useState<Axis[]>();
  const [error, setError] = useState<string>();

  const open = async () => {
    try {
      setCandidates(await backend.getAxes());
    } catch (reason) {
      setError(String(reason));
    }
  };

  if (candidates) {
    return (
      <ElementEditForm
        noun={noun}
        element={{ id: "", label: "", axis: [], description: "" }}
        candidates={candidates}
        save={async (values) => {
          const uid = await backend.createElement(toCreate(values));
          setCandidates(undefined);
          onCreated(uid);
        }}
        unusedAxes={() => backend.getUnusedAxes()}
        deleteUnusedAxes={async () => {
          await backend.deleteUnusedAxes();
          return backend.getAxes();
        }}
        addAxis={async (id, newLabel) => {
          await backend.addAxis(id, newLabel === "" ? undefined : newLabel);
          return backend.getAxes();
        }}
        onSaved={() => {}}
        onCancel={() => setCandidates(undefined)}
      />
    );
  }
  return (
    <>
      {error && <pre role="alert">{error}</pre>}
      <button type="button" onClick={open}>
        {buttonLabel}
      </button>
    </>
  );
}
