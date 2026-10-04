// The terminal's file system is the real `content/home` folder in this repo.
// Add a file there and it shows up in `ls`, `cat`, `grep`, `find` and `tree`.
//
// Two naming rules, both using a leading underscore (bundlers skip real dotfiles):
//   _about      one line describing the directory it sits in; never listed
//   _anything   appears in the terminal as the hidden file `.anything`

export interface FileNode {
  type: 'file';
  name: string;
  content: string;
}

export interface DirNode {
  type: 'dir';
  name: string;
  about: string;
  children: Map<string, FsNode>;
}

export type FsNode = FileNode | DirNode;

export const HOME_PATH = '/home/katheu/mind-interface';
const ABOUT_FILE = '_about';

export function buildTree(files: Record<string, string>, prefix: string): DirNode {
  const root: DirNode = { type: 'dir', name: '~', about: '', children: new Map() };

  for (const [fullPath, content] of Object.entries(files)) {
    if (!fullPath.startsWith(prefix)) continue;
    const parts = fullPath.slice(prefix.length).split('/').filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) continue;

    let dir = root;
    for (const part of parts) {
      let next = dir.children.get(part);
      if (!next || next.type !== 'dir') {
        next = { type: 'dir', name: part, about: '', children: new Map() };
        dir.children.set(part, next);
      }
      dir = next;
    }

    if (fileName === ABOUT_FILE) {
      dir.about = content.trim();
      continue;
    }
    const name = fileName.startsWith('_') ? `.${fileName.slice(1)}` : fileName;
    dir.children.set(name, { type: 'file', name, content });
  }

  return root;
}

const contentFiles = import.meta.glob('/content/home/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export const root = buildTree(contentFiles, '/content/home/');

export function isHidden(name: string): boolean {
  return name.startsWith('.');
}

/** Children sorted directories-first, then alphabetically. */
export function listDir(dir: DirNode, showHidden = false): FsNode[] {
  return [...dir.children.values()]
    .filter(node => showHidden || !isHidden(node.name))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

function findChild(dir: DirNode, name: string): FsNode | undefined {
  const exact = dir.children.get(name);
  if (exact) return exact;
  const lower = name.toLowerCase();
  for (const child of dir.children.values()) {
    if (child.name.toLowerCase() === lower) return child;
  }
  return undefined;
}

export function getNode(segments: string[], from: DirNode = root): FsNode | null {
  let node: FsNode = from;
  for (const segment of segments) {
    if (node.type !== 'dir') return null;
    const next = findChild(node, segment);
    if (!next) return null;
    node = next;
  }
  return node;
}

/**
 * Turn what the visitor typed into canonical path segments relative to home.
 * Returns null when the path does not exist. `..` at home stays at home.
 */
export function resolvePath(cwd: string[], target: string): string[] | null {
  let input = target.trim();
  let segments = [...cwd];

  if (input.toLowerCase().startsWith(HOME_PATH)) input = `~${input.slice(HOME_PATH.length)}`;
  if (input === '~' || input.startsWith('~/') || input.startsWith('/')) {
    segments = [];
    input = input.replace(/^~?\/*/, '');
  }

  for (const part of input.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      segments.pop();
      continue;
    }
    const dir = getNode(segments);
    if (!dir || dir.type !== 'dir') return null;
    const child = findChild(dir, part);
    if (!child) return null;
    segments.push(child.name);
  }

  return segments;
}

/** `~/projects/moodforecast-ai`, the way a shell prompt shows it. */
export function displayPath(segments: string[]): string {
  return segments.length ? `~/${segments.join('/')}` : '~';
}

export function absolutePath(segments: string[]): string {
  return segments.length ? `${HOME_PATH}/${segments.join('/')}` : HOME_PATH;
}

/** One-line description: a directory's `.about`, or a file's first meaningful line. */
export function describe(node: FsNode): string {
  if (node.type === 'dir') return node.about;
  const firstLine = node.content.split('\n').find(line => /[A-Za-z0-9]/.test(line)) ?? '';
  return firstLine
    .trim()
    .replace(/^(#+|\/\/|\/\*+|<!--|"""|''')\s*/, '')
    .replace(/\s*(\*\/|-->|"""|''')$/, '')
    .trim();
}

export interface WalkEntry {
  node: FsNode;
  segments: string[];
}

/** Every visible node below `start`, depth-first. */
export function walk(start: string[], showHidden = false): WalkEntry[] {
  const out: WalkEntry[] = [];
  const visit = (segments: string[]) => {
    const node = getNode(segments);
    if (!node || node.type !== 'dir') return;
    for (const child of listDir(node, showHidden)) {
      const childSegments = [...segments, child.name];
      out.push({ node: child, segments: childSegments });
      if (child.type === 'dir') visit(childSegments);
    }
  };
  visit(start);
  return out;
}
