import type {
  Behavior,
  Feature,
  Requirement,
  Scenario,
  TestCase,
  Traceability,
} from "./backend";

export interface ScenarioNode {
  scenario: Scenario;
  /** Requirements the scenario contributes to that its feature does not. */
  extraRequirements: Requirement[];
  testCases: TestCase[];
}

export interface BehaviorNode {
  behavior: Behavior;
  scenarios: ScenarioNode[];
}

export interface FeatureNode {
  feature: Feature;
  behaviors: BehaviorNode[];
}

export interface RequirementNode {
  requirement: Requirement;
  features: FeatureNode[];
}

export interface RelationTree {
  requirements: RequirementNode[];
  featuresWithoutRequirement: FeatureNode[];
}

export function buildRelationTree(t: Traceability): RelationTree {
  const contributes = (fromUid: string, toUid: string) =>
    t.relations.some(
      (r) =>
        r.kind === "contributes_to" &&
        r.from_uid === fromUid &&
        r.to_uid === toUid,
    );

  const featureNode = (feature: Feature): FeatureNode => {
    const featureRequirements = t.requirements.filter((r) =>
      contributes(feature.feature_uid, r.requirement_uid),
    );
    return {
      feature,
      behaviors: t.behaviors
        .filter((b) => b.feature_uid === feature.feature_uid)
        .map((behavior) => ({
          behavior,
          scenarios: t.scenarios
            .filter((s) => s.behavior_uid === behavior.behavior_uid)
            .map((scenario) => ({
              scenario,
              extraRequirements: t.requirements.filter(
                (r) =>
                  contributes(scenario.scenario_uid, r.requirement_uid) &&
                  !featureRequirements.includes(r),
              ),
              testCases: t.test_cases.filter(
                (c) => c.scenario_uid === scenario.scenario_uid,
              ),
            })),
        })),
    };
  };

  return {
    requirements: t.requirements.map((requirement) => ({
      requirement,
      features: t.features
        .filter((f) => contributes(f.feature_uid, requirement.requirement_uid))
        .map(featureNode),
    })),
    featuresWithoutRequirement: t.features
      .filter(
        (f) =>
          !t.requirements.some((r) =>
            contributes(f.feature_uid, r.requirement_uid),
          ),
      )
      .map(featureNode),
  };
}
