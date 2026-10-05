import { useEffect, useState } from "react";
import type { Backend, Project } from "./backend";
import { CaseDetail } from "./CaseDetail";
import { describeCase } from "./caseView";
import { RequirementDetail } from "./RequirementDetail";
import { buildRequirementRows } from "./rows";

export function App({ backend }: { backend: Backend }) {
  const [projectRoot, setProjectRoot] = useState<string>();
  const [project, setProject] = useState<Project>();
  const [error, setError] = useState<string>();
  const [pickedUid, setPickedUid] = useState<string>();
  const [pickedCaseUid, setPickedCaseUid] = useState<string>();

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

  const rows = buildRequirementRows(project);
  const picked = rows.find((r) => r.requirementUid === pickedUid);
  const caseView =
    pickedUid && pickedCaseUid
      ? describeCase(project, pickedUid, pickedCaseUid)
      : undefined;

  return (
    <main>
      <p>{projectRoot}</p>
      <p>表示中のコミット {project.at_commit}</p>
      <p>検証結果は表示していません</p>
      <table>
        <thead>
          <tr>
            <th scope="col">要求</th>
            <th scope="col">ケース数</th>
            <th scope="col">紐づくケース</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.requirementUid}>
              <th scope="row">
                <button
                  type="button"
                  aria-pressed={row.requirementUid === pickedUid}
                  onClick={() => {
                    setPickedUid(row.requirementUid);
                    setPickedCaseUid(undefined);
                  }}
                >
                  {row.title}
                </button>
              </th>
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
      <aside aria-label="詳細">
        {caseView ? (
          <CaseDetail
            view={caseView}
            backend={backend}
            atCommit={project.at_commit}
          />
        ) : picked ? (
          <RequirementDetail row={picked} onPickCase={setPickedCaseUid} />
        ) : (
          <p>行を選ぶと、事実と出所が、ここに出ます。</p>
        )}
      </aside>
    </main>
  );
}
