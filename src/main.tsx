import { invoke } from "@tauri-apps/api/core";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import type { Backend, CaseDetail, Project } from "./backend";

const backend: Backend = {
  getProjectRoot: () => invoke<string>("get_project_root"),
  getProject: () => invoke<Project>("get_project"),
  getCaseDetail: (caseUid, scenarioUid, atCommit) =>
    invoke<CaseDetail>("get_case_detail", { caseUid, scenarioUid, atCommit }),
};

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
createRoot(root).render(<App backend={backend} />);
