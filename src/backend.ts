import type { Create, Edit } from "./edit";

/** Which kind of element a removal names. */
export type RemoveKind = "requirement" | "feature" | "behavior" | "scenario";

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

/** What a case declares as its verification means in the working tree; declaring one does not mean anything ran. */
export interface Binding {
  case_uid: string;
  mode: string;
  reference: string | null;
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

export interface ElementDetail {
  axis: string[];
  description: string | null;
  /** The common procedures a behavior declares, by name. */
  procedures: Record<string, { steps: string[] }>;
}

/** A step is free text, or the name of a procedure the behavior declares. */
export type ScenarioStep = { action: string } | { use: string };

/** One phase of a scenario as the knowledge writes it: steps to take, then results to check. */
export interface ScenarioPhase {
  steps: ScenarioStep[];
  results: string[];
}

export interface ScenarioDetail {
  description: string | null;
  implementation_note: string | null;
  phases: ScenarioPhase[];
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
  /** What each case declares as its verification means, in the working tree. */
  getBindings(): Promise<Binding[]>;
  /** Declares the means of a case, replacing the one it had; no reference leaves it without one. */
  setBinding(
    caseUid: string,
    mode: string,
    reference: string | null,
  ): Promise<void>;
  /** The tags to offer as the base of a comparison, the newest first; empty when none can be listed. */
  getTags(): Promise<string[]>;
  /** The committed content between `base` and `HEAD`; rejects with the core's message. */
  getImpact(base: string): Promise<ChangeImpact>;
  /** `null` when the project does not use StrictDoc. */
  getStrictDoc(skipSaved: boolean): Promise<StrictDoc | null>;
  getRequirementDescriptions(uids: string[]): Promise<RequirementDescription[]>;
  getCaseDetail(caseUid: string, scenarioUid: string): Promise<CaseDetail>;
  /** The axes and the description the core records on a requirement, a feature or a behavior. */
  getElementDetail(uid: string): Promise<ElementDetail>;
  /** The description and the implementation note the core records on a scenario. */
  getScenarioDetail(uid: string): Promise<ScenarioDetail>;
  /** The axes the project defines. */
  getAxes(): Promise<Axis[]>;
  /** The ids of the axes no requirement, feature or behavior uses. */
  getUnusedAxes(): Promise<string[]>;
  /** Deletes every axis nobody uses; rejects with what the core said. */
  deleteUnusedAxes(): Promise<void>;
  /** Registers a new axis; the label is the id in the core when omitted. Rejects with what the core said. */
  addAxis(id: string, label?: string): Promise<void>;
  /** Creates one element through the core and returns the uid the core gave it; rejects with what the core said when it did not. */
  createElement(create: Create): Promise<string>;
  /** Deletes one element through the core, with the children that cannot stand without it; rejects with what the core said when it did not. */
  removeElement(kind: RemoveKind, uid: string): Promise<void>;
  /** Writes the edit through the core; rejects with what the core said when it did not apply it. */
  editKnowledge(edit: Edit): Promise<void>;
}
