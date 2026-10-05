import type { Project } from "./backend";

export interface RequirementRow {
  requirementUid: string;
  title: string;
  cases: { caseUid: string; title: string }[];
}

/** One row per requirement, in the order the traceability reports them. */
export function buildRequirementRows(project: Project): RequirementRow[] {
  const { traceability, coverage } = project;
  const scenarioByUid = new Map(
    traceability.scenarios.map((s) => [s.scenario_uid, s]),
  );
  const scenarioUidByCase = new Map(
    traceability.test_cases.map((c) => [c.case_uid, c.scenario_uid]),
  );
  const casesByRequirement = new Map(
    coverage.requirements.map((r) => [r.requirement_uid, r.cases]),
  );

  return traceability.requirements.map((r) => ({
    requirementUid: r.requirement_uid,
    title: r.label ?? r.requirement_id,
    cases: (casesByRequirement.get(r.requirement_uid) ?? []).map((c) => {
      const scenario = scenarioByUid.get(
        scenarioUidByCase.get(c.case_uid) ?? "",
      );
      return {
        caseUid: c.case_uid,
        title: scenario?.label ?? scenario?.scenario_id ?? c.case_uid,
      };
    }),
  }));
}
