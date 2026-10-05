// The `mood` command: live calls to the MoodForecast AI service.
import type { ReactNode } from 'react';
import type { Ctx } from './commands';
import { Accent, Cmd, Dim, Rows, Warn } from './ui';

const MOOD_API = 'https://moodforecastai-production.up.railway.app';

/* Places offered when the visitor has not named one, or might like another. */
const PLACES = [
  'Nairobi', 'Mombasa', 'Kigali', 'Zanzibar', 'Cape Town', 'Cairo', 'Marrakech', 'Lisbon', 'Reykjavik',
  'Istanbul', 'Mumbai', 'Kathmandu', 'Singapore', 'Tokyo', 'Sydney', 'Honolulu', 'Vancouver', 'Mexico City',
  'Rio de Janeiro', 'Buenos Aires',
];
const SURPRISE = ['surprise', 'random', 'anywhere'];
const BAR_WIDTH = 20;

/** What the visitor has looked up so far, so the suggestions keep moving. */
export interface MoodSession {
  /** Every name a looked-up place goes by: what was typed and what it resolved to. */
  seen: string[];
  /** How many different places have been looked up. */
  checked: number;
}

export function createMoodSession(): MoodSession {
  return { seen: [], checked: 0 };
}

interface Weather {
  temp_c: number;
  feels_like_c?: number | null;
  condition: string;
  humidity: number;
  wind_kph: number;
  is_day?: boolean;
}

interface Wellbeing {
  location: string;
  weather: Weather;
  mood_score: number;
  mood_label?: string;
  baseline_score?: number;
  factors?: { label: string; delta: number }[];
  energy_level: string;
  risk_level: string;
  ai_summary?: string | null;
  recommendations: string[];
  curiosity?: { question: string; location: string }[];
}

/* ---------- talking to the service ---------- */

/** The service answered, but not with a reading. */
class NoReading extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(detail || `HTTP ${status}`);
  }
}

async function ask<T>(path: string): Promise<T> {
  const response = await fetch(`${MOOD_API}${path}`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: unknown } | null;
    throw new NoReading(response.status, typeof body?.detail === 'string' ? body.detail : '');
  }
  return (await response.json()) as T;
}

/* ---------- suggesting places ---------- */

function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Places the visitor has not looked up yet, in a different order every time. */
function elsewhere(session: MoodSession, count: number, ...avoid: string[]): string[] {
  const isIn = (names: string[], place: string) =>
    names.some(name => name.toLowerCase().includes(place.toLowerCase()));
  const allowed = PLACES.filter(place => !isIn(avoid, place));
  const fresh = allowed.filter(place => !isIn(session.seen, place));
  return shuffled(fresh.length >= count ? fresh : allowed).slice(0, count);
}

function PlaceCmds({ places }: { places: string[] }) {
  return (
    <>
      {places.map(place => (
        <span key={place}>
          <Cmd>{`mood ${place.toLowerCase()}`}</Cmd>{' '}
        </span>
      ))}
    </>
  );
}

/* Used until the service sends its own questions (the `curiosity` field). */
const QUESTIONS: ((place: string, here: string) => string)[] = [
  (place, here) => `Take a guess: is it warmer in ${place} than in ${here}?`,
  place => `What's the mood like in ${place} today?`,
  place => `Is it day or night in ${place} right now?`,
  place => `If you teleported to ${place} right now, what would you need to wear?`,
  (place, here) => `Which is having the better day, ${here} or ${place}?`,
];

/** Called once per reading, not on every render, so the suggestions stay put on screen. */
function whereNext(data: Wellbeing, place: string, session: MoodSession): ReactNode {
  const here = data.location.split(',')[0];
  const questions = shuffled(QUESTIONS);
  const prompts = data.curiosity?.length
    ? data.curiosity
    : elsewhere(session, 2, place, data.location).map((location, index) => ({
        location,
        question: questions[index](location, here),
      }));
  return (
    <>
      {'\n'}
      <Dim>
        where next?{session.checked > 1 ? ` (${session.checked} places checked so far)` : ''}
      </Dim>
      {'\n'}
      {prompts.map(prompt => (
        <span key={prompt.location}>
          {'  '}
          {prompt.question} <Cmd>{`mood ${prompt.location.toLowerCase()}`}</Cmd>
          {'\n'}
        </span>
      ))}
      {'  '}
      <Dim>or let me pick:</Dim> <Cmd>mood surprise</Cmd>
    </>
  );
}

/* ---------- output ---------- */

function Bar({ score }: { score: number }) {
  const filled = Math.round((Math.min(100, Math.max(0, score)) / 100) * BAR_WIDTH);
  return (
    <span className="art">
      <Accent>{'█'.repeat(filled)}</Accent>
      <Dim>{'░'.repeat(BAR_WIDTH - filled)}</Dim>
    </span>
  );
}

