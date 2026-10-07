import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ScenarioPhase } from "./backend";
import { PhasesEditor } from "./PhasesEditor";

const phases: ScenarioPhase[] = [
  {
    steps: [{ use: "seed" }, { action: "Click the filter." }],
    results: ["Only the active tasks show."],
  },
  {
    steps: [{ action: "Reload." }],
    results: ["The filter is kept.", "The count is kept."],
  },
];
const procedures = {
  seed: { steps: ["Add a task.", "Complete it."] },
  login: { steps: ["Sign in."] },
};

function renderEditor(
  handlers: {
    save?: (phases: ScenarioPhase[]) => Promise<void>;
    onSaved?: () => void;
    onCancel?: () => void;
    phases?: ScenarioPhase[];
    procedures?: Record<string, { steps: string[] }>;
  } = {},
) {
  return render(
    <PhasesEditor
      phases={handlers.phases ?? phases}
      procedures={handlers.procedures ?? procedures}
      save={handlers.save ?? (async () => {})}
      onSaved={handlers.onSaved ?? (() => {})}
      onCancel={handlers.onCancel ?? (() => {})}
    />,
  );
}

const phase = (n: number) =>
  screen.getByRole("group", { name: `フェーズ${n}` });

describe("PhasesEditor", () => {
  it("starts from the phases, each with its steps and results as rows", () => {
    renderEditor();

    const first = phase(1);
    expect(within(first).getByLabelText("手順1")).toHaveValue("seed");
    expect(within(first).getByLabelText("手順2")).toHaveValue(
      "Click the filter.",
    );
    expect(within(first).getByLabelText("期待結果1")).toHaveValue(
      "Only the active tasks show.",
    );
    const second = phase(2);
    expect(within(second).getByLabelText("手順1")).toHaveValue("Reload.");
    expect(within(second).getByLabelText("期待結果2")).toHaveValue(
      "The count is kept.",
    );
  });

  it("saves all the phases whole, with what was rewritten", async () => {
    const save = vi.fn(async () => {});
    renderEditor({ save });

    fireEvent.change(within(phase(1)).getByLabelText("手順1"), {
      target: { value: "login" },
    });
    fireEvent.change(within(phase(1)).getByLabelText("手順2"), {
      target: { value: "Click the other filter." },
    });
    fireEvent.change(within(phase(2)).getByLabelText("期待結果1"), {
      target: { value: "The filter stays." },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith([
        {
          steps: [{ use: "login" }, { action: "Click the other filter." }],
          results: ["Only the active tasks show."],
        },
        {
          steps: [{ action: "Reload." }],
          results: ["The filter stays.", "The count is kept."],
        },
      ]),
    );
  });

  it("saves the phases as they are when nothing was changed", async () => {
    const save = vi.fn(async () => {});
    renderEditor({ save });

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(phases));
  });

  it("tells that it was saved once the core applied the edit", async () => {
    const onSaved = vi.fn();
    renderEditor({ onSaved });

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it("shows what the core said above the form, keeps what was typed, and does not say it was saved", async () => {
    const onSaved = vi.fn();
    renderEditor({
      save: () =>
        Promise.reject(
          "features[0].behaviors[0].scenarios[0].phases[0].steps[1].action: must not be empty",
        ),
      onSaved,
    });
    fireEvent.change(within(phase(1)).getByLabelText("手順2"), {
      target: { value: "" },
    });

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "phases[0].steps[1].action: must not be empty",
    );
    expect(within(phase(1)).getByLabelText("手順2")).toHaveValue("");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("closes on cancel without saving", () => {
    const save = vi.fn(async () => {});
    const onCancel = vi.fn();
    renderEditor({ save, onCancel });
    fireEvent.change(within(phase(1)).getByLabelText("手順2"), {
      target: { value: "changed" },
    });

    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
  });

  it("adds a blank step and a blank result to a phase, and sends them for the core to judge", async () => {
    const save = vi.fn(async () => {});
    renderEditor({ save });

    fireEvent.click(
      within(phase(2)).getByRole("button", { name: "＋ 手順を追加" }),
    );
    fireEvent.click(
      within(phase(2)).getByRole("button", { name: "＋ 期待結果を追加" }),
    );
    fireEvent.change(within(phase(2)).getByLabelText("手順2"), {
      target: { value: "Check it." },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith([
        phases[0],
        {
          steps: [{ action: "Reload." }, { action: "Check it." }],
          results: ["The filter is kept.", "The count is kept.", ""],
        },
      ]),
    );
  });

  it("adds a call of a common procedure, starting from the first one the behavior declares", async () => {
    const save = vi.fn(async () => {});
    renderEditor({ save });

    fireEvent.click(
      within(phase(2)).getByRole("button", { name: "＋ 共通手順を追加" }),
    );

    expect(within(phase(2)).getByLabelText("手順2")).toHaveValue("seed");
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith([
        phases[0],
        {
          steps: [{ action: "Reload." }, { use: "seed" }],
          results: phases[1].results,
        },
      ]),
    );
  });

  it("cannot add a call of a common procedure when the behavior declares none", () => {
    renderEditor({ procedures: {} });

    expect(
      within(phase(1)).getByRole("button", { name: "＋ 共通手順を追加" }),
    ).toBeDisabled();
  });

  it("deletes a step and a result", async () => {
    const save = vi.fn(async () => {});
    renderEditor({ save });

    fireEvent.click(
      within(phase(1)).getByRole("button", { name: "手順1を削除" }),
    );
    fireEvent.click(
      within(phase(2)).getByRole("button", { name: "期待結果1を削除" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith([
        {
          steps: [{ action: "Click the filter." }],
          results: phases[0].results,
        },
        { steps: [{ action: "Reload." }], results: ["The count is kept."] },
      ]),
    );
  });

  it("adds a phase that starts with a blank step and a blank result, so the core can judge it", async () => {
    const save = vi.fn(async () => {});
    renderEditor({ save });

    fireEvent.click(screen.getByRole("button", { name: "＋ フェーズを追加" }));
    fireEvent.change(within(phase(3)).getByLabelText("手順1"), {
      target: { value: "Do it." },
    });
    fireEvent.change(within(phase(3)).getByLabelText("期待結果1"), {
      target: { value: "It is done." },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith([
        ...phases,
        { steps: [{ action: "Do it." }], results: ["It is done."] },
      ]),
    );
  });

  it("deletes a phase", async () => {
    const save = vi.fn(async () => {});
    renderEditor({ save });

    fireEvent.click(
      within(phase(1)).getByRole("button", { name: "このフェーズを削除" }),
    );

    expect(
      screen.queryByRole("group", { name: "フェーズ2" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith([phases[1]]));
  });

  it("shows the steps of the common procedure a step calls", () => {
    renderEditor();

    const call = within(phase(1)).getByLabelText("手順1").closest(".row");
    expect(call).toHaveTextContent("Add a task.");
    expect(call).toHaveTextContent("Complete it.");

    fireEvent.change(within(phase(1)).getByLabelText("手順1"), {
      target: { value: "login" },
    });

    expect(call).toHaveTextContent("Sign in.");
    expect(call).not.toHaveTextContent("Add a task.");
  });
});
