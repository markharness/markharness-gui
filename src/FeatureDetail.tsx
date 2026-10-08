import type { Backend } from "./backend";
import { BehaviorCreator } from "./BehaviorCreator";
import { FeatureCard } from "./FeatureCard";
import { FeatureCreator } from "./FeatureCreator";
import { Card, ElementHeading, Section } from "./Section";
import type { RequirementRow } from "./rows";
import { sourceName } from "./sources";

/** A picked feature that has no case yet, under the requirement it was reached from. */
export function FeatureDetail({
  row,
  feature,
  behaviors,
  backend,
  onFeatureCreated,
  onBehaviorCreated,
  onPickBehavior,
  onEdited,
}: {
  row: RequirementRow;
  feature: { uid: string; title: string; id: string; label: string | null };
  /** The behaviors of the feature, with or without a case. */
  behaviors: { uid: string; title: string }[];
  backend: Backend;
  onFeatureCreated: (featureUid: string) => void;
  onBehaviorCreated: (behaviorUid: string) => void;
  onPickBehavior: (behaviorUid: string) => void;
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
      <FeatureCard feature={feature} backend={backend} onEdited={onEdited} />
      <BehaviorCreator
        featureUid={feature.uid}
        backend={backend}
        onCreated={onBehaviorCreated}
      />
      <Section title="このFeatureのBehavior" badge="markharness">
        {behaviors.length === 0 ? (
          <p>ありません。</p>
        ) : (
          <ul>
            {behaviors.map((b) => (
              <li key={b.uid}>
                <button type="button" onClick={() => onPickBehavior(b.uid)}>
                  {b.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
