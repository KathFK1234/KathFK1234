// Building blocks for command output.
import { createContext, Fragment, useContext, type ReactNode } from 'react';

/** Lets any command name in the output run itself when clicked or tapped. */
export const RunContext = createContext<(line: string) => void>(() => {});

export function Cmd({ children, run }: { children: string; run?: string }) {
  const runLine = useContext(RunContext);
  return (
    <button type="button" className="cmd" onClick={() => runLine(run ?? children)}>
      {children}
    </button>
  );
}

export function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="link" href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

export function Rows({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <div className="rows">
      {rows.map(([left, right], index) => (
        <Fragment key={index}>
          <span>{left}</span>
          <span>{right}</span>
        </Fragment>
      ))}
    </div>
  );
}

export const Accent = ({ children }: { children: ReactNode }) => <span className="accent">{children}</span>;
export const Accent2 = ({ children }: { children: ReactNode }) => <span className="accent2">{children}</span>;
export const Dim = ({ children }: { children: ReactNode }) => <span className="dim">{children}</span>;
export const Warn = ({ children }: { children: ReactNode }) => <span className="warn">{children}</span>;
