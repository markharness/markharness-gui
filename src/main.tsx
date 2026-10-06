import { invoke } from "@tauri-apps/api/core";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import type { FeatureEdit } from "./edit";
import type {
  Axis,
  Backend,
  CaseDetail,
  ChangeImpact,
  Coverage,
  RequirementDescription,
  StrictDoc,
  Traceability,
} from "./backend";

const backend: Backend = {
  getProjectRoot: () => invoke<string>("get_project_root"),
  getTraceability: () => invoke<Traceability>("get_traceability"),
  getCoverage: () => invoke<Coverage>("get_coverage"),
  getTags: () => invoke<string[]>("get_tags"),
  getImpact: (base) => invoke<ChangeImpact>("get_impact", { base }),
  getStrictDoc: (skipSaved) =>
    invoke<StrictDoc | null>("get_strictdoc", { skipSaved }),
  getRequirementDescriptions: (uids) =>
    invoke<RequirementDescription[]>("get_requirement_descriptions", { uids }),
  getCaseDetail: (caseUid, scenarioUid) =>
    invoke<CaseDetail>("get_case_detail", { caseUid, scenarioUid }),
  getAxis: (uid) => invoke<string[]>("get_axis", { uid }),
  getAxes: () => invoke<Axis[]>("get_axes"),
  editKnowledge: (edit: FeatureEdit) =>
    invoke<void>("edit_knowledge", { edit }),
};

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
createRoot(root).render(<App backend={backend} />);
