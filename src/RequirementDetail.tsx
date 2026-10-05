import type { RequirementRow } from "./rows";

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3>
        {title} <small>{badge}</small>
      </h3>
      {children}
    </section>
  );
}

/** The facts about one requirement, each under the name of the source that reports it. */
export function RequirementDetail({ row }: { row: RequirementRow }) {
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
              <li key={c.caseUid}>{c.title}</li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
