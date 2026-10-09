import { useState } from "react";
import type { Axis, Backend } from "./backend";
import type { Create } from "./edit";
import { ElementEditForm } from "./ElementEditForm";
import type { EditedValues } from "./ElementEditor";
import { Modal } from "./Modal";

/** The button that opens a form to create one element; the form starts empty. */
export function ElementCreator({
  noun,
  buttonLabel,
  withDescription = false,
  withProcedures = false,
  linkableFeatures,
  toCreate,
  backend,
  onCreated,
}: {
  /** What the element is called to the user, as in "要求の保存とキャンセル". */
  noun: string;
  buttonLabel: string;
  /** Whether the form asks for a description, for an element that has one. */
  withDescription?: boolean;
  /** Whether the form asks for common procedures, for an element that declares them. */
  withProcedures?: boolean;
  /** The features left without a requirement, for a new requirement to take. */
  linkableFeatures?: { uid: string; title: string }[];
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
      <Modal title={`${noun}を追加`} onClose={() => setCandidates(undefined)}>
        <ElementEditForm
          noun={noun}
          element={{
            id: "",
            label: "",
            axis: [],
            ...(withDescription && { description: "" }),
            ...(withProcedures && { procedures: {} }),
            ...(linkableFeatures && { features: linkableFeatures }),
          }}
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
      </Modal>
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
