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
        {title} <small>{badge}</small>
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
    <div>
      <p>
        <small>{kind}</small> <small>{source}</small>
      </p>
      <Heading>{title}</Heading>
      <p>{id}</p>
    </div>
  );
}
