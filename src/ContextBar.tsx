import type { Comparison } from "./useComparison";

export function ContextBar({
  projectRoot,
  coverageCommit,
  coverageLoading,
  strictdocLoading,
  comparison,
  onReload,
}: {
  projectRoot: string;
  /** The commit the committed content was read at; `null` until it is read. */
  coverageCommit: string | null;
  coverageLoading: boolean;
  strictdocLoading: boolean;
  comparison: Comparison;
  onReload: () => void;
}) {
  const { tags, base, chooseBase, result } = comparison;
  return (
    <header className="context">
      <span className="root">{projectRoot}</span>
      <span>作業ツリー(未コミットの編集を含む)を表示中</span>
      <span>
        コミット済みの内容:{" "}
        {coverageCommit ? (
          <>
            <code>{coverageCommit.slice(0, 7)}</code> (HEAD)
          </>
        ) : coverageLoading ? (
          "読み込み中"
        ) : (
          "読めませんでした"
        )}
      </span>
      <span>検証結果は表示していません</span>
      <span>
        <label>
          比較元:{" "}
          <select
            value={base}
            disabled={tags.length === 0}
            onChange={(e) => chooseBase(e.target.value)}
          >
            <option value="">未選択</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>{" "}
        <small>コミット済みの内容で比較</small>
      </span>
      {result && (
        <span>
          変更後に確認対象となるケース:{" "}
          {result.kind === "loading"
            ? "読み込み中"
            : result.kind === "counted"
              ? `${result.casesToConfirm.size}件`
              : result.message}
        </span>
      )}
      {strictdocLoading && <span>StrictDoc: 更新中</span>}
      <button type="button" className="reload" onClick={onReload}>
        再読み込み
      </button>
    </header>
  );
}
