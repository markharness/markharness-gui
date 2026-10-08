import type { Backend } from "./backend";
import { BehaviorProcedures } from "./BehaviorProcedures";
import { ElementCard } from "./ElementCard";

/** The behavior of a picked case, or a picked behavior, which turns into forms to edit it in place. */
export function BehaviorCard({
  behavior,
  backend,
  onEdited,
  onProceduresEdited,
}: {
  behavior: {
    uid: string;
    featureUid: string;
    title: string;
    id: string;
    label: string | null;
  };
  backend: Backend;
  onEdited: () => void;
  onProceduresEdited: () => void;
}) {
  return (
    <ElementCard
      noun="Behavior"
      element={behavior}
      load={async () => {
        const detail = await backend.getElementDetail(behavior.uid);
        return { axis: detail.axis, description: detail.description };
      }}
      toEdit={(values) => ({
        kind: "behavior",
        feature_uid: behavior.featureUid,
        uid: behavior.uid,
        id: values.id,
        label: values.label,
        description: values.description,
        axis: values.axis ?? [],
      })}
      backend={backend}
      onEdited={onEdited}
    >
      <BehaviorProcedures
        featureUid={behavior.featureUid}
        uid={behavior.uid}
        backend={backend}
        onEdited={onProceduresEdited}
      />
    </ElementCard>
  );
}
