import { describe, expect, it } from "vitest";
import { changedFeatureEdit } from "./edit";

const original = { uid: "F1", label: "Sign in", axis: ["ui", "workflow"] };

describe("changedFeatureEdit", () => {
  it("sends the label alone when only the label was changed", () => {
    expect(
      changedFeatureEdit(original, {
        label: "Log in",
        axis: ["ui", "workflow"],
      }),
    ).toEqual({ kind: "feature", uid: "F1", label: "Log in" });
  });

  it("sends the axes alone when only the axes were changed", () => {
    expect(
      changedFeatureEdit(original, { label: "Sign in", axis: ["ui"] }),
    ).toEqual({ kind: "feature", uid: "F1", axis: ["ui"] });
  });

  it("does not treat the same axes in another order as a change", () => {
    expect(
      changedFeatureEdit(original, {
        label: "Sign in",
        axis: ["workflow", "ui"],
      }),
    ).toEqual({ kind: "feature", uid: "F1" });
  });

  it("sends the uid alone when nothing was changed", () => {
    expect(
      changedFeatureEdit(original, {
        label: "Sign in",
        axis: ["ui", "workflow"],
      }),
    ).toEqual({ kind: "feature", uid: "F1" });
  });

  it("sends an empty label as it is, for the core to refuse", () => {
    expect(
      changedFeatureEdit(original, { label: "", axis: ["ui", "workflow"] }),
    ).toEqual({ kind: "feature", uid: "F1", label: "" });
  });

  it("does not send a label the feature never had", () => {
    expect(
      changedFeatureEdit(
        { uid: "F1", label: null, axis: [] },
        { label: "", axis: [] },
      ),
    ).toEqual({ kind: "feature", uid: "F1" });
  });
});
