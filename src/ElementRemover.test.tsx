import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Backend } from "./backend";
import { ElementRemover } from "./ElementRemover";

function backendWith(overrides: Partial<Backend> = {}): Backend {
  return { removeElement: async () => {}, ...overrides } as Backend;
}

async function open(
  kind: "requirement" | "feature" | "behavior" | "scenario",
  noun: string,
  backend: Backend,
  onRemoved = vi.fn(),
) {
  render(
    <ElementRemover
      kind={kind}
      noun={noun}
      uid="U1"
      backend={backend}
      onRemoved={onRemoved}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: `${noun}を削除` }));
  return within(await screen.findByRole("dialog", { name: `${noun}を削除` }));
}

describe("ElementRemover", () => {
  it("asks for a confirmation that says it cannot be undone", async () => {
    const dialog = await open("scenario", "Scenario", backendWith());

    expect(dialog.getByText(/元に戻せません/)).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "削除" })).toBeInTheDocument();
    expect(
      dialog.getByRole("button", { name: "キャンセル" }),
    ).toBeInTheDocument();
  });

  it("says a feature takes its behaviors and scenarios with it", async () => {
    const dialog = await open("feature", "Feature", backendWith());

    expect(dialog.getByText(/Behavior/)).toBeInTheDocument();
    expect(dialog.getByText(/Scenario/)).toBeInTheDocument();
  });

  it("says a behavior takes its scenarios with it", async () => {
    const dialog = await open("behavior", "Behavior", backendWith());

    expect(dialog.getByText(/Scenario/)).toBeInTheDocument();
  });

  it("says a requirement leaves its features, only detached from it", async () => {
    const dialog = await open("requirement", "要求", backendWith());

    expect(dialog.getByText(/Featureは削除されず/)).toBeInTheDocument();
  });

  it("removes the element once confirmed and hands over", async () => {
    const removeElement = vi.fn(async () => {});
    const onRemoved = vi.fn();
    const dialog = await open(
      "scenario",
      "Scenario",
      backendWith({ removeElement }),
      onRemoved,
    );

    fireEvent.click(dialog.getByRole("button", { name: "削除" }));

    await waitFor(() => expect(onRemoved).toHaveBeenCalledTimes(1));
    expect(removeElement).toHaveBeenCalledWith("scenario", "U1");
    expect(
      screen.queryByRole("dialog", { name: "Scenarioを削除" }),
    ).not.toBeInTheDocument();
  });

  it("shows the core's refusal as it is and stays open", async () => {
    const onRemoved = vi.fn();
    const dialog = await open(
      "scenario",
      "Scenario",
      backendWith({
        removeElement: async () => {
          throw new Error("error: no scenario matches 'U1'");
        },
      }),
      onRemoved,
    );

    fireEvent.click(dialog.getByRole("button", { name: "削除" }));

    expect(await dialog.findByRole("alert")).toHaveTextContent(
      "no scenario matches 'U1'",
    );
    expect(onRemoved).not.toHaveBeenCalled();
  });

  it("closes without removing when cancelled", async () => {
    const removeElement = vi.fn(async () => {});
    const dialog = await open(
      "scenario",
      "Scenario",
      backendWith({ removeElement }),
    );

    fireEvent.click(dialog.getByRole("button", { name: "キャンセル" }));

    expect(
      screen.queryByRole("dialog", { name: "Scenarioを削除" }),
    ).not.toBeInTheDocument();
    expect(removeElement).not.toHaveBeenCalled();
  });
});
