import { invoke } from "@tauri-apps/api/core";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import type { Backend, Project } from "./backend";

const backend: Backend = {
  getProjectRoot: () => invoke<string>("get_project_root"),
  getProject: () => invoke<Project>("get_project"),
};

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
createRoot(root).render(<App backend={backend} />);
