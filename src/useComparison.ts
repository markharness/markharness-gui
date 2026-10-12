import { useEffect, useState } from "react";
import type { Backend, ComparisonTarget } from "./backend";
import { casesToConfirm } from "./impact";

export type ComparisonResult =
  | { kind: "loading" }
  | { kind: "counted"; casesToConfirm: ReadonlySet<string> }
  /** The core's own message; no count is shown then, so that it is not read as 0. */
  | { kind: "failed"; message: string };

/**
 * The value of the choice for the uncommitted edits. A colon cannot be in the name of a git ref,
 * so no tag takes this value.
 */
export const UNCOMMITTED = ":uncommitted";

function toTarget(choice: string): ComparisonTarget | undefined {
  if (!choice) return undefined;
  return choice === UNCOMMITTED
    ? { kind: "uncommitted" }
    : { kind: "tag", name: choice };
}

export interface Comparison {
  tags: string[];
  /** The value chosen: empty until one is chosen, `UNCOMMITTED`, or the name of a tag. */
  choice: string;
  choose: (choice: string) => void;
  /** `undefined` while nothing is chosen. */
  target?: ComparisonTarget;
  /** `undefined` while nothing is chosen. */
  result?: ComparisonResult;
}

/**
 * Compares what the user chooses: a tag with `HEAD`, or `HEAD` with the uncommitted edits.
 * It reads again whenever `loaded` changes, which is when the project is reloaded.
 * The uncommitted edits read again whenever `workingTree` changes too, which is after an edit
 * has changed the working tree; a tag is committed content, which an edit does not change.
 */
export function useComparison(
  backend: Backend,
  loaded: unknown,
  workingTree: unknown,
): Comparison {
  const [tags, setTags] = useState<string[]>([]);
  const [choice, setChoice] = useState("");
  const [result, setResult] = useState<ComparisonResult>();

  useEffect(() => {
    if (!loaded) return;
    let current = true;
    backend.getTags().then(
      (found) => current && setTags(found),
      () => current && setTags([]),
    );
    return () => {
      current = false;
    };
  }, [backend, loaded]);

  const followsEdits = choice === UNCOMMITTED ? workingTree : undefined;

  // biome-ignore lint/correctness/useExhaustiveDependencies: `followsEdits` is read by no line here; it only makes an edit read again.
  useEffect(() => {
    const target = toTarget(choice);
    if (!loaded || !target) {
      setResult(undefined);
      return;
    }
    let current = true;
    setResult({ kind: "loading" });
    backend.getImpact(target).then(
      (impact) =>
        current &&
        setResult({
          kind: "counted",
          casesToConfirm: casesToConfirm(impact),
        }),
      (e) => current && setResult({ kind: "failed", message: String(e) }),
    );
    return () => {
      current = false;
    };
  }, [backend, loaded, choice, followsEdits]);

  return {
    tags,
    choice,
    choose: setChoice,
    target: toTarget(choice),
    result: choice ? result : undefined,
  };
}
