import type { KeyboardEvent } from "react";

/**
 * Enter in a one-line field would submit the form, and so save. Nothing is saved or added on Enter;
 * the buttons do that. A field of several lines keeps its line break, and a button keeps its press.
 */
export function ignoreEnterInOneLineFields(e: KeyboardEvent) {
  if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
    e.preventDefault();
  }
}
