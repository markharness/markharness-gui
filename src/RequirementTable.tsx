import { Fragment } from "react";
import type { RequirementRow } from "./rows";

/** The headings that start at this row: the levels past those shared with the row before. */
function newHeadings(previous: string[], current: string[]): string[] {
  let shared = 0;
  while (
    shared < previous.length &&
    shared < current.length &&
    previous[shared] === current[shared]
  )
    shared += 1;
  return current.slice(shared);
}

export function RequirementTable({
  rows,
  showParents,
  pickedKey,
  onPick,
}: {
  rows: RequirementRow[];
  /** Whether StrictDoc is read, so that the parent column has something to show. */
  showParents: boolean;
  pickedKey: string | undefined;
  onPick: (key: string) => void;
}) {
  const columns = showParents ? 4 : 3;
  return (
    <table>
      <thead>
        <tr>
          {showParents && (
            <th scope="col" className="col-parent">
              親の要求
            </th>
          )}
          <th scope="col">要求</th>
          <th scope="col" className="col-count">
            ケース数
          </th>
          <th scope="col" className="col-cases">
            紐づくケース
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <Fragment key={row.key}>
            {newHeadings(rows[i - 1]?.headings ?? [], row.headings).map(
              (title) => (
                <tr key={`${row.key}-${title}`}>
                  <th colSpan={columns} scope="colgroup">
                    {title}
                  </th>
                </tr>
              ),
            )}
            <tr
              id={`row-${row.key}`}
              className={row.key === pickedKey ? "selected" : undefined}
            >
              {showParents && (
                <td>
                  {row.strictdoc?.parents.map((p) =>
                    p.key ? (
                      <button
                        type="button"
                        key={p.uid}
                        className="parent"
                        onClick={() => p.key && onPick(p.key)}
                      >
                        {p.uid}
                      </button>
                    ) : (
                      <span key={p.uid} className="parent">
                        {p.uid}
                      </span>
                    ),
                  )}
                </td>
              )}
              <th scope="row">
                <button
                  type="button"
                  aria-pressed={row.key === pickedKey}
                  onClick={() => onPick(row.key)}
                >
                  {row.title}
                </button>
                {row.strictdoc && (
                  <p className="statement">{row.strictdoc.statement}</p>
                )}
                {row.strictdoc && row.strictdoc.children.length > 0 && (
                  <p className="children">
                    子の要求: {row.strictdoc.children.length}件
                  </p>
                )}
              </th>
              <td className="count">{row.cases.length}</td>
              <td>
                {row.cases.map((c) => (
                  <span key={c.caseUid} className="case">
                    {c.title}
                  </span>
                ))}
              </td>
            </tr>
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
