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
  screen.getByRole("region", { name: `フェーズ${n}` });
const steps = (n: number) =>
  within(within(phase(n)).getByRole("list", { name: "手順" }));
const results = (n: number) =>
  within(within(phase(n)).getByRole("list", { name: "期待結果" }));
const save = () => screen.getByRole("button", { name: "保存" });

describe("PhasesEditor", () => {
  it("lays out each phase with its steps and its results as numbered rows", () => {
    renderEditor();

    const rows = steps(1).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("1");
    expect(rows[1]).toHaveTextContent("2");
    expect(results(2).getAllByRole("listitem")).toHaveLength(2);
    expect(results(2).getAllByRole("listitem")[1]).toHaveTextContent("2");
    expect(
      within(phase(1)).getByRole("heading", { name: "手順" }),
    ).toBeInTheDocument();
    expect(
      within(phase(1)).getByRole("heading", { name: "期待結果" }),
    ).toBeInTheDocument();
  });

  it("starts from the phases, a call of a common procedure being a step marked as common", () => {
    renderEditor();

    const [call, free] = steps(1).getAllByRole("listitem");
    expect(within(call).getByLabelText("手順1")).toHaveValue("seed");
    expect(within(call).getByRole("checkbox", { name: "共通" })).toBeChecked();
    expect(within(free).getByLabelText("手順2")).toHaveValue(
      "Click the filter.",
    );
    expect(
      within(free).getByRole("checkbox", { name: "共通" }),
    ).not.toBeChecked();
    expect(results(1).getByLabelText("期待結果1")).toHaveValue(
      "Only the active tasks show.",
    );
  });

  it("saves all the phases whole, with what was rewritten", async () => {
    const onSave = vi.fn(async () => {});
    renderEditor({ save: onSave });

    fireEvent.change(steps(1).getByLabelText("手順1"), {
      target: { value: "login" },
    });
    fireEvent.change(steps(1).getByLabelText("手順2"), {
      target: { value: "Click the other filter." },
    });
    fireEvent.change(results(2).getByLabelText("期待結果1"), {
      target: { value: "The filter stays." },
    });
    fireEvent.click(save());

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([
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
    const onSave = vi.fn(async () => {});
    renderEditor({ save: onSave });

    fireEvent.click(save());

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(phases));
  });

  it("tells that it was saved once the core applied the edit", async () => {
    const onSaved = vi.fn();
    renderEditor({ onSaved });

    fireEvent.click(save());

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
    fireEvent.change(steps(1).getByLabelText("手順2"), {
      target: { value: "" },
    });

    fireEvent.click(save());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "phases[0].steps[1].action: must not be empty",
    );
    expect(steps(1).getByLabelText("手順2")).toHaveValue("");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("closes on cancel without saving", () => {
    const onSave = vi.fn(async () => {});
    const onCancel = vi.fn();
    renderEditor({ save: onSave, onCancel });
    fireEvent.change(steps(1).getByLabelText("手順2"), {
      target: { value: "changed" },
    });

    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("adds a step with one button only, directly below the steps, and a result directly below the results", () => {
    renderEditor();

    expect(
      screen.queryByRole("button", { name: "＋ 共通手順を追加" }),
    ).not.toBeInTheDocument();
    const addStep = within(phase(2)).getByRole("button", {
      name: "＋ 手順を追加",
    });
    const stepList = within(phase(2)).getByRole("list", { name: "手順" });
    const resultsHeading = within(phase(2)).getByRole("heading", {
      name: "期待結果",
    });
    expect(
      stepList.compareDocumentPosition(addStep) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      addStep.compareDocumentPosition(resultsHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const addResult = within(phase(2)).getByRole("button", {
      name: "＋ 期待結果を追加",
    });
    expect(
      within(phase(2))
        .getByRole("list", { name: "期待結果" })
        .compareDocumentPosition(addResult) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("adds a blank step and a blank result to a phase, and sends them for the core to judge", async () => {
    const onSave = vi.fn(async () => {});
    renderEditor({ save: onSave });

    fireEvent.click(
      within(phase(2)).getByRole("button", { name: "＋ 手順を追加" }),
    );
    fireEvent.click(
      within(phase(2)).getByRole("button", { name: "＋ 期待結果を追加" }),
    );
    fireEvent.change(steps(2).getByLabelText("手順2"), {
      target: { value: "Check it." },
    });
    fireEvent.click(save());

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([
        phases[0],
        {
          steps: [{ action: "Reload." }, { action: "Check it." }],
          results: ["The filter is kept.", "The count is kept.", ""],
        },
      ]),
    );
  });

  it("makes a step a common one with its checkbox, starting from the first procedure the behavior declares", async () => {
    const onSave = vi.fn(async () => {});
    renderEditor({ save: onSave });

    fireEvent.click(steps(2).getByRole("checkbox", { name: "共通" }));

    expect(steps(2).getByLabelText("手順1")).toHaveValue("seed");
    fireEvent.click(save());
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([
        phases[0],
        { steps: [{ use: "seed" }], results: phases[1].results },
      ]),
    );
  });

  it("keeps the text of a step when it is made common and made plain again", async () => {
    const onSave = vi.fn(async () => {});
    renderEditor({ save: onSave });
    const toggle = () => steps(2).getByRole("checkbox", { name: "共通" });

    fireEvent.click(toggle());
    fireEvent.click(toggle());

    expect(steps(2).getByLabelText("手順1")).toHaveValue("Reload.");
    fireEvent.click(save());
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(phases));
  });

  it("cannot make a step common when the behavior declares no procedure", () => {
    renderEditor({ procedures: {} });

    expect(steps(2).getByRole("checkbox", { name: "共通" })).toBeDisabled();
  });

  it("deletes a step and a result with the small button at the end of the row", async () => {
    const onSave = vi.fn(async () => {});
    renderEditor({ save: onSave });

    fireEvent.click(steps(1).getByRole("button", { name: "手順1を削除" }));
    fireEvent.click(
      results(2).getByRole("button", { name: "期待結果1を削除" }),
    );
    fireEvent.click(save());

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([
        {
          steps: [{ action: "Click the filter." }],
          results: phases[0].results,
        },
        { steps: [{ action: "Reload." }], results: ["The count is kept."] },
      ]),
    );
  });

  it("adds a phase that starts with a blank step and a blank result, so the core can judge it", async () => {
    const onSave = vi.fn(async () => {});
    renderEditor({ save: onSave });

    fireEvent.click(screen.getByRole("button", { name: "＋ フェーズを追加" }));
    fireEvent.change(steps(3).getByLabelText("手順1"), {
      target: { value: "Do it." },
    });
    fireEvent.change(results(3).getByLabelText("期待結果1"), {
      target: { value: "It is done." },
    });
    fireEvent.click(save());

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([
        ...phases,
        { steps: [{ action: "Do it." }], results: ["It is done."] },
      ]),
    );
  });

  it("deletes a phase with the button in its header", async () => {
    const onSave = vi.fn(async () => {});
    renderEditor({ save: onSave });

    fireEvent.click(screen.getByRole("button", { name: "フェーズ1を削除" }));

    expect(
      screen.queryByRole("region", { name: "フェーズ2" }),
    ).not.toBeInTheDocument();
    fireEvent.click(save());
    await waitFor(() => expect(onSave).toHaveBeenCalledWith([phases[1]]));
  });

  it("shows the steps of the common procedure a step calls", () => {
    renderEditor();
    const call = steps(1).getAllByRole("listitem")[0];

    expect(call).toHaveTextContent("Add a task.");
    expect(call).toHaveTextContent("Complete it.");

    fireEvent.change(within(call).getByLabelText("手順1"), {
      target: { value: "login" },
    });

    expect(call).toHaveTextContent("Sign in.");
    expect(call).not.toHaveTextContent("Add a task.");
  });

  it("does nothing on Enter, with or without Ctrl: it neither saves nor adds a row", () => {
    const onSave = vi.fn(async () => {});
    renderEditor({ save: onSave });
    const input = steps(1).getByLabelText("手順2");

    const plain = fireEvent.keyDown(input, { key: "Enter" });
    const withCtrl = fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });

    expect(plain).toBe(false);
    expect(withCtrl).toBe(false);
    expect(steps(1).getAllByRole("listitem")).toHaveLength(2);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("still lets Enter press a focused button", () => {
    renderEditor();
    const add = within(phase(1)).getByRole("button", { name: "＋ 手順を追加" });

    expect(fireEvent.keyDown(add, { key: "Enter" })).toBe(true);
  });
});
