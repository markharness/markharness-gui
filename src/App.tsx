import { useState } from "react";
import type { Backend } from "./backend";
import { CaseDetail } from "./CaseDetail";
import { describeCase } from "./caseView";
import { ContextBar } from "./ContextBar";
import { RequirementDetail } from "./RequirementDetail";
import { RequirementTable } from "./RequirementTable";
import { buildRequirementRows } from "./rows";
import { Toast } from "./Toast";
import { useProjectData } from "./useProjectData";

export function App({ backend }: { backend: Backend }) {
  const data = useProjectData(backend);
  const [pickedKey, setPickedKey] = useState<string>();
  const [pickedCaseUid, setPickedCaseUid] = useState<string>();

  if (data.error) return <pre role="alert">{data.error}</pre>;
  if (!data.loaded) return <p>読み込み中…</p>;

  const { projectRoot, project } = data.loaded;
  const rows = buildRequirementRows(project, data.strictdoc, data.descriptions);
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
  const pickCase = (key: string, caseUid: string) => {
    setPickedKey(key);
    setPickedCaseUid(caseUid);
  };

  return (
    <main className="app">
      <ContextBar
        projectRoot={projectRoot}
        atCommit={project.at_commit}
        strictdocLoading={data.strictdocLoading}
        onReload={data.reload}
      />
      {data.notice && (
        <Toast message={data.notice} onDismiss={data.dismissNotice} />
      )}
      <div className="panes">
        <section className="list">
          <RequirementTable
            rows={rows}
            showParents={data.strictdoc !== null}
            pickedKey={pickedKey}
            pickedCaseUid={pickedCaseUid}
            onPick={pick}
            onPickCase={pickCase}
          />
        </section>
        <aside className="detail" aria-label="詳細">
          {picked && <p className="related">関連する情報</p>}
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
            <p className="placeholder">
              行を選ぶと、事実と出所が、ここに出ます。
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}
