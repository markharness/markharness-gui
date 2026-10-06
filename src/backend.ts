import type { FeatureEdit } from "./edit";

export interface Requirement {
  requirement_id: string;
  requirement_uid: string;
  source: "native" | "external";
  label: string | null;
  /** For an external requirement, the MID of the StrictDoc requirement that holds its content. */
  source_key?: string | null;
  /** The cases the core relates to the requirement, by the same rule as the coverage. */
  case_uids: string[];
}

export interface Feature {
  feature_id: string;
  feature_uid: string;
  label: string | null;
}

export interface Behavior {
  behavior_id: string;
  behavior_uid: string;
  feature_id: string;
  feature_uid: string;
  label: string | null;
}

export interface Scenario {
  scenario_id: string;
  scenario_uid: string;
  behavior_id: string;
  behavior_uid: string;
  label: string | null;
}

export interface TestCase {
  case_id: string;
  case_uid: string;
  scenario_uid: string;
}

export interface Relation {
  from_uid: string;
  to_uid: string;
  kind: "contributes_to" | "generated_from";
}

export interface Traceability {
  requirements: Requirement[];
  features: Feature[];
  behaviors: Behavior[];
  scenarios: Scenario[];
  test_cases: TestCase[];
  relations: Relation[];
}

/** What the core reports about the committed content at `HEAD`. */
export interface Coverage {
  at_commit: string;
  requirements: {
    requirement_uid: string;
    cases: {
      case_uid: string;
      binding_mode: string | null;
      binding_reference: string | null;
      reference_status: "exists" | "missing" | "not_checked" | null;
    }[];
  }[];
  gaps: {
    kind: "requirement_has_no_feature" | "feature_has_no_case";
    requirement_id: string;
    feature_id: string | null;
  }[];
}

/** What the core reports about the requirements touched between a base and `HEAD`. */
export interface ChangeImpact {
  requirements: {
    requirement_uid: string;
    /** Empty when no case relates to the requirement. */
    cases: ImpactCase[];
  }[];
}

export interface ImpactCase {
  case_uid: string;
  status: "confirmed" | "followed_up" | "unconfirmed";
}

export interface CaseDetail {
  description: string | null;
  phases: { steps: string[]; results: string[] }[];
}

export type StrictDocNode =
  | { kind: "section"; title: string; nodes: StrictDocNode[] }
  | {
      kind: "requirement";
      mid: string;
      uid: string | null;
      title: string;
      statement: string;
      parents: string[];
    };

/** The requirements StrictDoc exports, in the order of its documents and sections. */
export interface StrictDoc {
  documents: { title: string; nodes: StrictDocNode[] }[];
}

/** The description markharness holds for a requirement; an external requirement has none. */
export interface RequirementDescription {
  uid: string;
  description: string | null;
}

export interface Axis {
  id: string;
  label: string;
}

export interface Backend {
  getProjectRoot(): Promise<string>;
  /** The working tree, including edits that are not committed yet. */
  getTraceability(): Promise<Traceability>;
  /** The committed content at `HEAD`; it cannot read the working tree. */
  getCoverage(): Promise<Coverage>;
  /** The tags to offer as the base of a comparison, the newest first; empty when none can be listed. */
  getTags(): Promise<string[]>;
  /** The committed content between `base` and `HEAD`; rejects with the core's message. */
  getImpact(base: string): Promise<ChangeImpact>;
  /** `null` when the project does not use StrictDoc. */
  getStrictDoc(skipSaved: boolean): Promise<StrictDoc | null>;
  getRequirementDescriptions(uids: string[]): Promise<RequirementDescription[]>;
  getCaseDetail(caseUid: string, scenarioUid: string): Promise<CaseDetail>;
  /** The axes the core records on a requirement, a feature or a behavior. */
  getAxis(uid: string): Promise<string[]>;
  /** The axes the project defines. */
  getAxes(): Promise<Axis[]>;
  /** Registers a new axis; the label is the id in the core when omitted. Rejects with what the core said. */
  addAxis(id: string, label?: string): Promise<void>;
  /** Writes the edit through the core; rejects with what the core said when it did not apply it. */
  editKnowledge(edit: FeatureEdit): Promise<void>;
}
