import type { ReactNode } from "react";

/** A heading naming what the facts below are, followed by the source that reports them. */
export function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3>
        {title}
        <small className="badge">{badge}</small>
      </h3>
      {children}
    </section>
  );
}

/** One element of the traceability: what kind it is, who reports it, its title and id. */
export function ElementHeading({
  kind,
  source,
  title,
  id,
  level = 3,
}: {
  kind: string;
  source: string;
  title: string;
  id: string;
  level?: 2 | 3;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div className="element">
      <small className="kind">{kind}</small>
      <small className="badge">{source}</small>
      <Heading>{title}</Heading>
      <span className="id">{id}</span>
    </div>
  );
}

/** A box around one element and the facts about it; the picked element's box stands out. */
export function Card({
  selected,
  children,
}: {
  selected?: boolean;
  children: ReactNode;
}) {
  return <div className={selected ? "card selected" : "card"}>{children}</div>;
}
