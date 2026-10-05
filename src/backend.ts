export interface Requirement {
  requirement_id: string;
  requirement_uid: string;
  source: "native" | "external";
  label: string | null;
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

export interface Coverage {
  at_commit: string;
  requirements: {
    requirement_uid: string;
    cases: { case_uid: string }[];
  }[];
}

/** The traceability and the coverage of one commit. */
export interface Project {
  at_commit: string;
  traceability: Traceability;
  coverage: Coverage;
}

export interface Backend {
  getProjectRoot(): Promise<string>;
  getProject(): Promise<Project>;
}
