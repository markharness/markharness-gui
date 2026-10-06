import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Axis } from "./backend";
import type { FeatureEdit } from "./edit";
import { FeatureEditForm } from "./FeatureEditForm";

const feature = { uid: "F1", label: "Sign in", axis: ["ui"] };
const candidates = [
  { id: "functional", label: "機能" },
  { id: "ui", label: "画面" },
];

const newCategory = () => screen.getByRole("group", { name: "新しい分類" });

function renderForm(
  save: (edit: FeatureEdit) => Promise<void> = async () => {},
  handlers: {
    onSaved?: () => void;
    onCancel?: () => void;
    addAxis?: (id: string, label: string) => Promise<Axis[]>;
  } = {},
) {
  return render(
    <FeatureEditForm
      feature={feature}
      candidates={candidates}
      save={save}
      addAxis={handlers.addAxis ?? (async () => candidates)}
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

  it("adds an axis in place, offers it checked, and keeps what was typed", async () => {
    const addAxis = vi.fn(async () => [
      ...candidates,
      { id: "perf", label: "性能" },
    ]);
    renderForm(undefined, { addAxis });
    fireEvent.change(screen.getByLabelText("ラベル"), {
      target: { value: "Log in" },
    });

    fireEvent.click(screen.getByRole("button", { name: "＋ 分類を追加" }));
    fireEvent.change(within(newCategory()).getByLabelText("id"), {
      target: { value: "perf" },
    });
    fireEvent.change(within(newCategory()).getByLabelText("ラベル"), {
      target: { value: "性能" },
    });
    fireEvent.click(screen.getByRole("button", { name: "追加" }));

    expect(await screen.findByLabelText("性能")).toBeChecked();
    expect(addAxis).toHaveBeenCalledWith("perf", "性能");
    expect(screen.getByLabelText("ラベル")).toHaveValue("Log in");
    expect(screen.getByLabelText("画面")).toBeChecked();
    expect(
      screen.queryByRole("group", { name: "新しい分類" }),
    ).not.toBeInTheDocument();
  });

  it("shows what the core said when it refused the axis, and keeps what was typed", async () => {
    renderForm(undefined, {
      addAxis: () =>
        Promise.reject(
          "error: axis 'perf' already exists under .markharness/axes/",
        ),
    });
    fireEvent.click(screen.getByRole("button", { name: "＋ 分類を追加" }));
    fireEvent.change(within(newCategory()).getByLabelText("id"), {
      target: { value: "perf" },
    });

    fireEvent.click(screen.getByRole("button", { name: "追加" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "axis 'perf' already exists",
    );
    expect(within(newCategory()).getByLabelText("id")).toHaveValue("perf");
    expect(screen.queryByLabelText("性能")).not.toBeInTheDocument();
  });

  it("shows the fields for a new category only after the plus button is pressed", () => {
    renderForm();

    expect(
      screen.queryByRole("group", { name: "新しい分類" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "分類" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "＋ 分類を追加" }));

    expect(within(newCategory()).getByLabelText("ラベル")).toBeInTheDocument();
  });

  it("keeps the plus button below the box of the categories, also while the fields are open", () => {
    renderForm();
    const plus = () => screen.getByRole("button", { name: "＋ 分類を追加" });

    expect(
      within(screen.getByRole("group", { name: "分類" })).queryByRole(
        "button",
        {
          name: "＋ 分類を追加",
        },
      ),
    ).not.toBeInTheDocument();
    expect(
      screen
        .getByRole("group", { name: "分類" })
        .compareDocumentPosition(plus()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(plus());

    expect(plus()).toBeInTheDocument();
  });

  it("closes the fields of a new category and forgets what was typed in them", async () => {
    renderForm(undefined, {
      addAxis: () => Promise.reject("error: not a valid slug"),
    });
    fireEvent.click(screen.getByRole("button", { name: "＋ 分類を追加" }));
    fireEvent.change(within(newCategory()).getByLabelText("id"), {
      target: { value: "Bad Id" },
    });
    fireEvent.click(screen.getByRole("button", { name: "追加" }));
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

    expect(
      screen.queryByRole("group", { name: "新しい分類" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "＋ 分類を追加" }));
    expect(within(newCategory()).getByLabelText("id")).toHaveValue("");
  });
});
