import { useEffect, useState } from "react";
import type { Backend } from "./backend";
import { countCasesToConfirm } from "./impact";

export type ComparisonResult =
  | { kind: "loading" }
  | { kind: "counted"; casesToConfirm: number }
  /** The core's own message; no count is shown then, so that it is not read as 0. */
  | { kind: "failed"; message: string };

export interface Comparison {
  tags: string[];
  /** The tag compared against `HEAD`; empty until one is chosen. */
  base: string;
  chooseBase: (base: string) => void;
  /** `undefined` while no base is chosen. */
  result?: ComparisonResult;
}

/**
 * Compares the tag the user chooses with `HEAD`.
 * It reads again whenever `loaded` changes, which is when the project is reloaded.
 */
export function useComparison(backend: Backend, loaded: unknown): Comparison {
  const [tags, setTags] = useState<string[]>([]);
  const [base, setBase] = useState("");
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

  useEffect(() => {
    if (!loaded || !base) {
      setResult(undefined);
      return;
    }
    let current = true;
    setResult({ kind: "loading" });
    backend.getImpact(base).then(
      (impact) =>
        current &&
        setResult({
          kind: "counted",
          casesToConfirm: countCasesToConfirm(impact),
        }),
      (e) => current && setResult({ kind: "failed", message: String(e) }),
    );
    return () => {
      current = false;
    };
  }, [backend, loaded, base]);

  return { tags, base, chooseBase: setBase, result: base ? result : undefined };
}
