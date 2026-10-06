import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EditError, FeatureEdit } from "./edit";
import { FeatureEditForm } from "./FeatureEditForm";

const feature = { uid: "F1", label: "Sign in", axis: ["ui"] };
const candidates = [
  { id: "functional", label: "機能" },
  { id: "ui", label: "画面" },
];

function renderForm(
  save: (edit: FeatureEdit) => Promise<void> = async () => {},
  handlers: { onSaved?: () => void; onCancel?: () => void } = {},
) {
  return render(
    <FeatureEditForm
      feature={feature}
      candidates={candidates}
      save={save}
      onSaved={handlers.onSaved ?? (() => {})}
      onCancel={handlers.onCancel ?? (() => {})}
    />,
  );
}

describe("FeatureEditForm", () => {
  it("starts from the label and the axes the feature has", () => {
    renderForm();

    expect(screen.getByLabelText("ラベル")).toHaveValue("Sign in");
    expect(screen.getByLabelText("機能")).not.toBeChecked();
    expect(screen.getByLabelText("画面")).toBeChecked();
  });

  it("saves only what was changed", async () => {
    const save = vi.fn(async () => {});
    renderForm(save);

    fireEvent.change(screen.getByLabelText("ラベル"), {
      target: { value: "Log in" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        kind: "feature",
        uid: "F1",
        label: "Log in",
      }),
    );
  });

  it("saves the uid alone when nothing was changed, instead of refusing", async () => {
    const save = vi.fn(async () => {});
    renderForm(save);

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({ kind: "feature", uid: "F1" }),
    );
  });

  it("tells that it was saved once the core applied the edit", async () => {
    const onSaved = vi.fn();
    renderForm(async () => {}, { onSaved });

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it("shows the diagnostics of the core above the form and keeps what was typed", async () => {
    const onSaved = vi.fn();
    const refused: EditError = {
      kind: "rejected",
      detail: [{ location: "features[0].label", message: "must not be empty" }],
    };
    renderForm(() => Promise.reject(refused), { onSaved });

    fireEvent.change(screen.getByLabelText("ラベル"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "features[0].label: must not be empty",
    );
    expect(screen.getByLabelText("ラベル")).toHaveValue("");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("says the edit was saved when only the generation of the tests failed", async () => {
    const failed: EditError = {
      kind: "generate_failed",
      detail: { exit_code: 1, stderr: "error: cannot write generated/" },
    };
    renderForm(() => Promise.reject(failed));

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "保存はできましたが、テストの生成に失敗しました",
    );
    expect(alert).toHaveTextContent("error: cannot write generated/");
  });

  it("shows the stderr of the core as it is when it failed without a diagnostic", async () => {
    const failed: EditError = {
      kind: "reconcile_failed",
      detail: { exit_code: 2, stderr: "error: no such project" },
    };
    renderForm(() => Promise.reject(failed));

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("error: no such project");
    expect(alert).not.toHaveTextContent("保存はできましたが");
  });

  it("shows why the core could not be run", async () => {
    const failed: EditError = {
      kind: "cannot_run",
      detail: "markharness: not found",
    };
    renderForm(() => Promise.reject(failed));

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "markharness: not found",
    );
  });

  it("closes on cancel without saving", () => {
    const save = vi.fn(async () => {});
    const onCancel = vi.fn();
    renderForm(save, { onCancel });

    fireEvent.change(screen.getByLabelText("ラベル"), {
      target: { value: "Log in" },
    });
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
  });
});
