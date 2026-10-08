import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Backend,
  Binding,
  Coverage,
  StrictDoc,
  Traceability,
} from "./backend";

export interface ProjectData {
  /** Set once the project root and the traceability (the working tree) are both read. */
  loaded?: { projectRoot: string; traceability: Traceability };
  /** Changes when the project is read or reloaded, and not when an edit reads the traceability again. */
  readOf?: object;
  /** The reason the traceability could not be read; nothing partial is shown then. */
  error?: string;
  /** The committed content, read apart from the traceability. */
  coverage: Coverage | null;
  coverageLoading: boolean;
  /** What each case declares as its verification means, in the working tree; null until read. */
  bindings: Binding[] | null;
  bindingsLoading: boolean;
  strictdoc: StrictDoc | null;
  strictdocLoading: boolean;
  /** What markharness holds as each requirement's description, by requirement uid. */
  descriptions: Record<string, string>;
  /** Why the coverage, StrictDoc or the descriptions could not be read. It never blocks the rest of the screen. */
  notice?: string;
  dismissNotice: () => void;
  reload: () => void;
  /** Reads the traceability again, after an edit; the coverage, StrictDoc and descriptions stay as they are. */
  refreshTraceability: () => void;
  /** Reads the verification means again, after one is declared. */
  refreshBindings: () => void;
}

/**
 * Reads the traceability, and the coverage and StrictDoc apart from it so that the list shows first.
 * A reload reads all of them again, skipping the saved StrictDoc export.
 */
export function useProjectData(backend: Backend): ProjectData {
  const [loaded, setLoaded] = useState<ProjectData["loaded"]>();
  // Held apart from `loaded`, so that an edit does not read the coverage and the descriptions again.
  const [refreshed, setRefreshed] = useState<Traceability>();
  const [error, setError] = useState<string>();
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [coverageLoading, setCoverageLoading] = useState(true);
  const [bindings, setBindings] = useState<Binding[] | null>(null);
  const [bindingsLoading, setBindingsLoading] = useState(true);
  const [strictdoc, setStrictDoc] = useState<StrictDoc | null>(null);
  const [strictdocLoading, setStrictDocLoading] = useState(true);
  const [notice, setNotice] = useState<string>();
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let current = true;
    setError(undefined);
    setStrictDoc(null);
    setStrictDocLoading(true);
    Promise.all([backend.getProjectRoot(), backend.getTraceability()]).then(
      ([projectRoot, traceability]) => {
        if (!current) return;
        setRefreshed(undefined);
        setLoaded({ projectRoot, traceability });
      },
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

  // The coverage reads only committed content, which takes longer than the traceability:
  // the list shows first and the verification fills in.
  useEffect(() => {
    if (!loaded) return;
    let current = true;
    setCoverage(null);
    setCoverageLoading(true);
    backend.getCoverage().then(
      (c) => {
        if (!current) return;
        setCoverage(c);
        setCoverageLoading(false);
      },
      (e) => {
        if (!current) return;
        setCoverageLoading(false);
        setNotice(String(e));
      },
    );
    return () => {
      current = false;
    };
  }, [backend, loaded]);

  const readBindings = useCallback(
    (isCurrent: () => boolean = () => true) => {
      backend.getBindings().then(
        (b) => {
          if (!isCurrent()) return;
          setBindings(b);
          setBindingsLoading(false);
        },
        (e) => {
          if (!isCurrent()) return;
          setBindingsLoading(false);
          setNotice(String(e));
        },
      );
    },
    [backend],
  );

  useEffect(() => {
    if (!loaded) return;
    let current = true;
    setBindings(null);
    setBindingsLoading(true);
    readBindings(() => current);
    return () => {
      current = false;
    };
  }, [loaded, readBindings]);

  // Read apart from the traceability too: the rows show first and the descriptions fill in.
  const readDescriptions = useCallback(
    (traceability: Traceability, isCurrent: () => boolean = () => true) => {
      const uids = traceability.requirements
        .filter((r) => r.source === "native")
        .map((r) => r.requirement_uid);
      backend.getRequirementDescriptions(uids).then(
        (found) => {
          if (!isCurrent()) return;
          setDescriptions(
            Object.fromEntries(
              found.flatMap((d) =>
                d.description === null ? [] : [[d.uid, d.description]],
              ),
            ),
          );
        },
        (e) => isCurrent() && setNotice(String(e)),
      );
    },
    [backend],
  );

  useEffect(() => {
    if (!loaded) return;
    let current = true;
    readDescriptions(loaded.traceability, () => current);
    return () => {
      current = false;
    };
  }, [loaded, readDescriptions]);

  const current = useMemo(
    () =>
      loaded && refreshed ? { ...loaded, traceability: refreshed } : loaded,
    [loaded, refreshed],
  );

  return {
    loaded: current,
    readOf: loaded,
    error,
    coverage,
    coverageLoading,
    bindings,
    bindingsLoading,
    strictdoc,
    strictdocLoading,
    descriptions,
    notice,
    dismissNotice: () => setNotice(undefined),
    reload: () => setReloads((n) => n + 1),
    refreshBindings: () => readBindings(),
    refreshTraceability: () => {
      backend.getTraceability().then(
        (traceability) => {
          setRefreshed(traceability);
          readDescriptions(traceability);
        },
        (e) => setNotice(String(e)),
      );
    },
  };
}
