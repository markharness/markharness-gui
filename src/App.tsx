import { Fragment, useEffect, useState } from "react";
import type { Backend, Project, StrictDoc } from "./backend";
import { CaseDetail } from "./CaseDetail";
import { describeCase } from "./caseView";
import { RequirementDetail } from "./RequirementDetail";
import { buildRequirementRows } from "./rows";

type StrictDocState =
  | { status: "loading" }
  | { status: "done"; strictdoc: StrictDoc | null };

/** The headings that start at this row: the levels past those shared with the row before. */
function newHeadings(previous: string[], current: string[]): string[] {
  let shared = 0;
  while (
    shared < previous.length &&
    shared < current.length &&
    previous[shared] === current[shared]
  )
    shared += 1;
  return current.slice(shared);
}

export function App({ backend }: { backend: Backend }) {
  const [projectRoot, setProjectRoot] = useState<string>();
  const [project, setProject] = useState<Project>();
  const [error, setError] = useState<string>();
  const [strictdoc, setStrictDoc] = useState<StrictDocState>({
    status: "loading",
  });
  const [toast, setToast] = useState<string>();
  const [reloads, setReloads] = useState(0);
  const [pickedKey, setPickedKey] = useState<string>();
  const [pickedCaseUid, setPickedCaseUid] = useState<string>();

  useEffect(() => {
    let current = true;
    setError(undefined);
    setStrictDoc({ status: "loading" });
    Promise.all([backend.getProjectRoot(), backend.getProject()]).then(
      ([root, p]) => {
        if (!current) return;
        setProjectRoot(root);
        setProject(p);
      },
      (e) => current && setError(String(e)),
    );
    // StrictDoc is read apart from the project, so that the project shows first.
    backend.getStrictDoc(reloads > 0).then(
      (s) => current && setStrictDoc({ status: "done", strictdoc: s }),
      (e) => {
        if (!current) return;
        setStrictDoc({ status: "done", strictdoc: null });
        setToast(String(e));
      },
    );
    return () => {
      current = false;
    };
  }, [backend, reloads]);

  if (error) return <pre role="alert">{error}</pre>;
  if (!projectRoot || !project) return <p>読み込み中…</p>;

  const loadedStrictDoc =
    strictdoc.status === "done" ? strictdoc.strictdoc : null;
  const rows = buildRequirementRows(project, loadedStrictDoc);
  const picked = rows.find((r) => r.key === pickedKey);
  const caseView =
    picked?.requirementUid && pickedCaseUid
      ? describeCase(project, picked.requirementUid, pickedCaseUid)
      : undefined;
  const pick = (key: string) => {
    setPickedKey(key);
    setPickedCaseUid(undefined);
    document
      .getElementById(`row-${key}`)
      ?.scrollIntoView?.({ block: "center" });
  };
  const columns = loadedStrictDoc ? 4 : 3;

  return (
    <main>
      <p>{projectRoot}</p>
      <p>表示中のコミット {project.at_commit}</p>
      <p>検証結果は表示していません</p>
      {strictdoc.status === "loading" && <p>StrictDoc: 更新中</p>}
      <button type="button" onClick={() => setReloads(reloads + 1)}>
        再読み込み
      </button>
      {toast && (
        <div role="status">
          <pre>{toast}</pre>
          <button type="button" onClick={() => setToast(undefined)}>
            閉じる
          </button>
        </div>
      )}
      <table>
        <thead>
          <tr>
            {loadedStrictDoc && <th scope="col">親の要求</th>}
            <th scope="col">要求</th>
            <th scope="col">ケース数</th>
            <th scope="col">紐づくケース</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <Fragment key={row.key}>
              {newHeadings(rows[i - 1]?.headings ?? [], row.headings).map(
                (title) => (
                  <tr key={`${row.key}-${title}`}>
                    <th colSpan={columns} scope="colgroup">
                      {title}
                    </th>
                  </tr>
                ),
              )}
              <tr id={`row-${row.key}`}>
                {loadedStrictDoc && (
                  <td>
                    {row.strictdoc?.parents.map((p) =>
                      p.key ? (
                        <button
                          type="button"
                          key={p.uid}
                          onClick={() => p.key && pick(p.key)}
                        >
                          {p.uid}
                        </button>
                      ) : (
                        <span key={p.uid}>{p.uid}</span>
                      ),
                    )}
                  </td>
                )}
                <th scope="row">
                  <button
                    type="button"
                    aria-pressed={row.key === pickedKey}
                    onClick={() => pick(row.key)}
                  >
                    {row.title}
                  </button>
                  {row.strictdoc && <p>{row.strictdoc.statement}</p>}
                  {row.strictdoc && row.strictdoc.children.length > 0 && (
                    <p>子の要求: {row.strictdoc.children.length}件</p>
                  )}
                </th>
                <td>{row.cases.length}</td>
                <td>
                  {row.cases.map((c) => (
                    <span key={c.caseUid}>{c.title}</span>
                  ))}
                </td>
              </tr>
            </Fragment>
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
          <RequirementDetail
            row={picked}
            onPickCase={setPickedCaseUid}
            onJump={pick}
          />
        ) : (
          <p>行を選ぶと、事実と出所が、ここに出ます。</p>
        )}
      </aside>
    </main>
  );
}
