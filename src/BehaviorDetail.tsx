import type { Backend } from "./backend";
import { BehaviorCard } from "./BehaviorCard";
import { FeatureCard } from "./FeatureCard";
import { Card, ElementHeading } from "./Section";
import type { RequirementRow } from "./rows";
import { sourceName } from "./sources";

/** A picked behavior that has no case yet, under the feature and the requirement it was reached from. */
export function BehaviorDetail({
  row,
  feature,
  behavior,
  backend,
  onEdited,
}: {
  row: RequirementRow;
  feature: { uid: string; title: string; id: string; label: string | null };
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
    <>
      <Card>
        <ElementHeading
          kind="要求"
          source={sourceName(row.source)}
          title={row.title}
          id={row.requirementId ?? ""}
        />
      </Card>
      <FeatureCard feature={feature} backend={backend} onEdited={onEdited} />
      <BehaviorCard
        behavior={behavior}
        backend={backend}
        onEdited={onEdited}
        onProceduresEdited={onEdited}
      />
    </>
  );
}
