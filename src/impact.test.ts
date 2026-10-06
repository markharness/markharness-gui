import { describe, expect, it } from "vitest";
import type { ChangeImpact, ImpactCase } from "./backend";
import { countCasesToConfirm } from "./impact";

const touched = (
  ...cases: ImpactCase[]
): ChangeImpact["requirements"][number] => ({
  requirement_uid: "R",
  cases,
});
const aCase = (case_uid: string, status: ImpactCase["status"]): ImpactCase => ({
  case_uid,
  status,
});

describe("countCasesToConfirm", () => {
  it("counts the cases that are not confirmed, a followed-up one included", () => {
    const impact: ChangeImpact = {
      requirements: [
        touched(
          aCase("C1", "unconfirmed"),
          aCase("C2", "followed_up"),
          aCase("C3", "confirmed"),
        ),
      ],
    };

    expect(countCasesToConfirm(impact)).toBe(2);
  });

  it("counts a case once even when several touched requirements relate to it", () => {
    const impact: ChangeImpact = {
      requirements: [
        touched(aCase("C1", "unconfirmed")),
        touched(aCase("C1", "unconfirmed"), aCase("C2", "unconfirmed")),
      ],
    };

    expect(countCasesToConfirm(impact)).toBe(2);
  });

  it("does not count a requirement that has no case", () => {
    const impact: ChangeImpact = { requirements: [touched()] };

    expect(countCasesToConfirm(impact)).toBe(0);
  });

  it("is 0 when nothing was touched", () => {
    expect(countCasesToConfirm({ requirements: [] })).toBe(0);
  });
});
