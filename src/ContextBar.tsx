export function ContextBar({
  projectRoot,
  coverageCommit,
  coverageLoading,
  strictdocLoading,
  onReload,
}: {
  projectRoot: string;
  /** The commit the committed content was read at; `null` until it is read. */
  coverageCommit: string | null;
  coverageLoading: boolean;
  strictdocLoading: boolean;
  onReload: () => void;
}) {
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
      {strictdocLoading && <span>StrictDoc: 更新中</span>}
      <button type="button" className="reload" onClick={onReload}>
        再読み込み
      </button>
    </header>
  );
}
