import { invoke } from "@tauri-apps/api/core";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import type {
  Backend,
  CaseDetail,
  Coverage,
  RequirementDescription,
  StrictDoc,
  Traceability,
} from "./backend";

const backend: Backend = {
  getProjectRoot: () => invoke<string>("get_project_root"),
  getTraceability: () => invoke<Traceability>("get_traceability"),
  getCoverage: () => invoke<Coverage>("get_coverage"),
  getStrictDoc: (skipSaved) =>
    invoke<StrictDoc | null>("get_strictdoc", { skipSaved }),
  getRequirementDescriptions: (uids) =>
    invoke<RequirementDescription[]>("get_requirement_descriptions", { uids }),
  getCaseDetail: (caseUid, scenarioUid) =>
    invoke<CaseDetail>("get_case_detail", { caseUid, scenarioUid }),
};

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
createRoot(root).render(<App backend={backend} />);
