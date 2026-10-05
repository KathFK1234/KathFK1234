import { Fragment, type ReactNode } from 'react';
import stack from '../data/stack.json';
import { FONTS, THEMES, type FontName, type Prefs, type ThemeName } from '../prefs';
import {
  absolutePath,
  describe,
  displayPath,
  getNode,
  HOME_PATH,
  listDir,
  resolvePath,
  walk,
  type DirNode,
} from './fs';
import { createMoodSession, mood, type MoodSession } from './mood';
import { Accent, Accent2, Cmd, Dim, Link, Rows, Warn } from './ui';

export interface ShellState {
  cwd: string[];
  prevCwd: string[];
  history: string[];
  mode: 'whoami' | null;
  startedAt: number;
  mood: MoodSession;
}

export interface Ctx {
  state: ShellState;
  print: (node: ReactNode) => void;
  clear: () => void;
  prefs: Prefs;
  setPrefs: (next: Partial<Prefs>) => void;
}

type Output = ReactNode | void;
type Group = 'profile' | 'files' | 'system' | 'fun';

export interface Command {
  name: string;
  summary: string;
  group: Group;
  usage?: string;
  aliases?: string[];
  /** What Tab should offer for this command's argument. */
  completes?: 'dirs' | 'paths' | 'commands' | readonly string[];
  hidden?: boolean;
  run: (args: string[], ctx: Ctx, rest: string) => Output | Promise<Output>;
}

export const LINKS = {
  github: 'https://github.com/KathFK1234',
  linkedin: 'https://www.linkedin.com/in/katheu-kilonzo-1a260422a/',
  email: 'mailto:fkatheukilonzo@gmail.com',
  repo: 'https://github.com/KathFK1234/KathFK1234',
  moodforecast: 'https://moodforecastai-production.up.railway.app',
  mindconnect: 'https://github.com/derick-macharia/mindconnect-platform',
} as const;

const EMAIL = 'fkatheukilonzo@gmail.com';

/* Skills written by hand. `skills` adds anything new that src/data/stack.json
   (refreshed from GitHub by languages_update_script.py) has found since, in the
   row that matches the category `stack` files it under. */
const CORE_SKILLS: [string, string[]][] = [
  ['languages', ['Python', 'JavaScript', 'HTML', 'CSS', 'C', 'Shell']],
  ['backend', ['FastAPI', 'Django', 'DRF', 'REST APIs', 'PostgreSQL']],
  ['frontend', ['React', 'Vite']],
  ['cloud', ['AWS', 'Docker', 'Railway', 'Supabase', 'DigitalOcean']],
  ['ai', ['LLMs', 'RAG', 'intelligent assistants', 'practical automation']],
  ['tooling', ['Git', 'GitHub', 'Linux', 'Postman', 'Figma', 'Canva']],
];
// Names in the data file that are already covered by a hand-written entry above.
const SAME_AS: Record<string, string> = { 'Django REST Framework': 'DRF' };
// Categories in the data file that go by another name here. Any other category gets a row of its own.
const SKILL_ROW: Record<string, string> = { 'data & databases': 'backend', infrastructure: 'cloud' };

function skillRows(): [string, string[]][] {
  const known = new Set(CORE_SKILLS.flatMap(([, items]) => items.map(item => item.toLowerCase())));
  const isNew = (name: string) => !known.has((SAME_AS[name] ?? name).toLowerCase());
  const rows = CORE_SKILLS.map(([label, items]): [string, string[]] => [label, [...items]]);
  rows[0][1].push(...stack.languages.map(language => language.name).filter(isNew));
  for (const tool of stack.tools.filter(tool => isNew(tool.name))) {
    const category = tool.category.toLowerCase();
    const label = SKILL_ROW[category] ?? category;
    let row = rows.find(([name]) => name === label);
    if (!row) rows.push((row = [label, []]));
    row[1].push(tool.name);
  }
  return rows;
}

export function createShellState(history: string[] = []): ShellState {
  return { cwd: [], prevCwd: [], history, mode: null, startedAt: Date.now(), mood: createMoodSession() };
}

/* ---------- rendering helpers ---------- */

function linkify(line: string, keyPrefix: string): ReactNode[] {
  return line.split(/(https?:\/\/[^\s)]+|`[^`]+`)/g).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (/^https?:\/\//.test(part)) return <Link key={key} href={part}>{part}</Link>;
    if (/^`[^`]+`$/.test(part)) return <span key={key} className="accent2">{part.slice(1, -1)}</span>;
    return part;
  });
}

function FileText({ name, text }: { name: string; text: string }) {
  const isProse = /\.(md|txt)$/i.test(name);
  const lines = text.replace(/\n$/, '').split('\n');
  return (
    <>
      {lines.map((line, index) => (
        <Fragment key={index}>
          {isProse && /^#{1,6}\s/.test(line) ? (
            <span className="md-h">{line}</span>
          ) : (
            linkify(line, String(index))
          )}
          {'\n'}
        </Fragment>
      ))}
    </>
  );
}

const artRow = (text: string) => `│ ${text.padEnd(18)} │`;

/** The welcome block: a cat peeking over a terminal, beside a short introduction. */
export function Banner() {
  return (
    <div className="hero">
      <pre className="hero-art" aria-hidden="true">
        <span className="accent2">{'        /\\_/\\\n       ( o.o )\n'}</span>
        {' ┌──────'}
        <span className="accent2">U</span>
        {'───'}
        <span className="accent2">U</span>
        {'─────────┐\n'}
        {` ${artRow('$ whoami')}\n`}
        {[' psychologist', ' backend engineer', ' educator'].map(line => (
          <Fragment key={line}>
            {' │'}
            <span className="hero-text">{line.padEnd(20)}</span>
            {'│\n'}
          </Fragment>
        ))}
        {' │ $ '}
        <span className="cursor blink">{' '}</span>
        {`${' '.repeat(15)} │\n`}
        {` └${'─'.repeat(20)}┘`}
      </pre>
      <div>
        <div className="title">Hi, I’m Katheu Kilonzo.</div>
        <Dim>psychology × backend engineering × human-centered systems</Dim>
        {'\n\n'}
        <Rows
          rows={[
            [<Accent2>now</Accent2>, 'School Lead Educator at TechLit Africa'],
            [<Accent2>builds</Accent2>, 'backend systems and AI products shaped by how people behave'],
            [<Accent2>trained</Accent2>, 'BA Psychology · AWS Certified Cloud Practitioner'],
            [<Accent2>based</Accent2>, 'Kenya (EAT)'],
          ]}
        />
        {'\n'}
        <Dim>type</Dim> <Cmd>help</Cmd> <Dim>to explore, or start with</Dim> <Cmd>about</Cmd>
        <Dim>,</Dim> <Cmd>projects</Cmd> <Dim>or</Dim> <Cmd>ls</Cmd>
        <Dim>.</Dim>
      </div>
    </div>
  );
}

