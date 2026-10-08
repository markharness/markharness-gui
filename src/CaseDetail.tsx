import { useCallback, useEffect, useRef, useState } from "react";
import type { Backend, Binding, CaseDetail as Detail } from "./backend";
import type { CaseView } from "./caseView";
import { BehaviorCard } from "./BehaviorCard";
import { BehaviorCreator } from "./BehaviorCreator";
import { ElementEditor } from "./ElementEditor";
import { FeatureCard } from "./FeatureCard";
import { FeatureCreator } from "./FeatureCreator";
import { Card, ElementHeading, Section } from "./Section";
import { ScenarioCreator } from "./ScenarioCreator";
import { ScenarioEditor } from "./ScenarioEditor";
import { sourceName } from "./sources";
import { VerificationEditor } from "./VerificationEditor";

/**
 * A picked case, under the elements above it. Its description and steps are read when it is
 * picked; a failure to read them is shown here and leaves the rest of the screen alone.
 */
export function CaseDetail({
  view,
  backend,
  binding,
  bindingsLoading,
  onEdited,
  onBindingEdited,
  onFeatureCreated,
  onBehaviorCreated,
  onScenarioCreated,
}: {
  view: CaseView;
  backend: Backend;
  /** What the case declares in the working tree; none when it declares nothing. */
  binding?: Binding;
  bindingsLoading: boolean;
  onEdited: () => void;
  onBindingEdited: () => void;
  onFeatureCreated: (featureUid: string) => void;
  onBehaviorCreated: (behaviorUid: string) => void;
  onScenarioCreated: (scenarioUid: string) => void;
}) {
  const [detail, setDetail] = useState<Detail>();
  const [error, setError] = useState<string>();
  const { case: picked } = view;
  const reads = useRef(0);
  const [editingVerification, setEditingVerification] = useState(false);

  const read = useCallback(() => {
    const mine = ++reads.current;
    setDetail(undefined);
    setError(undefined);
    backend.getCaseDetail(picked.caseUid, picked.scenarioUid).then(
      (d) => mine === reads.current && setDetail(d),
      (e) => mine === reads.current && setError(String(e)),
    );
  }, [backend, picked.caseUid, picked.scenarioUid]);

  useEffect(() => {
    read();
    return () => {
      reads.current += 1;
    };
  }, [read]);

  return (
    <>
      <Card>
        <ElementHeading
          kind="要求"
          source={sourceName(view.requirement.source)}
          title={view.requirement.title}
          id={view.requirement.id}
        />
        {view.requirement.source === "native" && (
          <ElementEditor
            noun="要求"
            id={view.requirement.id}
            label={view.requirement.label}
            load={async () => {
              const detail = await backend.getElementDetail(
                view.requirement.uid,
              );
              return { axis: detail.axis, description: detail.description };
            }}
            toEdit={(values) => ({
              kind: "requirement",
              uid: view.requirement.uid,
              id: values.id,
              label: values.label,
              description: values.description,
              axis: values.axis ?? [],
            })}
            backend={backend}
            onEdited={onEdited}
          />
        )}
      </Card>
      <FeatureCreator
        requirementUid={view.requirement.uid}
        backend={backend}
        onCreated={onFeatureCreated}
      />
      {view.feature && (
        <>
          <FeatureCard
            feature={view.feature}
            backend={backend}
            onEdited={onEdited}
          />
          <BehaviorCreator
            featureUid={view.feature.uid}
            backend={backend}
            onCreated={onBehaviorCreated}
          />
        </>
      )}
      {view.behavior && (
        <>
          <BehaviorCard
            behavior={view.behavior}
            backend={backend}
            onEdited={onEdited}
            onProceduresEdited={() => {
              read();
              onEdited();
            }}
          />
          <ScenarioCreator
            featureUid={view.behavior.featureUid}
            behaviorUid={view.behavior.uid}
            backend={backend}
            onCreated={onScenarioCreated}
          />
        </>
      )}
      <Card selected>
        <ElementHeading
          kind="ケース"
          source="markharness"
          title={picked.title}
          id={picked.id}
          level={2}
        />
        {view.feature && view.behavior && (
          <ScenarioEditor
            featureUid={view.feature.uid}
            behaviorUid={view.behavior.uid}
            uid={picked.scenarioUid}
            id={picked.scenarioId}
            label={picked.label}
            backend={backend}
            onEdited={() => {
              read();
              onEdited();
            }}
          />
        )}
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
                    ? view.verification.reference.status
                      ? `${view.verification.reference.target}(${view.verification.reference.status})`
                      : view.verification.reference.target
                    : "—"}
                </dd>
              </dl>
              {editingVerification ? (
                <VerificationEditor
                  mode={binding?.mode ?? null}
                  reference={binding?.reference ?? null}
                  save={(mode, reference) =>
                    backend.setBinding(picked.caseUid, mode, reference)
                  }
                  onSaved={() => {
                    setEditingVerification(false);
                    onBindingEdited();
                  }}
                  onCancel={() => setEditingVerification(false)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingVerification(true)}
                >
                  検証方法を編集
                </button>
              )}
            </>
          ) : (
            <p>{bindingsLoading ? "読み込み中…" : "読めませんでした"}</p>
          )}
        </Section>
      </Card>
    </>
  );
}
