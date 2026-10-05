import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import type { Backend, Project } from "./backend";

const project: Project = {
  at_commit: "45c7fc13cfc0749fb0df9f2cdca724d0826f8a78",
  traceability: {
    requirements: [
      {
        requirement_id: "req-1",
        requirement_uid: "R1",
        source: "native",
        label: "Login requirement",
      },
      {
        requirement_id: "req-2",
        requirement_uid: "R2",
        source: "native",
        label: "Logout requirement",
      },
    ],
    features: [],
    behaviors: [],
    scenarios: [
      {
        scenario_id: "sc-1",
        scenario_uid: "S1",
        behavior_id: "b",
        behavior_uid: "B",
        label: "Log in with a password",
      },
    ],
    test_cases: [{ case_id: "tc-1", case_uid: "C1", scenario_uid: "S1" }],
    relations: [],
  },
  coverage: {
    at_commit: "45c7fc13cfc0749fb0df9f2cdca724d0826f8a78",
    requirements: [
      { requirement_uid: "R1", cases: [{ case_uid: "C1" }] },
      { requirement_uid: "R2", cases: [] },
    ],
  },
};

function fakeBackend(overrides: Partial<Backend> = {}): Backend {
  return {
    getProjectRoot: async () => "/work/project",
    getProject: async () => project,
    ...overrides,
  };
}

describe("App", () => {
  it("shows the project root and the commit being displayed", async () => {
    render(<App backend={fakeBackend()} />);

    expect(await screen.findByText("/work/project")).toBeInTheDocument();
    expect(
      screen.getByText(/45c7fc13cfc0749fb0df9f2cdca724d0826f8a78/),
    ).toBeInTheDocument();
  });

  it("shows a requirement with its case count and the titles of its cases", async () => {
    render(<App backend={fakeBackend()} />);

    const row = (await screen.findByText("Login requirement")).closest("tr");
    if (!row) throw new Error("not inside a table row");
    expect(within(row).getByText("1")).toBeInTheDocument();
    expect(within(row).getByText("Log in with a password")).toBeInTheDocument();
  });

  it("shows a requirement with no cases as 0, without marking it", async () => {
    render(<App backend={fakeBackend()} />);

    const row = (await screen.findByText("Logout requirement")).closest("tr");
    if (!row) throw new Error("not inside a table row");
    expect(within(row).getByText("0")).toBeInTheDocument();
    expect(within(row).queryByRole("button")).not.toBeInTheDocument();
  });

  it("lists the requirements in the order the backend returns them", async () => {
    render(<App backend={fakeBackend()} />);

    await screen.findByText("Login requirement");
    const titles = screen
      .getAllByRole("row")
      .slice(1)
      .map((r) => r.querySelector("th")?.textContent);
    expect(titles).toEqual(["Login requirement", "Logout requirement"]);
  });

  it("shows only the error, with nothing partial, when the project cannot be read", async () => {
    const backend = fakeBackend({
      getProject: async () => {
        throw new Error(
          "対応しているschema_versionは 1 ですが、受け取ったのは 2 です",
        );
      },
    });

    render(<App backend={backend} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "対応しているschema_versionは 1 ですが、受け取ったのは 2 です",
    );
    expect(screen.queryByText("/work/project")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the error when the project root cannot be determined", async () => {
    const backend = fakeBackend({
      getProjectRoot: async () => {
        throw new Error("usage: markharness-gui --dir <project root>");
      },
    });

    render(<App backend={backend} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "usage: markharness-gui --dir <project root>",
    );
  });

  it("shows that it is loading until the backend answers", () => {
    const pending = new Promise<never>(() => {});
    const backend = fakeBackend({ getProject: () => pending });

    render(<App backend={backend} />);

    expect(screen.getByText("読み込み中…")).toBeInTheDocument();
  });
});
