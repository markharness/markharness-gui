import type {
  Coverage,
  StrictDoc,
  StrictDocNode,
  Traceability,
} from "./backend";

export interface RequirementRow {
  /** Identifies the row on screen; a StrictDoc requirement markharness does not know has no uid. */
  key: string;
  requirementUid: string | undefined;
  requirementId: string | undefined;
  /** Where the requirement's content lives: markharness, or an external spec (StrictDoc). */
  source: "native" | "external";
  title: string;
  /** The label markharness holds, which `title` falls back from; none for an external requirement. */
  label: string | null;
  /** What markharness holds as the requirement's description; an external requirement has none. */
  description?: string;
  /** The StrictDoc document and sections the requirement sits under. */
  headings: string[];
  /** Why the core reports the requirement as not covered; unknown until the coverage is read. */
  gaps?: { label: string; value: string }[];
  /** The features that contribute to the requirement, with or without a case. */
  features: { uid: string; title: string }[];
  cases: { caseUid: string; title: string; belongsTo: string }[];
  /** What StrictDoc reports; absent for a project that does not use it. */
  strictdoc?: {
    uid: string | null;
    statement: string;
    parents: { uid: string; key: string | undefined }[];
    children: { uid: string; key: string }[];
  };
}

interface Flat {
  node: Extract<StrictDocNode, { kind: "requirement" }>;
  headings: string[];
}

function flatten(strictdoc: StrictDoc): Flat[] {
  const out: Flat[] = [];
  const walk = (nodes: StrictDocNode[], headings: string[]) => {
    for (const node of nodes) {
      if (node.kind === "section") walk(node.nodes, [...headings, node.title]);
      else out.push({ node, headings });
    }
  };
  for (const doc of strictdoc.documents) walk(doc.nodes, [doc.title]);
  return out;
}

/**
 * One row per requirement. With StrictDoc, its requirements come first in its document and
 * section order and the rest follow; without it, the order is the traceability's. The cases
 * come from the traceability; the coverage only adds why a requirement is not covered.
 */
export function buildRequirementRows(
  traceability: Traceability,
  strictdoc: StrictDoc | null = null,
  descriptions: Record<string, string> = {},
  coverage: Coverage | null = null,
): RequirementRow[] {
  const scenarioByUid = new Map(
    traceability.scenarios.map((s) => [s.scenario_uid, s]),
  );
  const scenarioUidByCase = new Map(
    traceability.test_cases.map((c) => [c.case_uid, c.scenario_uid]),
  );
  const requirementByMid = new Map(
    traceability.requirements.flatMap((r) =>
      r.source_key ? [[r.source_key, r] as const] : [],
    ),
  );

  const featuresOf = (requirementUid: string) =>
    traceability.relations
      .filter(
        (rel) => rel.kind === "contributes_to" && rel.to_uid === requirementUid,
      )
      .flatMap((rel) => {
        const feature = traceability.features.find(
          (f) => f.feature_uid === rel.from_uid,
        );
        return feature
          ? [
              {
                uid: feature.feature_uid,
                title: feature.label ?? feature.feature_id,
              },
            ]
          : [];
      });

  type Known = Traceability["requirements"][number];
  const known = (r: Known | undefined, title: string, headings: string[]) => ({
    requirementUid: r?.requirement_uid,
    requirementId: r?.requirement_id,
    description: r ? descriptions[r.requirement_uid] : undefined,
    features: r ? featuresOf(r.requirement_uid) : [],
    source: r?.source ?? ("external" as const),
    title,
    label: r?.label ?? null,
    headings,
    gaps: coverage
      ? r
        ? coverage.gaps
            .filter((g) => g.requirement_id === r.requirement_id)
            .map((g) =>
              g.kind === "requirement_has_no_feature"
                ? { label: "機能のない要求", value: "" }
                : { label: "ケースがない機能", value: g.feature_id ?? "" },
            )
        : []
      : undefined,
    cases: (r?.case_uids ?? []).map((caseUid) => {
      const scenario = scenarioByUid.get(scenarioUidByCase.get(caseUid) ?? "");
      const behavior = traceability.behaviors.find(
        (b) => b.behavior_uid === scenario?.behavior_uid,
      );
      const feature = traceability.features.find(
        (f) => f.feature_uid === behavior?.feature_uid,
      );
      return {
        caseUid,
        title: scenario?.label ?? scenario?.scenario_id ?? caseUid,
        belongsTo: [
          feature && (feature.label ?? feature.feature_id),
          behavior && (behavior.label ?? behavior.behavior_id),
        ]
          .filter(Boolean)
          .join(" › "),
      };
    }),
  });

  const fromStrictDoc: RequirementRow[] = [];
  const shown = new Set<string>();
  if (strictdoc) {
    const flat = flatten(strictdoc);
    const keyOf = (f: Flat) =>
      requirementByMid.get(f.node.mid)?.requirement_uid ??
      `strictdoc:${f.node.mid}`;
    const keyByUid = new Map(
      flat.flatMap((f) =>
        f.node.uid ? [[f.node.uid, keyOf(f)] as const] : [],
      ),
    );
    for (const f of flat) {
      const r = requirementByMid.get(f.node.mid);
      if (r) shown.add(r.requirement_uid);
      fromStrictDoc.push({
        key: keyOf(f),
        ...known(r, f.node.title, f.headings),
        strictdoc: {
          uid: f.node.uid,
          statement: f.node.statement,
          parents: f.node.parents.map((uid) => ({
            uid,
            key: keyByUid.get(uid),
          })),
          children: flat
            .filter((c) => f.node.uid && c.node.parents.includes(f.node.uid))
            .map((c) => ({ uid: c.node.uid ?? "", key: keyOf(c) })),
        },
      });
    }
  }

  const rest = traceability.requirements
    .filter((r) => !shown.has(r.requirement_uid))
    .map((r) => ({
      key: r.requirement_uid,
      ...known(r, r.label ?? r.requirement_id, []),
    }));
  return [...fromStrictDoc, ...rest];
}
