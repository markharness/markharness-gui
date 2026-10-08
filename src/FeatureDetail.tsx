import type { Backend } from "./backend";
import { ElementCard } from "./ElementCard";
import { FeatureCreator } from "./FeatureCreator";
import { Card, ElementHeading } from "./Section";
import type { RequirementRow } from "./rows";
import { sourceName } from "./sources";

/** A picked feature that has no case yet, under the requirement it was reached from. */
export function FeatureDetail({
  row,
  feature,
  backend,
  onFeatureCreated,
  onEdited,
}: {
  row: RequirementRow;
  feature: { uid: string; title: string; id: string; label: string | null };
  backend: Backend;
  onFeatureCreated: (featureUid: string) => void;
  onEdited: () => void;
}) {
  return (
    <>
      <Card>
        <ElementHeading
          kind="要求"
          source={sourceName(row.source)}
          title={row.title}
          id={row.requirementId ?? ""}
        />
      </Card>
      {row.requirementUid && (
        <FeatureCreator
          requirementUid={row.requirementUid}
          backend={backend}
          onCreated={onFeatureCreated}
        />
      )}
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
    </>
  );
}
