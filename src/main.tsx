import { invoke } from "@tauri-apps/api/core";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import type { Edit } from "./edit";
import type {
  Axis,
  Backend,
  CaseDetail,
  ChangeImpact,
  Coverage,
  ElementDetail,
  RequirementDescription,
  ScenarioDetail,
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
  getElementDetail: (uid) =>
    invoke<ElementDetail>("get_element_detail", { uid }),
  getScenarioDetail: (uid) =>
    invoke<ScenarioDetail>("get_scenario_detail", { uid }),
  getAxes: () => invoke<Axis[]>("get_axes"),
  getUnusedAxes: () => invoke<string[]>("get_unused_axes"),
  deleteUnusedAxes: async () => {
    await invoke<string[]>("delete_unused_axes");
  },
  addAxis: (id, label) => invoke<void>("add_axis", { id, label }),
  editKnowledge: (edit: Edit) => invoke<void>("edit_knowledge", { edit }),
};

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
createRoot(root).render(<App backend={backend} />);
