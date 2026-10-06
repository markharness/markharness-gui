import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import type {
  Backend,
  ChangeImpact,
  Coverage,
  StrictDoc,
  Traceability,
} from "./backend";

const project: { traceability: Traceability; coverage: Coverage } = {
  traceability: {
    requirements: [
      {
        requirement_id: "req-1",
        requirement_uid: "R1",
        source: "native",
        label: "Login requirement",
        case_uids: ["C1"],
      },
      {
        requirement_id: "req-2",
        requirement_uid: "R2",
        source: "native",
        label: "Logout requirement",
        case_uids: [],
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
    getTraceability: async () => project.traceability,
    getCoverage: async () => project.coverage,
    getTags: async () => [],
    getImpact: async () => ({ requirements: [] }),
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
    getElementDetail: async () => ({ axis: ["ui"], description: null }),
    getAxes: async () => [
      { id: "functional", label: "機能" },
      { id: "ui", label: "画面" },
    ],
    getScenarioDetail: async () => ({
      description: null,
      implementation_note: null,
    }),
    getUnusedAxes: async () => [],
    deleteUnusedAxes: async () => {},
    addAxis: async () => {},
    editKnowledge: async () => {},
    ...overrides,
  };
}

describe("App", () => {
  it("shows the project root and the commit the committed content is read at", async () => {
    render(<App backend={fakeBackend()} />);

    expect(await screen.findByText("/work/project")).toBeInTheDocument();
    expect(await screen.findByText("45c7fc1")).toBeInTheDocument();
  });

  it("shows the commit shortly, as the content that is committed", async () => {
    render(<App backend={fakeBackend()} />);

    const commit = await screen.findByText("45c7fc1");

    expect(commit.parentElement).toHaveTextContent("コミット済みの内容");
    expect(commit.parentElement).toHaveTextContent("(HEAD)");
  });

  it("says that the list is the working tree, edits not yet committed included", async () => {
    render(<App backend={fakeBackend()} />);

    expect(await screen.findByText(/作業ツリー/)).toHaveTextContent(
      "未コミットの編集を含む",
    );
  });

  it("shows the list before the coverage is read, and says it is being read", async () => {
    const pending = new Promise<never>(() => {});
    render(<App backend={fakeBackend({ getCoverage: () => pending })} />);

    const row = (await screen.findByText("Login requirement")).closest("tr");
    if (!row) throw new Error("not inside a table row");

    expect(
      within(row).getByRole("button", { name: "Log in with a password" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/コミット済みの内容:/)).toHaveTextContent(
      "読み込み中",
    );
    expect(screen.queryByText("45c7fc1")).not.toBeInTheDocument();
  });

  it("says in the detail pane that the verification is being read, until the coverage is read", async () => {
    let answer: (c: Coverage) => void = () => {};
    const coverage = new Promise<Coverage>((resolve) => {
      answer = resolve;
    });
    render(<App backend={fakeBackend({ getCoverage: () => coverage })} />);
    fireEvent.click(await screen.findByText("Logout requirement"));
    const pane = screen.getByRole("complementary", { name: "詳細" });

    expect(within(pane).getByText("読み込み中…")).toBeInTheDocument();
    expect(within(pane).queryByText("機能のない要求")).not.toBeInTheDocument();

    answer(project.coverage);

    expect(await within(pane).findByText("機能のない要求")).toBeInTheDocument();
  });

  it("tells why the coverage could not be read, keeps the list, and does not show what it would have", async () => {
    const backend = fakeBackend({
      getCoverage: async () => {
        throw new Error("gitを起動できません");
      },
    });
    render(<App backend={backend} />);
    fireEvent.click(await screen.findByText("Logout requirement"));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "gitを起動できません",
    );
    const pane = screen.getByRole("complementary", { name: "詳細" });
    expect(within(pane).getByText("読めませんでした")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
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

  it("heads the detail of a picked row as related information", async () => {
    render(<App backend={fakeBackend()} />);
    await screen.findByText("Login requirement");
    const pane = screen.getByRole("complementary", { name: "詳細" });
    expect(within(pane).queryByText("関連する情報")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Login requirement"));

    expect(within(pane).getByText("関連する情報")).toBeInTheDocument();
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

  it("shows each linked case in the detail pane as one box with its title and where it belongs", async () => {
    render(<App backend={fakeBackend()} />);

    fireEvent.click(await screen.findByText("Login requirement"));

    const pane = screen.getByRole("complementary", { name: "詳細" });
    const box = within(pane).getByRole("button", {
      name: /Log in with a password/,
    });
    expect(box).toHaveTextContent("›");
    expect(box).toHaveClass("case-box");
    expect(within(box).getByText("Log in with a password")).toHaveAttribute(
      "title",
      "Log in with a password",
    );
  });

  it("shows why the core reports a requirement as not covered, only in the detail pane", async () => {
    render(<App backend={fakeBackend()} />);
    await screen.findByText("Logout requirement");
    expect(screen.queryByText("機能のない要求")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Logout requirement"));

    const pane = screen.getByRole("complementary", { name: "詳細" });
    expect(await within(pane).findByText("機能のない要求")).toBeInTheDocument();
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

  it("reads the description and the steps of the picked case", async () => {
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
    expect(calls).toEqual([["C1", "S1"]]);
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
    expect(await within(pane).findByText("自動(参照)")).toBeInTheDocument();
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
    const linked: Traceability = {
      ...project.traceability,
      requirements: [
        {
          requirement_id: "llr-1",
          requirement_uid: "R1",
          source: "external",
          label: null,
          source_key: "m-l",
          case_uids: ["C1"],
        },
      ],
    };
    const withStrictDoc = (overrides: Partial<Backend> = {}) =>
      fakeBackend({
        getTraceability: async () => linked,
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

    it("reads everything again, skipping the saved StrictDoc export, when reloaded", async () => {
      const skipped: boolean[] = [];
      let reads = 0;
      let coverages = 0;
      render(
        <App
          backend={withStrictDoc({
            getTraceability: async () => {
              reads += 1;
              return linked;
            },
            getCoverage: async () => {
              coverages += 1;
              return project.coverage;
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
      expect(reads).toBe(2);
      await waitFor(() => expect(coverages).toBe(2));
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

    it("asks only for requirements whose content markharness holds", async () => {
      const asked: unknown[][] = [];
      const backend = described({
        getRequirementDescriptions: async (...args) => {
          asked.push(args);
          return [];
        },
      });
      render(<App backend={backend} />);

      await screen.findByText("Login requirement");

      await waitFor(() => expect(asked).toEqual([[["R1", "R2"]]]));
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
      getTraceability: async () => {
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
    const backend = fakeBackend({ getTraceability: () => pending });

    render(<App backend={backend} />);

    expect(screen.getByText("読み込み中…")).toBeInTheDocument();
  });
});

describe("App comparison with a tag", () => {
  const impact: ChangeImpact = {
    requirements: [
      {
        requirement_uid: "R1",
        cases: [
          { case_uid: "C1", status: "unconfirmed" },
          { case_uid: "C2", status: "followed_up" },
          { case_uid: "C3", status: "confirmed" },
        ],
      },
      {
        requirement_uid: "R2",
        cases: [{ case_uid: "C1", status: "unconfirmed" }],
      },
      { requirement_uid: "R3", cases: [] },
    ],
  };
  const tags = ["v0.3.0", "v0.2.0", "v0.1.0"];

  const baseSelect = () => screen.findByRole("combobox", { name: /^比較元/ });

  it("offers the tags as the base, the newest first, and leaves it unselected", async () => {
    render(<App backend={fakeBackend({ getTags: async () => tags })} />);

    const select = await baseSelect();

    await waitFor(() =>
      expect(
        within(select)
          .getAllByRole("option")
          .map((o) => o.textContent),
      ).toEqual(["未選択", "v0.3.0", "v0.2.0", "v0.1.0"]),
    );
    expect(select).toHaveValue("");
  });

  it("shows no count until a base is chosen, and does not read the impact", async () => {
    let asked = false;
    const backend = fakeBackend({
      getTags: async () => tags,
      getImpact: async () => {
        asked = true;
        return impact;
      },
    });
    render(<App backend={backend} />);
    await baseSelect();

    expect(screen.queryByText(/変更後に確認対象となるケース/)).toBeNull();
    expect(asked).toBe(false);
  });

  it("says that the comparison reads the committed content", async () => {
    render(<App backend={fakeBackend({ getTags: async () => tags })} />);

    expect(await screen.findByText("コミット済みの内容で比較")).toBeVisible();
  });

  it("passes the chosen tag as given and shows how many cases are to be confirmed", async () => {
    const asked: string[] = [];
    const backend = fakeBackend({
      getTags: async () => tags,
      getImpact: async (base) => {
        asked.push(base);
        return impact;
      },
    });
    render(<App backend={backend} />);
    const select = await baseSelect();
    await within(select).findByRole("option", { name: "v0.2.0" });

    fireEvent.change(select, { target: { value: "v0.2.0" } });

    expect(
      await screen.findByText(/変更後に確認対象となるケース/),
    ).toHaveTextContent("変更後に確認対象となるケース: 2件");
    expect(asked).toEqual(["v0.2.0"]);
  });

  it("shows 0 when no case is to be confirmed", async () => {
    const backend = fakeBackend({
      getTags: async () => tags,
      getImpact: async () => ({ requirements: [] }),
    });
    render(<App backend={backend} />);
    const select = await baseSelect();
    await within(select).findByRole("option", { name: "v0.1.0" });

    fireEvent.change(select, { target: { value: "v0.1.0" } });

    expect(
      await screen.findByText(/変更後に確認対象となるケース/),
    ).toHaveTextContent("変更後に確認対象となるケース: 0件");
  });

  it("shows the message of the core in place of the count when the comparison fails", async () => {
    const backend = fakeBackend({
      getTags: async () => tags,
      getImpact: async () => {
        throw "error: bad revision 'v0.1.0'";
      },
    });
    render(<App backend={backend} />);
    const select = await baseSelect();
    await within(select).findByRole("option", { name: "v0.1.0" });

    fireEvent.change(select, { target: { value: "v0.1.0" } });

    const line = await screen.findByText(/変更後に確認対象となるケース/);
    expect(line).toHaveTextContent("error: bad revision 'v0.1.0'");
    expect(line).not.toHaveTextContent("件");
  });

  it("says that it is reading while the core has not answered", async () => {
    const backend = fakeBackend({
      getTags: async () => tags,
      getImpact: () => new Promise<never>(() => {}),
    });
    render(<App backend={backend} />);
    const select = await baseSelect();
    await within(select).findByRole("option", { name: "v0.1.0" });

    fireEvent.change(select, { target: { value: "v0.1.0" } });

    expect(
      await screen.findByText(/変更後に確認対象となるケース/),
    ).toHaveTextContent("読み込み中");
  });

  it("shows the count of the last chosen base even when an earlier one answers later", async () => {
    let answerFirst: (i: ChangeImpact) => void = () => {};
    const first = new Promise<ChangeImpact>((resolve) => {
      answerFirst = resolve;
    });
    const backend = fakeBackend({
      getTags: async () => tags,
      getImpact: (base) =>
        base === "v0.3.0" ? first : Promise.resolve({ requirements: [] }),
    });
    render(<App backend={backend} />);
    const select = await baseSelect();
    await within(select).findByRole("option", { name: "v0.3.0" });

    fireEvent.change(select, { target: { value: "v0.3.0" } });
    fireEvent.change(select, { target: { value: "v0.2.0" } });
    await screen.findByText(/変更後に確認対象となるケース: 0件/);
    answerFirst(impact);

    await waitFor(() =>
      expect(
        screen.getByText(/変更後に確認対象となるケース/),
      ).toHaveTextContent("0件"),
    );
  });

  it("offers nothing to choose when there are no tags", async () => {
    render(<App backend={fakeBackend({ getTags: async () => [] })} />);

    const select = await baseSelect();

    expect(select).toBeDisabled();
    expect(within(select).getAllByRole("option")).toHaveLength(1);
  });

  it("reads the comparison again when the project is reloaded", async () => {
    let reads = 0;
    const backend = fakeBackend({
      getTags: async () => tags,
      getImpact: async () => {
        reads += 1;
        return impact;
      },
    });
    render(<App backend={backend} />);
    const select = await baseSelect();
    await within(select).findByRole("option", { name: "v0.2.0" });
    fireEvent.change(select, { target: { value: "v0.2.0" } });
    await screen.findByText(/変更後に確認対象となるケース: 2件/);

    fireEvent.click(screen.getByRole("button", { name: "再読み込み" }));

    await waitFor(() => expect(reads).toBe(2));
  });

  it("colors the cases that are to be confirmed in the list, and no others", async () => {
    const backend = fakeBackend({
      getTags: async () => tags,
      getImpact: async () => ({
        requirements: [
          {
            requirement_uid: "R1",
            cases: [{ case_uid: "C1", status: "unconfirmed" }],
          },
        ],
      }),
    });
    render(<App backend={backend} />);
    const caseButton = await screen.findByRole("button", {
      name: "Log in with a password",
    });
    expect(caseButton).not.toHaveClass("to-confirm");
    const select = await baseSelect();
    await within(select).findByRole("option", { name: "v0.2.0" });

    fireEvent.change(select, { target: { value: "v0.2.0" } });

    await waitFor(() => expect(caseButton).toHaveClass("to-confirm"));
  });

  it("does not color a case that is confirmed", async () => {
    const backend = fakeBackend({
      getTags: async () => tags,
      getImpact: async () => ({
        requirements: [
          {
            requirement_uid: "R1",
            cases: [{ case_uid: "C1", status: "confirmed" }],
          },
        ],
      }),
    });
    render(<App backend={backend} />);
    const select = await baseSelect();
    await within(select).findByRole("option", { name: "v0.2.0" });

    fireEvent.change(select, { target: { value: "v0.2.0" } });

    await screen.findByText(/変更後に確認対象となるケース: 0件/);
    expect(
      screen.getByRole("button", { name: "Log in with a password" }),
    ).not.toHaveClass("to-confirm");
  });

  it("stops coloring the cases when the base is unselected again", async () => {
    const backend = fakeBackend({
      getTags: async () => tags,
      getImpact: async () => impact,
    });
    render(<App backend={backend} />);
    const select = await baseSelect();
    await within(select).findByRole("option", { name: "v0.2.0" });
    fireEvent.change(select, { target: { value: "v0.2.0" } });
    const caseButton = await screen.findByRole("button", {
      name: "Log in with a password",
    });
    await waitFor(() => expect(caseButton).toHaveClass("to-confirm"));

    fireEvent.change(select, { target: { value: "" } });

    await waitFor(() => expect(caseButton).not.toHaveClass("to-confirm"));
  });

  it("edits the feature of a case in the detail pane and shows the label the core now has", async () => {
    let label = "Sign in";
    const edits: unknown[] = [];
    const backend = fakeBackend({
      getTraceability: async () => ({
        ...project.traceability,
        features: [{ feature_id: "f-1", feature_uid: "F1", label }],
      }),
      editKnowledge: async (edit) => {
        edits.push(edit);
        label = "Log in";
      },
    });
    render(<App backend={backend} />);
    const row = (await screen.findByText("Login requirement")).closest("tr");
    if (!row) throw new Error("not inside a table row");
    fireEvent.click(
      within(row).getByRole("button", { name: "Log in with a password" }),
    );
    const pane = screen.getByRole("complementary", { name: "詳細" });

    fireEvent.click(
      await within(pane).findByRole("button", { name: "Featureを編集" }),
    );
    fireEvent.change(await within(pane).findByLabelText("ラベル"), {
      target: { value: "Log in" },
    });
    fireEvent.click(within(pane).getByRole("button", { name: "保存" }));

    expect(await within(pane).findByText("Log in")).toBeInTheDocument();
    expect(edits).toEqual([
      { kind: "feature", uid: "F1", label: "Log in", axis: ["ui"] },
    ]);
    expect(within(pane).queryByLabelText("ラベル")).not.toBeInTheDocument();
  });

  it("reads only the traceability again after an edit, not the committed content", async () => {
    let coverageReads = 0;
    const backend = fakeBackend({
      getCoverage: async () => {
        coverageReads += 1;
        return project.coverage;
      },
    });
    render(<App backend={backend} />);
    const row = (await screen.findByText("Login requirement")).closest("tr");
    if (!row) throw new Error("not inside a table row");
    fireEvent.click(
      within(row).getByRole("button", { name: "Log in with a password" }),
    );
    const pane = screen.getByRole("complementary", { name: "詳細" });
    fireEvent.click(
      await within(pane).findByRole("button", { name: "Featureを編集" }),
    );
    await within(pane).findByLabelText("ラベル");

    fireEvent.click(within(pane).getByRole("button", { name: "保存" }));
    await waitFor(() =>
      expect(within(pane).queryByLabelText("ラベル")).not.toBeInTheDocument(),
    );

    expect(coverageReads).toBe(1);
  });

  it("does not read the comparison again after an edit, and still shows its count", async () => {
    let impactReads = 0;
    const backend = fakeBackend({
      getTags: async () => ["v1.0.0"],
      getImpact: async () => {
        impactReads += 1;
        return { requirements: [] };
      },
    });
    render(<App backend={backend} />);
    const base = await screen.findByLabelText(/比較元/);
    // The select is disabled until the tags are read.
    await waitFor(() => expect(base).toBeEnabled());
    fireEvent.change(base, { target: { value: "v1.0.0" } });
    expect(await screen.findByText(/0件/)).toBeInTheDocument();
    const row = (await screen.findByText("Login requirement")).closest("tr");
    if (!row) throw new Error("not inside a table row");
    fireEvent.click(
      within(row).getByRole("button", { name: "Log in with a password" }),
    );
    const pane = screen.getByRole("complementary", { name: "詳細" });
    fireEvent.click(
      await within(pane).findByRole("button", { name: "Featureを編集" }),
    );
    await within(pane).findByLabelText("ラベル");

    fireEvent.click(within(pane).getByRole("button", { name: "保存" }));
    await waitFor(() =>
      expect(within(pane).queryByLabelText("ラベル")).not.toBeInTheDocument(),
    );

    expect(screen.getByText(/変更後に確認対象となるケース/)).toHaveTextContent(
      "0件",
    );
    expect(impactReads).toBe(1);
  });

  it("adds an axis from the form of the feature, and offers it from what the core now lists", async () => {
    const added: unknown[][] = [];
    let axes = [
      { id: "functional", label: "機能" },
      { id: "ui", label: "画面" },
    ];
    const backend = fakeBackend({
      getAxes: async () => axes,
      addAxis: async (id, label) => {
        added.push([id, label]);
        axes = [...axes, { id, label: label ?? id }];
      },
    });
    render(<App backend={backend} />);
    const row = (await screen.findByText("Login requirement")).closest("tr");
    if (!row) throw new Error("not inside a table row");
    fireEvent.click(
      within(row).getByRole("button", { name: "Log in with a password" }),
    );
    const pane = screen.getByRole("complementary", { name: "詳細" });
    fireEvent.click(
      await within(pane).findByRole("button", { name: "Featureを編集" }),
    );
    fireEvent.click(
      await within(pane).findByRole("button", { name: "＋ 分類を追加" }),
    );
    fireEvent.change(
      within(
        within(pane).getByRole("group", { name: "新しい分類" }),
      ).getByLabelText("id"),
      {
        target: { value: "perf" },
      },
    );

    fireEvent.click(within(pane).getByRole("button", { name: "追加" }));

    expect(await within(pane).findByLabelText("perf")).toBeChecked();
    expect(added).toEqual([["perf", undefined]]);
  });

  it("deletes the unused categories from the form of the feature, and offers what the core now lists", async () => {
    let axes = [
      { id: "functional", label: "機能" },
      { id: "ui", label: "画面" },
    ];
    const backend = fakeBackend({
      getAxes: async () => axes,
      getUnusedAxes: async () => ["functional"],
      deleteUnusedAxes: async () => {
        axes = axes.filter((a) => a.id !== "functional");
      },
    });
    render(<App backend={backend} />);
    const row = (await screen.findByText("Login requirement")).closest("tr");
    if (!row) throw new Error("not inside a table row");
    fireEvent.click(
      within(row).getByRole("button", { name: "Log in with a password" }),
    );
    const pane = screen.getByRole("complementary", { name: "詳細" });
    fireEvent.click(
      await within(pane).findByRole("button", { name: "Featureを編集" }),
    );
    fireEvent.click(
      await within(pane).findByRole("button", { name: "未使用の分類を削除" }),
    );
    const confirm = await within(pane).findByRole("group", {
      name: "未使用の分類を削除",
    });

    fireEvent.click(within(confirm).getByRole("button", { name: "削除" }));

    await waitFor(() =>
      expect(within(pane).queryByLabelText("機能")).not.toBeInTheDocument(),
    );
    expect(within(pane).getByLabelText("画面")).toBeInTheDocument();
  });

  it("edits the behavior of a case, with its description, and shows the label the core now has", async () => {
    let label = "Password check";
    const edits: unknown[] = [];
    const backend = fakeBackend({
      getTraceability: async () => ({
        ...project.traceability,
        behaviors: [
          {
            behavior_id: "b-1",
            behavior_uid: "B",
            feature_id: "f-1",
            feature_uid: "F1",
            label,
          },
        ],
      }),
      getElementDetail: async (uid) =>
        uid === "B"
          ? { axis: ["ui"], description: "Checks the password." }
          : { axis: [], description: null },
      editKnowledge: async (edit) => {
        edits.push(edit);
        label = "Credentials check";
      },
    });
    render(<App backend={backend} />);
    const row = (await screen.findByText("Login requirement")).closest("tr");
    if (!row) throw new Error("not inside a table row");
    fireEvent.click(
      within(row).getByRole("button", { name: "Log in with a password" }),
    );
    const pane = screen.getByRole("complementary", { name: "詳細" });

    fireEvent.click(
      await within(pane).findByRole("button", { name: "Behaviorを編集" }),
    );
    expect(await within(pane).findByLabelText("説明")).toHaveValue(
      "Checks the password.",
    );
    fireEvent.change(within(pane).getByLabelText("ラベル"), {
      target: { value: "Credentials check" },
    });
    fireEvent.change(within(pane).getByLabelText("説明"), {
      target: { value: "Checks the user and the password." },
    });
    fireEvent.click(within(pane).getByRole("button", { name: "保存" }));

    expect(
      await within(pane).findByText("Credentials check"),
    ).toBeInTheDocument();
    expect(edits).toEqual([
      {
        kind: "behavior",
        feature_uid: "F1",
        uid: "B",
        label: "Credentials check",
        description: "Checks the user and the password.",
        axis: ["ui"],
      },
    ]);
  });

  it("edits the scenario of a case, and shows the description and the label the core now has", async () => {
    let label = "Log in with a password";
    let description = "Rejects a wrong password.";
    const edits: unknown[] = [];
    const backend = fakeBackend({
      getTraceability: async () => ({
        ...project.traceability,
        scenarios: [
          {
            scenario_id: "sc-1",
            scenario_uid: "S1",
            behavior_id: "b-1",
            behavior_uid: "B",
            label,
          },
        ],
      }),
      getCaseDetail: async () => ({ description, phases: [] }),
      getScenarioDetail: async () => ({
        description,
        implementation_note: null,
      }),
      editKnowledge: async (edit) => {
        edits.push(edit);
        label = "Log in with a wrong password";
        description = "Shows an error.";
      },
    });
    render(<App backend={backend} />);
    const row = (await screen.findByText("Login requirement")).closest("tr");
    if (!row) throw new Error("not inside a table row");
    fireEvent.click(
      within(row).getByRole("button", { name: "Log in with a password" }),
    );
    const pane = screen.getByRole("complementary", { name: "詳細" });

    fireEvent.click(
      await within(pane).findByRole("button", { name: "Scenarioを編集" }),
    );
    expect(await within(pane).findByLabelText("説明")).toHaveValue(
      "Rejects a wrong password.",
    );
    expect(
      within(pane).queryByRole("group", { name: "分類" }),
    ).not.toBeInTheDocument();
    fireEvent.change(within(pane).getByLabelText("ラベル"), {
      target: { value: "Log in with a wrong password" },
    });
    fireEvent.change(within(pane).getByLabelText("説明"), {
      target: { value: "Shows an error." },
    });
    fireEvent.click(within(pane).getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(within(pane).getByText("Shows an error.")).toBeInTheDocument(),
    );
    expect(
      within(pane).getAllByText("Log in with a wrong password").length,
    ).toBeGreaterThan(0);
    expect(edits).toEqual([
      {
        kind: "scenario",
        feature_uid: "F1",
        behavior_uid: "B",
        uid: "S1",
        label: "Log in with a wrong password",
        description: "Shows an error.",
      },
    ]);
  });
});
