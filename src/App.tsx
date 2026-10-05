import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { applyPrefs, loadHistory, loadPrefs, saveHistory, savePrefs, type Prefs } from './prefs';
import { Prompt, Ps1 } from './Prompt';
import { Banner, createShellState, execute, type Ctx } from './shell/commands';
import { commonPrefix, complete, ghostFor } from './shell/complete';
import { displayPath } from './shell/fs';
import { RunContext } from './shell/ui';

type Entry =
  | { id: number; kind: 'echo'; path: string; question: boolean; text: string }
  | { id: number; kind: 'out'; node: ReactNode; from?: number };

interface TabMenu {
  lines: string[];
  labels: string[];
  active: number;
}

const NAV = ['about', 'projects', 'skills', 'resume', 'contact', 'help'];

let nextId = 0;
const bootEntries = (): Entry[] => [{ id: nextId++, kind: 'out', node: <Banner /> }];

export default function App() {
  const shell = useRef(createShellState(loadHistory())).current;
  const [entries, setEntries] = useState<Entry[]>(bootEntries);
  const [value, setValue] = useState('');
  const [caret, setCaret] = useState(0);
  const [focused, setFocused] = useState(false);
  const [menu, setMenu] = useState<TabMenu | null>(null);
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs);
  const [touched, setTouched] = useState(false);

  const prefsRef = useRef(prefs);
  const historyIndex = useRef<number | null>(null);
  const draft = useRef('');
  const inputRef = useRef<HTMLInputElement>(null);
  const termRef = useRef<HTMLDivElement>(null);
  const lastEcho = useRef<HTMLDivElement>(null);

  useEffect(() => applyPrefs(prefs), [prefs]);

  // autoFocus can land before the focus listener is attached, so sync once on mount.
  useEffect(() => {
    setFocused(document.activeElement === inputRef.current && document.hasFocus());
  }, []);

  const setPrefs = useCallback((next: Partial<Prefs>) => {
    prefsRef.current = { ...prefsRef.current, ...next };
    savePrefs(prefsRef.current);
    setPrefsState(prefsRef.current);
  }, []);

  const setInput = useCallback((next: string) => {
    setValue(next);
    setCaret(next.length);
    // Keep the hidden input's own caret in step with the mirrored one. Measured when the
    // frame arrives, so a key pressed in between is not left stranded after the caret.
    requestAnimationFrame(() => {
      const input = inputRef.current;
      input?.setSelectionRange(input.value.length, input.value.length);
    });
  }, []);

  // Output goes under the command that produced it, even if that command was slow
  // (a network call) and the visitor has run others since.
  const printUnder = useCallback((echoId: number, node: ReactNode) => {
    setEntries(current => {
      const entry: Entry = { id: nextId++, kind: 'out', node, from: echoId };
      let at = current.findIndex(other => other.id === echoId);
      if (at < 0) return [...current, entry];
      while (at + 1 < current.length && current[at + 1].kind === 'out' && (current[at + 1] as { from?: number }).from === echoId) at++;
      return [...current.slice(0, at + 1), entry, ...current.slice(at + 1)];
    });
  }, []);

  const run = useCallback(
    async (line: string) => {
      const text = line.trim();
      setMenu(null);
      setInput('');
      historyIndex.current = null;
      setTouched(true);
      // Built now, not inside the updater: the command below may change cwd.
      const echo: Entry = {
        id: nextId++,
        kind: 'echo',
        path: displayPath(shell.cwd),
        question: shell.mode !== null,
        text,
      };
      setEntries(current => [...current, echo]);
      if (!text) return;

      if (shell.mode === null && shell.history[shell.history.length - 1] !== text) {
        shell.history.push(text);
      }

      const ctx: Ctx = {
        state: shell,
        print: node => printUnder(echo.id, node),
        clear: () => setEntries([]),
        prefs: prefsRef.current,
        setPrefs,
      };
      await execute(text, ctx);
      saveHistory(shell.history);
      // cwd and mode live on the mutable shell object; re-render the prompt.
      setEntries(current => [...current]);
    },
    [printUnder, setInput, setPrefs, shell],
  );

  // After each change, keep the newest command in view: scroll to the bottom,
  // unless the output is taller than the screen — then start at its first line.
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    const echo = lastEcho.current;
    const outputHeight = echo ? term.scrollHeight - echo.offsetTop : 0;
    term.scrollTop = echo && outputHeight > term.clientHeight ? echo.offsetTop - 12 : term.scrollHeight;
  }, [entries]);

  // Tab suggestions appear under the prompt, so always show the bottom for them,
  // even when the last output is long and the view was left at its first line.
  useEffect(() => {
    const term = termRef.current;
    if (term && menu) term.scrollTop = term.scrollHeight;
  }, [menu]);

  // Shareable links: ?cmd=projects runs a command on load.
  const ranDeepLink = useRef(false);
  useEffect(() => {
    if (ranDeepLink.current) return;
    ranDeepLink.current = true;
    const command = new URLSearchParams(window.location.search).get('cmd');
    if (command) void run(command.slice(0, 200));
  }, [run]);

  // Typing anywhere, or clicking empty space, lands in the prompt —
  // but never steals a text selection someone is trying to copy.
  useEffect(() => {
    const focusInput = () => inputRef.current?.focus({ preventScroll: true });
    const onClick = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest('a, button')) return;
      if (window.getSelection()?.toString()) return;
      focusInput();
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      // Leave Enter and Space alone on a focused button or link, so they still activate it.
      if ((event.target as HTMLElement).closest?.('a, button')) return;
      if (document.activeElement !== inputRef.current) focusInput();
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const onTab = () => {
    if (menu && menu.lines.length > 1) {
      const active = (menu.active + 1) % menu.lines.length;
      setMenu({ ...menu, active });
      setInput(menu.lines[active]);
      return;
    }
    const { lines, labels } = complete(value, shell.cwd);
    if (!lines.length) return;
    if (lines.length === 1) {
      setInput(lines[0]);
      return;
    }
    const prefix = commonPrefix(lines);
    if (prefix.length > value.length) setInput(prefix);
    setMenu({ lines, labels, active: -1 });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const { key } = event;

    if (key === 'Tab') {
      event.preventDefault();
      onTab();
      return;
    }
    if (key !== 'Shift') setMenu(null);

    if (key === 'Enter') {
      event.preventDefault();
      void run(value);
    } else if (key === 'ArrowUp' || key === 'ArrowDown') {
      event.preventDefault();
      const { history } = shell;
      if (!history.length) return;
      // Down with nothing recalled would otherwise wipe what is being typed.
      if (historyIndex.current === null && key === 'ArrowDown') return;
      if (historyIndex.current === null) draft.current = value;
      const current = historyIndex.current ?? history.length;
      const next = Math.min(history.length, Math.max(0, current + (key === 'ArrowUp' ? -1 : 1)));
      historyIndex.current = next === history.length ? null : next;
      // Stepping back past the newest entry restores the unfinished line.
      setInput(history[next] ?? draft.current);
    } else if (key === 'ArrowRight' && caret >= value.length && ghost) {
      event.preventDefault();
      setInput(value + ghost);
    } else if (event.ctrlKey && key.toLowerCase() === 'l') {
      event.preventDefault();
      setEntries([]);
    } else if (event.ctrlKey && key.toLowerCase() === 'u') {
      event.preventDefault();
      setInput('');
    } else if (event.ctrlKey && key.toLowerCase() === 'c' && !window.getSelection()?.toString()) {
      event.preventDefault();
      const echo: Entry = {
        id: nextId++,
        kind: 'echo',
        path: displayPath(shell.cwd),
        question: shell.mode !== null,
        text: `${value}^C`,
      };
      setEntries(current => [...current, echo]);
      shell.mode = null;
      setInput('');
    }
  };

  const ghost = useMemo(
    () => (shell.mode === null && !menu ? ghostFor(value, shell.history) : ''),
    // `entries` changes whenever a command runs, which is when history changes.
    [value, menu, shell, entries],
  );
  const path = displayPath(shell.cwd);
  const lastEchoId = [...entries].reverse().find(entry => entry.kind === 'echo')?.id;

  return (
    <RunContext.Provider value={run}>
      <header className="statusbar">
        <div className="status-title">
          <span className="dot" />
          <span>
            katheu kilonzo<span className="status-path"> — {path}</span>
          </span>
        </div>
        <nav className="navlinks" aria-label="shortcuts">
          {NAV.map(command => (
            <button key={command} type="button" onClick={() => void run(command)}>
              {command}
            </button>
          ))}
        </nav>
      </header>

      <main className="terminal" ref={termRef}>
        <div role="log" aria-live="polite">
          {entries.map(entry =>
            entry.kind === 'echo' ? (
              <div key={entry.id} className="prompt-line" ref={entry.id === lastEchoId ? lastEcho : undefined}>
                <Ps1 path={entry.path} question={entry.question} />
                <span className="typed">{entry.text}</span>
              </div>
            ) : (
              <div key={entry.id} className="output">
                {entry.node}
              </div>
            ),
          )}
        </div>

        <Prompt
          path={path}
          question={shell.mode !== null}
          value={value}
          caret={caret}
          ghost={ghost}
          placeholder={touched ? '' : 'type help'}
          focused={focused}
          inputRef={inputRef}
          onChange={next => {
            setValue(next);
            setMenu(null);
            historyIndex.current = null;
          }}
          onCaret={setCaret}
          onKeyDown={onKeyDown}
          onFocusChange={setFocused}
        />

        {menu ? (
          <div className="tab-menu">
            {menu.labels.map((label, index) => (
              <button
                key={label}
                type="button"
                className={index === menu.active ? 'active' : undefined}
                onClick={() => {
                  setInput(menu.lines[index]);
                  setMenu(null);
                  inputRef.current?.focus();
                }}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </main>
    </RunContext.Provider>
  );
}
