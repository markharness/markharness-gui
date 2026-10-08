import { useState } from "react";
import type { Axis } from "./backend";
import { ignoreEnterInOneLineFields } from "./ignoreEnter";

export function ElementEditForm({
  noun,
  element,
  candidates: initialCandidates,
  save,
  addAxis,
  unusedAxes,
  deleteUnusedAxes,
  onSaved,
  onCancel,
}: {
  /** What the element is called to the user, as in "Featureの保存とキャンセル". */
  noun: string;
  /** `description` is given only for an element whose description is edited too. */
  element: {
    id: string;
    label: string | null;
    /** Given only for an element that has categories. */
    axis?: string[];
    description?: string | null;
    /** Given only for an element that has an implementation note. */
    implementationNote?: string | null;
  };
  candidates: Axis[];
  /** Saves the label and the axes as the form holds them. */
  save: (values: {
    id: string;
    label: string;
    axis?: string[];
    description?: string;
    implementationNote?: string;
  }) => Promise<void>;
  /** Registers a new axis and returns the axes to choose from, the new one included. */
  addAxis: (id: string, label: string) => Promise<Axis[]>;
  /** The ids of the categories no element uses. */
  unusedAxes: () => Promise<string[]>;
  /** Deletes the categories no element uses and returns the axes to choose from. */
  deleteUnusedAxes: () => Promise<Axis[]>;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [id, setId] = useState(element.id);
  const [label, setLabel] = useState(element.label ?? "");
  const [axis, setAxis] = useState(element.axis ?? []);
  const [implementationNote, setImplementationNote] = useState(
    element.implementationNote ?? "",
  );
  const [description, setDescription] = useState(element.description ?? "");
  const [error, setError] = useState<string>();
  const [candidates, setCandidates] = useState(initialCandidates);
  const [newId, setNewId] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [axisError, setAxisError] = useState<string>();
  const [adding, setAdding] = useState(false);
  const [unused, setUnused] = useState<string[]>();
  const [nothingUnused, setNothingUnused] = useState(false);
  const [pruneError, setPruneError] = useState<string>();
  const closeNewCategory = () => {
    setAdding(false);
    setNewId("");
    setNewLabel("");
    setAxisError(undefined);
  };
  return (
    <form
      className="edit-form"
      onKeyDown={ignoreEnterInOneLineFields}
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        save({
          id,
          label,
          ...(element.axis !== undefined && { axis }),
          ...(element.description !== undefined && { description }),
          ...(element.implementationNote !== undefined && {
            implementationNote,
          }),
        }).then(onSaved, (reason) => setError(String(reason)));
      }}
    >
      {error && <pre role="alert">{error}</pre>}
      <label className="field">
        <span>ID</span>
        <input value={id} onChange={(e) => setId(e.target.value)} />
      </label>
      <label className="field">
        <span>ラベル</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>
      {element.description !== undefined && (
        <label className="field">
          <span>説明</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
      )}
      {element.implementationNote !== undefined && (
        <label className="field">
          <span>実装メモ</span>
          <textarea
            value={implementationNote}
            onChange={(e) => setImplementationNote(e.target.value)}
          />
        </label>
      )}
      {element.axis !== undefined && (
        <>
          <fieldset>
            <legend>分類</legend>
            {candidates.map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={axis.includes(c.id)}
                  onChange={() =>
                    setAxis(
                      axis.includes(c.id)
                        ? axis.filter((a) => a !== c.id)
                        : [...axis, c.id],
                    )
                  }
                />
                {c.label}
              </label>
            ))}
          </fieldset>
          <fieldset aria-label="分類の操作" className="category-actions">
            <button
              type="button"
              aria-expanded={adding}
              onClick={() => (adding ? closeNewCategory() : setAdding(true))}
            >
              {adding ? "－ 分類を追加" : "＋ 分類を追加"}
            </button>
            <button
              type="button"
              onClick={() => {
                setNothingUnused(false);
                setPruneError(undefined);
                unusedAxes().then(
                  (ids) =>
                    ids.length === 0 ? setNothingUnused(true) : setUnused(ids),
                  (reason) => setPruneError(String(reason)),
                );
              }}
            >
              未使用の分類を削除
            </button>
          </fieldset>
          {nothingUnused && <p role="status">未使用の分類は、ありません。</p>}
          {adding && (
            <fieldset className="new-category">
              <legend>新しい分類</legend>
              <label className="field">
                <span>id</span>
                <input
                  value={newId}
                  placeholder="例: performance(半角の小文字英数字とハイフン)"
                  onChange={(e) => setNewId(e.target.value)}
                />
              </label>
              <label className="field">
                <span>ラベル</span>
                <input
                  value={newLabel}
                  placeholder="省略可"
                  onChange={(e) => setNewLabel(e.target.value)}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setAxisError(undefined);
                  addAxis(newId, newLabel).then(
                    (axes) => {
                      setCandidates(axes);
                      setAxis((current) => [...current, newId]);
                      closeNewCategory();
                    },
                    (reason) => setAxisError(String(reason)),
                  );
                }}
              >
                追加
              </button>
              {axisError && <pre role="alert">{axisError}</pre>}
            </fieldset>
          )}
          {unused && (
            <fieldset>
              <legend>未使用の分類を削除</legend>
              <p>どの要素からも使われていない、次の分類を削除します。</p>
              <ul>
                {unused.map((id) => (
                  <li key={id}>
                    {candidates.find((c) => c.id === id)?.label ?? id}
                  </li>
                ))}
              </ul>
              <p>この操作は元に戻せません。</p>
              <p>
                このフォームで選んだだけで、保存していない分類も、使われていないものとして、削除されます。
              </p>
              <button
                type="button"
                onClick={() =>
                  deleteUnusedAxes().then(
                    (axes) => {
                      setCandidates(axes);
                      setAxis((current) =>
                        current.filter((id) => axes.some((a) => a.id === id)),
                      );
                      setUnused(undefined);
                    },
                    (reason) => setPruneError(String(reason)),
                  )
                }
              >
                削除
              </button>
              <button
                type="button"
                onClick={() => {
                  setUnused(undefined);
                  setPruneError(undefined);
                }}
              >
                キャンセル
              </button>
            </fieldset>
          )}
          {pruneError && <pre role="alert">{pruneError}</pre>}
        </>
      )}
      <fieldset
        aria-label={`${noun}の保存とキャンセル`}
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
