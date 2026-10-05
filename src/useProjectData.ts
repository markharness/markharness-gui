import { useEffect, useState } from "react";
import type { Backend, Project, StrictDoc } from "./backend";

export interface ProjectData {
  /** Set once the project root and the project are both read. */
  loaded?: { projectRoot: string; project: Project };
  /** The reason the project could not be read; nothing partial is shown then. */
  error?: string;
  strictdoc: StrictDoc | null;
  strictdocLoading: boolean;
  /** Why StrictDoc could not be read. It never blocks the rest of the screen. */
  notice?: string;
  dismissNotice: () => void;
  reload: () => void;
}

/**
 * Reads the project, and StrictDoc apart from it so that the project shows first.
 * A reload reads both again, skipping the saved StrictDoc export.
 */
export function useProjectData(backend: Backend): ProjectData {
  const [loaded, setLoaded] = useState<ProjectData["loaded"]>();
  const [error, setError] = useState<string>();
  const [strictdoc, setStrictDoc] = useState<StrictDoc | null>(null);
  const [strictdocLoading, setStrictDocLoading] = useState(true);
  const [notice, setNotice] = useState<string>();
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let current = true;
    setError(undefined);
    setStrictDoc(null);
    setStrictDocLoading(true);
    Promise.all([backend.getProjectRoot(), backend.getProject()]).then(
      ([projectRoot, project]) =>
        current && setLoaded({ projectRoot, project }),
      (e) => current && setError(String(e)),
    );
    backend.getStrictDoc(reloads > 0).then(
      (s) => {
        if (!current) return;
        setStrictDoc(s);
        setStrictDocLoading(false);
      },
      (e) => {
        if (!current) return;
        setStrictDocLoading(false);
        setNotice(String(e));
      },
    );
    return () => {
      current = false;
    };
  }, [backend, reloads]);

  return {
    loaded,
    error,
    strictdoc,
    strictdocLoading,
    notice,
    dismissNotice: () => setNotice(undefined),
    reload: () => setReloads((n) => n + 1),
  };
}
