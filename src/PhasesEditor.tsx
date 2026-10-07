import { useRef, useState } from "react";
import type { ScenarioPhase } from "./backend";
import { ignoreEnterInOneLineFields } from "./ignoreEnter";

/**
 * A step is one row. Whether it calls a common procedure is an attribute of the row, and the row
 * keeps both its text and the procedure it would call, so switching the attribute loses neither.
 */
interface StepRow {
  id: number;
  common: boolean;
  text: string;
  procedure: string;
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
  const procedureNames = Object.keys(procedures);
  const firstProcedure = procedureNames[0] ?? "";
  const [rows, setRows] = useState<PhaseRow[]>(() =>
    phases.map((phase) => ({
      id: newId(),
      steps: phase.steps.map((step) =>
        "use" in step
          ? { id: newId(), common: true, text: "", procedure: step.use }
          : {
              id: newId(),
              common: false,
              text: step.action,
              procedure: firstProcedure,
            },
      ),
      results: phase.results.map((value) => ({ id: newId(), value })),
    })),
  );

  const changePhase = (phaseId: number, change: (p: PhaseRow) => PhaseRow) =>
    setRows((current) =>
      current.map((p) => (p.id === phaseId ? change(p) : p)),
    );
  const changeStep = (
    phaseId: number,
    stepId: number,
    change: Partial<StepRow>,
  ) =>
    changePhase(phaseId, (p) => ({
      ...p,
      steps: p.steps.map((st) =>
        st.id === stepId ? { ...st, ...change } : st,
      ),
    }));
  const setResult = (phaseId: number, resultId: number, value: string) =>
    changePhase(phaseId, (p) => ({
      ...p,
      results: p.results.map((r) => (r.id === resultId ? { ...r, value } : r)),
    }));

  return (
    <form
      className="edit-form phases-form"
      onKeyDown={ignoreEnterInOneLineFields}
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        save(
          rows.map((p) => ({
            steps: p.steps.map((st) =>
              st.common ? { use: st.procedure } : { action: st.text },
            ),
            results: p.results.map((r) => r.value),
          })),
        ).then(onSaved, (reason) => setError(String(reason)));
      }}
    >
      {error && <pre role="alert">{error}</pre>}
      {rows.map((phase, i) => (
        <section
          key={phase.id}
          className="phase"
          aria-label={`フェーズ${i + 1}`}
        >
          <header>
            <span>フェーズ {i + 1}</span>
            <button
              type="button"
              className="icon"
              aria-label={`フェーズ${i + 1}を削除`}
              onClick={() =>
                setRows((current) => current.filter((p) => p.id !== phase.id))
              }
            >
              削除
            </button>
          </header>
          <h4>手順</h4>
          <ol aria-label="手順" className="rows">
            {phase.steps.map((step, j) => (
              <li key={step.id} className="row step">
                <span className="number">{j + 1}</span>
                <div className="content">
                  {step.common ? (
                    <>
                      <select
                        aria-label={`手順${j + 1}`}
                        value={step.procedure}
                        onChange={(e) =>
                          changeStep(phase.id, step.id, {
                            procedure: e.target.value,
                          })
                        }
                      >
                        {[...new Set([...procedureNames, step.procedure])].map(
                          (name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ),
                        )}
                      </select>
                      <small className="procedure-steps">
                        {(procedures[step.procedure]?.steps ?? []).join(" / ")}
                      </small>
                    </>
                  ) : (
                    <input
                      aria-label={`手順${j + 1}`}
                      value={step.text}
                      onChange={(e) =>
                        changeStep(phase.id, step.id, { text: e.target.value })
                      }
                    />
                  )}
                </div>
                <label className="common">
                  <input
                    type="checkbox"
                    checked={step.common}
                    disabled={!step.common && procedureNames.length === 0}
                    onChange={(e) =>
                      changeStep(phase.id, step.id, {
                        common: e.target.checked,
                        procedure: step.procedure || firstProcedure,
                      })
                    }
                  />
                  共通
                </label>
                <button
                  type="button"
                  className="icon"
                  aria-label={`手順${j + 1}を削除`}
                  title="削除"
                  onClick={() =>
                    changePhase(phase.id, (p) => ({
                      ...p,
                      steps: p.steps.filter((st) => st.id !== step.id),
                    }))
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="add"
            onClick={() =>
              changePhase(phase.id, (p) => ({
                ...p,
                steps: [
                  ...p.steps,
                  {
                    id: newId(),
                    common: false,
                    text: "",
                    procedure: firstProcedure,
                  },
                ],
              }))
            }
          >
            ＋ 手順を追加
          </button>
          <h4>期待結果</h4>
          <ol aria-label="期待結果" className="rows">
            {phase.results.map((result, k) => (
              <li key={result.id} className="row result">
                <span className="number">{k + 1}</span>
                <div className="content">
                  <input
                    aria-label={`期待結果${k + 1}`}
                    value={result.value}
                    onChange={(e) =>
                      setResult(phase.id, result.id, e.target.value)
                    }
                  />
                </div>
                <button
                  type="button"
                  className="icon"
                  aria-label={`期待結果${k + 1}を削除`}
                  title="削除"
                  onClick={() =>
                    changePhase(phase.id, (p) => ({
                      ...p,
                      results: p.results.filter((r) => r.id !== result.id),
                    }))
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="add"
            onClick={() =>
              changePhase(phase.id, (p) => ({
                ...p,
                results: [...p.results, { id: newId(), value: "" }],
              }))
            }
          >
            ＋ 期待結果を追加
          </button>
        </section>
      ))}
      <button
        type="button"
        className="add"
        onClick={() =>
          setRows((current) => [
            ...current,
            {
              id: newId(),
              steps: [
                {
                  id: newId(),
                  common: false,
                  text: "",
                  procedure: firstProcedure,
                },
              ],
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
