import { describe, expect, it } from "vitest";
import type { Coverage, StrictDoc, Traceability } from "./backend";
import { buildRequirementRows } from "./rows";

interface Fixture {
  traceability: Traceability;
  coverage: Coverage;
}

function project(overrides: Partial<Fixture> = {}): Fixture {
  return {
    traceability: {
      requirements: [
        {
          requirement_id: "req-b",
          requirement_uid: "RB",
          source: "native",
          label: "Second",
          case_uids: [],
        },
        {
          requirement_id: "req-a",
          requirement_uid: "RA",
          source: "native",
          label: null,
          case_uids: ["C1", "C2"],
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

function build(
  fixture: Fixture,
  strictdoc: StrictDoc | null = null,
  descriptions: Record<string, string> = {},
) {
  return buildRequirementRows(
    fixture.traceability,
    strictdoc,
    descriptions,
    fixture.coverage,
  );
}

describe("buildRequirementRows", () => {
  it("makes one row per requirement, in the order the traceability reports them", () => {
    const rows = build(project());

    expect(rows.map((r) => r.requirementUid)).toEqual(["RB", "RA"]);
  });

  it("titles a requirement by its label, or by its id when it has none", () => {
    const rows = build(project());

    expect(rows.map((r) => r.title)).toEqual(["Second", "req-a"]);
  });

  it("lists the cases the traceability links to the requirement, titled by their scenario", () => {
    const [, ra] = build(project());

    expect(ra.cases.map((c) => [c.caseUid, c.title])).toEqual([
      ["C1", "Add a task"],
      ["C2", "sc-2"],
    ]);
  });

  it("gives a requirement with no cases an empty case list", () => {
    const [rb] = build(project());

    expect(rb.cases).toEqual([]);
  });

  it("lists the cases without the coverage, which is read apart from the traceability", () => {
    const [, ra] = buildRequirementRows(project().traceability, null, {}, null);

    expect(ra.cases.map((c) => c.caseUid)).toEqual(["C1", "C2"]);
  });

  it("carries the requirement id and where its content lives", () => {
    const [rb] = build(project());

    expect(rb.requirementId).toBe("req-b");
    expect(rb.source).toBe("native");
  });

  it("does not know why a requirement is not covered until the coverage is read", () => {
    const rows = buildRequirementRows(project().traceability, null, {}, null);

    expect(rows.every((r) => r.gaps === undefined)).toBe(true);
  });

  it("says in words why the core reports a requirement as not covered", () => {
    const [rb, ra] = build(project());

    expect(rb.gaps).toEqual([{ label: "機能のない要求", value: "" }]);
    expect(ra.gaps).toEqual([{ label: "ケースがない機能", value: "f-1" }]);
  });
});

describe("buildRequirementRows with StrictDoc", () => {
  const strictdoc: StrictDoc = {
    documents: [
      {
        title: "High-Level",
        nodes: [
          {
            kind: "requirement",
            mid: "m-h1",
            uid: "HLR-1",
            title: "Manage tasks",
            statement: "The system shall manage tasks.",
            parents: [],
          },
          {
            kind: "section",
            title: "Filtering",
            nodes: [
              {
                kind: "requirement",
                mid: "m-l1",
                uid: "LLR-1",
                title: "Filter by state",
                statement: "Filter.",
                parents: ["HLR-1"],
              },
              {
                kind: "requirement",
                mid: "m-l2",
                uid: "LLR-2",
                title: "Filter lost",
                statement: "Lost.",
                parents: ["HLR-1", "NOWHERE"],
              },
            ],
          },
        ],
      },
    ],
  };

  function externalProject(): Fixture {
    const p = project();
    p.traceability.requirements = [
      {
        requirement_id: "req-native",
        requirement_uid: "RN",
        source: "native",
        label: "Native",
        case_uids: [],
      },
      {
        requirement_id: "llr-1",
        requirement_uid: "RL1",
        source: "external",
        label: null,
        source_key: "m-l1",
        case_uids: ["C1"],
      },
    ];
    p.coverage.requirements = [
      { requirement_uid: "RN", cases: [] },
      {
        requirement_uid: "RL1",
        cases: [
          {
            case_uid: "C1",
            binding_mode: null,
            binding_reference: null,
            reference_status: null,
          },
        ],
      },
    ];
    p.coverage.gaps = [];
    return p;
  }

  it("lists every StrictDoc requirement in its document and section order, then the rest", () => {
    const rows = build(externalProject(), strictdoc);

    expect(rows.map((r) => r.title)).toEqual([
      "Manage tasks",
      "Filter by state",
      "Filter lost",
      "Native",
    ]);
  });

  it("keeps the document and section titles each requirement sits under", () => {
    const rows = build(externalProject(), strictdoc);

    expect(rows.map((r) => r.headings)).toEqual([
      ["High-Level"],
      ["High-Level", "Filtering"],
      ["High-Level", "Filtering"],
      [],
    ]);
  });

  it("joins a StrictDoc requirement to the markharness requirement that has its MID as source key", () => {
    const rows = build(externalProject(), strictdoc);

    const llr1 = rows.find((r) => r.title === "Filter by state");
    expect(llr1?.requirementUid).toBe("RL1");
    expect(llr1?.cases.map((c) => c.caseUid)).toEqual(["C1"]);
  });

  it("shows a StrictDoc requirement markharness does not know with no cases", () => {
    const rows = build(externalProject(), strictdoc);

    const hlr = rows.find((r) => r.title === "Manage tasks");
    expect(hlr?.requirementUid).toBeUndefined();
    expect(hlr?.cases).toEqual([]);
    expect(hlr?.gaps).toEqual([]);
  });

  it("carries the statement and the parents and children as the relations StrictDoc reports", () => {
    const rows = build(externalProject(), strictdoc);

    const hlr = rows.find((r) => r.title === "Manage tasks");
    expect(hlr?.strictdoc?.statement).toBe("The system shall manage tasks.");
    expect(hlr?.strictdoc?.parents).toEqual([]);
    expect(hlr?.strictdoc?.children.map((c) => c.uid)).toEqual([
      "LLR-1",
      "LLR-2",
    ]);
    const lost = rows.find((r) => r.title === "Filter lost");
    expect(lost?.strictdoc?.parents.map((p) => p.uid)).toEqual([
      "HLR-1",
      "NOWHERE",
    ]);
  });

  it("links a parent to its row, and leaves one the export does not contain unlinked", () => {
    const rows = build(externalProject(), strictdoc);

    const lost = rows.find((r) => r.title === "Filter lost");
    const hlr = rows.find((r) => r.title === "Manage tasks");
    expect(lost?.strictdoc?.parents[0].key).toBe(hlr?.key);
    expect(lost?.strictdoc?.parents[1].key).toBeUndefined();
  });

  it("keeps the markharness requirements as before when the project does not use StrictDoc", () => {
    const rows = build(externalProject(), null);

    expect(rows.map((r) => r.title)).toEqual(["Native", "llr-1"]);
    expect(rows.every((r) => r.strictdoc === undefined)).toBe(true);
  });
});

describe("buildRequirementRows with descriptions", () => {
  it("carries the description markharness holds for a requirement", () => {
    const rows = build(project(), null, {
      RA: "Does the thing.",
    });

    expect(rows.find((r) => r.requirementUid === "RA")?.description).toBe(
      "Does the thing.",
    );
    expect(
      rows.find((r) => r.requirementUid === "RB")?.description,
    ).toBeUndefined();
  });
});

describe("buildRequirementRows cases", () => {
  it("says which feature and behavior each case belongs to", () => {
    const p = project();
    p.traceability.features = [
      { feature_id: "f-1", feature_uid: "F1", label: "Sign in" },
    ];
    p.traceability.behaviors = [
      {
        behavior_id: "b-1",
        behavior_uid: "B",
        feature_id: "f-1",
        feature_uid: "F1",
        label: null,
      },
    ];

    const [, ra] = build(p);

    expect(ra.cases[0].belongsTo).toBe("Sign in › b-1");
  });
});
