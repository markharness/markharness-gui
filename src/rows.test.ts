import { describe, expect, it } from "vitest";
import type { Project } from "./backend";
import { buildRequirementRows } from "./rows";

function project(overrides: Partial<Project> = {}): Project {
  return {
    at_commit: "abc123",
    traceability: {
      requirements: [
        {
          requirement_id: "req-b",
          requirement_uid: "RB",
          source: "native",
          label: "Second",
        },
        {
          requirement_id: "req-a",
          requirement_uid: "RA",
          source: "native",
          label: null,
        },
      ],
      features: [],
      behaviors: [],
      scenarios: [
        {
          scenario_id: "sc-1",
          scenario_uid: "S1",
          behavior_id: "b",
          behavior_uid: "B",
          label: "Add a task",
        },
        {
          scenario_id: "sc-2",
          scenario_uid: "S2",
          behavior_id: "b",
          behavior_uid: "B",
          label: null,
        },
      ],
      test_cases: [
        { case_id: "tc-1", case_uid: "C1", scenario_uid: "S1" },
        { case_id: "tc-2", case_uid: "C2", scenario_uid: "S2" },
      ],
      relations: [],
    },
    coverage: {
      at_commit: "abc123",
      requirements: [
        {
          requirement_uid: "RA",
          cases: [
            {
              case_uid: "C1",
              binding_mode: null,
              binding_reference: null,
              reference_status: null,
            },
            {
              case_uid: "C2",
              binding_mode: null,
              binding_reference: null,
              reference_status: null,
            },
          ],
        },
        { requirement_uid: "RB", cases: [] },
      ],
      gaps: [
        {
          kind: "requirement_has_no_feature",
          requirement_id: "req-b",
          feature_id: null,
        },
        {
          kind: "feature_has_no_case",
          requirement_id: "req-a",
          feature_id: "f-1",
        },
      ],
    },
    ...overrides,
  };
}

describe("buildRequirementRows", () => {
  it("makes one row per requirement, in the order the traceability reports them", () => {
    const rows = buildRequirementRows(project());

    expect(rows.map((r) => r.requirementUid)).toEqual(["RB", "RA"]);
  });

  it("titles a requirement by its label, or by its id when it has none", () => {
    const rows = buildRequirementRows(project());

    expect(rows.map((r) => r.title)).toEqual(["Second", "req-a"]);
  });

  it("lists the cases the coverage links to the requirement, titled by their scenario", () => {
    const [, ra] = buildRequirementRows(project());

    expect(ra.cases).toEqual([
      { caseUid: "C1", title: "Add a task" },
      { caseUid: "C2", title: "sc-2" },
    ]);
  });

  it("gives a requirement the coverage reports no cases for an empty case list", () => {
    const [rb] = buildRequirementRows(project());

    expect(rb.cases).toEqual([]);
  });

  it("gives a requirement the coverage does not mention an empty case list", () => {
    const p = project();
    p.coverage.requirements = [];

    const rows = buildRequirementRows(p);

    expect(rows.every((r) => r.cases.length === 0)).toBe(true);
  });

  it("carries the requirement id and where its content lives", () => {
    const [rb] = buildRequirementRows(project());

    expect(rb.requirementId).toBe("req-b");
    expect(rb.source).toBe("native");
  });

  it("says in words why the core reports a requirement as not covered", () => {
    const [rb, ra] = buildRequirementRows(project());

    expect(rb.gaps).toEqual([{ label: "機能のない要求", value: "" }]);
    expect(ra.gaps).toEqual([{ label: "ケースがない機能", value: "f-1" }]);
  });
});
