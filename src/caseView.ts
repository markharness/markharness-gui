import type { Binding, Coverage, Traceability } from "./backend";

export interface CaseView {
  requirement: {
    uid: string;
    title: string;
    id: string;
    label: string | null;
    source: "native" | "external";
  };
  feature:
    | { uid: string; title: string; id: string; label: string | null }
    | undefined;
  behavior:
    | {
        uid: string;
        featureUid: string;
        title: string;
        id: string;
        label: string | null;
      }
    | undefined;
  case: {
    caseUid: string;
    title: string;
    id: string;
    scenarioUid: string;
    scenarioId: string;
    label: string | null;
  };
  /** What the case declares; says nothing about whether anything ran. Unknown until the coverage is read. */
  verification?: {
    method: string;
    /** `status` is known only while the committed content declares the same reference. */
    reference: { target: string; status: string | null } | null;
  };
}

const METHOD_NAMES: Record<string, string> = {
  automated: "自動(参照)",
  manual: "手動(参照)",
};

const REFERENCE_STATUS_NAMES = {
  exists: "あり",
  missing: "なし",
  not_checked: "確認対象外",
};

/** The case picked from a requirement, with the elements above it, in the order the data links them. */
export function describeCase(
  traceability: Traceability,
  coverage: Coverage | null,
  bindings: Binding[] | null,
  requirementUid: string,
  caseUid: string,
): CaseView | undefined {
  const testCase = traceability.test_cases.find((c) => c.case_uid === caseUid);
  const requirement = traceability.requirements.find(
    (r) => r.requirement_uid === requirementUid,
  );
  if (!testCase || !requirement) return undefined;

  const scenario = traceability.scenarios.find(
    (s) => s.scenario_uid === testCase.scenario_uid,
  );
  const behavior = traceability.behaviors.find(
    (b) => b.behavior_uid === scenario?.behavior_uid,
  );
  const feature = traceability.features.find(
    (f) => f.feature_uid === behavior?.feature_uid,
  );
  const binding = bindings?.find((b) => b.case_uid === caseUid);
  const declared = coverage?.requirements
    .find((r) => r.requirement_uid === requirementUid)
    ?.cases.find((c) => c.case_uid === caseUid);

  return {
    requirement: {
      uid: requirement.requirement_uid,
      title: requirement.label ?? requirement.requirement_id,
      id: requirement.requirement_id,
      label: requirement.label,
      source: requirement.source,
    },
    feature: feature && {
      uid: feature.feature_uid,
      title: feature.label ?? feature.feature_id,
      id: feature.feature_id,
      label: feature.label,
    },
    behavior: behavior && {
      uid: behavior.behavior_uid,
      featureUid: behavior.feature_uid,
      title: behavior.label ?? behavior.behavior_id,
      id: behavior.behavior_id,
      label: behavior.label,
    },
    case: {
      caseUid: testCase.case_uid,
      title: scenario?.label ?? scenario?.scenario_id ?? testCase.case_id,
      id: testCase.case_id,
      scenarioUid: testCase.scenario_uid,
      scenarioId: scenario?.scenario_id ?? "",
      label: scenario?.label ?? null,
    },
    verification: bindings
      ? {
          method: binding?.mode
            ? (METHOD_NAMES[binding.mode] ?? binding.mode)
            : "未宣言",
          reference: binding?.reference
            ? {
                target: binding.reference,
                status:
                  declared?.reference_status &&
                  declared.binding_reference === binding.reference
                    ? REFERENCE_STATUS_NAMES[declared.reference_status]
                    : null,
              }
            : null,
        }
      : undefined,
  };
}
