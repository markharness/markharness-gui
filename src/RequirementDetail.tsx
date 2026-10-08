import type { Backend, RemoveKind } from "./backend";
import { ElementEditor } from "./ElementEditor";
import { ElementRemover } from "./ElementRemover";
import { FeatureCreator } from "./FeatureCreator";
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
  backend,
  coverageLoading,
  onPickCase,
  onJump,
  onPickFeature,
  onFeatureCreated,
  onEdited,
  onRemoved,
}: {
  row: RequirementRow;
  backend: Backend;
  coverageLoading: boolean;
  onPickCase: (caseUid: string) => void;
  onJump: (key: string) => void;
  onPickFeature: (featureUid: string) => void;
  onFeatureCreated: (featureUid: string) => void;
  onEdited: () => void;
  onRemoved: (kind: RemoveKind) => void;
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
        {row.source === "native" && row.requirementUid && (
          <ElementEditor
            noun="要求"
            id={row.requirementId ?? ""}
            label={row.label}
            load={async () => {
              const detail = await backend.getElementDetail(
                row.requirementUid ?? "",
              );
              return { axis: detail.axis, description: detail.description };
            }}
            toEdit={(values) => ({
              kind: "requirement",
              uid: row.requirementUid ?? "",
              id: values.id,
              label: values.label,
              description: values.description,
              axis: values.axis ?? [],
            })}
            backend={backend}
            onEdited={onEdited}
          />
        )}
        {row.source === "native" && row.requirementUid && (
          <ElementRemover
            kind="requirement"
            noun="要求"
            uid={row.requirementUid}
            backend={backend}
            onRemoved={() => onRemoved("requirement")}
          />
        )}
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
      {row.requirementUid && (
        <FeatureCreator
          requirementUid={row.requirementUid}
          backend={backend}
          onCreated={onFeatureCreated}
        />
      )}
      {strictdoc && (
        <Section title="子の要求" badge="StrictDoc">
          <Links
            items={strictdoc.children.map((c) => ({ uid: c.uid, key: c.key }))}
            onJump={onJump}
          />
        </Section>
      )}
      <Section title="この要求のFeature" badge="markharness">
        {row.features.length === 0 ? (
          <p>ありません。</p>
        ) : (
          <ul>
            {row.features.map((f) => (
              <li key={f.uid}>
                <button type="button" onClick={() => onPickFeature(f.uid)}>
                  {f.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="紐づくケース" badge="markharness">
        {row.cases.length === 0 ? (
          <p>紐づいていません。</p>
        ) : (
          <div className="case-boxes">
            {row.cases.map((c) => (
              <button
                type="button"
                key={c.caseUid}
                className="case-box"
                onClick={() => onPickCase(c.caseUid)}
              >
                <span className="case-box-title" title={c.title}>
                  {c.title}
                </span>
                <small className="belongs-to">{c.belongsTo}</small>
              </button>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
