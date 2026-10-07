import { useRef, useState } from "react";
import type { ScenarioPhase } from "./backend";

interface StepRow {
  id: number;
  kind: "action" | "use";
  value: string;
}

interface ResultRow {
  id: number;
  value: string;
}

interface PhaseRow {
  id: number;
  steps: StepRow[];
  results: ResultRow[];
}

/** Edits the phases of a scenario as rows, and saves them whole, as the core replaces them whole. */
export function PhasesEditor({
  phases,
  procedures,
  save,
  onSaved,
  onCancel,
}: {
  phases: ScenarioPhase[];
  /** The common procedures the scenario's behavior declares, by name. */
  procedures: Record<string, { steps: string[] }>;
  save: (phases: ScenarioPhase[]) => Promise<void>;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string>();
  const nextId = useRef(0);
  const newId = () => {
    nextId.current += 1;
    return nextId.current;
  };
  const [rows, setRows] = useState<PhaseRow[]>(() =>
    phases.map((phase) => ({
      id: newId(),
      steps: phase.steps.map((step) =>
        "use" in step
          ? { id: newId(), kind: "use" as const, value: step.use }
          : { id: newId(), kind: "action" as const, value: step.action },
      ),
      results: phase.results.map((value) => ({ id: newId(), value })),
    })),
  );
  const procedureNames = Object.keys(procedures);

  const changePhase = (phaseId: number, change: (p: PhaseRow) => PhaseRow) =>
    setRows((current) =>
      current.map((p) => (p.id === phaseId ? change(p) : p)),
    );
  const setStep = (phaseId: number, stepId: number, value: string) =>
    changePhase(phaseId, (p) => ({
      ...p,
      steps: p.steps.map((st) => (st.id === stepId ? { ...st, value } : st)),
    }));
  const setResult = (phaseId: number, resultId: number, value: string) =>
    changePhase(phaseId, (p) => ({
      ...p,
      results: p.results.map((r) => (r.id === resultId ? { ...r, value } : r)),
    }));

  return (
    <form
      className="edit-form phases-form"
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        save(
          rows.map((p) => ({
            steps: p.steps.map((st) =>
              st.kind === "use" ? { use: st.value } : { action: st.value },
            ),
            results: p.results.map((r) => r.value),
          })),
        ).then(onSaved, (reason) => setError(String(reason)));
      }}
    >
      {error && <pre role="alert">{error}</pre>}
      {rows.map((phase, i) => (
        <fieldset key={phase.id} aria-label={`フェーズ${i + 1}`}>
          {phase.steps.map((step, j) => (
            <div key={step.id} className="row">
              {step.kind === "use" ? (
                <select
                  aria-label={`手順${j + 1}`}
                  value={step.value}
                  onChange={(e) => setStep(phase.id, step.id, e.target.value)}
                >
                  {[...new Set([...procedureNames, step.value])].map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  aria-label={`手順${j + 1}`}
                  value={step.value}
                  onChange={(e) => setStep(phase.id, step.id, e.target.value)}
                />
              )}
              {step.kind === "use" && (
                <small className="procedure-steps">
                  {(procedures[step.value]?.steps ?? []).join(" / ")}
                </small>
              )}
              <button
                type="button"
                aria-label={`手順${j + 1}を削除`}
                onClick={() =>
                  changePhase(phase.id, (p) => ({
                    ...p,
                    steps: p.steps.filter((st) => st.id !== step.id),
                  }))
                }
              >
                削除
              </button>
            </div>
          ))}
          <div className="row-actions">
            <button
              type="button"
              onClick={() =>
                changePhase(phase.id, (p) => ({
                  ...p,
                  steps: [
                    ...p.steps,
                    { id: newId(), kind: "action", value: "" },
                  ],
                }))
              }
            >
              ＋ 手順を追加
            </button>
            <button
              type="button"
              disabled={procedureNames.length === 0}
              onClick={() =>
                changePhase(phase.id, (p) => ({
                  ...p,
                  steps: [
                    ...p.steps,
                    { id: newId(), kind: "use", value: procedureNames[0] },
                  ],
                }))
              }
            >
              ＋ 共通手順を追加
            </button>
          </div>
          {phase.results.map((result, k) => (
            <div key={result.id} className="row">
              <input
                aria-label={`期待結果${k + 1}`}
                value={result.value}
                onChange={(e) => setResult(phase.id, result.id, e.target.value)}
              />
              <button
                type="button"
                aria-label={`期待結果${k + 1}を削除`}
                onClick={() =>
                  changePhase(phase.id, (p) => ({
                    ...p,
                    results: p.results.filter((r) => r.id !== result.id),
                  }))
                }
              >
                削除
              </button>
            </div>
          ))}
          <div className="row-actions">
            <button
              type="button"
              onClick={() =>
                changePhase(phase.id, (p) => ({
                  ...p,
                  results: [...p.results, { id: newId(), value: "" }],
                }))
              }
            >
              ＋ 期待結果を追加
            </button>
          </div>
          <button
            type="button"
            onClick={() =>
              setRows((current) => current.filter((p) => p.id !== phase.id))
            }
          >
            このフェーズを削除
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        onClick={() =>
          setRows((current) => [
            ...current,
            {
              id: newId(),
              steps: [{ id: newId(), kind: "action", value: "" }],
              results: [{ id: newId(), value: "" }],
            },
          ])
        }
      >
        ＋ フェーズを追加
      </button>
      <fieldset
        aria-label="手順と期待結果の保存とキャンセル"
        className="form-actions"
      >
        <button type="submit" className="primary">
          保存
        </button>
        <button type="button" onClick={onCancel}>
          キャンセル
        </button>
      </fieldset>
    </form>
  );
}
