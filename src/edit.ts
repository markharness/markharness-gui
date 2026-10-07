/** One edit of a feature, with the label and the axes as the form holds them. */
export interface FeatureEdit {
  kind: "feature";
  uid: string;
  label: string;
  axis: string[];
}

/** One edit of a behavior, with the label, the description and the axes as the form holds them. */
export interface BehaviorEdit {
  kind: "behavior";
  feature_uid: string;
  uid: string;
  label: string;
  description?: string;
  axis: string[];
}

/** One edit of a scenario, with the label, the description and the implementation note as the form holds them. */
export interface ScenarioEdit {
  kind: "scenario";
  feature_uid: string;
  behavior_uid: string;
  uid: string;
  label: string;
  description?: string;
  implementation_note?: string;
}

/** One edit of a requirement markharness holds the content of, with the label, the description and the axes as the form holds them. */
export interface RequirementEdit {
  kind: "requirement";
  uid: string;
  label: string;
  description?: string;
  axis: string[];
}

export type Edit = FeatureEdit | BehaviorEdit | ScenarioEdit | RequirementEdit;

/**
 * The core refuses an empty note, so a note the scenario never had is left out while it is blank.
 * A note it had is sent even when emptied: the core cannot clear it and says so.
 */
export function scenarioEdit(
  ids: { featureUid: string; behaviorUid: string; uid: string },
  original: { implementationNote: string | null },
  values: { label: string; description?: string; implementationNote?: string },
): ScenarioEdit {
  const edit: ScenarioEdit = {
    kind: "scenario",
    feature_uid: ids.featureUid,
    behavior_uid: ids.behaviorUid,
    uid: ids.uid,
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
