/** One edit of a feature; a field left out is not sent, so the core keeps its value. */
export interface FeatureEdit {
  kind: "feature";
  uid: string;
  label?: string;
  axis?: string[];
}

export function changedFeatureEdit(
  original: { uid: string; label: string | null; axis: string[] },
  form: { label: string; axis: string[] },
): FeatureEdit {
  const edit: FeatureEdit = { kind: "feature", uid: original.uid };
  if (form.label !== (original.label ?? "")) edit.label = form.label;
  if (!sameMembers(form.axis, original.axis)) edit.axis = form.axis;
  return edit;
}

function sameMembers(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/** Why the core did not apply an edit, as `edit_knowledge` reports it. */
export type EditError =
  | { kind: "rejected"; detail: { location: string; message: string }[] }
  | { kind: "reconcile_failed"; detail: CommandFailure }
  | { kind: "generate_failed"; detail: CommandFailure }
  | { kind: "cannot_run"; detail: string };

interface CommandFailure {
  exit_code: number | null;
  stderr: string;
}
