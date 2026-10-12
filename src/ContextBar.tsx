import type { ComparisonTarget } from "./backend";
import { type Comparison, UNCOMMITTED } from "./useComparison";

/** Which two things the comparison sets side by side. */
function range(target: ComparisonTarget): string {
  return target.kind === "uncommitted"
    ? "HEAD → 作業ツリー"
    : `${target.name} → HEAD`;
}

/**
 * The uncommitted edits cannot be confirmed (no commit lies in the range), so what they report
 * is the cases they affect, and the result is provisional.
 */
function note(target: ComparisonTarget): string {
  return target.kind === "uncommitted"
    ? "未コミットの変更に基づく暫定的な影響分析(未追跡のファイルを含む)"
    : "コミット済みの内容で比較";
}

function countLabel(target: ComparisonTarget): string {
  return target.kind === "uncommitted"
    ? "影響を受けるケース"
    : "変更後に確認対象となるケース";
}

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
  const { tags, choice, choose, target, result } = comparison;
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
      <span className="comparison">
        <label>
          比較対象:{" "}
          <select value={choice} onChange={(e) => choose(e.target.value)}>
            <option value="">未選択</option>
            <option value={UNCOMMITTED}>未コミットの編集</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
        {target && (
          <>
            <small>{range(target)}</small>
            <small>{note(target)}</small>
          </>
        )}
      </span>
      {result && target && (
        <span>
          {countLabel(target)}:{" "}
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
