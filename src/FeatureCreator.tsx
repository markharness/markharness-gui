import type { Backend } from "./backend";
import { ElementCreator } from "./ElementCreator";

/** The button under a requirement that creates a feature contributing to it. */
export function FeatureCreator({
  requirementUid,
  backend,
  onCreated,
}: {
  requirementUid: string;
  backend: Backend;
  /** Called with the uid the core gave the new feature. */
  onCreated: (featureUid: string) => void;
}) {
  return (
    <ElementCreator
      noun="Feature"
      buttonLabel="↓ Featureを追加"
      toCreate={(values) => ({
        kind: "feature",
        id: values.id,
        label: values.label,
        contributes_to: [requirementUid],
        axis: values.axis ?? [],
      })}
      backend={backend}
      onCreated={onCreated}
    />
  );
}
