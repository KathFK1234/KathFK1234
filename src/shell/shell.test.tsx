import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
    for (const name of commandNames()) {
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

/** Stands in for the MoodForecast AI service: answers each path from `routes`, 404 otherwise. */
function serve(routes: Record<string, unknown>) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    const path = decodeURIComponent(new URL(url).pathname + new URL(url).search);
    calls.push(path);
    const route = Object.keys(routes).find(key => key.toLowerCase() === path.toLowerCase());
    if (!route) return new Response(JSON.stringify({ detail: 'Not Found' }), { status: 404 });
    const body = routes[route];
    return new Response(JSON.stringify(body), { status: typeof body === 'string' ? 422 : 200 });
  });
  return calls;
}

const NAIROBI = {
  location: 'Nairobi, KE',
  weather: { temp_c: 24.3, feels_like_c: 25.5, condition: 'Mainly Clear', humidity: 48, wind_kph: 9.1, is_day: true },
  mood_score: 77,
  mood_label: 'Upbeat',
  baseline_score: 65,
  factors: [
    { label: 'Clear skies', delta: 15 },
    { label: 'Warm air', delta: -3 },
  ],
  energy_level: 'High',
  risk_level: 'Minimal',
  ai_summary: 'Mainly clear and 24°C in Nairobi, KE.',
  recommendations: ['Water the plants.'],
};

describe('mood', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks for a place instead of assuming one', async () => {
    const calls = serve({});
    const { run } = shell();
    const out = await run('mood');
    expect(out).toMatch(/It needs a place/);
    expect(out.match(/mood [a-z]/g)!.length).toBeGreaterThanOrEqual(5);
    expect(calls).toEqual([]);
  });

  it('shows the score, the reasons behind it and the weather', async () => {
    serve({ '/api/wellbeing/nairobi': NAIROBI });
    const { run } = shell();
    const out = await run('mood nairobi');
    expect(out).toMatch(/Nairobi, KE/);
    expect(out).toMatch(/77\/100 Upbeat/);
    expect(out).toMatch(/baseline 65 · Clear skies \+15 · Warm air −3/);
    expect(out).toMatch(/Mainly Clear, 24\.3°C, feels like 25\.5°C, humidity 48%, wind 9\.1 km\/h/);
    expect(out).toMatch(/• Water the plants\./);
  });

  it('nudges towards places not looked up yet', async () => {
    serve({ '/api/wellbeing/nairobi': NAIROBI });
    const { ctx, run } = shell();
    for (let i = 0; i < 10; i++) {
      const suggested = (await run('mood nairobi')).split('where next?')[1];
      expect(suggested).toMatch(/mood [a-z]/);
      expect(suggested).not.toMatch(/mood nairobi/);
    }
    expect(ctx.state.mood.seen).toContain('Nairobi, KE');
  });

  it("uses the service's own questions when it sends them", async () => {
    const curiosity = [{ question: 'Feeling the heat? See how chilly Nuuk is right now.', location: 'Nuuk' }];
    serve({ '/api/wellbeing/nairobi': { ...NAIROBI, curiosity } });
    const { run } = shell();
    expect(await run('mood nairobi')).toMatch(/See how chilly Nuuk is right now\. mood nuuk/);
  });

  it('picks a place for the visitor', async () => {
    const calls = serve({});
    const { run } = shell();
    await run('mood surprise');
    expect(calls[0]).toMatch(/^\/api\/wellbeing\/[A-Z]/);
  });

  it('keeps multi-word places together', async () => {
    const calls = serve({ '/api/wellbeing/cape town': { ...NAIROBI, location: 'Cape Town, ZA' } });
    const { run } = shell();
    expect(await run('mood cape town')).toMatch(/Cape Town, ZA/);
    expect(calls).toEqual(['/api/wellbeing/cape town']);
  });

  it('scores the week ahead day by day', async () => {
    const day = { condition: 'Rain Showers', temp_max_c: 24.5, temp_min_c: 16, sunrise: '06:17', sunset: '18:24' };
    const daily = [
      { ...day, date: '2026-10-05', precipitation_chance: 53, mood_score: 65, mood_label: 'Steady' },
      { ...day, date: '2026-10-06', condition: 'Clear', precipitation_chance: null, mood_score: 80, mood_label: 'Upbeat' },
    ];
    serve({ '/api/forecast/nairobi': { location: 'Nairobi, KE', daily } });
    const { run } = shell();
    const out = await run('mood week nairobi');
    expect(out).toMatch(/Mon 5 Oct.*65 Steady.*Rain Showers, 16–25°C, rain 53%/s);
    expect(out).toMatch(/Tue 6 Oct.*80 Upbeat.*Clear, 16–25°C(?!, rain)/s);
    expect(out).toMatch(/best day: Tue 6 Oct \(80, Upbeat\)/);
    expect(out).toMatch(/daylight today 06:17–18:24/);
    expect(out).toMatch(/mood week [a-z]/);
    expect(await run('mood week')).toMatch(/which place\?.*mood week [a-z]/s);
    expect(await run('mood forecast atlantis')).toMatch(/service is up/);
  });

  it('explains an unknown place, a failing service and no connection', async () => {
    serve({ '/api/wellbeing/atlantis': "Location 'atlantis' not found" });
    const { run } = shell();
    expect(await run('mood atlantis')).toMatch(/could not find a place called “atlantis”.*mood [a-z]/s);
    expect(await run('mood nairobi')).toMatch(/service is up.*HTTP 404/s);
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('fetch failed');
    });
    expect(await run('mood nairobi')).toMatch(/could not reach the MoodForecast AI service/);
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
