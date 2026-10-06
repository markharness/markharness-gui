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

export type Edit = FeatureEdit | BehaviorEdit;
