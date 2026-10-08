import { useState } from "react";
import type { Backend, RemoveKind } from "./backend";
import { Modal } from "./Modal";

/** What a removal takes with it, which the confirmation says before the element is deleted. */
const CONSEQUENCE: Record<RemoveKind, string> = {
  requirement:
    "この要求を削除します。紐づくFeatureは削除されず、紐づきだけが外れます。",
  feature: "このFeatureを削除します。配下のBehaviorとScenarioも削除されます。",
  behavior: "このBehaviorを削除します。配下のScenarioも削除されます。",
  scenario: "このScenarioを削除します。",
};

/** The button that deletes one element, after a confirmation that it cannot be undone. */
export function ElementRemover({
  kind,
  noun,
  uid,
  backend,
  onRemoved,
}: {
  kind: RemoveKind;
  /** What the element is called to the user: "Feature", "Behavior", "Scenario" or "要求". */
  noun: string;
  uid: string;
  backend: Backend;
  onRemoved: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();

  const close = () => {
    setConfirming(false);
    setError(undefined);
  };

  if (confirming) {
    return (
      <Modal title={`${noun}を削除`} onClose={close}>
        <div className="edit-form">
          {error && <pre role="alert">{error}</pre>}
          <p>{CONSEQUENCE[kind]}</p>
          <p>この操作は元に戻せません。</p>
          <fieldset
            aria-label={`${noun}の削除とキャンセル`}
            className="form-actions"
          >
            <button
              type="button"
              className="primary"
              onClick={() =>
                backend.removeElement(kind, uid).then(
                  () => {
                    close();
                    onRemoved();
                  },
                  (reason) => setError(String(reason)),
                )
              }
            >
              削除
            </button>
            <button type="button" onClick={close}>
              キャンセル
            </button>
          </fieldset>
        </div>
      </Modal>
    );
  }
  return (
    <button type="button" onClick={() => setConfirming(true)}>
      {noun}を削除
    </button>
  );
}
