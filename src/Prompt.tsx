import type { ChangeEvent, KeyboardEvent, RefObject } from 'react';

interface PromptProps {
  path: string;
  /** Set while a command is waiting for an answer (e.g. whoami). */
  question: boolean;
  value: string;
  caret: number;
  ghost: string;
  placeholder: string;
  focused: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onCaret: (caret: number) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onFocusChange: (focused: boolean) => void;
}

export function Ps1({ path, question }: { path: string; question: boolean }) {
  if (question) return <span className="ps1 accent">?</span>;
  return (
    <span className="ps1">
      <span className="ps1-host">
        <span className="accent">visitor@katheu</span>
        <span className="dim">:</span>
      </span>
      <span className="accent2">{path}</span>
      <span className="dim">$</span>
    </span>
  );
}

/**
 * The line being typed. A real <input> takes the keystrokes (so mobile
 * keyboards, paste and IMEs work) but stays invisible; what you see is a
 * mirror of its value with a terminal-style block cursor at the caret.
 */
export function Prompt(props: PromptProps) {
  const { value, caret, ghost, focused, inputRef } = props;
  const atEnd = caret >= value.length;
  const syncCaret = (event: { currentTarget: HTMLInputElement }) =>
    props.onCaret(event.currentTarget.selectionStart ?? event.currentTarget.value.length);

  return (
    <div className="prompt-line">
      <Ps1 path={props.path} question={props.question} />
      <span className="typed">
        {value.slice(0, caret)}
        <span
          // Re-keying restarts the blink, so the cursor stays solid while typing.
          key={`${value}:${caret}`}
          className={focused ? 'cursor blink' : 'cursor hollow'}
        >
          {atEnd ? ' ' : value[caret]}
        </span>
        {atEnd ? null : value.slice(caret + 1)}
        {atEnd && ghost ? <span className="ghost">{ghost}</span> : null}
        {!value && !ghost && props.placeholder ? <span className="ghost">{props.placeholder}</span> : null}
      </span>
      <input
        ref={inputRef}
        className="real-input"
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          props.onChange(event.target.value);
          syncCaret(event);
        }}
        onKeyDown={props.onKeyDown}
        onKeyUp={syncCaret}
        onSelect={syncCaret}
        onFocus={() => props.onFocusChange(true)}
        onBlur={() => props.onFocusChange(false)}
        aria-label="terminal input — type help and press Enter"
        autoFocus
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
      />
    </div>
  );
}
