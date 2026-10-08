import type { Backend } from "./backend";
import { ElementCard } from "./ElementCard";

/** The feature of a picked case, or a picked feature, which turns into a form to edit it in place. */
export function FeatureCard({
  feature,
  backend,
  onEdited,
}: {
  feature: { uid: string; title: string; id: string; label: string | null };
  backend: Backend;
  onEdited: () => void;
}) {
  return (
    <ElementCard
      noun="Feature"
      element={feature}
      load={async () => {
        const detail = await backend.getElementDetail(feature.uid);
        return { axis: detail.axis };
      }}
      toEdit={(values) => ({
        kind: "feature",
        uid: feature.uid,
        id: values.id,
        label: values.label,
        axis: values.axis ?? [],
      })}
      backend={backend}
      onEdited={onEdited}
    />
  );
}
