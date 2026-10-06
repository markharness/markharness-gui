import type { ChangeImpact } from "./backend";

/**
 * The cases the core does not report as confirmed, each counted once.
 * A touched requirement that has no case adds none: there is nothing to confirm on it.
 */
export function countCasesToConfirm(impact: ChangeImpact): number {
  const uids = new Set<string>();
  for (const requirement of impact.requirements) {
    for (const c of requirement.cases) {
      if (c.status !== "confirmed") uids.add(c.case_uid);
    }
  }
  return uids.size;
}
