import { useState } from "react";
import type { Backend } from "./backend";
import { CaseDetail } from "./CaseDetail";
import { describeCase } from "./caseView";
import { ElementCreator } from "./ElementCreator";
import { ContextBar } from "./ContextBar";
import { RequirementDetail } from "./RequirementDetail";
import { RequirementTable } from "./RequirementTable";
import { buildRequirementRows } from "./rows";
import { Toast } from "./Toast";
import { unlinkedFeatures } from "./unlinked";
import { useComparison } from "./useComparison";
import { useProjectData } from "./useProjectData";

export function App({ backend }: { backend: Backend }) {
  const data = useProjectData(backend);
  const comparison = useComparison(backend, data.readOf);
  const [pickedKey, setPickedKey] = useState<string>();
  const [pickedCaseUid, setPickedCaseUid] = useState<string>();

  if (data.error) return <pre role="alert">{data.error}</pre>;
  if (!data.loaded) return <p>読み込み中…</p>;

  const { projectRoot, traceability } = data.loaded;
  const rows = buildRequirementRows(
    traceability,
    data.strictdoc,
    data.descriptions,
    data.coverage,
  );
  const unlinked = unlinkedFeatures(traceability);
  const picked = rows.find((r) => r.key === pickedKey);
  const caseView =
    picked?.requirementUid && pickedCaseUid
      ? describeCase(
          traceability,
          data.coverage,
          data.bindings,
          picked.requirementUid,
          pickedCaseUid,
        )
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
        coverageCommit={data.coverage?.at_commit ?? null}
        coverageLoading={data.coverageLoading}
        strictdocLoading={data.strictdocLoading}
        comparison={comparison}
        onReload={data.reload}
      />
      {unlinked.length > 0 && (
        <p className="unlinked">
          要求に紐づかないFeatureが{unlinked.length}
          件あります(一覧には表示されません): {unlinked.join("、")}
        </p>
      )}
      {data.notice && (
        <Toast message={data.notice} onDismiss={data.dismissNotice} />
      )}
      <div className="panes">
        <section className="list">
          <ElementCreator
            noun="要求"
            buttonLabel="＋ 要求を追加"
            toCreate={(values) => ({
              kind: "requirement",
              id: values.id,
              label: values.label,
              description:
                values.description === "" ? undefined : values.description,
              axis: values.axis ?? [],
            })}
            backend={backend}
            onCreated={(uid) => {
              data.refreshTraceability();
              setPickedKey(uid);
              setPickedCaseUid(undefined);
            }}
          />
          <RequirementTable
            rows={rows}
            casesToConfirm={
              comparison.result?.kind === "counted"
                ? comparison.result.casesToConfirm
                : undefined
            }
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
              binding={data.bindings?.find(
                (b) => b.case_uid === caseView.case.caseUid,
              )}
              bindingsLoading={data.bindingsLoading}
              onEdited={data.refreshTraceability}
              onBindingEdited={data.refreshBindings}
            />
          ) : picked ? (
            <RequirementDetail
              row={picked}
              backend={backend}
              coverageLoading={data.coverageLoading}
              onPickCase={setPickedCaseUid}
              onJump={pick}
              onEdited={data.refreshTraceability}
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
