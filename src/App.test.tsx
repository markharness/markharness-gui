import { fireEvent, render, screen, within } from "@testing-library/react";
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
    features: [{ feature_id: "f-1", feature_uid: "F1", label: "Sign in" }],
    behaviors: [
      {
        behavior_id: "b-1",
        behavior_uid: "B",
        feature_id: "f-1",
        feature_uid: "F1",
        label: "Password check",
      },
    ],
    scenarios: [
      {
        scenario_id: "sc-1",
        scenario_uid: "S1",
        behavior_id: "b-1",
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
      {
        requirement_uid: "R1",
        cases: [
          {
            case_uid: "C1",
            binding_mode: "automated",
            binding_reference: "tests/login.spec.ts",
            reference_status: "exists",
          },
        ],
      },
      { requirement_uid: "R2", cases: [] },
    ],
    gaps: [
      {
        kind: "requirement_has_no_feature",
        requirement_id: "req-2",
        feature_id: null,
      },
    ],
  },
};

function fakeBackend(overrides: Partial<Backend> = {}): Backend {
  return {
    getProjectRoot: async () => "/work/project",
    getProject: async () => project,
    getCaseDetail: async () => ({
      description: "Rejects a wrong password.",
      phases: [
        {
          steps: ["Open the form.", "Enter a wrong password."],
          results: ["An error is shown."],
        },
      ],
    }),
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
    // The title is the only control in the row: nothing flags the empty case list.
    expect(within(row).getAllByRole("button")).toHaveLength(1);
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

  it("asks to pick a row until one is picked", async () => {
    render(<App backend={fakeBackend()} />);

    expect(
      await screen.findByText("行を選ぶと、事実と出所が、ここに出ます。"),
    ).toBeInTheDocument();
  });

  it("shows the picked requirement in the detail pane with where its facts come from", async () => {
    render(<App backend={fakeBackend()} />);

    fireEvent.click(await screen.findByText("Login requirement"));

    const pane = screen.getByRole("complementary", { name: "詳細" });
    expect(within(pane).getByText("Login requirement")).toBeInTheDocument();
    expect(within(pane).getByText("req-1")).toBeInTheDocument();
    expect(
      within(pane).getByRole("heading", { name: /^紐づくケース/ }),
    ).toBeInTheDocument();
    expect(within(pane).getByText("1件")).toBeInTheDocument();
    expect(
      within(pane).getByText("Log in with a password"),
    ).toBeInTheDocument();
    expect(within(pane).getAllByText("markharness").length).toBeGreaterThan(0);
  });

  it("shows why the core reports a requirement as not covered, only in the detail pane", async () => {
    render(<App backend={fakeBackend()} />);
    await screen.findByText("Logout requirement");
    expect(screen.queryByText("機能のない要求")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Logout requirement"));

    const pane = screen.getByRole("complementary", { name: "詳細" });
    expect(within(pane).getByText("機能のない要求")).toBeInTheDocument();
    expect(within(pane).getByText("紐づいていません。")).toBeInTheDocument();
    expect(within(pane).getByText("0件")).toBeInTheDocument();
  });

  it("says that results of verification are not shown", async () => {
    render(<App backend={fakeBackend()} />);

    expect(
      await screen.findByText("検証結果は表示していません"),
    ).toBeInTheDocument();
  });

  it("shows the elements above a picked case, in the order the data links them", async () => {
    render(<App backend={fakeBackend()} />);
    fireEvent.click(await screen.findByText("Login requirement"));

    fireEvent.click(
      screen.getByRole("button", { name: /Log in with a password/ }),
    );

    const pane = screen.getByRole("complementary", { name: "詳細" });
    const titles = [
      "Login requirement",
      "Sign in",
      "Password check",
      "Log in with a password",
    ];
    const found = await within(pane).findAllByText(
      new RegExp(`^(${titles.join("|")})$`),
    );
    expect(found.map((e) => e.textContent)).toEqual(titles);
  });

  it("reads the description and the steps of the picked case at the displayed commit", async () => {
    const calls: unknown[][] = [];
    const backend = fakeBackend({
      getCaseDetail: async (...args) => {
        calls.push(args);
        return {
          description: "Rejects a wrong password.",
          phases: [
            {
              steps: ["Open the form.", "Enter a wrong password."],
              results: ["An error is shown."],
            },
          ],
        };
      },
    });
    render(<App backend={backend} />);
    fireEvent.click(await screen.findByText("Login requirement"));

    fireEvent.click(
      screen.getByRole("button", { name: /Log in with a password/ }),
    );

    expect(
      await screen.findByText("Rejects a wrong password."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Enter a wrong password\./)).toBeInTheDocument();
    expect(screen.getByText(/An error is shown\./)).toBeInTheDocument();
    expect(calls).toEqual([
      ["C1", "S1", "45c7fc13cfc0749fb0df9f2cdca724d0826f8a78"],
    ]);
  });

  it("shows the declared verification means and whether its reference resolves", async () => {
    render(<App backend={fakeBackend()} />);
    fireEvent.click(await screen.findByText("Login requirement"));

    fireEvent.click(
      screen.getByRole("button", { name: /Log in with a password/ }),
    );

    const pane = screen.getByRole("complementary", { name: "詳細" });
    expect(within(pane).getByText("自動")).toBeInTheDocument();
    expect(
      within(pane).getByText(/tests\/login\.spec\.ts/),
    ).toBeInTheDocument();
    expect(within(pane).getByText(/あり/)).toBeInTheDocument();
  });

  it("keeps the table and says why the detail of a case could not be read", async () => {
    const backend = fakeBackend({
      getCaseDetail: async () => {
        throw new Error("markharnessを起動できません");
      },
    });
    render(<App backend={backend} />);
    fireEvent.click(await screen.findByText("Login requirement"));

    fireEvent.click(
      screen.getByRole("button", { name: /Log in with a password/ }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "markharnessを起動できません",
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
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
