import type { Backend } from "./backend";
import {
  ElementEditor,
  type EditableDetail,
  type EditedValues,
} from "./ElementEditor";
import type { Edit } from "./edit";
import { Card, ElementHeading } from "./Section";

/** The feature or the behavior of a picked case, which turns into a form to edit it in place. */
export function ElementCard({
  noun,
  element,
  load,
  toEdit,
  backend,
  onEdited,
}: {
  noun: string;
  element: { title: string; id: string; label: string | null };
  load: () => Promise<EditableDetail>;
  toEdit: (values: EditedValues, detail: EditableDetail) => Edit;
  backend: Backend;
  onEdited: () => void;
}) {
  return (
    <Card>
      <ElementHeading
        kind={noun}
        source="markharness"
        title={element.title}
        id={element.id}
      />
      <ElementEditor
        noun={noun}
        label={element.label}
        load={load}
        toEdit={toEdit}
        backend={backend}
        onEdited={onEdited}
      />
    </Card>
  );
}
