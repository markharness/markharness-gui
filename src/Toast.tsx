/** A notice in the corner that leaves the rest of the screen usable. */
export function Toast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div role="status">
      <pre>{message}</pre>
      <button type="button" onClick={onDismiss}>
        閉じる
      </button>
    </div>
  );
}
