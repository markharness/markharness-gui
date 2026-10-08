import type { Backend } from "./backend";
import { ElementCreator } from "./ElementCreator";

/** The button under a feature that creates a behavior of it. */
export function BehaviorCreator({
  featureUid,
  backend,
  onCreated,
}: {
  featureUid: string;
  backend: Backend;
  /** Called with the uid the core gave the new behavior. */
  onCreated: (behaviorUid: string) => void;
}) {
  return (
    <ElementCreator
      noun="Behavior"
      buttonLabel="↓ Behaviorを追加"
      withDescription
      withProcedures
      toCreate={(values) => ({
        kind: "behavior",
        feature_uid: featureUid,
        id: values.id,
        label: values.label,
        description: values.description ?? "",
        axis: values.axis ?? [],
        ...(values.procedures !== undefined &&
          values.procedures.length > 0 && { procedures: values.procedures }),
      })}
      backend={backend}
      onCreated={onCreated}
    />
  );
}
