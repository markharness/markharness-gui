import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Backend,
  Binding,
  CaseDetail as Detail,
  ScenarioPhase,
} from "./backend";
import type { CaseView } from "./caseView";
import { BehaviorProcedures } from "./BehaviorProcedures";
import { ElementCard } from "./ElementCard";
import { ElementEditor } from "./ElementEditor";
import { PhasesEditor } from "./PhasesEditor";
import { scenarioEdit } from "./edit";
import { Card, ElementHeading, Section } from "./Section";
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
}: {
  view: CaseView;
  backend: Backend;
  /** What the case declares in the working tree; none when it declares nothing. */
  binding?: Binding;
  bindingsLoading: boolean;
  onEdited: () => void;
  onBindingEdited: () => void;
}) {
  const [detail, setDetail] = useState<Detail>();
  const [error, setError] = useState<string>();
  const { case: picked } = view;
  const reads = useRef(0);
  const [editingPhases, setEditingPhases] = useState<{
    phases: ScenarioPhase[];
    procedures: Record<string, { steps: string[] }>;
  }>();
  const [phasesError, setPhasesError] = useState<string>();
  const [editingVerification, setEditingVerification] = useState(false);

  const editPhases = async () => {
    try {
      const [scenario, behavior] = await Promise.all([
        backend.getScenarioDetail(picked.scenarioUid),
        backend.getElementDetail(view.behavior?.uid ?? ""),
      ]);
      setEditingPhases({
        phases: scenario.phases,
        procedures: behavior.procedures,
      });
    } catch (reason) {
      setPhasesError(String(reason));
    }
  };

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
      {view.feature && (
        <ElementCard
          noun="Feature"
          element={view.feature}
          load={async () => {
            const detail = await backend.getElementDetail(
              view.feature?.uid ?? "",
            );
            return { axis: detail.axis };
          }}
          toEdit={(values) => ({
            kind: "feature",
            uid: view.feature?.uid ?? "",
            id: values.id,
            label: values.label,
            axis: values.axis ?? [],
          })}
          backend={backend}
          onEdited={onEdited}
        />
      )}
      {view.behavior && (
        <ElementCard
          noun="Behavior"
          element={view.behavior}
          load={async () => {
            const detail = await backend.getElementDetail(
              view.behavior?.uid ?? "",
            );
            return { axis: detail.axis, description: detail.description };
          }}
          toEdit={(values) => ({
            kind: "behavior",
            feature_uid: view.behavior?.featureUid ?? "",
            uid: view.behavior?.uid ?? "",
            id: values.id,
            label: values.label,
            description: values.description,
            axis: values.axis ?? [],
          })}
          backend={backend}
          onEdited={onEdited}
        >
          <BehaviorProcedures
            featureUid={view.behavior.featureUid}
            uid={view.behavior.uid}
            backend={backend}
            onEdited={() => {
              read();
              onEdited();
            }}
          />
        </ElementCard>
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
          <ElementEditor
            noun="Scenario"
            id={picked.scenarioId}
            label={picked.label}
            load={async () => {
              const detail = await backend.getScenarioDetail(
                picked.scenarioUid,
              );
              return {
                description: detail.description,
                implementationNote: detail.implementation_note,
              };
            }}
            toEdit={(values, detail) =>
              scenarioEdit(
                {
                  featureUid: view.feature?.uid ?? "",
                  behaviorUid: view.behavior?.uid ?? "",
                  uid: picked.scenarioUid,
                },
                { implementationNote: detail.implementationNote ?? null },
                values,
              )
            }
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
              {editingPhases ? (
                <PhasesEditor
                  phases={editingPhases.phases}
                  procedures={editingPhases.procedures}
                  save={(phases) =>
                    backend.editKnowledge({
                      kind: "scenario",
                      feature_uid: view.feature?.uid ?? "",
                      behavior_uid: view.behavior?.uid ?? "",
                      uid: picked.scenarioUid,
                      phases,
                    })
                  }
                  onSaved={() => {
                    setEditingPhases(undefined);
                    read();
                    onEdited();
                  }}
                  onCancel={() => setEditingPhases(undefined)}
                />
              ) : (
                <>
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
                  {phasesError && <pre role="alert">{phasesError}</pre>}
                  {view.feature && view.behavior && (
                    <button type="button" onClick={editPhases}>
                      手順を編集
                    </button>
                  )}
                </>
              )}
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
