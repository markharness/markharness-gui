import { useEffect, useState } from "react";
import type { Backend, Traceability } from "./backend";
import { type FeatureNode, buildRelationTree } from "./relations";

function FeatureItem({ node }: { node: FeatureNode }) {
  const { feature, behaviors } = node;
  return (
    <li>
      {feature.label ?? feature.feature_id}
      <ul>
        {behaviors.map(({ behavior, scenarios }) => (
          <li key={behavior.behavior_uid}>
            {behavior.label ?? behavior.behavior_id}
            <ul>
              {scenarios.map(({ scenario, extraRequirements, testCases }) => (
                <li key={scenario.scenario_uid}>
                  {scenario.label ?? scenario.scenario_id}
                  {extraRequirements.map((r) => (
                    <span key={r.requirement_uid}>
                      要求: {r.label ?? r.requirement_id}
                    </span>
                  ))}
                  <ul>
                    {testCases.map((c) => (
                      <li key={c.case_uid}>{c.case_id}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </li>
  );
}

export function App({ backend }: { backend: Backend }) {
  const [projectRoot, setProjectRoot] = useState<string>();
  const [traceability, setTraceability] = useState<Traceability>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    Promise.all([backend.getProjectRoot(), backend.getTraceability()]).then(
      ([root, t]) => {
        setProjectRoot(root);
        setTraceability(t);
      },
      (e) => setError(String(e)),
    );
  }, [backend]);

  if (error) return <pre role="alert">{error}</pre>;
  if (!projectRoot || !traceability) return <p>読み込み中…</p>;

  const { requirements, featuresWithoutRequirement } =
    buildRelationTree(traceability);
  return (
    <main>
      <p>{projectRoot}</p>
      <ul>
        {requirements.map(({ requirement, features }) => (
          <li key={requirement.requirement_uid}>
            {requirement.label ?? requirement.requirement_id}
            <ul>
              {features.map((node) => (
                <FeatureItem key={node.feature.feature_uid} node={node} />
              ))}
            </ul>
          </li>
        ))}
        {featuresWithoutRequirement.length > 0 && (
          <li>
            要求に紐づかない
            <ul>
              {featuresWithoutRequirement.map((node) => (
                <FeatureItem key={node.feature.feature_uid} node={node} />
              ))}
            </ul>
          </li>
        )}
      </ul>
    </main>
  );
}
