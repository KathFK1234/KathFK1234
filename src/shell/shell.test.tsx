import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS } from '../prefs';
import { commandNames, commands, createShellState, execute, tokenize, type Ctx } from './commands';
import { commonPrefix, complete, ghostFor } from './complete';
import { buildTree, describe as describeNode, displayPath, getNode, resolvePath, root, walk } from './fs';

function shell() {
  const printed: ReactNode[] = [];
  let cleared = 0;
  const ctx: Ctx = {
    state: createShellState(),
    print: node => printed.push(node),
    clear: () => cleared++,
    prefs: { ...DEFAULT_PREFS },
    setPrefs: next => Object.assign(ctx.prefs, next),
  };
  const run = async (line: string) => {
    printed.length = 0;
    await execute(line, ctx);
    return renderToStaticMarkup(<>{printed}</>).replace(/<[^>]+>/g, '');
  };
  return { ctx, run, cleared: () => cleared };
}

describe('file system', () => {
  it('loads the content folder, including directory descriptions', () => {
    const projects = getNode(['projects']);
    expect(projects?.type).toBe('dir');
    expect(describeNode(projects!)).toMatch(/product, backend/);
    expect(getNode(['.secrets'])?.type).toBe('file');
  });

  it('gives every directory a description and at least one visible entry', () => {
    const dirs = walk([]).filter(entry => entry.node.type === 'dir');
    expect(dirs.length).toBeGreaterThan(20);
    for (const { node, segments } of dirs) {
      expect(describeNode(node), segments.join('/')).not.toBe('');
      expect(walk(segments).length, segments.join('/')).toBeGreaterThan(0);
    }
  });

  it('resolves relative, absolute, home and parent paths', () => {
    expect(resolvePath([], 'projects/moodforecast-ai')).toEqual(['projects', 'moodforecast-ai']);
    expect(resolvePath(['projects'], '../notes')).toEqual(['notes']);
    expect(resolvePath(['projects'], '~/research')).toEqual(['research']);
    expect(resolvePath(['projects'], '/home/katheu/notes')).toEqual(['notes']);
    expect(resolvePath([], '../..')).toEqual([]);
    expect(resolvePath([], 'PROJECTS/')).toEqual(['projects']);
    expect(resolvePath([], 'nope')).toBeNull();
  });

  it('keeps same-named folders apart', () => {
    // `research` exists at the top level and inside mindconnect.
    expect(resolvePath(['projects', 'mindconnect'], 'research')).toEqual(['projects', 'mindconnect', 'research']);
    expect(resolvePath([], 'research')).toEqual(['research']);
  });

  it('builds a tree from a flat file map', () => {
    const tree = buildTree({ '/x/a/_about': 'alpha\n', '/x/a/b.md': '# Bee\n', '/x/_plan': 'shh' }, '/x/');
    const a = tree.children.get('a')!;
    expect(describeNode(a)).toBe('alpha');
    expect(describeNode(getNode(['a', 'b.md'], tree)!)).toBe('Bee');
    expect(displayPath(['a'])).toBe('~/a');
    expect(getNode(['a', '_about'], tree)).toBeNull();
    expect(tree.children.get('.plan')?.type).toBe('file');
    expect(root.type).toBe('dir');
  });
});

