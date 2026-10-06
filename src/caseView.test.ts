import { describe, expect, it } from "vitest";
import type { Coverage, Traceability } from "./backend";
import { describeCase } from "./caseView";

interface Fixture {
  traceability: Traceability;
  coverage: Coverage;
}

function project(
  binding: Partial<Coverage["requirements"][0]["cases"][0]> = {},
): Fixture {
  return {
    traceability: {
      requirements: [
        {
          requirement_id: "req-1",
          requirement_uid: "R1",
          source: "native",
          label: "Login",
          case_uids: ["C1"],
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

function describeFixture(
  fixture: Fixture,
  requirementUid: string,
  caseUid: string,
) {
  return describeCase(
    fixture.traceability,
    fixture.coverage,
    requirementUid,
    caseUid,
  );
}

describe("describeCase", () => {
  it("follows the case up to its scenario, behavior, feature and the requirement picked from", () => {
    const view = describeFixture(project(), "R1", "C1");

    expect(view?.requirement).toEqual({
      title: "Login",
      id: "req-1",
      source: "native",
    });
    expect(view?.feature).toEqual({
      uid: "F1",
      title: "Sign in",
      id: "f-1",
      label: "Sign in",
    });
    expect(view?.behavior).toEqual({
      uid: "B1",
      featureUid: "F1",
      title: "b-1",
      id: "b-1",
      label: null,
    });
    expect(view?.case).toEqual({
      caseUid: "C1",
      title: "Wrong password",
      id: "tc-1",
      scenarioUid: "S1",
    });
  });

  it("reports a case that declares no verification means as undeclared", () => {
    const view = describeFixture(project(), "R1", "C1");

    expect(view?.verification).toEqual({ method: "未宣言", reference: null });
  });

  it("names the declared means and whether the reference resolves, never that anything ran", () => {
    const view = describeFixture(
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
    const view = describeFixture(
      project({ binding_mode: "exploratory" }),
      "R1",
      "C1",
    );

    expect(view?.verification?.method).toBe("exploratory");
  });

  it("leaves the verification out until the coverage is read, and still follows the case up", () => {
    const view = describeCase(project().traceability, null, "R1", "C1");

    expect(view?.verification).toBeUndefined();
    expect(view?.case.title).toBe("Wrong password");
  });

  it("gives nothing for a case the traceability does not know", () => {
    expect(describeFixture(project(), "R1", "unknown")).toBeUndefined();
  });
});
