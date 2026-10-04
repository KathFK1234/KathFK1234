import { commandNames, findCommand } from './commands';
import { getNode, isHidden, listDir, resolvePath } from './fs';

export interface Completion {
  /** Full replacement input lines, one per candidate. */
  lines: string[];
  /** What to show for each candidate (just the completed word). */
  labels: string[];
}

function completePath(cwd: string[], partial: string, dirsOnly: boolean): string[] {
  const slash = partial.lastIndexOf('/');
  const dirPart = slash >= 0 ? partial.slice(0, slash + 1) : '';
  const namePart = partial.slice(slash + 1).toLowerCase();

  const segments = resolvePath(cwd, dirPart || '.');
  const dir = segments && getNode(segments);
  if (!dir || dir.type !== 'dir') return [];

  return listDir(dir, isHidden(namePart))
    .filter(node => node.name.toLowerCase().startsWith(namePart))
    .filter(node => !dirsOnly || node.type === 'dir')
    .map(node => `${dirPart}${node.name}${node.type === 'dir' ? '/' : ''}`);
}

export function complete(input: string, cwd: string[]): Completion {
  const text = input.replace(/^\s+/, '');
  const space = text.indexOf(' ');

  if (space < 0) {
    const names = commandNames(false).filter(name => name.startsWith(text.toLowerCase()));
    const pool = names.length ? names : commandNames().filter(name => name.startsWith(text.toLowerCase()));
    return { lines: pool.map(name => `${name} `), labels: pool };
  }

  const commandText = text.slice(0, space);
  const lastSpace = text.lastIndexOf(' ');
  const head = text.slice(0, lastSpace + 1);
  const partial = text.slice(lastSpace + 1);
  const spec = findCommand(commandText.toLowerCase())?.completes ?? 'paths';

  let words: string[];
  if (spec === 'commands') words = commandNames().filter(name => name.startsWith(partial.toLowerCase()));
  else if (spec === 'dirs' || spec === 'paths') words = completePath(cwd, partial, spec === 'dirs');
  else {
    words = spec.filter(word => word.startsWith(partial.toLowerCase()));
    if (!words.length) words = completePath(cwd, partial, false);
  }

  return { lines: words.map(word => `${head}${word}`), labels: words };
}

export function commonPrefix(values: string[]): string {
  if (!values.length) return '';
  let prefix = values[0];
  for (const value of values.slice(1)) {
    while (!value.toLowerCase().startsWith(prefix.toLowerCase())) prefix = prefix.slice(0, -1);
  }
  return prefix;
}

/** Fish-style suggestion: the rest of the most recent matching history line, or a command name. */
export function ghostFor(input: string, history: string[]): string {
  if (!input.trim()) return '';
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].startsWith(input) && history[i].length > input.length) return history[i].slice(input.length);
  }
  if (input.includes(' ')) return '';
  const name = commandNames(false).find(candidate => candidate.startsWith(input.toLowerCase()));
  return name && name.length > input.length ? name.slice(input.length) : '';
}
