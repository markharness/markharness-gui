import { useEffect, useRef, useState } from "react";
import type { NamedProcedure } from "./edit";

interface StepRow {
  id: number;
  text: string;
}

/** A procedure that is already there keeps its name, which cannot be edited: the core has no rename. */
interface ProcedureRow {
  id: number;
  name: string;
  existing: boolean;
  steps: StepRow[];
}

/**
 * The rows that edit the common procedures of a behavior. It holds the rows and reports the
 * procedures they stand for to `onChange`, on mount and after every change.
 */
export function ProceduresFields({
  procedures,
  onChange,
}: {
  procedures: Record<string, { steps: string[] }>;
  onChange: (procedures: NamedProcedure[]) => void;
}) {
  const nextId = useRef(0);
  const newId = () => {
    nextId.current += 1;
    return nextId.current;
  };
  const [rows, setRows] = useState<ProcedureRow[]>(() =>
    Object.entries(procedures).map(([name, procedure]) => ({
      id: newId(),
      name,
      existing: true,
      steps: procedure.steps.map((text) => ({ id: newId(), text })),
    })),
  );

  useEffect(() => {
    onChange(
      rows.map((p) => ({ name: p.name, steps: p.steps.map((st) => st.text) })),
    );
  }, [rows, onChange]);

  const changeProcedure = (
    id: number,
    change: (p: ProcedureRow) => ProcedureRow,
  ) => setRows((current) => current.map((p) => (p.id === id ? change(p) : p)));

  return (
    <>
      {rows.some((p) => p.existing) && (
        <p className="hint">この共通手順を使うすべてのケースが変わります。</p>
      )}
      {rows.map((procedure, i) => {
        const title = procedure.existing ? procedure.name : String(i + 1);
        return (
          <section
            key={procedure.id}
            className="phase"
            aria-label={`共通手順 ${title}`}
          >
            <header>
              {procedure.existing ? (
                <span>{procedure.name}</span>
              ) : (
                <input
                  aria-label="名前"
                  value={procedure.name}
                  onChange={(e) =>
                    changeProcedure(procedure.id, (p) => ({
                      ...p,
                      name: e.target.value,
                    }))
                  }
                />
              )}
              <button
                type="button"
                className="icon"
                aria-label={`共通手順 ${title}を削除`}
                onClick={() =>
                  setRows((current) =>
                    current.filter((p) => p.id !== procedure.id),
                  )
                }
              >
                削除
              </button>
            </header>
            <h4>手順</h4>
            <ol aria-label="手順" className="rows">
              {procedure.steps.map((step, j) => (
                <li key={step.id} className="row step">
                  <span className="number">{j + 1}</span>
                  <div className="content">
                    <input
                      aria-label={`手順${j + 1}`}
                      value={step.text}
                      onChange={(e) =>
                        changeProcedure(procedure.id, (p) => ({
                          ...p,
                          steps: p.steps.map((st) =>
                            st.id === step.id
                              ? { ...st, text: e.target.value }
                              : st,
                          ),
                        }))
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="icon"
                    aria-label={`手順${j + 1}を削除`}
                    title="削除"
                    onClick={() =>
                      changeProcedure(procedure.id, (p) => ({
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
                changeProcedure(procedure.id, (p) => ({
                  ...p,
                  steps: [...p.steps, { id: newId(), text: "" }],
                }))
              }
            >
              ＋ 手順を追加
            </button>
          </section>
        );
      })}
      <button
        type="button"
        className="add"
        onClick={() =>
          setRows((current) => [
            ...current,
            { id: newId(), name: "", existing: false, steps: [] },
          ])
        }
      >
        ＋ 共通手順を追加
      </button>
    </>
  );
}
