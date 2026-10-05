import { useEffect, useState } from "react";
import type { Backend, Project } from "./backend";
import { buildRequirementRows } from "./rows";

export function App({ backend }: { backend: Backend }) {
  const [projectRoot, setProjectRoot] = useState<string>();
  const [project, setProject] = useState<Project>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    Promise.all([backend.getProjectRoot(), backend.getProject()]).then(
      ([root, p]) => {
        setProjectRoot(root);
        setProject(p);
      },
      (e) => setError(String(e)),
    );
  }, [backend]);

  if (error) return <pre role="alert">{error}</pre>;
  if (!projectRoot || !project) return <p>読み込み中…</p>;

  return (
    <main>
      <p>{projectRoot}</p>
      <p>表示中のコミット {project.at_commit}</p>
      <table>
        <thead>
          <tr>
            <th scope="col">要求</th>
            <th scope="col">ケース数</th>
            <th scope="col">紐づくケース</th>
          </tr>
        </thead>
        <tbody>
          {buildRequirementRows(project).map((row) => (
            <tr key={row.requirementUid}>
              <th scope="row">{row.title}</th>
              <td>{row.cases.length}</td>
              <td>
                {row.cases.map((c) => (
                  <span key={c.caseUid}>{c.title}</span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
