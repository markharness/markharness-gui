import type { Backend } from "./backend";
import { ElementCard } from "./ElementCard";

/**
 * The procedures are sent whole, as the core replaces them whole. A behavior that had none and
 * still has none sends nothing, instead of an empty list that changes nothing.
 */
function proceduresChanged(
  original: Record<string, unknown> | undefined,
  edited: unknown[] | undefined,
) {
  return (
    edited !== undefined &&
    !(edited.length === 0 && Object.keys(original ?? {}).length === 0)
  );
}

/** The behavior of a picked case, or a picked behavior, which turns into forms to edit it in place. */
export function BehaviorCard({
  behavior,
  backend,
  onEdited,
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
}) {
  return (
    <ElementCard
      noun="Behavior"
      element={behavior}
      load={async () => {
        const detail = await backend.getElementDetail(behavior.uid);
        return {
          axis: detail.axis,
          description: detail.description,
          procedures: detail.procedures,
        };
      }}
      toEdit={(values, detail) => ({
        kind: "behavior",
        feature_uid: behavior.featureUid,
        uid: behavior.uid,
        id: values.id,
        label: values.label,
        description: values.description,
        axis: values.axis ?? [],
        ...(proceduresChanged(detail.procedures, values.procedures) && {
          procedures: values.procedures,
        }),
      })}
      backend={backend}
      onEdited={onEdited}
    />
  );
}
