def rw(p, fn):
    s = open(p, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in s else '\n'
    s = s.replace('\r\n', '\n')
    s = fn(s)
    open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', nl))


def sub(s, a, b):
    assert a in s, a
    return s.replace(a, b, 1)


def form(s):
    s = sub(s, 'import { ignoreEnterInOneLineFields } from "./ignoreEnter";', 'import type { NamedProcedure } from "./edit";\nimport { ignoreEnterInOneLineFields } from "./ignoreEnter";\nimport { ProceduresFields } from "./ProceduresFields";')
    s = sub(s, '    /** Given only for an element that has an implementation note. */\n    implementationNote?: string | null;\n  };', '    /** Given only for an element that has an implementation note. */\n    implementationNote?: string | null;\n    /** Given only for an element that declares common procedures, by name. */\n    procedures?: Record<string, { steps: string[] }>;\n  };')
    s = sub(s, '    description?: string;\n    implementationNote?: string;\n  }) => Promise<void>;', '    description?: string;\n    implementationNote?: string;\n    procedures?: NamedProcedure[];\n  }) => Promise<void>;')
    s = sub(s, '  const [error, setError] = useState<string>();\n  const [candidates', '  const [error, setError] = useState<string>();\n  const [procedures, setProcedures] = useState<NamedProcedure[]>([]);\n  const [candidates')
    s = sub(s, '          ...(element.implementationNote !== undefined && {\n            implementationNote,\n          }),\n        })', '          ...(element.implementationNote !== undefined && {\n            implementationNote,\n          }),\n          ...(element.procedures !== undefined && { procedures }),\n        })')
    s = sub(s, '      <fieldset\n        aria-label={`${noun}の保存とキャンセル`}', '''      {element.procedures !== undefined && (
        <>
          <h4>共通手順</h4>
          <ProceduresFields
            procedures={element.procedures}
            onChange={setProcedures}
          />
        </>
      )}
      <fieldset
        aria-label={`${noun}の保存とキャンセル`}''')
    return s


rw('src/ElementEditForm.tsx', form)


def editor(s):
    s = sub(s, '  implementationNote?: string | null;\n}', '  implementationNote?: string | null;\n  procedures?: Record<string, { steps: string[] }>;\n}')
    s = sub(s, '  implementationNote?: string;\n}', '  implementationNote?: string;\n  procedures?: NamedProcedure[];\n}')
    s = sub(s, 'import type { Edit } from "./edit";', 'import type { Edit, NamedProcedure } from "./edit";')
    s = sub(s, '          ...(detail.implementationNote !== undefined && {\n            implementationNote: detail.implementationNote,\n          }),', '          ...(detail.implementationNote !== undefined && {\n            implementationNote: detail.implementationNote,\n          }),\n          ...(detail.procedures !== undefined && {\n            procedures: detail.procedures,\n          }),')
    return s


rw('src/ElementEditor.tsx', editor)


def creator(s):
    s = sub(s, '  withDescription = false,\n', '  withDescription = false,\n  withProcedures = false,\n')
    s = sub(s, '  withDescription?: boolean;\n', '  withDescription?: boolean;\n  /** Whether the form asks for common procedures, for an element that declares them. */\n  withProcedures?: boolean;\n')
    s = sub(s, '          ...(withDescription && { description: "" }),', '          ...(withDescription && { description: "" }),\n          ...(withProcedures && { procedures: {} }),')
    return s


rw('src/ElementCreator.tsx', creator)
