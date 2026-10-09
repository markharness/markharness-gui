import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Backend } from "./backend";
import { ScenarioEditor } from "./ScenarioEditor";

function backendWith(overrides: Partial<Backend> = {}): Backend {
  return {
    getScenarioDetail: async () => ({
      description: "Rejects it.",
      implementation_note: null,
      phases: [
        { steps: [{ use: "seed" }, { action: "Click." }], results: ["Shown."] },
      ],
    }),
    getElementDetail: async () => ({
      axis: [],
      description: null,
      procedures: { seed: { steps: ["Add a task."] } },
    }),
    editKnowledge: async () => {},
    ...overrides,
  } as Backend;
}

async function open(backend: Backend, onEdited = vi.fn()) {
  render(
    <ScenarioEditor
      featureUid="F1"
      behaviorUid="B1"
      uid="S1"
      id="wrong-password"
      label="Wrong password"
      backend={backend}
      onEdited={onEdited}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Scenarioを編集" }));
  return within(await screen.findByRole("dialog", { name: "Scenarioを編集" }));
}

describe("ScenarioEditor", () => {
  it("opens one form with the fields and the phases the scenario has", async () => {
    const dialog = await open(backendWith());

    expect(dialog.getByLabelText("ID")).toHaveValue("wrong-password");
    expect(dialog.getByLabelText("ラベル")).toHaveValue("Wrong password");
    expect(dialog.getByLabelText("説明")).toHaveValue("Rejects it.");
    expect(dialog.getByLabelText("実装メモ")).toHaveValue("");
    expect(dialog.getByLabelText("手順1")).toHaveValue("seed");
    expect(dialog.getByLabelText("手順2")).toHaveValue("Click.");
  });

  it("saves the fields and the phases in one edit, and leaves out a note the scenario never had", async () => {
    const editKnowledge = vi.fn(async () => {});
    const onEdited = vi.fn();
    const dialog = await open(backendWith({ editKnowledge }), onEdited);

    fireEvent.change(dialog.getByLabelText("ラベル"), {
      target: { value: "Bad password" },
    });
    fireEvent.change(dialog.getByLabelText("手順2"), {
      target: { value: "Press it." },
    });
    fireEvent.click(dialog.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(onEdited).toHaveBeenCalledTimes(1));
    expect(editKnowledge).toHaveBeenCalledWith({
      kind: "scenario",
      feature_uid: "F1",
      behavior_uid: "B1",
      uid: "S1",
      id: "wrong-password",
      label: "Bad password",
      description: "Rejects it.",
      phases: [
        {
          steps: [{ use: "seed" }, { action: "Press it." }],
          results: ["Shown."],
        },
      ],
    });
    expect(
      screen.queryByRole("dialog", { name: "Scenarioを編集" }),
    ).not.toBeInTheDocument();
  });

  it("shows the core's refusal as it is and stays open", async () => {
    const onEdited = vi.fn();
    const dialog = await open(
      backendWith({
        editKnowledge: async () => {
          throw new Error("phases[0].steps[1].action: must not be empty");
        },
      }),
      onEdited,
    );

    fireEvent.click(dialog.getByRole("button", { name: "保存" }));

    expect(await dialog.findByRole("alert")).toHaveTextContent(
      "must not be empty",
    );
    expect(onEdited).not.toHaveBeenCalled();
  });

  it("says why the form could not open when the scenario cannot be read", async () => {
    render(
      <ScenarioEditor
        featureUid="F1"
        behaviorUid="B1"
        uid="S1"
        id="wrong-password"
        label={null}
        backend={backendWith({
          getScenarioDetail: async () => {
            throw new Error("markharnessを起動できません");
          },
        })}
        onEdited={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Scenarioを編集" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "markharnessを起動できません",
    );
  });
});