/* ---------- small utilities ---------- */

export function tokenize(line: string): string[] {
  const tokens: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3]);
  }
  return tokens;
}

function splitFlags(args: string[]): { flags: string; operands: string[] } {
  const operands: string[] = [];
  let flags = '';
  for (const arg of args) {
    if (/^-[a-zA-Z]+$/.test(arg)) flags += arg.slice(1);
    else operands.push(arg);
  }
  return { flags, operands };
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

function relativeTo(base: string[], segments: string[]): string {
  return `./${segments.slice(base.length).join('/')}`;
}

function environment(ctx: Ctx): Record<string, string> {
  return {
    USER: 'visitor',
    HOME: HOME_PATH,
    PWD: absolutePath(ctx.state.cwd),
    SHELL: '/bin/ksh',
    TERM: 'xterm-256color',
    EDITOR: 'curiosity',
    LANG: 'en_KE.UTF-8',
    THEME: ctx.prefs.theme,
  };
}

function uptimeText(ctx: Ctx): string {
  const seconds = Math.max(0, Math.round((Date.now() - ctx.state.startedAt) / 1000));
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/** Resolve a path operand to a file, or explain why it cannot be read. */
function readFile(command: string, cwd: string[], target: string): { name: string; text: string } | ReactNode {
  const segments = resolvePath(cwd, target);
  const node = segments && getNode(segments);
  if (!node) {
    if (/^\/|\.\.\//.test(target)) {
      return (
        <>
          <Warn>{command}: {target}: Permission denied</Warn>{'\n'}
          <Dim>That path contains secrets, unfinished thoughts, or an aggressively protected cat.</Dim>
        </>
      );
    }
    return <Warn>{command}: {target}: No such file or directory</Warn>;
  }
  if (node.type === 'dir') return <Warn>{command}: {target}: Is a directory</Warn>;
  return { name: node.name, text: node.content };
}

function isFile(result: ReturnType<typeof readFile>): result is { name: string; text: string } {
  return typeof result === 'object' && result !== null && 'text' in result;
}

function lineCount(args: string[]): { count: number; operands: string[] } {
  const operands: string[] = [];
  let count = 10;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-n' && args[i + 1]) count = Number(args[++i]) || 10;
    else if (/^-\d+$/.test(args[i])) count = Number(args[i].slice(1));
    else operands.push(args[i]);
  }
  return { count, operands };
}

const FORTUNES = [
  '“Build things that make life feel simpler, not just more technical.”',
  '“The best systems are the ones people trust enough to keep using.”',
  '“Curiosity is a better deployment strategy than perfection.”',
  '“A product that understands context will always beat a product that only computes.”',
  '“Even a system with a perfectly tuned API still needs a little human sense.”',
  '“The most useful code is often the kind that makes another person feel less stuck.”',
  '“Good systems reduce friction before they ever need to explain themselves.”',
  '“People do not remember the code; they remember how the product felt.”',
  '“The best interfaces feel invisible because they respect attention.”',
  '“A thoughtful product is a product that makes people feel seen.”',
  '“The most durable work is the kind that keeps learning from real users.”',
  '“Software is not just logic. It is also trust, tone, and timing.”',
];

const READ_ONLY = (command: string) => (
  <>
    <Warn>{command}: read-only file system</Warn>{'\n'}
    <Dim>this universe is curated. look, but do not rearrange the furniture.</Dim>
  </>
);

function hireMe(): ReactNode {
  return (
    <>
      <Dim>[sudo] password for visitor: ********</Dim>{'\n'}
      <Accent>access granted.</Accent> no password required, just interest.{'\n\n'}
      <Rows
        rows={[
          ['email', <Link href={LINKS.email}>{EMAIL}</Link>],
          ['linkedin', <Link href={LINKS.linkedin}>connect here</Link>],
          ['github', <Link href={LINKS.github}>github.com/KathFK1234</Link>],
        ]}
      />
    </>
  );
}

/* ---------- command registry ---------- */

const GROUP_TITLES: Record<Group, string> = {
  profile: 'about me',
  files: 'look around',
  system: 'the terminal',
  fun: 'for the curious',
};

export const commands: Command[] = [
  /* ----- profile ----- */
  {
    name: 'about',
    summary: 'who I am and why this exists',
    group: 'profile',
    run: () => (
      <>
        I’m Katheu Kilonzo — a software engineer who built my way into product work through psychology, systems
        thinking, and a lot of hands-on debugging.{'\n\n'}
        The pattern is consistent: I look for the hidden friction in a flow, then design software around the behavior
        that actually happens in the real world. A form abandoned on step three is not a UX detail; it is a system
        problem. A wellbeing score without context is not insight; it is noise.{'\n\n'}
        That lens shows up in my work across backend engineering, AI product ideas, and education technology. I care
        about software that reduces confusion, respects attention, and makes complex systems feel clear.{'\n\n'}
        Type <Cmd>psychology</Cmd> if you want the deeper version.
      </>
    ),
  },
  {
    name: 'psychology',
    summary: 'why psychology shapes how I build software',
    group: 'profile',
    run: () => (
      <>
        Psychology is not a side topic in my work — it is one of the main reasons I build software the way I do.
        {'\n\n'}
        I think about motivation, friction, trust, context, and what people actually do when they are tired, confused,
        or under time pressure. That showed up in MoodForecast AI: the same weather signal means different things
        depending on context, not just on the numbers. It also shaped how I think about product design and frontend
        flow quality.{'\n\n'}
        The question is never only “can this work technically?” It is also “why would someone keep using it, trust it,
        and understand it?”{'\n\n'}
        <Dim>more in</Dim> <Cmd>ls research</Cmd>
      </>
    ),
  },
  {
    name: 'thinking',
    summary: 'the mental model behind my work',
    group: 'profile',
    run: () => (
      <>
        <Accent2>
          <span className="art">{'psychology\n     \\\n      \\\n  systems ─── backend ─── ai\n      \\           \\\n       \\           education\n        research'}</span>
        </Accent2>
        {'\n\n'}
        I do not treat these as separate careers. They are one way of thinking: observe, form a hypothesis, build a
        small test, learn from reality, and iterate.{'\n\n'}
        Whether the subject is a student, a user flow, an API, or a model output, the same habit of mind applies:
        understand the context, design for the system, and learn from what actually happens.
      </>
    ),
  },
  {
    name: 'projects',
    summary: 'case studies and featured work',
    group: 'profile',
    run: () => (
      <>
        <Accent>MoodForecast AI</Accent> — a system exploring how environmental conditions influence mood and
        emotional wellbeing.{'\n\n'}
        <Rows
          rows={[
            [
              <Dim>Problem</Dim>,
              'weather apps report conditions; they rarely explain what those conditions mean for a person’s state, day, or habits',
            ],
            [
              <Dim>Observation</Dim>,
              'the same signal can feel reassuring, draining, or chaotic depending on context, routine, and perception',
            ],
            [
              <Dim>Solution</Dim>,
              'FastAPI backend, live weather data integration, and a psychologically informed wellbeing scoring layer designed to interpret the situation rather than just record it',
            ],
            [
              <Dim>Links</Dim>,
              <>
                <Link href={LINKS.moodforecast}>live demo</Link> · <Link href={`${LINKS.github}/moodforecast_ai`}>source</Link>{' '}
                · <Cmd>mood nairobi</Cmd>
              </>,
            ],
          ]}
        />
        {'\n'}
        <Accent>Murengeti Lab System</Accent> — a computer lab management system for schools. It replaces scattered
        spreadsheets with one connected place for students, classes, timetables, attendance, equipment, and reports,
        and gives each school its own private workspace. <Dim>(source is private)</Dim>
        {'\n\n'}
        <Accent>MindConnect</Accent> — a digital mental-health concept shaped around youth-centered support,
        low-friction care journeys, and clearer emotional checkpoints in digital experiences.{' '}
        <Link href={LINKS.mindconnect}>source</Link>
        {'\n\n'}
        <Accent>Chema Backend</Accent> — an agricultural and data platform built to connect decision-support,
        operational information, and AI assistance in a way that is practical for real work rather than abstract
        automation. <Dim>(source is private)</Dim>
        {'\n\n'}
        <Dim>go deeper:</Dim> <Cmd>cd projects</Cmd> <Dim>then</Dim> <Cmd>ls</Cmd> <Dim>or</Dim> <Cmd>tree projects</Cmd>
      </>
    ),
  },
  {
    name: 'skills',
    summary: 'stack, tools, and technical strengths',
    group: 'profile',
    run: () => (
      <>
        core stack{'\n\n'}
        <Rows rows={skillRows().map(([label, items]) => [label, <Accent2>{items.join(', ')}</Accent2>])} />
        {'\n'}I enjoy building systems that are not only functional but also resilient, understandable, and grounded
        in user context.{'\n\n'}
        <Dim>the measured version, straight from my repositories:</Dim> <Cmd>stack</Cmd>
      </>
    ),
  },
  {
    name: 'stack',
    summary: 'languages and tools detected across my GitHub repos',
    group: 'profile',
    aliases: ['languages'],
    run: () => {
      const total = stack.languages.reduce((sum, language) => sum + language.bytes, 0) || 1;
      const categories = [...new Set(stack.tools.map(tool => tool.category))];
      const barWidth = 20;
      return (
        <>
          <Accent>languages</Accent> <Dim>
            — share of code across {stack.repos} {stack.includesPrivate ? '' : 'public '}repositories
          </Dim>{'\n'}
          <div className="rows rows-3">
            {stack.languages.map(language => {
              const share = language.bytes / total;
              const filled = Math.max(1, Math.round(share * barWidth));
              return (
                <Fragment key={language.name}>
                  <span>{language.name}</span>
                  <span className="art">
                    <Accent>{'█'.repeat(filled)}</Accent>
                    <Dim>{'░'.repeat(barWidth - filled)}</Dim>
                  </span>
                  <Dim>{share < 0.01 ? '<1' : Math.round(share * 100)}%</Dim>
                </Fragment>
              );
            })}
          </div>
          {'\n'}
          <Accent>frameworks and tools</Accent> <Dim>— read from each repository’s dependency files</Dim>{'\n'}
          <Rows
            rows={categories.map(category => [
              category.toLowerCase(),
              <Accent2>
                {stack.tools
                  .filter(tool => tool.category === category)
                  .map(tool => tool.name)
                  .join(', ')}
              </Accent2>,
            ])}
          />
          {'\n'}
          <Dim>refreshed automatically from GitHub · last changed {stack.updated}</Dim>
        </>
      );
    },
  },
  {
    name: 'experience',
    summary: 'background and current work',
    group: 'profile',
    run: () => (
      <>
        current and relevant experience:{'\n\n'}
        <Rows
          rows={[
            [<Dim>Apr 2026 — Present</Dim>, 'School Lead Educator — TechLit Africa'],
            [<Dim>Feb 2026 — Apr 2026</Dim>, 'Backend Developer Intern — Chakula Africa'],
            [<Dim>Nov 2025 — Feb 2026</Dim>, 'Technical Apprentice — TechLeap at Zynamis'],
            [<Dim>Sep 2024 — Apr 2025</Dim>, 'Class Representative — Kenyatta University'],
            [<Dim>May 2024 — Sep 2024</Dim>, 'Student Psychologist — Mathari Teaching and Referral Hospital'],
            [<Dim>May 2023 — Jul 2023</Dim>, 'Student Attache — KEMRI VCT'],
          ]}
        />
        {'\n'}The common thread is practical systems thinking: design for how people actually behave, learn, and make
        decisions, then build the software to support that reality.
      </>
    ),
  },
  {
    name: 'education',
    summary: 'academic training and certifications',
    group: 'profile',
    run: () => (
      <>
        learning path:{'\n\n'}
        {'  BA Psychology — Kenyatta University (2021 — 2025)\n'}
        {'  ALX Software Engineering (2024 — Present)\n'}
        {'  AWS re/Start — AWS Certified Cloud Practitioner (2025)\n'}
        {"  Alliance Girls' High School — KCSE, B+\n\n"}
        The formal subjects differ, but the through-line is consistent: understand difficult systems, then make them
        useful.
      </>
    ),
  },
  {
    name: 'volunteer',
    summary: 'community work and service',
    group: 'profile',
    run: () => (
      <>
        community work:{'\n\n'}
        {'  Volunteer Educator — Joy Village\n'}
        {'  Social Media Support — UNV East Africa\n'}
        {'  Global Admissions Committee Member — Millennium Campus Network\n'}
        {'  Millennium Fellowship — Art Therapy Clubhouse\n\n'}
        People, access, and opportunity are not side quests. They are part of the system.
      </>
    ),
  },
  {
    name: 'resume',
    summary: 'quick professional summary',
    group: 'profile',
    aliases: ['cv'],
    run: () => (
      <>
        short professional summary:{'\n\n'}
        {'  Software Engineer + School Lead Educator\n'}
        {'  AWS Certified Cloud Practitioner\n'}
        {'  BA Psychology\n'}
        {'  Python · FastAPI · Django · PostgreSQL · Docker · Git · Linux\n\n'}
        {'  '}
        <Link href={LINKS.linkedin}>linkedin profile</Link>
        {'\n  '}
        <Link href={LINKS.github}>github</Link>
        {'\n\n'}
        <Dim>the long version:</Dim> <Cmd>experience</Cmd> <Cmd>education</Cmd> <Cmd>volunteer</Cmd>
      </>
    ),
  },
  {
    name: 'contact',
    summary: 'email, GitHub, and LinkedIn',
    group: 'profile',
    run: () => (
      <>
        reach me directly:{'\n\n'}
        <Rows
          rows={[
            ['email', <Link href={LINKS.email}>{EMAIL}</Link>],
            ['github', <Link href={LINKS.github}>github.com/KathFK1234</Link>],
            ['linkedin', <Link href={LINKS.linkedin}>linkedin.com/in/katheu-kilonzo-1a260422a</Link>],
          ]}
        />
        {'\n'}or type <Cmd>sudo hire-me</Cmd> if you want the dramatic path.
      </>
    ),
  },
  {
    name: 'hire-me',
    summary: 'the less dramatic hiring path',
    group: 'profile',
    run: hireMe,
  },
  {
    name: 'whois',
    summary: 'a short record for katheu',
    group: 'profile',
    run: () => (
      <>
        <Accent>WHOIS katheu</Accent>{'\n'}
        <Rows
          rows={[
            ['Name', 'Katheu Kilonzo'],
            ['Role', 'software engineer, educator, systems thinker'],
            ['Interests', 'psychology, AI, backend systems, product design'],
            ['Verdict', 'interesting enough to keep investigating'],
          ]}
        />
      </>
    ),
  },

  /* ----- files ----- */
  {
    name: 'ls',
    summary: 'list what is in a directory',
    usage: 'ls [-a] [-l] [path]',
    group: 'files',
    completes: 'paths',
    run: (args, ctx) => {
      const { flags, operands } = splitFlags(args);
      const target = operands[0] ?? '.';
      const segments = resolvePath(ctx.state.cwd, target);
      const node = segments && getNode(segments);
      if (!node) {
        return (
          <>
            <Warn>ls: {target}: No such file or directory</Warn>{'\n'}
            <Dim>try</Dim> <Cmd>ls ~</Cmd> <Dim>or</Dim> <Cmd>tree</Cmd>
          </>
        );
      }
      if (node.type === 'file') return node.name;

      const entries = listDir(node, flags.includes('a'));
      if (!entries.length) return <Dim>empty directory. the universe is calm for now.</Dim>;

      const long = flags.includes('l');
      return (
        <div className={long ? 'rows rows-3' : 'rows'}>
          {entries.map(entry => (
            <Fragment key={entry.name}>
              {long && (
                <Dim>
                  {entry.type === 'dir'
                    ? `drwxr-xr-x ${String(listDir(entry, true).length).padStart(5)}`
                    : `-rw-r--r-- ${String(entry.content.length).padStart(5)}`}
                </Dim>
              )}
              <span className={entry.type === 'dir' ? 'accent2' : undefined}>
                {entry.name}
                {entry.type === 'dir' ? '/' : ''}
              </span>
              <Dim>{describe(entry)}</Dim>
            </Fragment>
          ))}
        </div>
      );
    },
  },
  {
    name: 'cd',
    summary: 'move into a directory (cd .. goes up, cd - goes back)',
    usage: 'cd [path]',
    group: 'files',
    completes: 'dirs',
    run: (args, ctx) => {
      const { state } = ctx;
      const target = args[0] ?? '~';

      if (target === '-') {
        [state.cwd, state.prevCwd] = [state.prevCwd, state.cwd];
        return <Dim>{displayPath(state.cwd)}</Dim>;
      }

      if (/^\.\.\/?$/.test(target) && state.cwd.length === 0) {
        return <Dim>you’re already at home. you’re not allowed to be curious beyond here ;)</Dim>;
      }

      const segments = resolvePath(state.cwd, target);
      const node = segments && getNode(segments);
      if (!segments || !node) {
        return (
          <>
            <Warn>cd: {target}: No such file or directory</Warn>{'\n'}
            <Dim>this path does not exist in this little universe. try</Dim> <Cmd>ls</Cmd>
          </>
        );
      }
      if (node.type === 'file') {
        return (
          <>
            <Warn>cd: {target}: Not a directory</Warn>{'\n'}
            <Dim>that is a file. read it with</Dim> <Cmd>{`cat ${target}`}</Cmd>
          </>
        );
      }

      state.prevCwd = state.cwd;
      state.cwd = segments;
    },
  },
  {
    name: 'pwd',
    summary: 'reveal the current working directory',
    group: 'files',
    run: (_args, ctx) => absolutePath(ctx.state.cwd),
  },
  {
    name: 'cat',
    summary: 'print a file (or, with no file, a very important cat)',
    usage: 'cat [file ...]',
    group: 'files',
    aliases: ['less', 'more', 'bat'],
    completes: 'paths',
    run: (args, ctx) => {
      if (!args.length) return '(=^.^=)\nhehehe\nI love cats :)';
      return args.map((target, index) => {
        const result = readFile('cat', ctx.state.cwd, target);
        return (
          <Fragment key={index}>
            {isFile(result) ? <FileText name={result.name} text={result.text} /> : <>{result}{'\n'}</>}
          </Fragment>
        );
      });
    },
  },
  {
    name: 'head',
    summary: 'peek at the first lines of a file',
    usage: 'head [-n lines] file',
    group: 'files',
    completes: 'paths',
    run: (args, ctx) => {
      const { count, operands } = lineCount(args);
      if (!operands.length) {
        return (
          <>
            <Warn>head: missing file operand</Warn>{'\n'}
            <Dim>try</Dim> <Cmd>head ~/README.md</Cmd>
          </>
        );
      }
      const result = readFile('head', ctx.state.cwd, operands[0]);
      if (!isFile(result)) return result;
      return <FileText name={result.name} text={result.text.split('\n').slice(0, count).join('\n')} />;
    },
  },
  {
    name: 'tail',
    summary: 'peek at the last lines of a file',
    usage: 'tail [-n lines] file',
    group: 'files',
    completes: 'paths',
    run: (args, ctx) => {
      const { count, operands } = lineCount(args);
      if (!operands.length) return <Warn>tail: missing file operand</Warn>;
      const result = readFile('tail', ctx.state.cwd, operands[0]);
      if (!isFile(result)) return result;
      return <FileText name={result.name} text={result.text.replace(/\n$/, '').split('\n').slice(-count).join('\n')} />;
    },
  },
  {
    name: 'wc',
    summary: 'count lines, words, and characters in a file',
    usage: 'wc file',
    group: 'files',
    completes: 'paths',
    run: (args, ctx) => {
      if (!args.length) return <Warn>wc: missing file operand</Warn>;
      const result = readFile('wc', ctx.state.cwd, args[0]);
      if (!isFile(result)) return result;
      const lines = result.text.split('\n').length - 1;
      const words = result.text.split(/\s+/).filter(Boolean).length;
      return `${String(lines).padStart(6)} ${String(words).padStart(6)} ${String(result.text.length).padStart(6)} ${result.name}`;
    },
  },
  {
    name: 'grep',
    summary: 'search every file below here for a word',
    usage: 'grep pattern [path]',
    group: 'files',
    run: (args, ctx) => {
      const { operands } = splitFlags(args);
      const [pattern, target = '.'] = operands;
      if (!pattern) {
        return (
          <>
            <Warn>grep: missing search pattern</Warn>{'\n'}
            <Dim>try</Dim> <Cmd>grep psychology</Cmd>
          </>
        );
      }
      const base = resolvePath(ctx.state.cwd, target);
      const baseNode = base && getNode(base);
      if (!base || !baseNode) return <Warn>grep: {target}: No such file or directory</Warn>;

      const files =
        baseNode.type === 'file'
          ? [{ node: baseNode, segments: base }]
          : walk(base).filter(entry => entry.node.type === 'file');
      const needle = pattern.toLowerCase();
      const hits: ReactNode[] = [];
      let total = 0;
      const limit = 30;

      for (const { node, segments } of files) {
        if (node.type !== 'file') continue;
        node.content.split('\n').forEach((line, index) => {
          const at = line.toLowerCase().indexOf(needle);
          if (at < 0) return;
          total++;
          if (hits.length >= limit) return;
          const path = baseNode.type === 'file' ? node.name : relativeTo(base, segments);
          hits.push(
            <Fragment key={`${path}:${index}`}>
              <Accent2>{path}</Accent2>
              <Dim>:{index + 1}:</Dim> {line.slice(0, at).trimStart()}
              <span className="match">{line.slice(at, at + pattern.length)}</span>
              {line.slice(at + pattern.length)}
              {'\n'}
            </Fragment>,
          );
        });
      }

      if (!total) {
        return (
          <>
            <Dim>no matches for “{pattern}”.</Dim>{'\n'}
            <Dim>The search went deep and came back with snacks, but no results.</Dim>
          </>
        );
      }
      return (
        <>
          {hits}
          {total > limit ? <Dim>… and {total - limit} more matches</Dim> : null}
        </>
      );
    },
  },
  {
    name: 'find',
    summary: 'find a file or folder by name',
    usage: 'find [name]',
    group: 'files',
    run: (args, ctx) => {
      const operands = args.filter(arg => !arg.startsWith('-') && arg !== '.');
      const query = (operands[operands.length - 1] ?? '').replace(/\*/g, '').toLowerCase();
      const matches = walk(ctx.state.cwd).filter(entry => entry.node.name.toLowerCase().includes(query));
      if (!matches.length) return <Dim>find: no paths matched “{query}”.</Dim>;
      return matches.map(({ node, segments }) => (
        <Fragment key={segments.join('/')}>
          <span className={node.type === 'dir' ? 'accent2' : undefined}>{relativeTo(ctx.state.cwd, segments)}</span>
          {'\n'}
        </Fragment>
      ));
    },
  },
  {
    name: 'tree',
    summary: 'draw the directory tree',
    usage: 'tree [-a] [-L depth] [path]',
    group: 'files',
    completes: 'dirs',
    run: (args, ctx) => {
      let depth = 3;
      const rest: string[] = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '-L' && args[i + 1]) depth = Math.max(1, Number(args[++i]) || 3);
        else rest.push(args[i]);
      }
      const { flags, operands } = splitFlags(rest);
      const target = operands[0] ?? '.';
      const base = resolvePath(ctx.state.cwd, target);
      const baseNode = base && getNode(base);
      if (!baseNode || baseNode.type !== 'dir') return <Warn>tree: {target}: Not a directory</Warn>;

      const lines: ReactNode[] = [];
      let dirs = 0;
      let files = 0;
      let truncated = false;
      const draw = (dir: DirNode, prefix: string, level: number) => {
        const entries = listDir(dir, flags.includes('a'));
        entries.forEach((entry, index) => {
          const last = index === entries.length - 1;
          if (entry.type === 'dir') dirs++;
          else files++;
          lines.push(
            <Fragment key={lines.length}>
              <Dim>{prefix}{last ? '└── ' : '├── '}</Dim>
              <span className={entry.type === 'dir' ? 'accent2' : undefined}>
                {entry.name}{entry.type === 'dir' ? '/' : ''}
              </span>
              {'\n'}
            </Fragment>,
          );
          if (entry.type !== 'dir') return;
          if (level >= depth) truncated ||= entry.children.size > 0;
          else draw(entry, prefix + (last ? '    ' : '│   '), level + 1);
        });
      };
      draw(baseNode, '', 1);

      return (
        <>
          <Accent>{target === '.' ? '.' : displayPath(base!)}</Accent>{'\n'}
          <span className="art">{lines}</span>
          {'\n'}
          <Dim>
            {dirs} directories, {files} files{truncated ? ` (depth ${depth} — go deeper with tree -L ${depth + 1})` : ''}
          </Dim>
        </>
      );
    },
  },
  {
    name: 'open',
    summary: 'open a profile, a project, or a file',
    usage: `open <${Object.keys(LINKS).join('|')}|file>`,
    group: 'files',
    completes: Object.keys(LINKS),
    run: (args, ctx) => {
      const target = (args[0] ?? '').toLowerCase();
      if (target in LINKS) {
        const url = LINKS[target as keyof typeof LINKS];
        if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
        return (
          <>
            <Accent>opening {target} ...</Accent> <Dim>if nothing happened:</Dim> <Link href={url}>{url}</Link>
          </>
        );
      }
      const segments = target ? resolvePath(ctx.state.cwd, args[0]) : null;
      const node = segments && getNode(segments);
      if (node?.type === 'file') return <FileText name={node.name} text={node.content} />;
      return (
        <>
          <Warn>open: unknown target</Warn>{'\n'}
          <Dim>try</Dim>{' '}
          {Object.keys(LINKS).map(name => (
            <Fragment key={name}><Cmd>{`open ${name}`}</Cmd> </Fragment>
          ))}
        </>
      );
    },
  },

  /* ----- system ----- */
  {
    name: 'help',
    summary: 'show this list',
    group: 'system',
    aliases: ['?', 'commands'],
    run: () => (
      <>
        {(Object.keys(GROUP_TITLES) as Group[]).map(group => (
          <Fragment key={group}>
            <Accent>{GROUP_TITLES[group]}</Accent>{'\n'}
            <Rows
              rows={commands
                .filter(command => command.group === group && !command.hidden)
                .map(command => [<Cmd>{command.name}</Cmd>, <Dim>{command.summary}</Dim>])}
            />
            {'\n'}
          </Fragment>
        ))}
        <Dim>
          Tab completes commands and paths · ↑ ↓ walk history · → accepts a suggestion · Ctrl+L clears · click any
          highlighted command to run it · man &lt;command&gt; for details
        </Dim>
      </>
    ),
  },
  {
    name: 'man',
    summary: 'read the manual for a command',
    usage: 'man command',
    group: 'system',
    completes: 'commands',
    run: args => {
      const name = (args[0] ?? '').toLowerCase();
      const command = findCommand(name);
      if (!command) {
        return (
          <>
            <Warn>No manual entry for {name || 'nothing'}.</Warn>{'\n'}
            <Dim>The documentation team is currently staring thoughtfully at the ceiling.</Dim>
          </>
        );
      }
      return (
        <>
          <Accent>NAME</Accent>{'\n'}
          {`    ${command.name} — ${command.summary}\n\n`}
          <Accent>SYNOPSIS</Accent>{'\n'}
          {`    ${command.usage ?? command.name}\n`}
          {command.aliases?.length ? (
            <>
              {'\n'}
              <Accent>ALIASES</Accent>{'\n'}
              {`    ${command.aliases.join(', ')}\n`}
            </>
          ) : null}
        </>
      );
    },
  },
  {
    name: 'history',
    summary: 'show the commands you have explored (history -c clears)',
    usage: 'history [-c]',
    group: 'system',
    run: (args, ctx) => {
      if (args[0] === '-c') {
        ctx.state.history.length = 0;
        return <Dim>history cleared. a fresh start.</Dim>;
      }
      if (!ctx.state.history.length) {
        return <Dim>history is empty. try a command and come back. bravery is a habit.</Dim>;
      }
      return ctx.state.history.map((entry, index) => (
        <Fragment key={index}>
          <Dim>{String(index + 1).padStart(4)}</Dim>  {entry}{'\n'}
        </Fragment>
      ));
    },
  },
  {
    name: 'clear',
    summary: 'reset the terminal (Ctrl+L)',
    group: 'system',
    aliases: ['cls'],
    run: (_args, ctx) => ctx.clear(),
  },
  {
    name: 'banner',
    summary: 'print the welcome screen again',
    group: 'system',
    run: () => <Banner />,
  },
  {
    name: 'theme',
    summary: 'change the colour scheme',
    usage: `theme [${Object.keys(THEMES).join('|')}]`,
    group: 'system',
    completes: Object.keys(THEMES),
    run: (args, ctx) => {
      const name = (args[0] ?? '').toLowerCase();
      if (name in THEMES) {
        ctx.setPrefs({ theme: name as ThemeName });
        return <>theme set to <Accent>{name}</Accent>. <Dim>it will be remembered on this device.</Dim></>;
      }
      return (
        <>
          {name ? <><Warn>theme: unknown theme “{name}”</Warn>{'\n'}</> : null}
          <Rows
            rows={Object.entries(THEMES).map(([key, about]) => [
              <Cmd run={`theme ${key}`}>{key}</Cmd>,
              <Dim>{about}{key === ctx.prefs.theme ? '  ← current' : ''}</Dim>,
            ])}
          />
        </>
      );
    },
  },
  {
    name: 'font',
    summary: 'change the terminal font',
    usage: `font [${Object.keys(FONTS).join('|')}]`,
    group: 'system',
    completes: Object.keys(FONTS),
    run: (args, ctx) => {
      const name = (args[0] ?? '').toLowerCase();
      if (name in FONTS) {
        ctx.setPrefs({ font: name as FontName });
        return <>font set to <Accent>{FONTS[name as FontName].label}</Accent>.</>;
      }
      return (
        <>
          {name ? <><Warn>font: unknown font “{name}”</Warn>{'\n'}</> : null}
          <Rows
            rows={Object.entries(FONTS).map(([key, font]) => [
              <Cmd run={`font ${key}`}>{key}</Cmd>,
              <Dim>{font.label}{key === ctx.prefs.font ? '  ← current' : ''}</Dim>,
            ])}
          />
        </>
      );
    },
  },
  {
    name: 'crt',
    summary: 'toggle old-monitor scanlines',
    usage: 'crt [on|off]',
    group: 'system',
    completes: ['on', 'off'],
    run: (args, ctx) => {
      const on = args[0] ? args[0].toLowerCase() === 'on' : !ctx.prefs.crt;
      ctx.setPrefs({ crt: on });
      return on ? <>scanlines <Accent>on</Accent>. <Dim>please do not degauss the visitor.</Dim></> : <>scanlines <Accent>off</Accent>.</>;
    },
  },
  {
    name: 'whoami',
    summary: 'tell the terminal why you are here',
    group: 'system',
    run: (_args, ctx) => {
      ctx.state.mode = 'whoami';
      return (
        <>
          <Dim>visitor profile scan started...</Dim>{'\n\n'}
          what brings you here?{'\n\n'}
          {'  '}<Cmd run="1">1. hiring</Cmd>{'\n  '}<Cmd run="2">2. collaborating</Cmd>{'\n  '}
          <Cmd run="3">3. just exploring</Cmd>
        </>
      );
    },
  },
  {
    name: 'date',
    summary: 'print the current timestamp',
    group: 'system',
    run: () => <Accent>{new Date().toString()}</Accent>,
  },
  {
    name: 'uname',
    summary: 'reveal the machine identity',
    usage: 'uname [-a]',
    group: 'system',
    run: args => (args.includes('-a') ? 'Linux katheu 6.8.0-52-generic x86_64 GNU/Linux' : 'Linux'),
  },
  {
    name: 'hostname',
    summary: 'print the host name',
    group: 'system',
    hidden: true,
    run: () => 'katheu',
  },
  {
    name: 'uptime',
    summary: 'how long this session has been running',
    group: 'system',
    run: (_args, ctx) => `up ${uptimeText(ctx)}, 1 visitor, load average: curious, curious, curious`,
  },
  {
    name: 'echo',
    summary: 'make the terminal repeat you',
    usage: 'echo [text]',
    group: 'system',
    run: (_args, ctx, rest) => {
      if (!rest) return 'echo: you said nothing, but somehow it was profound.';
      const env = environment(ctx);
      return rest.replace(/^(["'])(.*)\1$/, '$2').replace(/\$([A-Z_]+)/g, (whole, name: string) => env[name] ?? whole);
    },
  },
  {
    name: 'env',
    summary: 'print the environment',
    group: 'system',
    hidden: true,
    run: (_args, ctx) =>
      Object.entries(environment(ctx))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n'),
  },
  {
    name: 'which',
    summary: 'locate a command',
    usage: 'which command',
    group: 'system',
    hidden: true,
    completes: 'commands',
    run: args => {
      const command = findCommand((args[0] ?? '').toLowerCase());
      return command ? `/usr/bin/${command.name}` : <Warn>which: no {args[0] ?? 'command'} in PATH</Warn>;
    },
  },
  {
    name: 'neofetch',
    summary: 'a tiny system summary for this strange little universe',
    group: 'system',
    run: (_args, ctx) => (
      <div className="fetch">
        <pre aria-hidden="true">{' /\\_/\\\n( o.o )\n > ^ <'}</pre>
        <div>
          <Accent>visitor</Accent>@<Accent>katheu</Accent>{'\n'}
          <Dim>---------------------</Dim>{'\n'}
          <Rows
            rows={[
              [<Accent2>OS</Accent2>, 'human-centered software'],
              [<Accent2>Host</Accent2>, 'build-with-purpose'],
              [<Accent2>Kernel</Accent2>, 'curiosity 3.0'],
              [<Accent2>Uptime</Accent2>, uptimeText(ctx)],
              [<Accent2>Shell</Accent2>, 'ksh (katheu shell)'],
              [<Accent2>Theme</Accent2>, `${ctx.prefs.theme} · ${FONTS[ctx.prefs.font].label}`],
              [<Accent2>Stack</Accent2>, 'psychology + product + code'],
            ]}
          />
        </div>
      </div>
    ),
  },
  {
    name: 'top',
    summary: 'see what is running',
    group: 'system',
    aliases: ['ps', 'htop'],
    hidden: true,
    run: () => (
      <>
        <Dim>{'  PID USER     %CPU %MEM COMMAND'}</Dim>{'\n'}
        {'    1 katheu   42.0  8.1 curiosity\n'}
        {'  204 katheu   27.5  6.4 python (fastapi)\n'}
        {'  512 katheu   18.2  4.0 lesson-planning\n'}
        {' 1234 visitor   4.1  0.2 reading-this\n'}
        <Dim>status: thinking deeply and shipping carefully</Dim>
      </>
    ),
  },
  {
    name: 'mood',
    summary: 'ask the live MoodForecast AI service how a place feels',
    usage: 'mood <place>',
    group: 'fun',
    run: mood,
  },
  {
    name: 'git',
    summary: 'status and log, more or less',
    usage: 'git <status|log>',
    group: 'system',
    hidden: true,
    completes: ['status', 'log'],
    run: args => {
      if (args[0] === 'status') {
        return (
          <>
            <Accent>On branch main</Accent>{'\n'}
            {'Your branch is feeling optimistic.\n'}
            {'Changes not staged for commit:\n'}
            {'  • still building a better portfolio\n'}
            {'  • still learning how humans actually use software'}
          </>
        );
      }
      if (args[0] === 'log') {
        return (
          <>
            <Warn>c9e4d2a</Warn>  build: more curiosity, less noise{'\n'}
            <Warn>b1027aa</Warn>  fix: psychology still matters{'\n'}
            <Warn>a1980fd</Warn>  feat: became more human-centered{'\n'}
            <Dim>the real history:</Dim> <Link href={`${LINKS.repo}/commits/main`}>github.com/KathFK1234/KathFK1234</Link>
          </>
        );
      }
      return <><Dim>git: try</Dim> <Cmd>git status</Cmd> <Dim>or</Dim> <Cmd>git log</Cmd></>;
    },
  },
  {
    name: 'sudo',
    summary: 'the dramatic hiring path (sudo hire-me)',
    usage: 'sudo hire-me',
    group: 'fun',
    completes: ['hire-me'],
    run: (args, _ctx, rest) => {
      if (args[0]?.toLowerCase() === 'hire-me') return hireMe();
      if (/^rm\b/.test(rest)) {
        return <Warn>nice try. the universe has backups, and they are also read-only.</Warn>;
      }
      return (
        <>
          <Warn>visitor is not in the sudoers file. This incident will be reported.</Warn>{'\n'}
          <Dim>(to nobody. but</Dim> <Cmd>sudo hire-me</Cmd> <Dim>works.)</Dim>
        </>
      );
    },
  },
  {
    name: 'exit',
    summary: 'try to leave',
    group: 'system',
    aliases: ['logout', 'quit'],
    hidden: true,
    run: () => (
      <>
        <Dim>logout: this session is attached to your curiosity. close the tab to leave, or stay and try</Dim>{' '}
        <Cmd>fortune</Cmd>
      </>
    ),
  },

  /* ----- fun ----- */
  {
    name: 'fortune',
    summary: 'a tiny burst of wisdom',
    group: 'fun',
    run: () => <Accent2>{FORTUNES[Math.floor(Math.random() * FORTUNES.length)]}</Accent2>,
  },
  {
    name: 'coffee',
    summary: 'because every serious build needs motivation',
    group: 'fun',
    run: () => (
      <>
        <Warn>Error: coffee not found.</Warn>{'\n'}Motivation module compensating with stubborn optimism.
      </>
    ),
  },
  {
    name: 'ping',
    summary: 'check that somebody is home',
    usage: 'ping [host]',
    group: 'fun',
    hidden: true,
    run: args => {
      const host = args[0] ?? 'katheu';
      return (
        <>
          {`PING ${host}: 56 data bytes\n`}
          {`64 bytes from ${host}: icmp_seq=0 time=0.042 ms\n`}
          {`64 bytes from ${host}: icmp_seq=1 time=0.039 ms\n`}
          <Dim>2 packets transmitted, 2 received, 0% packet loss. for a real reply:</Dim> <Cmd>contact</Cmd>
        </>
      );
    },
  },
  {
    name: 'vim',
    summary: 'open an editor',
    group: 'fun',
    aliases: ['vi', 'nano', 'emacs'],
    hidden: true,
    run: () => (
      <>
        <Warn>editor disabled: nobody has ever successfully exited.</Warn>{'\n'}
        <Dim>reading is free, though:</Dim> <Cmd>cat ~/README.md</Cmd>
      </>
    ),
  },
  ...['rm', 'mkdir', 'touch', 'mv', 'cp', 'chmod'].map(
    (name): Command => ({
      name,
      summary: 'not in this universe',
      group: 'fun',
      hidden: true,
      run: () => READ_ONLY(name),
    }),
  ),
];

const SHORTCUTS: Record<string, string> = { ll: 'ls -l', la: 'ls -a', '..': 'cd ..', '~': 'cd ~' };

export function findCommand(name: string): Command | undefined {
  return commands.find(command => command.name === name || command.aliases?.includes(name));
}

/** Every name a visitor can type, for completion and "did you mean". */
export function commandNames(includeHidden = true): string[] {
  return commands.filter(command => includeHidden || !command.hidden).map(command => command.name);
}

function whoamiAnswer(answer: string): ReactNode {
  const text = answer.trim().toLowerCase();

  if (text === '1' || /hir|job|recruit/.test(text)) {
    return (
      <>
        <Accent>hiring profile</Accent>{'\n'}
        Katheu Kilonzo is a software engineer with a psychology-informed lens on product and systems.{'\n\n'}
        I build backend systems, AI-powered experiences, and practical tools that are grounded in real user needs.
        {'\n\n'}
        {'Key strengths:\n'}
        {'  • Python, FastAPI, Django, REST APIs\n'}
        {'  • practical AI workflows and product thinking\n'}
        {'  • human-centered design informed by psychology\n\n'}
        {'Featured work:\n'}
        {'  • MoodForecast AI\n  • Murengeti Lab System\n  • Chema Backend\n  • MindConnect concept work\n\n'}
        Next steps: <Cmd>resume</Cmd> <Cmd>projects</Cmd> <Cmd>contact</Cmd> or <Cmd>sudo hire-me</Cmd> for the direct
        route.
      </>
    );
  }

  if (text === '2' || /collab|build|partner/.test(text)) {
    return (
      <>
        <Accent>collaboration profile</Accent>{'\n'}
        I enjoy building with people who care about quality, clarity, and thoughtful product decisions.{'\n\n'}
        {'Current interests:\n'}
        {'  • AI-enabled product experiences\n'}
        {'  • backend architecture and APIs\n'}
        {'  • psychology-informed UX + digital wellbeing\n'}
        {'  • education technology and tooling\n\n'}
        Best next move: <Cmd>projects</Cmd> <Cmd>skills</Cmd> <Cmd>contact</Cmd>
      </>
    );
  }

  return (
    <>
      <Accent>explorer mode</Accent>{'\n'}
      I like curious people. This should feel a little like a playful system, but it still points to real work.
      {'\n\n'}
      Try any of these: <Cmd>fortune</Cmd> <Cmd>thinking</Cmd> <Cmd>psychology</Cmd> <Cmd>tree</Cmd>{' '}
      <Cmd>mood surprise</Cmd> <Cmd>theme</Cmd>{'\n\n'}
      The interface rewards curiosity more than certainty.
    </>
  );
}

function unknownCommand(name: string): ReactNode {
  const names = commands.flatMap(command => [command.name, ...(command.aliases ?? [])]);
  const closest = names
    .map(candidate => ({ candidate, distance: editDistance(name, candidate) }))
    .sort((a, b) => a.distance - b.distance)[0];
  const hints = [
    'this interface rewards curiosity more than precision.',
    'even good explorers need a map sometimes.',
    'command rejected by the universe. it happens.',
  ];
  return (
    <>
      <Warn>ksh: command not found: {name}</Warn>{'\n'}
      {closest && closest.distance <= 2 ? (
        <>
          <Dim>did you mean</Dim> <Cmd>{closest.candidate}</Cmd><Dim>?</Dim>
        </>
      ) : (
        <>
          <Dim>{hints[Math.floor(Math.random() * hints.length)]} type</Dim> <Cmd>help</Cmd>{' '}
          <Dim>for the map.</Dim>
        </>
      )}
    </>
  );
}

/** Run one line. Output goes through `ctx.print`; the caller echoes the line itself. */
export async function execute(line: string, ctx: Ctx): Promise<void> {
  const trimmed = line.trim();
  if (!trimmed) return;

  if (ctx.state.mode === 'whoami') {
    ctx.state.mode = null;
    // A real command (typed, or clicked in the nav) cancels the question instead of answering it.
    const first = tokenize(trimmed)[0]?.toLowerCase() ?? '';
    if (!findCommand(first) || first === 'hire-me') {
      ctx.print(whoamiAnswer(trimmed));
      return;
    }
  }

  const expanded = SHORTCUTS[trimmed.toLowerCase()] ?? trimmed;
  const [name, ...args] = tokenize(expanded);
  const command = findCommand(name.toLowerCase());
  if (!command) {
    ctx.print(unknownCommand(name));
    return;
  }

  const rest = expanded.slice(expanded.indexOf(name) + name.length).trim();
  try {
    const output = await command.run(args, ctx, rest);
    if (output !== undefined && output !== null) ctx.print(output);
  } catch {
    ctx.print(<Warn>{command.name}: something went wrong. the universe apologises.</Warn>);
  }
}
