import { useEffect, useRef, useState, type InputHTMLAttributes, type KeyboardEvent } from 'react';

type DebouncedInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  /** The committed value, owned by the parent (here: the URL). */
  value: string;
  /** Called with the typed text once typing pauses, or at once on Enter. */
  onCommit: (value: string) => void;
  delayMs?: number;
};

/**
 * A text input that reports its value only after typing pauses, so a search
 * box does not fire a request per keystroke. It still follows the parent's
 * value when that changes from outside (a "Clear filters" button, the back button).
 */
export function DebouncedInput({ value, onCommit, delayMs = 300, ...rest }: DebouncedInputProps) {
  const [text, setText] = useState(value);
  const [seenValue, setSeenValue] = useState(value);
  const [committed, setCommitted] = useState(value);
  const timer = useRef<number | undefined>(undefined);

  // The parent's value changed. If that was not the echo of our own commit,
  // show the new value.
  if (value !== seenValue) {
    setSeenValue(value);
    if (value !== committed) setText(value);
  }

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function commit(next: string) {
    window.clearTimeout(timer.current);
    setCommitted(next.trim());
    onCommit(next);
  }

  function change(next: string) {
    setText(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => commit(next), delayMs);
  }

  function commitOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') commit(text);
  }

  return (
    <input
      {...rest}
      value={text}
      onChange={(event) => change(event.target.value)}
      onKeyDown={commitOnEnter}
    />
  );
}
