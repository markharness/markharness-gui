import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import type { Backend, Traceability } from "./backend";

const empty: Traceability = {
  requirements: [],
  features: [],
  behaviors: [],
  scenarios: [],
  test_cases: [],
  relations: [],
};

function fakeBackend(overrides: Partial<Backend> = {}): Backend {
  return {
    getProjectRoot: async () => "/work/project",
    getTraceability: async () => empty,
    ...overrides,
  };
}

function itemOf(element: HTMLElement): HTMLElement {
  const item = element.closest("li");
  if (!item) throw new Error("not inside a list item");
  return item;
}

describe("App", () => {
  it("shows the project root returned by the backend", async () => {
    render(<App backend={fakeBackend()} />);

    expect(await screen.findByText("/work/project")).toBeInTheDocument();
  });

  it("shows the error when the backend fails", async () => {
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

  it("shows requirement, feature, behavior, scenario and test case as a nested tree", async () => {
    const backend = fakeBackend({
      getTraceability: async () => ({
        requirements: [
          {
            requirement_id: "req-1",
            requirement_uid: "R1",
            source: "native",
            label: "Login requirement",
          },
        ],
        features: [{ feature_id: "login", feature_uid: "F1", label: "Login" }],
        behaviors: [
          {
            behavior_id: "submit",
            behavior_uid: "B1",
            feature_id: "login",
            label: "Submit credentials",
          },
        ],
        scenarios: [
          {
            scenario_id: "valid",
            scenario_uid: "S1",
            behavior_id: "submit",
            label: "Valid login",
          },
        ],
        test_cases: [{ case_id: "tc-1", case_uid: "C1" }],
        relations: [
          { from_uid: "F1", to_uid: "R1", kind: "contributes_to" },
          { from_uid: "C1", to_uid: "S1", kind: "generated_from" },
        ],
      }),
    });

    render(<App backend={backend} />);

    const requirement = itemOf(await screen.findByText("Login requirement"));
    const feature = itemOf(within(requirement).getByText("Login"));
    const behavior = itemOf(within(feature).getByText("Submit credentials"));
    const scenario = itemOf(within(behavior).getByText("Valid login"));
    expect(within(scenario).getByText("tc-1")).toBeInTheDocument();
  });

  it("shows a feature under every requirement it contributes to", async () => {
    const backend = fakeBackend({
      getTraceability: async () => ({
        ...empty,
        requirements: [
          {
            requirement_id: "req-1",
            requirement_uid: "R1",
            source: "native",
            label: "Requirement one",
          },
          {
            requirement_id: "req-2",
            requirement_uid: "R2",
            source: "native",
            label: "Requirement two",
          },
        ],
        features: [
          { feature_id: "shared", feature_uid: "F1", label: "Shared feature" },
        ],
        relations: [
          { from_uid: "F1", to_uid: "R1", kind: "contributes_to" },
          { from_uid: "F1", to_uid: "R2", kind: "contributes_to" },
        ],
      }),
    });

    render(<App backend={backend} />);

    const one = itemOf(await screen.findByText("Requirement one"));
    const two = itemOf(screen.getByText("Requirement two"));
    expect(within(one).getByText("Shared feature")).toBeInTheDocument();
    expect(within(two).getByText("Shared feature")).toBeInTheDocument();
  });

  it("groups features without a requirement under a separate heading", async () => {
    const backend = fakeBackend({
      getTraceability: async () => ({
        ...empty,
        requirements: [
          {
            requirement_id: "req-1",
            requirement_uid: "R1",
            source: "native",
            label: "Requirement one",
          },
        ],
        features: [
          { feature_id: "linked", feature_uid: "F1", label: "Linked feature" },
          { feature_id: "orphan", feature_uid: "F2", label: "Orphan feature" },
        ],
        relations: [{ from_uid: "F1", to_uid: "R1", kind: "contributes_to" }],
      }),
    });

    render(<App backend={backend} />);

    const group = itemOf(await screen.findByText("要求に紐づかない"));
    expect(within(group).getByText("Orphan feature")).toBeInTheDocument();
    expect(within(group).queryByText("Linked feature")).not.toBeInTheDocument();
  });

  it("has no heading for features without a requirement when every feature is linked", async () => {
    const backend = fakeBackend({
      getTraceability: async () => ({
        ...empty,
        requirements: [
          {
            requirement_id: "req-1",
            requirement_uid: "R1",
            source: "native",
            label: "Requirement one",
          },
        ],
        features: [
          { feature_id: "linked", feature_uid: "F1", label: "Linked feature" },
        ],
        relations: [{ from_uid: "F1", to_uid: "R1", kind: "contributes_to" }],
      }),
    });

    render(<App backend={backend} />);

    await screen.findByText("Requirement one");
    expect(screen.queryByText("要求に紐づかない")).not.toBeInTheDocument();
  });

  it("names a requirement beside a scenario only when the feature does not contribute to it", async () => {
    const backend = fakeBackend({
      getTraceability: async () => ({
        ...empty,
        requirements: [
          {
            requirement_id: "req-1",
            requirement_uid: "R1",
            source: "native",
            label: "Requirement one",
          },
          {
            requirement_id: "req-2",
            requirement_uid: "R2",
            source: "native",
            label: "Requirement two",
          },
        ],
        features: [{ feature_id: "f", feature_uid: "F1", label: "Feature" }],
        behaviors: [
          {
            behavior_id: "b",
            behavior_uid: "B1",
            feature_id: "f",
            label: "Behavior",
          },
        ],
        scenarios: [
          {
            scenario_id: "s1",
            scenario_uid: "S1",
            behavior_id: "b",
            label: "Scenario elsewhere",
          },
          {
            scenario_id: "s2",
            scenario_uid: "S2",
            behavior_id: "b",
            label: "Scenario same",
          },
        ],
        relations: [
          { from_uid: "F1", to_uid: "R1", kind: "contributes_to" },
          { from_uid: "S1", to_uid: "R2", kind: "contributes_to" },
          { from_uid: "S2", to_uid: "R1", kind: "contributes_to" },
        ],
      }),
    });

    render(<App backend={backend} />);

    const elsewhere = itemOf(await screen.findByText("Scenario elsewhere"));
    const same = itemOf(screen.getByText("Scenario same"));
    expect(
      within(elsewhere).getByText("要求: Requirement two"),
    ).toBeInTheDocument();
    expect(within(same).queryByText(/^要求:/)).not.toBeInTheDocument();
  });

  it("shows only the error, with nothing partial, when the traceability cannot be read", async () => {
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
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("shows that it is loading until the backend answers", () => {
    const pending = new Promise<never>(() => {});
    const backend = fakeBackend({ getTraceability: () => pending });

    render(<App backend={backend} />);

    expect(screen.getByText("読み込み中…")).toBeInTheDocument();
  });
});
