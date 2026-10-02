import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("shows the project root returned by the backend", async () => {
    const backend = { getProjectRoot: async () => "/work/project" };

    render(<App backend={backend} />);

    expect(await screen.findByText("/work/project")).toBeInTheDocument();
  });

  it("shows the error when the backend fails", async () => {
    const backend = {
      getProjectRoot: async () => {
        throw new Error("usage: markharness-gui --dir <project root>");
      },
    };

    render(<App backend={backend} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "usage: markharness-gui --dir <project root>",
    );
  });
});
