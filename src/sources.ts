/** The name of the source that holds a requirement's content. */
export function sourceName(source: "native" | "external"): string {
  return source === "external" ? "StrictDoc" : "markharness";
}
