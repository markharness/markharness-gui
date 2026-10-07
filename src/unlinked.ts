import type { Traceability } from "./backend";

/**
 * The features that contribute to no requirement, neither themselves nor through one of their
 * scenarios. The list is rooted in the requirements, so these do not appear in it.
 */
export function unlinkedFeatures(traceability: Traceability): string[] {
  const contributing = new Set(
    traceability.relations
      .filter((r) => r.kind === "contributes_to")
      .map((r) => r.from_uid),
  );
  const featureOfBehavior = new Map(
    traceability.behaviors.map((b) => [b.behavior_uid, b.feature_uid]),
  );
  const linkedThroughScenario = new Set(
    traceability.scenarios
      .filter((s) => contributing.has(s.scenario_uid))
      .flatMap((s) => featureOfBehavior.get(s.behavior_uid) ?? []),
  );
  return traceability.features
    .filter(
      (f) =>
        !contributing.has(f.feature_uid) &&
        !linkedThroughScenario.has(f.feature_uid),
    )
    .map((f) => f.label ?? f.feature_id);
}
