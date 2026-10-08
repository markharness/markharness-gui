import { describe, expect, it } from "vitest";
import { scenarioEdit } from "./edit";

const ids = { featureUid: "F1", behaviorUid: "B1", uid: "S1" };

describe("scenarioEdit", () => {
  it("sends the label, the description and the note as the form holds them", () => {
    expect(
      scenarioEdit(
        ids,
        { implementationNote: "Old note.\n" },
        {
          id: "log-in",
          label: "Log in",
          description: "Logs in.",
          implementationNote: "New note.",
        },
      ),
    ).toEqual({
      kind: "scenario",
      feature_uid: "F1",
      behavior_uid: "B1",
      uid: "S1",
      id: "log-in",
      label: "Log in",
      description: "Logs in.",
      implementation_note: "New note.",
    });
  });

  it("leaves the note out when the scenario had none and the field is still blank", () => {
    const edit = scenarioEdit(
      ids,
      { implementationNote: null },
      {
        id: "log-in",
        label: "Log in",
        description: "Logs in.",
        implementationNote: "",
      },
    );

    expect("implementation_note" in edit).toBe(false);
  });

  it("sends a blank note as it is when the scenario had one, for the core to refuse", () => {
    expect(
      scenarioEdit(
        ids,
        { implementationNote: "Old note.\n" },
        {
          id: "log-in",
          label: "Log in",
          description: "Logs in.",
          implementationNote: "",
        },
      ).implementation_note,
    ).toBe("");
  });
});
