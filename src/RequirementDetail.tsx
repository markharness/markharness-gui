import { Card, ElementHeading, Section } from "./Section";
import type { RequirementRow } from "./rows";
import { sourceName } from "./sources";

function Links({
  items,
  onJump,
}: {
  items: { uid: string; key: string | undefined }[];
  onJump: (key: string) => void;
}) {
  if (items.length === 0) return <p>なし</p>;
  return (
    <ul>
      {items.map(({ uid, key }) => (
        <li key={uid}>
          {key ? (
            <button type="button" onClick={() => onJump(key)}>
              {uid}
            </button>
          ) : (
            uid
          )}
        </li>
      ))}
    </ul>
  );
}

/** The facts about one requirement, each under the name of the source that reports it. */
export function RequirementDetail({
  row,
  coverageLoading,
  onPickCase,
  onJump,
}: {
  row: RequirementRow;
  coverageLoading: boolean;
  onPickCase: (caseUid: string) => void;
  onJump: (key: string) => void;
}) {
  const { strictdoc } = row;
  return (
    <>
      {strictdoc && (
        <Section title="親の要求" badge="StrictDoc">
          <Links items={strictdoc.parents} onJump={onJump} />
        </Section>
      )}
      <Card selected>
        <ElementHeading
          kind="要求"
          source={sourceName(row.source)}
          title={row.title}
          id={row.requirementId ?? strictdoc?.uid ?? ""}
          level={2}
        />
        {strictdoc?.statement && (
          <Section title="要求内容" badge="StrictDoc">
            <pre>{strictdoc.statement}</pre>
          </Section>
        )}
        {row.description && (
          <Section title="要求内容" badge="markharness">
            <pre>{row.description}</pre>
          </Section>
        )}
        <Section title="ケースとの紐づき" badge="markharness">
          <dl>
            <dt>紐づくケース</dt>
            <dd>{row.cases.length}件</dd>
            {row.gaps ? (
              row.gaps.map((g) => (
                <div key={g.label + g.value}>
                  <dt>{g.label}</dt>
                  <dd>{g.value}</dd>
                </div>
              ))
            ) : (
              <div>
                <dt>ケースがない理由</dt>
                <dd>{coverageLoading ? "読み込み中…" : "読めませんでした"}</dd>
              </div>
            )}
          </dl>
        </Section>
      </Card>
      {strictdoc && (
        <Section title="子の要求" badge="StrictDoc">
          <Links
            items={strictdoc.children.map((c) => ({ uid: c.uid, key: c.key }))}
            onJump={onJump}
          />
        </Section>
      )}
      <Section title="紐づくケース" badge="markharness">
        {row.cases.length === 0 ? (
          <p>紐づいていません。</p>
        ) : (
          <ul>
            {row.cases.map((c) => (
              <li key={c.caseUid}>
                <button type="button" onClick={() => onPickCase(c.caseUid)}>
                  {c.title}
                </button>
                <small className="belongs-to">{c.belongsTo}</small>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
