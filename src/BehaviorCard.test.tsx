import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Backend } from "./backend";
import { BehaviorCard } from "./BehaviorCard";
import { BehaviorCreator } from "./BehaviorCreator";

const behavior = {
  uid: "B1",
  featureUid: "F1",
  title: "Check",
  id: "check",
  label: "Check",
};

function backendWith(overrides: Partial<Backend> = {}): Backend {
  return {
    getAxes: async () => [],
    getElementDetail: async () => ({
      axis: [],
      description: "Checks.",
      procedures: {},
    }),
    editKnowledge: async () => {},
    createElement: async () => "B-new",
    ...overrides,
  } as Backend;
}

describe("BehaviorCard", () => {
  it("sends no procedures when the behavior had none and none were added", async () => {
    const editKnowledge = vi.fn(async (_edit: object) => {});
    render(
      <BehaviorCard
        behavior={behavior}
        backend={backendWith({ editKnowledge })}
        onEdited={() => {}}
        onRemoved={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Behaviorを編集" }));
    const dialog = within(
      await screen.findByRole("dialog", { name: "Behaviorを編集" }),
    );
    fireEvent.click(dialog.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(editKnowledge).toHaveBeenCalledTimes(1));
    expect(editKnowledge.mock.calls[0]?.[0]).not.toHaveProperty("procedures");
  });

  it("sends the procedures whole once one is added", async () => {
    const editKnowledge = vi.fn(async (_edit: object) => {});
    render(
      <BehaviorCard
        behavior={behavior}
        backend={backendWith({ editKnowledge })}
        onEdited={() => {}}
        onRemoved={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Behaviorを編集" }));
    const dialog = within(
      await screen.findByRole("dialog", { name: "Behaviorを編集" }),
    );
    fireEvent.click(dialog.getByRole("button", { name: "＋ 共通手順を追加" }));
    fireEvent.change(dialog.getByLabelText("名前"), {
      target: { value: "seed" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "＋ 手順を追加" }));
    fireEvent.change(dialog.getByLabelText("手順1"), {
      target: { value: "Add a task." },
    });
    fireEvent.click(dialog.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(editKnowledge).toHaveBeenCalledWith(
        expect.objectContaining({
          procedures: [{ name: "seed", steps: ["Add a task."] }],
        }),
      ),
    );
  });
});

describe("BehaviorCreator", () => {
  it("creates a behavior with the procedures it declares", async () => {
    const createElement = vi.fn(async () => "B-new");
    render(
      <BehaviorCreator
        featureUid="F1"
        backend={backendWith({ createElement })}
        onCreated={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "↓ Behaviorを追加" }));
    const dialog = within(
      await screen.findByRole("dialog", { name: "Behaviorを追加" }),
    );
    fireEvent.change(dialog.getByLabelText("ID"), { target: { value: "b" } });
    fireEvent.change(dialog.getByLabelText("ラベル"), {
      target: { value: "B" },
    });
    fireEvent.change(dialog.getByLabelText("説明"), { target: { value: "D" } });
    fireEvent.click(dialog.getByRole("button", { name: "＋ 共通手順を追加" }));
    fireEvent.change(dialog.getByLabelText("名前"), {
      target: { value: "seed" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "＋ 手順を追加" }));
    fireEvent.change(dialog.getByLabelText("手順1"), {
      target: { value: "Add a task." },
    });
    fireEvent.click(dialog.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(createElement).toHaveBeenCalledWith({
        kind: "behavior",
        feature_uid: "F1",
        id: "b",
        label: "B",
        description: "D",
        axis: [],
        procedures: [{ name: "seed", steps: ["Add a task."] }],
      }),
    );
  });
});
