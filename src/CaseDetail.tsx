import { useEffect, useState } from "react";
import type { Backend, CaseDetail as Detail } from "./backend";
import type { CaseView } from "./caseView";
import { ElementCard } from "./ElementCard";
import { Card, ElementHeading, Section } from "./Section";
import { sourceName } from "./sources";

/**
 * A picked case, under the elements above it. Its description and steps are read when it is
 * picked; a failure to read them is shown here and leaves the rest of the screen alone.
 */
export function CaseDetail({
  view,
  backend,
  coverageLoading,
  onEdited,
}: {
  view: CaseView;
  backend: Backend;
  coverageLoading: boolean;
  onEdited: () => void;
}) {
  const [detail, setDetail] = useState<Detail>();
  const [error, setError] = useState<string>();
  const { case: picked } = view;

  useEffect(() => {
    let current = true;
    setDetail(undefined);
    setError(undefined);
    backend.getCaseDetail(picked.caseUid, picked.scenarioUid).then(
      (d) => current && setDetail(d),
      (e) => current && setError(String(e)),
    );
    return () => {
      current = false;
    };
  }, [backend, picked.caseUid, picked.scenarioUid]);

  return (
    <>
      <Card>
        <ElementHeading
          kind="要求"
          source={sourceName(view.requirement.source)}
          title={view.requirement.title}
          id={view.requirement.id}
        />
      </Card>
      {view.feature && (
        <ElementCard
          noun="Feature"
          element={view.feature}
          describe={false}
          toEdit={(values) => ({
            kind: "feature",
            uid: view.feature?.uid ?? "",
            ...values,
          })}
          backend={backend}
          onEdited={onEdited}
        />
      )}
      {view.behavior && (
        <ElementCard
          noun="Behavior"
          element={view.behavior}
          describe
          toEdit={(values) => ({
            kind: "behavior",
            feature_uid: view.behavior?.featureUid ?? "",
            uid: view.behavior?.uid ?? "",
            ...values,
          })}
          backend={backend}
          onEdited={onEdited}
        />
      )}
      <Card selected>
        <ElementHeading
          kind="ケース"
          source="markharness"
          title={picked.title}
          id={picked.id}
          level={2}
        />
        {error ? (
          <pre role="alert">{error}</pre>
        ) : !detail ? (
          <p>読み込み中…</p>
        ) : (
          <>
            {detail.description && (
              <Section title="説明" badge="markharness">
                <p>{detail.description}</p>
              </Section>
            )}
            <Section title="手順と期待結果" badge="markharness">
              {detail.phases.map((phase) => (
                <div key={phase.steps.join(" / ")}>
                  <ul>
                    {phase.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                  <p>→ {phase.results.join(" / ")}</p>
                </div>
              ))}
            </Section>
          </>
        )}
        <Section title="検証方法" badge="markharness">
          {view.verification ? (
            <>
              <dl>
                <dt>方法</dt>
                <dd>{view.verification.method}</dd>
                <dt>参照先</dt>
                <dd>
                  {view.verification.reference
                    ? `${view.verification.reference.target}(${view.verification.reference.status})`
                    : "—"}
                </dd>
              </dl>
              <small>コミット済みの内容から読んだ宣言です。</small>
            </>
          ) : (
            <p>{coverageLoading ? "読み込み中…" : "読めませんでした"}</p>
          )}
        </Section>
      </Card>
    </>
  );
}
