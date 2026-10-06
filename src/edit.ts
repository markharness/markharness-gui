/** One edit of a feature, with the label and the axes as the form holds them. */
export interface FeatureEdit {
  kind: "feature";
  uid: string;
  label: string;
  axis: string[];
}
