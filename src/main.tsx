import { invoke } from "@tauri-apps/api/core";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import type {
  Backend,
  CaseDetail,
  Project,
  RequirementDescription,
  StrictDoc,
} from "./backend";

const backend: Backend = {
  getProjectRoot: () => invoke<string>("get_project_root"),
  getProject: () => invoke<Project>("get_project"),
  getStrictDoc: (skipSaved) =>
    invoke<StrictDoc | null>("get_strictdoc", { skipSaved }),
  getRequirementDescriptions: (uids, atCommit) =>
    invoke<RequirementDescription[]>("get_requirement_descriptions", {
      uids,
      atCommit,
    }),
  getCaseDetail: (caseUid, scenarioUid, atCommit) =>
    invoke<CaseDetail>("get_case_detail", { caseUid, scenarioUid, atCommit }),
};

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
createRoot(root).render(<App backend={backend} />);
