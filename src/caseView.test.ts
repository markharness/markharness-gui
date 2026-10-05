import { describe, expect, it } from "vitest";
import type { Project } from "./backend";
import { describeCase } from "./caseView";

function project(
  binding: Partial<Project["coverage"]["requirements"][0]["cases"][0]> = {},
): Project {
  return {
    at_commit: "abc123",
    traceability: {
      requirements: [
        {
          requirement_id: "req-1",
          requirement_uid: "R1",
          source: "native",
          label: "Login",
        },
      ],
      features: [{ feature_id: "f-1", feature_uid: "F1", label: "Sign in" }],
      behaviors: [
        {
          behavior_id: "b-1",
          behavior_uid: "B1",
          feature_id: "f-1",
          feature_uid: "F1",
          label: null,
        },
      ],
      scenarios: [
        {
          scenario_id: "sc-1",
          scenario_uid: "S1",
          behavior_id: "b-1",
          behavior_uid: "B1",
          label: "Wrong password",
        },
      ],
      test_cases: [{ case_id: "tc-1", case_uid: "C1", scenario_uid: "S1" }],
      relations: [],
    },
    coverage: {
      at_commit: "abc123",
      requirements: [
        {
          requirement_uid: "R1",
          cases: [
            {
              case_uid: "C1",
              binding_mode: null,
              binding_reference: null,
              reference_status: null,
              ...binding,
            },
          ],
        },
      ],
      gaps: [],
    },
  };
}

describe("describeCase", () => {
  it("follows the case up to its scenario, behavior, feature and the requirement picked from", () => {
    const view = describeCase(project(), "R1", "C1");

    expect(view?.requirement).toEqual({
      title: "Login",
      id: "req-1",
      source: "native",
    });
    expect(view?.feature).toEqual({ title: "Sign in", id: "f-1" });
    expect(view?.behavior).toEqual({ title: "b-1", id: "b-1" });
    expect(view?.case).toEqual({
      caseUid: "C1",
      title: "Wrong password",
      id: "tc-1",
      scenarioUid: "S1",
    });
  });

  it("reports a case that declares no verification means as undeclared", () => {
    const view = describeCase(project(), "R1", "C1");

    expect(view?.verification).toEqual({ method: "未宣言", reference: null });
  });

  it("names the declared means and whether the reference resolves, never that anything ran", () => {
    const view = describeCase(
      project({
        binding_mode: "automated",
        binding_reference: "tests/login.spec.ts",
        reference_status: "missing",
      }),
      "R1",
      "C1",
    );

    expect(view?.verification).toEqual({
      method: "自動(参照)",
      reference: { target: "tests/login.spec.ts", status: "なし" },
    });
  });

  it("shows a declared means it has no name for as it is written", () => {
    const view = describeCase(
      project({ binding_mode: "exploratory" }),
      "R1",
      "C1",
    );

    expect(view?.verification.method).toBe("exploratory");
  });

  it("gives nothing for a case the traceability does not know", () => {
    expect(describeCase(project(), "R1", "unknown")).toBeUndefined();
  });
});
