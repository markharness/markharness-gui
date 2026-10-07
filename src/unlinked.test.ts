import { describe, expect, it } from "vitest";
import type { Traceability } from "./backend";
import { unlinkedFeatures } from "./unlinked";

function traceability(overrides: Partial<Traceability> = {}): Traceability {
  return {
    requirements: [],
    features: [
      { feature_id: "f-1", feature_uid: "F1", label: "Sign in" },
      { feature_id: "f-2", feature_uid: "F2", label: null },
    ],
    behaviors: [
      {
        behavior_id: "b-2",
        behavior_uid: "B2",
        feature_id: "f-2",
        feature_uid: "F2",
        label: null,
      },
    ],
    scenarios: [
      {
        scenario_id: "sc-2",
        scenario_uid: "S2",
        behavior_id: "b-2",
        behavior_uid: "B2",
        label: null,
      },
    ],
    test_cases: [],
    relations: [],
    ...overrides,
  };
}

describe("unlinkedFeatures", () => {
  it("names the features that contribute to no requirement, by label or else by id", () => {
    expect(unlinkedFeatures(traceability())).toEqual(["Sign in", "f-2"]);
  });

  it("leaves out a feature that contributes to a requirement", () => {
    const t = traceability({
      relations: [{ from_uid: "F1", to_uid: "R1", kind: "contributes_to" }],
    });

    expect(unlinkedFeatures(t)).toEqual(["f-2"]);
  });

  it("leaves out a feature one of whose scenarios contributes to a requirement itself", () => {
    const t = traceability({
      relations: [
        { from_uid: "F1", to_uid: "R1", kind: "contributes_to" },
        { from_uid: "S2", to_uid: "R1", kind: "contributes_to" },
      ],
    });

    expect(unlinkedFeatures(t)).toEqual([]);
  });

  it("does not take the link of a test case to its scenario for a link to a requirement", () => {
    const t = traceability({
      relations: [{ from_uid: "C2", to_uid: "S2", kind: "generated_from" }],
    });

    expect(unlinkedFeatures(t)).toEqual(["Sign in", "f-2"]);
  });
});
