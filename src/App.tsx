import { useEffect, useState } from "react";
import type { Backend } from "./backend";

export function App({ backend }: { backend: Backend }) {
  const [projectRoot, setProjectRoot] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    backend.getProjectRoot().then(setProjectRoot, (e) => setError(String(e)));
  }, [backend]);

  if (error) return <pre role="alert">{error}</pre>;
  return <p>{projectRoot}</p>;
}
