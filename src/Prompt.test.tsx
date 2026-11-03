import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Prompt } from './Prompt';

const markup = (value: string, ghost = '', placeholder = '', question = false) =>
  renderToStaticMarkup(
    <Prompt
      path="~"
      question={question}
      value={value}
      caret={value.length}
      ghost={ghost}
      placeholder={placeholder}
      focused
      inputRef={createRef<HTMLInputElement>()}
      onChange={() => {}}
      onCaret={() => {}}
      onKeyDown={() => {}}
      onFocusChange={() => {}}
    />,
  );

describe('Prompt', () => {
  it('hides the visible copy of the line from screen readers, which read the input', () => {
    for (const html of [markup('cat READ', 'ME.md'), markup('', '', 'type help')]) {
      expect(html).toMatch(/<span class="typed" aria-hidden="true">/);
      expect(html).toMatch(/<input[^>]*aria-label="terminal input/);
    }
  });

  it('says in the label when a command is waiting for an answer', () => {
    expect(markup('')).toMatch(/aria-label="terminal input — type help and press Enter"/);
    expect(markup('', '', '', true)).toMatch(/aria-label="your answer to the question above — type it and press Enter"/);
  });
});
