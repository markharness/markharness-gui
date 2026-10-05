import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import type { Backend, Project, StrictDoc } from "./backend";

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
    getStrictDoc: async () => null,
    getRequirementDescriptions: async () => [],
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
    expect(screen.getByText("45c7fc1")).toBeInTheDocument();
  });

  it("shows the commit shortly", async () => {
    render(<App backend={fakeBackend()} />);

    const commit = await screen.findByText("45c7fc1");

    expect(commit.parentElement).toHaveTextContent("(HEAD)");
  });

  it("picks a requirement from anywhere in its row", async () => {
    render(<App backend={fakeBackend()} />);
    const row = (await screen.findByText("Login requirement")).closest("tr");
    if (!row) throw new Error("not inside a table row");

    fireEvent.click(within(row).getByText("1"));

    const pane = screen.getByRole("complementary", { name: "詳細" });
    expect(within(pane).getByText("req-1")).toBeInTheDocument();
  });

  it("opens a case from its title in the row, and marks it as picked there", async () => {
    render(<App backend={fakeBackend()} />);
    const row = (await screen.findByText("Login requirement")).closest("tr");
    if (!row) throw new Error("not inside a table row");

    fireEvent.click(
      within(row).getByRole("button", { name: "Log in with a password" }),
    );

    const pane = screen.getByRole("complementary", { name: "詳細" });
    expect(
      await within(pane).findByText("Rejects a wrong password."),
    ).toBeInTheDocument();
    expect(
      within(row).getByRole("button", { name: "Log in with a password" }),
    ).toHaveAttribute("aria-pressed", "true");
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
      within(screen.getByRole("complementary", { name: "詳細" })).getByRole(
        "button",
        { name: /Log in with a password/ },
      ),
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
      within(screen.getByRole("complementary", { name: "詳細" })).getByRole(
        "button",
        { name: /Log in with a password/ },
      ),
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
      within(screen.getByRole("complementary", { name: "詳細" })).getByRole(
        "button",
        { name: /Log in with a password/ },
      ),
    );

    const pane = screen.getByRole("complementary", { name: "詳細" });
    expect(within(pane).getByText("自動(参照)")).toBeInTheDocument();
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
      within(screen.getByRole("complementary", { name: "詳細" })).getByRole(
        "button",
        { name: /Log in with a password/ },
      ),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "markharnessを起動できません",
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  describe("with StrictDoc", () => {
    const strictdoc: StrictDoc = {
      documents: [
        {
          title: "High-Level",
          nodes: [
            {
              kind: "requirement",
              mid: "m-h",
              uid: "HLR-1",
              title: "Manage accounts",
              statement: "The system shall manage accounts.",
              parents: [],
            },
            {
              kind: "section",
              title: "Login",
              nodes: [
                {
                  kind: "requirement",
                  mid: "m-l",
                  uid: "LLR-1",
                  title: "Sign in",
                  statement: "The user signs in with a password.",
                  parents: ["HLR-1"],
                },
              ],
            },
          ],
        },
      ],
    };
    const linked: Project = {
      ...project,
      traceability: {
        ...project.traceability,
        requirements: [
          {
            requirement_id: "llr-1",
            requirement_uid: "R1",
            source: "external",
            label: null,
            source_key: "m-l",
          },
        ],
      },
    };
    const withStrictDoc = (overrides: Partial<Backend> = {}) =>
      fakeBackend({
        getProject: async () => linked,
        getStrictDoc: async () => strictdoc,
        ...overrides,
      });

    it("shows the markharness data first and says StrictDoc is being read", async () => {
      const pending = new Promise<never>(() => {});
      render(<App backend={withStrictDoc({ getStrictDoc: () => pending })} />);

      expect(await screen.findByText("llr-1")).toBeInTheDocument();
      expect(screen.getByText("StrictDoc: 更新中")).toBeInTheDocument();
    });

    it("lists the StrictDoc requirements under their document and section titles", async () => {
      render(<App backend={withStrictDoc()} />);

      expect(await screen.findByText("Manage accounts")).toBeInTheDocument();
      expect(screen.getByText("High-Level")).toBeInTheDocument();
      expect(screen.getByText("Login")).toBeInTheDocument();
      expect(screen.queryByText("StrictDoc: 更新中")).not.toBeInTheDocument();
    });

    it("shows a dash where a requirement has no parent", async () => {
      render(<App backend={withStrictDoc()} />);

      const hlr = (await screen.findByText("Manage accounts")).closest("tr");
      if (!hlr) throw new Error("row not found");

      expect(within(hlr).getByText("—")).toBeInTheDocument();
    });

    it("names the source on the headings of the columns it fills", async () => {
      render(<App backend={withStrictDoc()} />);
      await screen.findByText("Manage accounts");

      expect(
        screen.getByRole("columnheader", { name: /^親の要求\s*StrictDoc$/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("columnheader", {
          name: /^紐づくケース\s*markharness$/,
        }),
      ).toBeInTheDocument();
    });

    it("shows a parent beside the requirement and how many requirements point at it", async () => {
      render(<App backend={withStrictDoc()} />);

      const hlr = (await screen.findByText("Manage accounts")).closest("tr");
      const llr = screen.getByText("Sign in").closest("tr");
      if (!hlr || !llr) throw new Error("rows not found");
      expect(within(hlr).getByText("子の要求: 1件")).toBeInTheDocument();
      expect(within(hlr).getByText("0")).toBeInTheDocument();
      expect(
        within(llr).getByRole("button", { name: "HLR-1" }),
      ).toBeInTheDocument();
    });

    it("moves to the parent when its link is pressed", async () => {
      render(<App backend={withStrictDoc()} />);
      const llr = (await screen.findByText("Sign in")).closest("tr");
      if (!llr) throw new Error("row not found");

      fireEvent.click(within(llr).getByRole("button", { name: "HLR-1" }));

      const pane = screen.getByRole("complementary", { name: "詳細" });
      expect(
        within(pane).getByText("The system shall manage accounts."),
      ).toBeInTheDocument();
      expect(
        within(pane).getByRole("button", { name: "LLR-1" }),
      ).toBeInTheDocument();
    });

    it("shows the statement, the parents and the children in the detail pane", async () => {
      render(<App backend={withStrictDoc()} />);

      fireEvent.click(await screen.findByRole("button", { name: "Sign in" }));

      const pane = screen.getByRole("complementary", { name: "詳細" });
      expect(
        within(pane).getByText("The user signs in with a password."),
      ).toBeInTheDocument();
      expect(
        within(pane).getByRole("button", { name: "HLR-1" }),
      ).toBeInTheDocument();
      expect(
        within(pane).getByRole("heading", { name: /^親の要求/ }),
      ).toBeInTheDocument();
      expect(
        within(pane).getByRole("heading", { name: /^子の要求/ }),
      ).toBeInTheDocument();
    });

    it("tells a failed export with a message that does not get in the way", async () => {
      const backend = withStrictDoc({
        getStrictDoc: async () => {
          throw new Error("error: bad sdoc");
        },
      });
      render(<App backend={backend} />);

      const toast = await screen.findByRole("status");

      expect(toast).toHaveTextContent("error: bad sdoc");
      expect(screen.getByRole("table")).toBeInTheDocument();
      expect(screen.queryByText("StrictDoc: 更新中")).not.toBeInTheDocument();
      fireEvent.click(within(toast).getByRole("button", { name: "閉じる" }));
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("reads both again, skipping the saved StrictDoc export, when reloaded", async () => {
      const skipped: boolean[] = [];
      let projects = 0;
      render(
        <App
          backend={withStrictDoc({
            getProject: async () => {
              projects += 1;
              return linked;
            },
            getStrictDoc: async (skipSaved) => {
              skipped.push(skipSaved);
              return strictdoc;
            },
          })}
        />,
      );
      await screen.findByText("Manage accounts");

      fireEvent.click(screen.getByRole("button", { name: "再読み込み" }));

      await waitFor(() => expect(skipped).toEqual([false, true]));
      expect(projects).toBe(2);
    });
  });

  it("does not mention StrictDoc for a project that does not use it", async () => {
    render(<App backend={fakeBackend()} />);

    await screen.findByText("Login requirement");

    expect(screen.queryByText("StrictDoc: 更新中")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  describe("with descriptions", () => {
    const described = (overrides: Partial<Backend> = {}) =>
      fakeBackend({
        getRequirementDescriptions: async () => [
          { uid: "R1", description: "Users can log in." },
          { uid: "R2", description: null },
        ],
        ...overrides,
      });

    it("shows the description under the requirement in the row, and again in the detail pane", async () => {
      render(<App backend={described()} />);

      const row = (await screen.findByText("Users can log in.")).closest("tr");
      if (!row) throw new Error("not inside a table row");
      expect(within(row).getByText("Login requirement")).toBeInTheDocument();

      fireEvent.click(within(row).getByText("Login requirement"));

      const pane = screen.getByRole("complementary", { name: "詳細" });
      expect(
        within(pane).getByRole("heading", { name: /^要求内容/ }),
      ).toHaveTextContent("markharness");
      expect(within(pane).getByText("Users can log in.")).toBeInTheDocument();
    });

    it("asks only for requirements whose content markharness holds, at the displayed commit", async () => {
      const asked: unknown[][] = [];
      const backend = described({
        getRequirementDescriptions: async (...args) => {
          asked.push(args);
          return [];
        },
      });
      render(<App backend={backend} />);

      await screen.findByText("Login requirement");

      await waitFor(() =>
        expect(asked).toEqual([
          [["R1", "R2"], "45c7fc13cfc0749fb0df9f2cdca724d0826f8a78"],
        ]),
      );
    });

    it("tells why the descriptions could not be read, and keeps the rows", async () => {
      const backend = described({
        getRequirementDescriptions: async () => {
          throw new Error("markharnessを起動できません");
        },
      });
      render(<App backend={backend} />);

      expect(await screen.findByRole("status")).toHaveTextContent(
        "markharnessを起動できません",
      );
      expect(screen.getByText("Login requirement")).toBeInTheDocument();
    });
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
