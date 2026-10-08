import type { ScenarioPhase } from "./backend";

/** One edit of a feature, with the label and the axes as the form holds them. */
export interface FeatureEdit {
  kind: "feature";
  uid: string;
  id?: string;
  label: string;
  axis: string[];
}

/** A common procedure of a behavior: the steps scenarios call by its name. */
export interface NamedProcedure {
  name: string;
  steps: string[];
}

/** One edit of a behavior, with the label, the description and the axes as the form holds them. */
export interface BehaviorEdit {
  kind: "behavior";
  feature_uid: string;
  uid: string;
  id?: string;
  label?: string;
  description?: string;
  axis?: string[];
  procedures?: NamedProcedure[];
}

/** One edit of a scenario, with the label, the description and the implementation note as the form holds them. */
export interface ScenarioEdit {
  kind: "scenario";
  feature_uid: string;
  behavior_uid: string;
  uid: string;
  id?: string;
  label?: string;
  description?: string;
  implementation_note?: string;
  phases?: ScenarioPhase[];
}

/** One edit of a requirement markharness holds the content of, with the label, the description and the axes as the form holds them. */
export interface RequirementEdit {
  kind: "requirement";
  uid: string;
  id?: string;
  label: string;
  description?: string;
  axis: string[];
}

/** One new element, with the fields the core needs to create it; a blank description is left out. */
export interface RequirementCreate {
  kind: "requirement";
  id: string;
  label: string;
  description?: string;
  axis: string[];
}

/** A new feature, which contributes to the requirements whose uids are given. */
export interface FeatureCreate {
  kind: "feature";
  id: string;
  label: string;
  contributes_to: string[];
  axis: string[];
}

/** A new behavior of the feature whose uid is given; the core needs its description. */
export interface BehaviorCreate {
  kind: "behavior";
  feature_uid: string;
  id: string;
  label: string;
  description: string;
  axis: string[];
}

export type Create = RequirementCreate | FeatureCreate | BehaviorCreate;

export type Edit = FeatureEdit | BehaviorEdit | ScenarioEdit | RequirementEdit;

/**
 * The core refuses an empty note, so a note the scenario never had is left out while it is blank.
 * A note it had is sent even when emptied: the core cannot clear it and says so.
 */
export function scenarioEdit(
  ids: { featureUid: string; behaviorUid: string; uid: string },
  original: { implementationNote: string | null },
  values: {
    id: string;
    label: string;
    description?: string;
    implementationNote?: string;
  },
): ScenarioEdit {
  const edit: ScenarioEdit = {
    kind: "scenario",
    feature_uid: ids.featureUid,
    behavior_uid: ids.behaviorUid,
    uid: ids.uid,
    id: values.id,
    label: values.label,
    description: values.description,
  };
  const note = values.implementationNote;
  if (
    note !== undefined &&
    !(original.implementationNote === null && note === "")
  ) {
    edit.implementation_note = note;
  }
  return edit;
}
