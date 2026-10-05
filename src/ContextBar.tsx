export function ContextBar({
  projectRoot,
  atCommit,
  strictdocLoading,
  onReload,
}: {
  projectRoot: string;
  atCommit: string;
  strictdocLoading: boolean;
  onReload: () => void;
}) {
  return (
    <header className="context">
      <span className="root">{projectRoot}</span>
      <span>
        表示中のコミット <code title={atCommit}>{atCommit.slice(0, 7)}</code>{" "}
        (HEAD)
      </span>
      <span>検証結果は表示していません</span>
      {strictdocLoading && <span>StrictDoc: 更新中</span>}
      <button type="button" className="reload" onClick={onReload}>
        再読み込み
      </button>
    </header>
  );
}
