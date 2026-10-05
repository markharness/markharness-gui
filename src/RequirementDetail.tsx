import { Section } from "./Section";
import type { RequirementRow } from "./rows";

/** The facts about one requirement, each under the name of the source that reports it. */
export function RequirementDetail({
  row,
  onPickCase,
}: {
  row: RequirementRow;
  onPickCase: (caseUid: string) => void;
}) {
  const source = row.source === "external" ? "StrictDoc" : "markharness";
  return (
    <>
      <p>
        <small>要求</small> <small>{source}</small>
      </p>
      <h2>{row.title}</h2>
      <p>{row.requirementId}</p>
      <Section title="ケースとの紐づき" badge="markharness">
        <dl>
          <dt>紐づくケース</dt>
          <dd>{row.cases.length}件</dd>
          {row.gaps.map((g) => (
            <div key={g.label + g.value}>
              <dt>{g.label}</dt>
              <dd>{g.value}</dd>
            </div>
          ))}
        </dl>
      </Section>
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
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
