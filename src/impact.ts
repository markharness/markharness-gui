import type { ChangeImpact } from "./backend";

/**
 * The cases the core does not report as confirmed, each once.
 * A touched requirement that has no case adds none: there is nothing to confirm on it.
 */
export function casesToConfirm(impact: ChangeImpact): ReadonlySet<string> {
  const uids = new Set<string>();
  for (const requirement of impact.requirements) {
    for (const c of requirement.cases) {
      if (c.status !== "confirmed") uids.add(c.case_uid);
    }
  }
  return uids;
}