describe('commands', () => {
  it('has unique names and aliases', () => {
    const all = commands.flatMap(command => [command.name, ...(command.aliases ?? [])]);
    expect(new Set(all).size).toBe(all.length);
  });

  it('runs every argument-free command without throwing', async () => {
    const { run } = shell();
    for (const name of commandNames().filter(name => name !== 'mood')) {
      const out = await run(name);
      expect(out, name).not.toMatch(/something went wrong/);
    }
  });

  it('navigates with cd and reports the right place', async () => {
    const { ctx, run } = shell();
    await run('cd projects/moodforecast-ai');
    expect(await run('pwd')).toBe('/home/katheu/projects/moodforecast-ai');
    expect(await run('ls')).toMatch(/backend\/.*data\/.*frontend\//s);
    await run('cd ..');
    expect(ctx.state.cwd).toEqual(['projects']);
    await run('cd -');
    expect(ctx.state.cwd).toEqual(['projects', 'moodforecast-ai']);
    await run('cd');
    expect(ctx.state.cwd).toEqual([]);
    expect(await run('cd ..')).toMatch(/already at home/);
  });

  it('refuses to cd into files or missing paths', async () => {
    const { ctx, run } = shell();
    expect(await run('cd README.md')).toMatch(/Not a directory/);
    expect(await run('cd nowhere')).toMatch(/No such file or directory/);
    expect(ctx.state.cwd).toEqual([]);
  });

  it('reads files with cat, head, tail and wc', async () => {
    const { run } = shell();
    expect(await run('cat README.md')).toMatch(/Katheu Kilonzo/);
    expect(await run('cat')).toMatch(/I love cats/);
    expect(await run('cat projects')).toMatch(/Is a directory/);
    expect(await run('cat /etc/passwd')).toMatch(/Permission denied/);
    expect((await run('head -n 1 README.md')).trim().split('\n')).toHaveLength(1);
    expect((await run('tail -2 contact.txt')).trim()).toMatch(/Email is the fastest route/);
    expect(await run('wc contact.txt')).toMatch(/contact\.txt$/);
  });

  it('searches real file contents and names', async () => {
    const { run } = shell();
    expect(await run('grep friction')).toMatch(/\.\/notes\/systems-thinking\/friction\.md:\d+:/);
    expect(await run('grep zzzznotthere')).toMatch(/no matches/);
    expect(await run('find mood')).toMatch(/\.\/projects\/moodforecast-ai/);
    expect(await run('find . -name "*.py"')).toMatch(/main\.py/);
    expect(await run('tree projects')).toMatch(/\d+ directories, \d+ files/);
  });

  it('hides dotfiles unless asked', async () => {
    const { run } = shell();
    expect(await run('ls')).not.toMatch(/\.secrets/);
    expect(await run('ls -a')).toMatch(/\.secrets/);
    expect(await run('ls -la')).toMatch(/drwxr-xr-x/);
  });

  it('handles the interactive whoami question', async () => {
    const { ctx, run } = shell();
    await run('whoami');
    expect(ctx.state.mode).toBe('whoami');
    expect(await run('1')).toMatch(/hiring profile/);
    expect(ctx.state.mode).toBeNull();
    // Running a command while the question is open cancels it.
    await run('whoami');
    expect(await run('pwd')).toBe('/home/katheu');
    expect(ctx.state.mode).toBeNull();
  });

  it('keeps the legacy two-word commands and is case-insensitive', async () => {
    const { run } = shell();
    expect(await run('sudo hire-me')).toMatch(/access granted/);
    expect(await run('SUDO HIRE-ME')).toMatch(/access granted/);
    expect(await run('git status')).toMatch(/On branch main/);
    expect(await run('ABOUT')).toMatch(/Katheu Kilonzo/);
  });

  it('suggests a close match for typos and documents every command', async () => {
    const { run } = shell();
    expect(await run('abuot')).toMatch(/did you mean about/);
    for (const name of commandNames()) expect(await run(`man ${name}`), name).toMatch(/NAME/);
  });

  it('changes preferences, clears, and expands variables', async () => {
    const { ctx, run, cleared } = shell();
    await run('theme amber');
    expect(ctx.prefs.theme).toBe('amber');
    expect(await run('theme nope')).toMatch(/unknown theme/);
    await run('font vt323');
    expect(ctx.prefs.font).toBe('vt323');
    await run('clear');
    expect(cleared()).toBe(1);
    expect(await run('echo hi $USER')).toBe('hi visitor');
  });

  it('shows languages and tools from the generated data file', async () => {
    const { run } = shell();
    const stack = await run('stack');
    expect(stack).toMatch(/Python/);
    expect(stack).toMatch(/\d+%/);
    expect(stack).toMatch(/FastAPI/);
    // Hand-written skills stay; anything new from GitHub is appended once.
    const skills = await run('skills');
    expect(skills).toMatch(/Python, JavaScript, HTML, CSS, C, Shell/);
    expect(skills.match(/FastAPI/g)).toHaveLength(1);
    // Detected tools join the row for their category instead of a catch-all.
    expect(skills).toMatch(/frontend.*React, Vite/);
    expect(skills).toMatch(/backend.*PostgreSQL.*SQLAlchemy/);
    expect(skills).not.toMatch(/also on github/);
  });

  it('tokenizes quoted arguments', () => {
    expect(tokenize(`grep "two words" 'x y' z`)).toEqual(['grep', 'two words', 'x y', 'z']);
  });
});

describe('completion', () => {
  it('completes command names', () => {
    expect(complete('proj', []).lines).toEqual(['projects ']);
    expect(complete('p', []).labels).toEqual(expect.arrayContaining(['projects', 'psychology', 'pwd']));
  });

  it('completes paths relative to the current directory', () => {
    expect(complete('cd pro', []).lines).toEqual(['cd projects/']);
    expect(complete('cd projects/m', []).labels).toEqual([
      'projects/mindconnect/',
      'projects/moodforecast-ai/',
      'projects/murengeti-lab/',
    ]);
    expect(complete('cat READ', []).lines).toEqual(['cat README.md']);
    expect(complete('cd READ', []).lines).toEqual([]);
    expect(complete('ls ', ['projects']).labels).toContain('chema-backend/');
  });

  it('completes command-specific arguments', () => {
    expect(complete('theme a', []).lines).toEqual(['theme amber']);
    expect(complete('man fort', []).lines).toEqual(['man fortune']);
    expect(complete('open li', []).lines).toEqual(['open linkedin']);
  });

  it('finds the shared prefix and a ghost suggestion', () => {
    expect(commonPrefix(['cd projects/mindconnect/', 'cd projects/moodforecast-ai/'])).toBe('cd projects/m');
    expect(ghostFor('ab', [])).toBe('out');
    expect(ghostFor('cat R', ['cat README.md'])).toBe('EADME.md');
    expect(ghostFor('', ['x'])).toBe('');
  });
});
