import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { NamedProcedure } from "./edit";
import { ElementEditForm } from "./ElementEditForm";

const procedures = {
  seed: { steps: ["Add a task.", "Complete it."] },
  login: { steps: ["Sign in."] },
};

function renderEditor(
  handlers: {
    save?: (procedures: NamedProcedure[]) => Promise<void>;
    onSaved?: () => void;
    onCancel?: () => void;
  } = {},
) {
  return render(
    <ElementEditForm
      noun="Behavior"
      element={{ id: "b", label: "B", axis: [], procedures }}
      candidates={[]}
      save={(values) =>
        (handlers.save ?? (async () => {}))(values.procedures ?? [])
      }
      addAxis={async () => []}
      unusedAxes={async () => []}
      deleteUnusedAxes={async () => []}
      onSaved={handlers.onSaved ?? (() => {})}
      onCancel={handlers.onCancel ?? (() => {})}
    />,
  );
}

const procedure = (name: string) =>
  screen.getByRole("region", { name: `共通手順 ${name}` });
const save = () => screen.getByRole("button", { name: "保存" });

describe("ElementEditForm, for the common procedures of a behavior", () => {
  it("shows each procedure by a name that cannot be edited, with its steps as rows", () => {
    renderEditor();

    const seed = within(procedure("seed"));
    expect(seed.queryByRole("textbox", { name: "名前" })).toBeNull();
    expect(seed.getByRole("textbox", { name: "手順1" })).toHaveValue(
      "Add a task.",
    );
    expect(seed.getByRole("textbox", { name: "手順2" })).toHaveValue(
      "Complete it.",
    );
    expect(
      within(procedure("login")).getByRole("textbox", { name: "手順1" }),
    ).toHaveValue("Sign in.");
  });

  it("warns that every case calling a procedure changes with it", () => {
    renderEditor();

    expect(
      screen.getByText("この共通手順を使うすべてのケースが変わります。"),
    ).toBeInTheDocument();
  });

  it("sends every procedure whole after a step is edited", async () => {
    const saved = vi.fn(async () => {});
    renderEditor({ save: saved });

    fireEvent.change(
      within(procedure("login")).getByRole("textbox", { name: "手順1" }),
      { target: { value: "Sign in again." } },
    );
    fireEvent.click(save());

    await waitFor(() =>
      expect(saved).toHaveBeenCalledWith([
        { name: "seed", steps: ["Add a task.", "Complete it."] },
        { name: "login", steps: ["Sign in again."] },
      ]),
    );
  });

  it("adds a procedure with a name and steps", async () => {
    const saved = vi.fn(async () => {});
    renderEditor({ save: saved });

    fireEvent.click(screen.getByRole("button", { name: "＋ 共通手順を追加" }));
    const added = within(screen.getByRole("region", { name: "共通手順 3" }));
    fireEvent.change(added.getByRole("textbox", { name: "名前" }), {
      target: { value: "logout" },
    });
    fireEvent.click(added.getByRole("button", { name: "＋ 手順を追加" }));
    fireEvent.change(added.getByRole("textbox", { name: "手順1" }), {
      target: { value: "Sign out." },
    });
    fireEvent.click(save());

    await waitFor(() =>
      expect(saved).toHaveBeenCalledWith([
        { name: "seed", steps: ["Add a task.", "Complete it."] },
        { name: "login", steps: ["Sign in."] },
        { name: "logout", steps: ["Sign out."] },
      ]),
    );
  });

  it("drops a procedure and a step that are deleted", async () => {
    const saved = vi.fn(async () => {});
    renderEditor({ save: saved });

    fireEvent.click(screen.getByRole("button", { name: "手順2を削除" }));
    fireEvent.click(
      screen.getByRole("button", { name: "共通手順 loginを削除" }),
    );
    fireEvent.click(save());

    await waitFor(() =>
      expect(saved).toHaveBeenCalledWith([
        { name: "seed", steps: ["Add a task."] },
      ]),
    );
  });

  it("shows the core's refusal as it is and stays open", async () => {
    const onSaved = vi.fn();
    renderEditor({
      save: async () => {
        throw new Error("Scenario 'a' still uses procedure 'seed'");
      },
      onSaved,
    });

    fireEvent.click(save());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Scenario 'a' still uses procedure 'seed'",
    );
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("does nothing when Enter is pressed in a field", () => {
    const saved = vi.fn(async () => {});
    renderEditor({ save: saved });

    fireEvent.keyDown(
      within(procedure("login")).getByRole("textbox", { name: "手順1" }),
      { key: "Enter" },
    );

    expect(saved).not.toHaveBeenCalled();
  });

  it("cancels without saving", () => {
    const onCancel = vi.fn();
    renderEditor({ onCancel });

    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(onCancel).toHaveBeenCalled();
  });
});

describe("ElementEditForm without common procedures", () => {
  it("shows no common procedures and sends none for an element that has none", async () => {
    const onSave = vi.fn(async (_values: object) => {});
    render(
      <ElementEditForm
        noun="Feature"
        element={{ id: "f", label: "F", axis: [] }}
        candidates={[]}
        save={onSave}
        addAxis={async () => []}
        unusedAxes={async () => []}
        deleteUnusedAxes={async () => []}
        onSaved={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.queryByText("＋ 共通手順を追加")).not.toBeInTheDocument();
    fireEvent.click(save());

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]?.[0]).not.toHaveProperty("procedures");
  });
});
