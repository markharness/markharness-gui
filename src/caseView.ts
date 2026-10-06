import type { Coverage, Traceability } from "./backend";

export interface CaseView {
  requirement: { title: string; id: string; source: "native" | "external" };
  feature:
    | { uid: string; title: string; id: string; label: string | null }
    | undefined;
  behavior: { title: string; id: string } | undefined;
  case: { caseUid: string; title: string; id: string; scenarioUid: string };
  /** What the case declares; says nothing about whether anything ran. Unknown until the coverage is read. */
  verification?: {
    method: string;
    reference: { target: string; status: string } | null;
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
  const declared = coverage?.requirements
    .find((r) => r.requirement_uid === requirementUid)
    ?.cases.find((c) => c.case_uid === caseUid);

  return {
    requirement: {
      title: requirement.label ?? requirement.requirement_id,
      id: requirement.requirement_id,
      source: requirement.source,
    },
    feature: feature && {
      uid: feature.feature_uid,
      title: feature.label ?? feature.feature_id,
      id: feature.feature_id,
      label: feature.label,
    },
    behavior: behavior && {
      title: behavior.label ?? behavior.behavior_id,
      id: behavior.behavior_id,
    },
    case: {
      caseUid: testCase.case_uid,
      title: scenario?.label ?? scenario?.scenario_id ?? testCase.case_id,
      id: testCase.case_id,
      scenarioUid: testCase.scenario_uid,
    },
    verification: coverage
      ? {
          method: declared?.binding_mode
            ? (METHOD_NAMES[declared.binding_mode] ?? declared.binding_mode)
            : "未宣言",
          reference:
            declared?.binding_reference && declared.reference_status
              ? {
                  target: declared.binding_reference,
                  status: REFERENCE_STATUS_NAMES[declared.reference_status],
                }
              : null,
        }
      : undefined,
  };
}
