import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("opens a dialog named by its title, with its content in it", () => {
    render(
      <Modal title="要求を編集" onClose={() => {}}>
        <p>中身</p>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { name: "要求を編集" });
    expect(dialog).toHaveTextContent("中身");
  });

  it("asks to close when Escape cancels the dialog, and does not close by itself", () => {
    const onClose = vi.fn();
    render(
      <Modal title="要求を編集" onClose={onClose}>
        <p>中身</p>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { name: "要求を編集" });
    const cancel = new Event("cancel", { cancelable: true });
    fireEvent(dialog, cancel);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(cancel.defaultPrevented).toBe(true);
  });

  it("does not close when the backdrop is clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal title="要求を編集" onClose={onClose}>
        <p>中身</p>
      </Modal>,
    );

    fireEvent.click(screen.getByRole("dialog", { name: "要求を編集" }));

    expect(onClose).not.toHaveBeenCalled();
  });
});
