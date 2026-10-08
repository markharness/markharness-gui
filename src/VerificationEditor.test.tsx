import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VerificationEditor } from "./VerificationEditor";

function renderEditor(
  handlers: {
    mode?: string | null;
    reference?: string | null;
    save?: (mode: string, reference: string | null) => Promise<void>;
    onSaved?: () => void;
    onCancel?: () => void;
  } = {},
) {
  return render(
    <VerificationEditor
      mode={handlers.mode === undefined ? "automated" : handlers.mode}
      reference={
        handlers.reference === undefined ? "tests/a.ts" : handlers.reference
      }
      save={handlers.save ?? (async () => {})}
      onSaved={handlers.onSaved ?? (() => {})}
      onCancel={handlers.onCancel ?? (() => {})}
    />,
  );
}

const save = () => screen.getByRole("button", { name: "保存" });

describe("VerificationEditor", () => {
  it("starts from the declared means and reference", () => {
    renderEditor({ mode: "manual", reference: "docs/check.md" });

    expect(screen.getByLabelText("方法")).toHaveValue("manual");
    expect(screen.getByLabelText("参照先")).toHaveValue("docs/check.md");
  });

  it("starts from automated with no reference for a case that declares nothing", () => {
    renderEditor({ mode: null, reference: null });

    expect(screen.getByLabelText("方法")).toHaveValue("automated");
    expect(screen.getByLabelText("参照先")).toHaveValue("");
  });

  it("saves the means and the reference as the form holds them", async () => {
    const saved = vi.fn(async () => {});
    renderEditor({ save: saved });

    fireEvent.change(screen.getByLabelText("方法"), {
      target: { value: "manual" },
    });
    fireEvent.change(screen.getByLabelText("参照先"), {
      target: { value: "docs/check.md" },
    });
    fireEvent.click(save());

    await waitFor(() =>
      expect(saved).toHaveBeenCalledWith("manual", "docs/check.md"),
    );
  });

  it("sends no reference when the field is emptied", async () => {
    const saved = vi.fn(async () => {});
    renderEditor({ save: saved });

    fireEvent.change(screen.getByLabelText("参照先"), {
      target: { value: "" },
    });
    fireEvent.click(save());

    await waitFor(() => expect(saved).toHaveBeenCalledWith("automated", null));
  });

  it("shows the core's refusal as it is and stays open", async () => {
    const onSaved = vi.fn();
    renderEditor({
      save: async () => {
        throw new Error("invalid mode");
      },
      onSaved,
    });

    fireEvent.click(save());

    expect(await screen.findByRole("alert")).toHaveTextContent("invalid mode");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("does nothing when Enter is pressed in the reference field", () => {
    const saved = vi.fn(async () => {});
    renderEditor({ save: saved });

    fireEvent.keyDown(screen.getByLabelText("参照先"), { key: "Enter" });

    expect(saved).not.toHaveBeenCalled();
  });

  it("cancels without saving", () => {
    const onCancel = vi.fn();
    renderEditor({ onCancel });

    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(onCancel).toHaveBeenCalled();
  });
});
