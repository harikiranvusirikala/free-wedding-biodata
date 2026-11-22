/** A small spinner in the text's colour, for a button or a line whose job is running (hidden from screen readers: say what is happening in words beside it). */
export function Spinner({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none ${className}`} />;
}