function weatherLine(weather: Weather): string {
  const parts = [weather.condition, `${weather.temp_c}°C`];
  if (weather.feels_like_c != null && weather.feels_like_c !== weather.temp_c) {
    parts.push(`feels like ${weather.feels_like_c}°C`);
  }
  parts.push(`humidity ${weather.humidity}%`, `wind ${weather.wind_kph} km/h`);
  if (weather.is_day === false) parts.push('night');
  return parts.join(', ');
}

/** "baseline 65 · Clear skies +15 · Warm air −3" */
function factorsLine(data: Wellbeing): string {
  const factors = (data.factors ?? []).map(
    factor => `${factor.label} ${factor.delta < 0 ? '−' : '+'}${Math.abs(factor.delta)}`,
  );
  return [...(data.baseline_score != null ? [`baseline ${data.baseline_score}`] : []), ...factors].join(' · ');
}

function guide(session: MoodSession): ReactNode {
  return (
    <>
      <Accent>mood</Accent> asks the live MoodForecast AI service how the weather feels somewhere.{'\n'}
      It needs a place. Pick one, or type your own:{'\n\n'}
      {'  '}
      <PlaceCmds places={elsewhere(session, 4)} />
      <Cmd>mood surprise</Cmd>
      {'\n\n'}
      <Rows rows={[[<Accent>mood &lt;place&gt;</Accent>, 'the mood score, what is behind it, and what to do with the day']]} />
      {'\n'}
      <Dim>any town or city works, not just the ones above.</Dim>
    </>
  );
}

function problem(error: unknown, place: string, session: MoodSession): ReactNode {
  if (error instanceof NoReading && error.status === 422) {
    return (
      <>
        <Warn>the service could not find a place called “{place}”.</Warn>{'\n'}
        <Dim>check the spelling, or head somewhere else:</Dim> <PlaceCmds places={elsewhere(session, 3)} />
      </>
    );
  }
  if (error instanceof NoReading) {
    return (
      <>
        <Accent>service is up</Accent>, but it could not produce a reading for “{place}”{' '}
        <Dim>(HTTP {error.status})</Dim>.{'\n'}
        <Dim>Its upstream weather provider did not answer. Try another place:</Dim>{' '}
        <PlaceCmds places={elsewhere(session, 3, place)} />
        {'\n'}
        <Dim>or see how the score is built:</Dim> <Cmd>cat ~/projects/moodforecast-ai/data/scoring-rules.md</Cmd>
      </>
    );
  }
  return (
    <>
      <Warn>could not reach the MoodForecast AI service.</Warn>{'\n'}
      <Dim>It may be asleep or you may be offline. The project notes are still here:</Dim>{' '}
      <Cmd>cat ~/projects/moodforecast-ai/README.md</Cmd>
    </>
  );
}

/* ---------- mood <place> ---------- */

async function reading(place: string, ctx: Ctx): Promise<ReactNode> {
  const session = ctx.state.mood;
  ctx.print(<Dim>contacting MoodForecast AI for {place} ...</Dim>);

  let data: Wellbeing;
  try {
    data = await ask<Wellbeing>(`/api/wellbeing/${encodeURIComponent(place)}`);
  } catch (error) {
    return problem(error, place, session);
  }
  if (!session.seen.includes(data.location)) session.checked++;
  session.seen.push(place, data.location);

  const why = factorsLine(data);
  const rows: [ReactNode, ReactNode][] = [
    [
      'mood score',
      <>
        <Accent>{data.mood_score}/100</Accent>
        {data.mood_label ? ` ${data.mood_label} ` : ' '}
        <Bar score={data.mood_score} />
      </>,
    ],
  ];
  if (why) rows.push(['why', why]);
  rows.push(['energy', data.energy_level], ['risk', data.risk_level], ['weather', weatherLine(data.weather)]);

  return (
    <>
      <Accent>{data.location}</Accent> <Dim>— live from the MoodForecast AI service</Dim>{'\n'}
      <Rows rows={rows} />
      {data.ai_summary ? `\n${data.ai_summary}\n` : null}
      {data.recommendations.length ? '\n' : null}
      {data.recommendations.map(item => `  • ${item}\n`)}
      {whereNext(data, place, session)}
    </>
  );
}

export async function mood(args: string[], ctx: Ctx): Promise<ReactNode> {
  const session = ctx.state.mood;
  const words = args.filter(Boolean);
  if (!words.length) return guide(session);
  if (words.length === 1 && SURPRISE.includes(words[0].toLowerCase())) return reading(elsewhere(session, 1)[0], ctx);
  return reading(words.join(' '), ctx);
}
