import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFS } from '../prefs';
import { commandNames, commands, createShellState, EXAMPLES, execute, tokenize, type Ctx } from './commands';
import { commonPrefix, complete, ghostFor } from './complete';
import { readEndpoints } from './mood';
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

  it('answers every listed command with something, even with no arguments', async () => {
    serve({});
    // Clicking a name in `help` runs it bare, so none of them may come back empty.
    for (const command of commands.filter(command => !command.hidden && command.name !== 'clear')) {
      const { run } = shell();
      expect((await run(command.name)).trim(), command.name).not.toBe('');
    }
    vi.unstubAllGlobals();
  });

  it('has a manual with working examples for every command', async () => {
    serve({});
    const { run } = shell();
    expect(await run('man')).toMatch(/What manual page do you want\?.*man [a-z]+.*man man.*help/s);
    expect(await run('man grpe')).toMatch(/No manual entry for grpe.*did you mean man grep\?/s);
    expect(await run('man zzzzzz')).not.toMatch(/did you mean/);
    expect(await run('man grep')).toMatch(/GREP\(1\).*NAME.*SYNOPSIS.*EXAMPLES.*grep psychology.*NOTES.*SEE ALSO.*man find/s);
    expect(await run('man languages')).toMatch(/STACK\(1\).*ALIASES\s+languages/s);

    for (const name of Object.keys(EXAMPLES)) expect(commandNames(), name).toContain(name);
    const broken = /something went wrong|command not found|No such file|missing|unknown|usage:|No manual entry/;
    for (const [name, examples] of Object.entries(EXAMPLES)) {
      const manual = await run(`man ${name}`);
      for (const example of examples) {
        expect(manual, name).toContain(example.replace(/"/g, '&quot;'));
        // Each from home, as a visitor clicking it would usually be.
        const fresh = shell();
        if (example === 'cd -' || example === 'cd ..') await fresh.run('cd projects');
        expect(await fresh.run(example), example).not.toMatch(broken);
      }
    }
    vi.unstubAllGlobals();
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
    expect(await run('cd')).toMatch(/home, sweet home.*cd projects/s);
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

/** Stands in for the MoodForecast AI service: answers each path from `routes`, 404 otherwise.
 *  Returns the paths asked for, leaving out the look at what the service offers. */
function serve(routes: Record<string, unknown>) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    const path = decodeURIComponent(new URL(url).pathname + new URL(url).search);
    if (path !== '/openapi.json') calls.push(path);
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
      const suggested = (await run('mood nairobi')).split('where next?')[1].split('more on')[0];
      expect(suggested).toMatch(/mood [a-z]/);
      // Nairobi may be one side of a comparison, never the place to go next.
      expect(suggested).not.toMatch(/(mood|week|vs) nairobi(?! vs)/);
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

  it('compares two places', async () => {
    const tokyo = {
      ...NAIROBI,
      location: 'Tokyo, JP',
      mood_score: 58,
      mood_label: 'Mellow',
      weather: { ...NAIROBI.weather, temp_c: 18.1, condition: 'Rain', is_day: false },
    };
    const calls = serve({ '/api/wellbeing/nairobi': NAIROBI, '/api/wellbeing/tokyo': tokyo });
    const { ctx, run } = shell();
    const out = await run('mood nairobi vs tokyo');
    expect(calls).toHaveLength(2);
    expect(out).toMatch(/Nairobi, KE.*Tokyo, JP/s);
    expect(out).toMatch(/77\/100 Upbeat.*58\/100 Mellow/s);
    expect(out).toMatch(/Nairobi is having the better day, 19 points ahead of Tokyo\. Nairobi is 6°C warmer\./);
    expect(out).toMatch(/mood nairobi vs (?!tokyo|nairobi)[a-z]/);
    expect(ctx.state.mood.checked).toBe(2);
    expect(await run('mood tokyo vs tokyo')).toMatch(/A tie: both sit at 58\. Same temperature, too\./);
    expect(await run('mood nairobi vs atlantis')).toMatch(/“atlantis”/);
    expect(await run('mood nairobi vs')).toMatch(/takes two places.*mood nairobi vs [a-z]/s);
  });

  it('lists what the service offers and uses endpoints it was never told about', async () => {
    const location = { name: 'location', in: 'path', required: true };
    const openapi = {
      paths: {
        '/api/wellbeing/{location}': { get: { description: 'Get mood and wellbeing score for a location.\n\nMore.' } },
        '/api/sleep/{location}': {
          get: {
            summary: 'Get Sleep',
            description: 'How well the night suits sleep.',
            parameters: [location, { name: 'hours', in: 'query', required: true }],
          },
        },
        '/api/subscribe': { post: {} },
        '/health': { get: {} },
      },
    };
    expect(readEndpoints(openapi).map(endpoint => endpoint.name)).toEqual(['sleep', 'wellbeing']);

    const sleep = {
      location: 'Kigali, RW',
      sleep_score: 81,
      cool_enough: true,
      tips: ['Open a window.'],
      best_window: { from: '22:00', to: '06:00' },
    };
    const calls = serve({ '/openapi.json': openapi, '/api/sleep/kigali?hours=8': sleep });
    const { run } = shell();

    const listed = await run('mood api');
    expect(listed).toMatch(/what the live service offers right now/);
    expect(listed).toMatch(/mood &lt;place&gt;.*Get mood and wellbeing score for a location\./s);
    expect(listed).toMatch(/mood sleep &lt;place&gt; hours=&lt;hours&gt;.*How well the night suits sleep\..*picked up on its own/s);
    expect(listed).not.toMatch(/subscribe|health/);

    const out = await run('mood sleep kigali hours=8');
    expect(calls).toEqual(['/api/sleep/kigali?hours=8']);
    expect(out).toMatch(/Kigali, RW.*sleep score.*81.*cool enough.*yes.*tips.*Open a window\..*best window.*from 22:00 · to 06:00/s);
    expect(out).toMatch(/mood sleep [a-z]/);
    expect(await run('mood sleep kigali')).toMatch(/usage: mood sleep &lt;place&gt; hours=&lt;hours&gt;/);
    // Once the service has been asked, the guide lists the new endpoint too.
    expect(await run('mood')).toMatch(/mood sleep &lt;place&gt;/);
  });

  it('judges a plan once the service can', async () => {
    const advice = {
      location: 'Mombasa, KE',
      weather: NAIROBI.weather,
      activity: 'swimming',
      recognised: true,
      verdict: 'go',
      headline: 'Green light for swimming. Enjoy!',
      reasons: ['Mainly clear and 24°C — good conditions for getting in the water.'],
      suggestion: null,
      curiosity: { question: 'Curious how swimming is looking elsewhere? Compare with:', places: ['Zanzibar', 'Malé'] },
    };
    const openapi = { paths: { '/api/activity/{location}': { get: {} }, '/api/wellbeing/{location}': { get: {} } } };
    const calls = serve({
      '/openapi.json': openapi,
      '/api/activity/mombasa?activity=swim': advice,
      '/api/activity/mombasa?activity=can+i+juggle': {
        ...advice,
        activity: 'time outdoors',
        recognised: false,
        verdict: 'skip',
        suggestion: 'Try a museum.',
        curiosity: null,
      },
      '/api/wellbeing/mombasa': NAIROBI,
    });
    const { run } = shell();

    const out = await run('mood swim in mombasa');
    expect(calls).toEqual(['/api/activity/mombasa?activity=swim']);
    expect(out).toMatch(/Mombasa, KE — swimming/);
    expect(out).toMatch(/go: Green light for swimming\. Enjoy!/);
    expect(out).toMatch(/• Mainly clear and 24°C/);
    expect(out).toMatch(/Compare with: mood swim in zanzibar.*mood swim in malé/s);
    expect(out).not.toMatch(/plans it knows well/);

    const unknown = await run('mood can i juggle in mombasa');
    expect(unknown).toMatch(/skip:.*Try a museum\..*plans it knows well: mood [a-z ]+ in mombasa/s);
    expect(unknown).toMatch(/mood can i juggle in (?!mombasa)[a-z]/);

    expect(await run('mood')).toMatch(/mood &lt;activity&gt; in &lt;place&gt;/);
    expect(await run('mood mombasa')).toMatch(/or ask about a plan: mood [a-z ]+ in mombasa/);
    expect(await run('mood activity mombasa')).toMatch(/usage: mood &lt;activity&gt; in &lt;place&gt;/);
  });

  it('presents new endpoints by the shape of their answer', async () => {
    const pick = {
      location: 'Nairobi, KE',
      weather: NAIROBI.weather,
      activity: 'rugby',
      verdict: 'skip',
      headline: "Today's pick for Nairobi: rugby.",
      reasons: ['Touch rugby counts.'],
      curiosity: { question: 'Compare with:', places: ['Lisbon'] },
    };
    const names = ['running', 'a walk', 'cycling', 'hiking', 'football', 'tennis', 'golf', 'a picnic', 'fishing'];
    const list = [...names, 'camping', 'swimming', 'reading', 'a nap'].map(name => ({ name, prompt: `Try ${name}` }));
    const paths = ['activities', 'activity', 'random-activity', 'tides', 'wellbeing'].map(name => [
      `/api/${name}/{location}`,
      { get: {} },
    ]);
    serve({
      '/openapi.json': { paths: Object.fromEntries(paths) },
      '/api/random-activity/nairobi': pick,
      '/api/activities/nairobi': list,
      '/api/tides/mombasa': ['high 06:10', 'low 12:20'],
    });
    const { run } = shell();

    // A verdict on an activity looks the same whichever endpoint sent it.
    const picked = await run('mood random-activity nairobi');
    expect(picked).toMatch(/Nairobi, KE — rugby\s+skip: Today&#x27;s pick for Nairobi: rugby\./);
    expect(picked).toMatch(/Compare with: mood rugby in lisbon/);
    expect(picked).toMatch(/not feeling it\? mood random-activity nairobi/);
    expect(picked).toMatch(/what does suit Nairobi right now: mood activities nairobi/);

    const listed = await run('mood activities nairobi');
    expect(listed).toMatch(/Try running.*mood running in nairobi.*Try reading.*mood reading in nairobi/s);
    expect(listed).toMatch(/also: a nap/);
    expect(listed).toMatch(/cannot choose\? mood random-activity nairobi/);

    expect(await run('mood tides mombasa')).toMatch(/mombasa — tides.*• high 06:10\s+• low 12:20.*mood tides [a-z]/s);
  });

  it('says so when the service cannot judge plans yet', async () => {
    const calls = serve({ '/openapi.json': { paths: { '/api/wellbeing/{location}': { get: {} } } } });
    const { run } = shell();
    expect(await run('mood picnic in cape town')).toMatch(/cannot judge plans yet.*mood cape town/s);
    expect(calls).toEqual([]);
    expect(await run('mood')).not.toMatch(/in &lt;place&gt;/);
  });

  it('shows fields the service has added since', async () => {
    serve({ '/api/wellbeing/nairobi': { ...NAIROBI, air_quality: 'Good', pollen: { grass: 'low' } } });
    const { run } = shell();
    const out = await run('mood nairobi');
    expect(out).toMatch(/also new from the service:.*air quality.*Good.*pollen.*grass low/s);
    serve({ '/api/wellbeing/nairobi': NAIROBI });
    expect(await run('mood nairobi')).not.toMatch(/also new/);
  });

  it('falls back to the last sync when the service will not say what it offers', async () => {
    serve({});
    const { run } = shell();
    const listed = await run('mood api');
    expect(listed).toMatch(/did not answer/);
    expect(listed).toMatch(/mood week &lt;place&gt;/);
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
    expect(complete('mood rey', []).lines).toEqual(['mood reykjavik']);
    expect(complete('mood nairobi v', []).lines).toContain('mood nairobi vs');
    expect(complete('mood week kig', []).lines).toEqual(['mood week kigali']);
  });

  it('finds the shared prefix and a ghost suggestion', () => {
    expect(commonPrefix(['cd projects/mindconnect/', 'cd projects/moodforecast-ai/'])).toBe('cd projects/m');
    expect(ghostFor('ab', [])).toBe('out');
    expect(ghostFor('cat R', ['cat README.md'])).toBe('EADME.md');
    expect(ghostFor('', ['x'])).toBe('');
  });
});
