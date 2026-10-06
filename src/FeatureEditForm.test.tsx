import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FeatureEdit } from "./edit";
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

  it("saves the label and the axes as they are in the form", async () => {
    const save = vi.fn(async () => {});
    renderForm(save);

    fireEvent.change(screen.getByLabelText("ラベル"), {
      target: { value: "Log in" },
    });
    fireEvent.click(screen.getByLabelText("機能"));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        kind: "feature",
        uid: "F1",
        label: "Log in",
        axis: ["ui", "functional"],
      }),
    );
  });

  it("saves even when nothing was changed, instead of refusing", async () => {
    const save = vi.fn(async () => {});
    renderForm(save);

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        kind: "feature",
        uid: "F1",
        label: "Sign in",
        axis: ["ui"],
      }),
    );
  });

  it("tells that it was saved once the core applied the edit", async () => {
    const onSaved = vi.fn();
    renderForm(async () => {}, { onSaved });

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it("shows what the core said above the form and keeps what was typed", async () => {
    const onSaved = vi.fn();
    renderForm(() => Promise.reject("features[0].label: must not be empty"), {
      onSaved,
    });

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
