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
  label: string | null;
}

export interface Scenario {
  scenario_id: string;
  scenario_uid: string;
  behavior_id: string;
  label: string | null;
}

export interface TestCase {
  case_id: string;
  case_uid: string;
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

export interface Backend {
  getProjectRoot(): Promise<string>;
  getTraceability(): Promise<Traceability>;
}
