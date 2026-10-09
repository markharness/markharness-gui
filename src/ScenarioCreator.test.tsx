import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Backend } from "./backend";
import { ScenarioCreator } from "./ScenarioCreator";

function backendWith(overrides: Partial<Backend> = {}): Backend {
  return {
    getElementDetail: async () => ({
      axis: [],
      description: null,
      procedures: { seed: { steps: ["Add a task."] } },
    }),
    createElement: async () => "S-new",
    ...overrides,
  } as Backend;
}

async function open(backend: Backend, onCreated = vi.fn()) {
  render(
    <ScenarioCreator
      featureUid="F1"
      behaviorUid="B1"
      backend={backend}
      onCreated={onCreated}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "↓ Scenarioを追加" }));
  return within(await screen.findByRole("dialog", { name: "Scenarioを追加" }));
}

describe("ScenarioCreator", () => {
  it("opens a form with the id, the label, the description and one empty phase", async () => {
    const dialog = await open(backendWith());

    expect(dialog.getByLabelText("ID")).toHaveValue("");
    expect(dialog.getByLabelText("ラベル")).toHaveValue("");
    expect(dialog.getByLabelText("説明")).toHaveValue("");
    expect(dialog.getByLabelText("手順1")).toHaveValue("");
    expect(dialog.getByLabelText("期待結果1")).toHaveValue("");
  });

  it("offers the common procedures of the behavior", async () => {
    const dialog = await open(backendWith());

    fireEvent.click(dialog.getByRole("checkbox", { name: "共通" }));

    expect(dialog.getByLabelText("手順1")).toHaveValue("seed");
  });

  it("creates the scenario with what the form holds and hands the new uid on", async () => {
    const createElement = vi.fn(async () => "S-new");
    const onCreated = vi.fn();
    const dialog = await open(backendWith({ createElement }), onCreated);

    fireEvent.change(dialog.getByLabelText("ID"), {
      target: { value: "s-new" },
    });
    fireEvent.change(dialog.getByLabelText("ラベル"), {
      target: { value: "New scenario" },
    });
    fireEvent.change(dialog.getByLabelText("説明"), {
      target: { value: "Does it." },
    });
    fireEvent.change(dialog.getByLabelText("手順1"), {
      target: { value: "Press it." },
    });
    fireEvent.change(dialog.getByLabelText("期待結果1"), {
      target: { value: "It shows." },
    });
    fireEvent.click(dialog.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("S-new"));
    expect(createElement).toHaveBeenCalledWith({
      kind: "scenario",
      feature_uid: "F1",
      behavior_uid: "B1",
      id: "s-new",
      label: "New scenario",
      description: "Does it.",
      phases: [{ steps: [{ action: "Press it." }], results: ["It shows."] }],
    });
    expect(
      screen.queryByRole("dialog", { name: "Scenarioを追加" }),
    ).not.toBeInTheDocument();
  });

  it("sends the implementation note when one is typed", async () => {
    const createElement = vi.fn(async () => "S-new");
    const dialog = await open(backendWith({ createElement }));

    fireEvent.change(dialog.getByLabelText("実装メモ"), {
      target: { value: "Uses the form." },
    });
    fireEvent.click(dialog.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(createElement).toHaveBeenCalledWith(
        expect.objectContaining({ implementation_note: "Uses the form." }),
      ),
    );
  });

  it("shows the core's refusal as it is and stays open", async () => {
    const onCreated = vi.fn();
    const dialog = await open(
      backendWith({
        createElement: async () => {
          throw new Error("features[0]: missing description");
        },
      }),
      onCreated,
    );

    fireEvent.click(dialog.getByRole("button", { name: "保存" }));

    expect(await dialog.findByRole("alert")).toHaveTextContent(
      "missing description",
    );
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("does nothing when Enter is pressed in a field", async () => {
    const createElement = vi.fn(async () => "S-new");
    const dialog = await open(backendWith({ createElement }));

    fireEvent.keyDown(dialog.getByLabelText("ID"), { key: "Enter" });

    expect(createElement).not.toHaveBeenCalled();
  });

  it("closes without creating when cancelled", async () => {
    const createElement = vi.fn(async () => "S-new");
    const dialog = await open(backendWith({ createElement }));

    fireEvent.click(dialog.getByRole("button", { name: "キャンセル" }));

    expect(
      screen.queryByRole("dialog", { name: "Scenarioを追加" }),
    ).not.toBeInTheDocument();
    expect(createElement).not.toHaveBeenCalled();
  });

  it("says why the form could not open when the procedures cannot be read", async () => {
    render(
      <ScenarioCreator
        featureUid="F1"
        behaviorUid="B1"
        backend={backendWith({
          getElementDetail: async () => {
            throw new Error("markharnessを起動できません");
          },
        })}
        onCreated={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "↓ Scenarioを追加" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "markharnessを起動できません",
    );
  });
});
