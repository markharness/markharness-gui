import { describe, expect, it } from "vitest";
import type { ChangeImpact, ImpactCase } from "./backend";
import { casesToConfirm } from "./impact";

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

describe("casesToConfirm", () => {
  it("collects the cases that are not confirmed, a followed-up one included", () => {
    const impact: ChangeImpact = {
      requirements: [
        touched(
          aCase("C1", "unconfirmed"),
          aCase("C2", "followed_up"),
          aCase("C3", "confirmed"),
        ),
      ],
    };

    expect(casesToConfirm(impact)).toEqual(new Set(["C1", "C2"]));
  });

  it("collects a case once even when several touched requirements relate to it", () => {
    const impact: ChangeImpact = {
      requirements: [
        touched(aCase("C1", "unconfirmed")),
        touched(aCase("C1", "unconfirmed"), aCase("C2", "unconfirmed")),
      ],
    };

    expect(casesToConfirm(impact)).toEqual(new Set(["C1", "C2"]));
  });

  it("collects nothing for a requirement that has no case", () => {
    const impact: ChangeImpact = { requirements: [touched()] };

    expect(casesToConfirm(impact).size).toBe(0);
  });

  it("is 0 when nothing was touched", () => {
    expect(casesToConfirm({ requirements: [] }).size).toBe(0);
  });
});
