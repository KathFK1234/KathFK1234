// The `mood` command: live calls to the MoodForecast AI service.
import { Fragment, type ReactNode } from 'react';
import synced from '../data/mood.json';
import type { Ctx } from './commands';
import { Accent, Cmd, Dim, Link, Rows, Warn } from './ui';

// Set VITE_MOOD_API (in .env.local) to try a backend running on your own machine.
const MOOD_API: string = import.meta.env.VITE_MOOD_API || 'https://moodforecastai-production.up.railway.app';

/** One `GET /api/<name>/{location}` endpoint of the service. */
interface Endpoint {
  name: string;
  about: string;
  params: { name: string; required: boolean }[];
}

/* src/data/mood.json is rewritten from MoodForecast AI by mood_sync_script.py:
   new endpoints, places and activities over there arrive here without a code change. */
interface Synced {
  endpoints: Endpoint[];
  places: Record<string, string[]>;
  activities: { name: string; category: string; aliases: string[] }[];
}
const SYNCED = synced as unknown as Synced;

/* Endpoints this file knows how to present, and how the visitor asks for them.
   Any other endpoint the service has still works, as `mood <name> <place>`. */
const BUILT_IN: Record<string, string> = {
  wellbeing: 'mood <place>',
  forecast: 'mood week <place>',
};

/* Places offered when the visitor has not named one, or might like another:
   these, plus every place MoodForecast AI itself suggests. */
const STARTER_PLACES = [
  'Nairobi', 'Mombasa', 'Kigali', 'Zanzibar', 'Cape Town', 'Cairo', 'Marrakech', 'Lisbon', 'Reykjavik',
  'Istanbul', 'Mumbai', 'Kathmandu', 'Singapore', 'Tokyo', 'Sydney', 'Honolulu', 'Vancouver', 'Mexico City',
  'Rio de Janeiro', 'Buenos Aires',
];
const PLACES = [...new Set([...STARTER_PLACES, ...Object.values(SYNCED.places).flat()])];
const SURPRISE = ['surprise', 'random', 'anywhere'];
const BAR_WIDTH = 20;

/** What Tab offers after `mood`. Places of more than one word are left to the visitor. */
export const MOOD_WORDS: readonly string[] = [
  'week',
  'vs',
  'surprise',
  'api',
  ...SYNCED.endpoints.map(endpoint => endpoint.name).filter(name => !(name in BUILT_IN)),
  ...PLACES.filter(place => !place.includes(' ')).map(place => place.toLowerCase()),
];

/** What the visitor has looked up so far, so the suggestions keep moving. */
export interface MoodSession {
  /** Every name a looked-up place goes by: what was typed and what it resolved to. */
  seen: string[];
  /** How many different places have been looked up. */
  checked: number;
  /** What the service offers, asked once per visit. */
  endpoints?: Promise<Endpoint[]>;
  /** The answer to that, once it is in; `live` is false if the service did not say. */
  known?: { endpoints: Endpoint[]; live: boolean };
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

interface Day {
  date: string;
  condition: string;
  temp_max_c: number;
  temp_min_c: number;
  precipitation_chance?: number | null;
  sunrise?: string | null;
  sunset?: string | null;
  mood_score: number;
  mood_label: string;
}

interface Forecast {
  location: string;
  daily: Day[];
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

async function ask<T>(path: string, timeout = 15000): Promise<T> {
  const response = await fetch(`${MOOD_API}${path}`, { signal: AbortSignal.timeout(timeout) });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: unknown } | null;
    throw new NoReading(response.status, typeof body?.detail === 'string' ? body.detail : '');
  }
  return (await response.json()) as T;
}

/* ---------- finding out what the service can do ---------- */

const LOCATION_ENDPOINT = /^\/api\/([a-z][a-z0-9_-]*)\/\{location\}$/;

/** The per-location endpoints in an OpenAPI document. Mirrors read_endpoints in mood_sync_script.py. */
export function readEndpoints(doc: unknown): Endpoint[] {
  type Operation = {
    summary?: string;
    description?: string;
    parameters?: { name: string; in: string; required?: boolean }[];
  };
  const paths = (doc as { paths?: Record<string, { get?: Operation }> } | null)?.paths ?? {};
  const found: Endpoint[] = [];
  for (const [path, operations] of Object.entries(paths)) {
    const name = LOCATION_ENDPOINT.exec(path)?.[1];
    const operation = operations?.get;
    if (!name || !operation) continue;
    found.push({
      name,
      about: (operation.description || operation.summary || '').trim().split('\n')[0],
      params: (operation.parameters ?? [])
        .filter(param => param.in === 'query')
        .map(param => ({ name: param.name, required: Boolean(param.required) })),
    });
  }
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Ask the service what it offers, so an endpoint deployed a minute ago already works here.
 * If it does not answer, fall back to what the last sync found.
 */
function endpoints(session: MoodSession): Promise<Endpoint[]> {
  session.endpoints ??= ask<unknown>('/openapi.json', 8000)
    .then(readEndpoints)
    .then(found => {
      if (!found.length) throw new Error('no endpoints listed');
      session.known = { endpoints: found, live: true };
      return found;
    })
    .catch(() => {
      session.known = { endpoints: SYNCED.endpoints, live: false };
      return SYNCED.endpoints;
    });
  return session.endpoints;
}

function usage(endpoint: Endpoint): string {
  const params = endpoint.params.filter(param => param.required).map(param => ` ${param.name}=<${param.name}>`);
  return BUILT_IN[endpoint.name] ?? `mood ${endpoint.name} <place>${params.join('')}`;
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

function PlaceCmds({ places, before = 'mood' }: { places: string[]; before?: string }) {
  return (
    <>
      {places.map(place => (
        <span key={place}>
          <Cmd>{`${before} ${place.toLowerCase()}`}</Cmd>{' '}
        </span>
      ))}
    </>
  );
}

interface Nudge {
  question: string;
  command: string;
}

/* Used until the service sends its own questions (the `curiosity` field).
   `from` is the place just looked up, as the visitor typed it. */
const NUDGES: ((place: string, here: string, from: string) => Nudge)[] = [
  (place, here, from) => ({
    question: `Take a guess: is it warmer in ${place} than in ${here}?`,
    command: `mood ${from} vs ${place.toLowerCase()}`,
  }),
  (place, here, from) => ({
    question: `Which is having the better day, ${here} or ${place}?`,
    command: `mood ${from} vs ${place.toLowerCase()}`,
  }),
  place => ({ question: `What's the mood like in ${place} today?`, command: `mood ${place.toLowerCase()}` }),
  place => ({ question: `Is it day or night in ${place} right now?`, command: `mood ${place.toLowerCase()}` }),
  place => ({
    question: `If you teleported to ${place} right now, what would you need to wear?`,
    command: `mood ${place.toLowerCase()}`,
  }),
  place => ({ question: `Would this week be kinder in ${place}?`, command: `mood week ${place.toLowerCase()}` }),
];

/** Called once per reading, not on every render, so the suggestions stay put on screen. */
function whereNext(data: Wellbeing, place: string, session: MoodSession): ReactNode {
  const here = data.location.split(',')[0];
  const from = place.toLowerCase();
  const makers = shuffled(NUDGES);
  const nudges: Nudge[] = data.curiosity?.length
    ? data.curiosity.map(({ question, location }) => ({ question, command: `mood ${location.toLowerCase()}` }))
    : elsewhere(session, 2, place, data.location).map((other, index) => makers[index](other, here, from));
  return (
    <>
      {'\n'}
      <Dim>
        where next?{session.checked > 1 ? ` (${session.checked} places checked so far)` : ''}
      </Dim>
      {'\n'}
      {nudges.map(nudge => (
        <span key={nudge.command}>
          {'  '}
          {nudge.question} <Cmd>{nudge.command}</Cmd>
          {'\n'}
        </span>
      ))}
      {'  '}
      <Dim>or let me pick:</Dim> <Cmd>mood surprise</Cmd>
      {'\n'}
      <Dim>more on {here}:</Dim> <Cmd>{`mood week ${from}`}</Cmd>
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

const WELLBEING_FIELDS = [
  'location', 'weather', 'mood_score', 'mood_label', 'baseline_score', 'factors', 'energy_level', 'risk_level',
  'ai_summary', 'recommendations', 'curiosity',
];
const FORECAST_FIELDS = ['location', 'weather', 'forecast_days', 'daily', 'ai_summary'];

/** Any value from the service on one line: `yes`, `a, b`, `question … · places a, b`. */
function plain(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (Array.isArray(value)) return value.map(plain).join(', ');
  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([, inner]) => inner != null)
      .map(([key, inner]) => `${key.replace(/_/g, ' ')} ${plain(inner)}`)
      .join(' · ');
  }
  return String(value);
}

/** Rows for fields this file has no special presentation for, so nothing the service sends is dropped. */
function fieldRows(data: object, skip: string[] = []): [ReactNode, ReactNode][] {
  return Object.entries(data)
    .filter(([key, value]) => !skip.includes(key) && value != null && !(Array.isArray(value) && !value.length))
    .map(([key, value]) => [
      key.replace(/_/g, ' '),
      Array.isArray(value) && value.some(item => typeof item === 'object' || String(item).length > 30) ? (
        <>
          {value.map((item, index) => (
            <div key={index}>{plain(item)}</div>
          ))}
        </>
      ) : (
        plain(value)
      ),
    ]);
}

/** Fields the service has started sending since this file was written. */
function newFields(data: object, known: string[]): ReactNode {
  const rows = fieldRows(data, known);
  if (!rows.length) return null;
  return (
    <>
      {'\n'}
      <Dim>also new from the service:</Dim>{'\n'}
      <Rows rows={rows} />
    </>
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
  const extra = (session.known?.endpoints ?? SYNCED.endpoints).filter(endpoint => !(endpoint.name in BUILT_IN));
  return (
    <>
      <Accent>mood</Accent> asks the live MoodForecast AI service how the weather feels somewhere.{'\n'}
      It needs a place. Pick one, or type your own:{'\n\n'}
      {'  '}
      <PlaceCmds places={elsewhere(session, 4)} />
      <Cmd>mood surprise</Cmd>
      {'\n\n'}
      <Rows
        rows={[
          [<Accent>mood &lt;place&gt;</Accent>, 'the mood score, what is behind it, and what to do with the day'],
          [<Accent>mood week &lt;place&gt;</Accent>, 'the mood outlook for the next seven days'],
          [<Accent>mood &lt;place&gt; vs &lt;place&gt;</Accent>, 'which of two places is having the better day'],
          ...extra.map((endpoint): [ReactNode, ReactNode] => [<Accent>{usage(endpoint)}</Accent>, endpoint.about]),
          [<Accent>mood api</Accent>, 'everything the service can do right now'],
        ]}
      />
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
  remember(session, place, data);

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
      {newFields(data, WELLBEING_FIELDS)}
      {whereNext(data, place, session)}
    </>
  );
}

/** Counts a place as looked up, so it is not suggested again. */
function remember(session: MoodSession, place: string, data: { location: string }) {
  if (!session.seen.includes(data.location)) session.checked++;
  session.seen.push(place, data.location);
}

/* ---------- mood <place> vs <place> ---------- */

async function versus(places: [string, string], ctx: Ctx): Promise<ReactNode> {
  const session = ctx.state.mood;
  ctx.print(
    <Dim>
      asking MoodForecast AI about {places[0]} and {places[1]} ...
    </Dim>,
  );

  // Both at once; a place that fails keeps its error so the message can name it.
  const [a, b] = await Promise.all(
    places.map(place =>
      ask<Wellbeing>(`/api/wellbeing/${encodeURIComponent(place)}`).catch((error: unknown) => ({ error })),
    ),
  );
  if ('error' in a) return problem(a.error, places[0], session);
  if ('error' in b) return problem(b.error, places[1], session);
  remember(session, places[0], a);
  remember(session, places[1], b);

  const name = (data: Wellbeing) => data.location.split(',')[0];
  const gap = Math.abs(a.mood_score - b.mood_score);
  const [ahead, behind] = a.mood_score >= b.mood_score ? [a, b] : [b, a];
  const warmer = a.weather.temp_c >= b.weather.temp_c ? a : b;
  const degrees = Math.round(Math.abs(a.weather.temp_c - b.weather.temp_c));
  const column = (data: Wellbeing): ReactNode[] => [
    <Accent>{data.location}</Accent>,
    <>
      {data.mood_score}/100{data.mood_label ? ` ${data.mood_label}` : ''}
    </>,
    data.energy_level,
    data.risk_level,
    `${data.weather.condition}, ${data.weather.temp_c}°C`,
    data.weather.is_day === false ? 'night' : 'day',
  ];
  const left = column(a);
  const right = column(b);

  return (
    <>
      <div className="rows rows-3">
        {['', 'mood score', 'energy', 'risk', 'weather', 'time'].map((label, index) => (
          <Fragment key={label}>
            <Dim>{label}</Dim>
            <span>{left[index]}</span>
            <span>{right[index]}</span>
          </Fragment>
        ))}
      </div>
      {'\n'}
      {gap ? (
        <>
          <Accent>{name(ahead)}</Accent> is having the better day, {gap} {gap === 1 ? 'point' : 'points'} ahead of{' '}
          {name(behind)}.
        </>
      ) : (
        <>A tie: both sit at {a.mood_score}.</>
      )}
      {degrees ? ` ${name(warmer)} is ${degrees}°C warmer.` : ' Same temperature, too.'}
      {'\n\n'}
      <Dim>try another pairing:</Dim>{' '}
      <PlaceCmds
        places={elsewhere(session, 2, ...places, a.location, b.location)}
        before={`mood ${places[0].toLowerCase()} vs`}
      />
    </>
  );
}

/* ---------- mood week <place> ---------- */

/** "Mon 5 Oct" */
function dayName(date: string): string {
  const day = new Date(`${date}T12:00:00`);
  if (Number.isNaN(day.getTime())) return date;
  return day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
}

async function week(place: string, ctx: Ctx): Promise<ReactNode> {
  const session = ctx.state.mood;
  ctx.print(<Dim>asking MoodForecast AI about the week ahead in {place} ...</Dim>);

  let data: Forecast;
  try {
    data = await ask<Forecast>(`/api/forecast/${encodeURIComponent(place)}`);
  } catch (error) {
    return problem(error, place, session);
  }
  if (!data.daily.length) return <Warn>the service has no forecast for {data.location} right now.</Warn>;

  const best = data.daily.reduce((top, day) => (day.mood_score > top.mood_score ? day : top));
  const today = data.daily[0];
  return (
    <>
      <Accent>{data.location}</Accent> <Dim>— the week ahead, scored day by day</Dim>{'\n'}
      <div className="rows rows-3">
        {data.daily.map(day => {
          const rain = day.precipitation_chance;
          return (
            <Fragment key={day.date}>
              <span>{dayName(day.date)}</span>
              <span>
                <Bar score={day.mood_score} /> {day.mood_score} {day.mood_label}
              </span>
              <Dim>
                {day.condition}, {Math.round(day.temp_min_c)}–{Math.round(day.temp_max_c)}°C
                {rain != null ? `, rain ${Math.round(rain)}%` : ''}
              </Dim>
            </Fragment>
          );
        })}
      </div>
      {'\n'}
      best day: <Accent>{dayName(best.date)}</Accent> ({best.mood_score}, {best.mood_label})
      {today.sunrise && today.sunset ? <Dim>{`  ·  daylight today ${today.sunrise}–${today.sunset}`}</Dim> : null}
      {newFields(data, FORECAST_FIELDS)}
      {'\n\n'}
      <Dim>how is the week shaping up elsewhere?</Dim>{' '}
      <PlaceCmds places={elsewhere(session, 2, place, data.location)} before="mood week" />
    </>
  );
}

/* ---------- mood api, and endpoints with no presentation of their own ---------- */

async function api(session: MoodSession): Promise<ReactNode> {
  const found = await endpoints(session);
  return (
    <>
      <Accent>MoodForecast AI</Accent>{' '}
      <Dim>
        {session.known?.live
          ? '— what the live service offers right now'
          : '— the service did not answer, so this is what it offered at the last sync'}
      </Dim>
      {'\n'}
      <Rows
        rows={found.map(endpoint => [
          <Accent>{usage(endpoint)}</Accent>,
          <>
            {endpoint.about} <Dim>{endpoint.name in BUILT_IN ? '' : '(picked up on its own)'}</Dim>
          </>,
        ])}
      />
      {'\n'}
      <Dim>
        read from the service’s own <Link href={`${MOOD_API}/docs`}>API description</Link>: an endpoint added there
        works here straight away.
      </Dim>
    </>
  );
}

/** `mood <name> <place> [key=value ...]` for an endpoint this file was never told about. */
async function other(endpoint: Endpoint, words: string[], ctx: Ctx): Promise<ReactNode> {
  const session = ctx.state.mood;
  const query = new URLSearchParams();
  const placeWords: string[] = [];
  for (const word of words) {
    const [key, ...value] = word.split('=');
    if (value.length && endpoint.params.some(param => param.name === key)) query.set(key, value.join('='));
    else placeWords.push(word);
  }
  const place = placeWords.join(' ');
  const missing = endpoint.params.filter(param => param.required && !query.has(param.name));
  if (!place || missing.length) {
    return (
      <>
        <Warn>usage: {usage(endpoint)}</Warn>
        {endpoint.about ? `\n${endpoint.about}` : null}
      </>
    );
  }

  ctx.print(
    <Dim>
      asking MoodForecast AI for {endpoint.name} in {place} ...
    </Dim>,
  );
  let data: { location?: string };
  try {
    const suffix = query.size ? `?${query}` : '';
    data = await ask<{ location?: string }>(`/api/${endpoint.name}/${encodeURIComponent(place)}${suffix}`);
  } catch (error) {
    return problem(error, place, session);
  }
  if (typeof data.location === 'string') remember(session, place, { location: data.location });

  return (
    <>
      <Accent>{data.location ?? place}</Accent> <Dim>— {endpoint.name}, live from the MoodForecast AI service</Dim>
      {'\n'}
      <Rows rows={fieldRows(data, ['location'])} />
      {'\n'}
      <Dim>and elsewhere?</Dim>{' '}
      <PlaceCmds places={elsewhere(session, 2, place, data.location ?? '')} before={`mood ${endpoint.name}`} />
    </>
  );
}

export async function mood(args: string[], ctx: Ctx): Promise<ReactNode> {
  const session = ctx.state.mood;
  const words = args.filter(Boolean);
  if (!words.length) return guide(session);
  if (words.length === 1 && SURPRISE.includes(words[0].toLowerCase())) return reading(elsewhere(session, 1)[0], ctx);

  const first = words[0].toLowerCase();
  const rest = words.slice(1).join(' ');
  if (words.length === 1 && (first === 'api' || first === 'features')) return api(session);

  if (rest) {
    const endpoint = (await endpoints(session)).find(candidate => candidate.name === first);
    if (endpoint?.name === 'wellbeing') return reading(rest, ctx);
    if (endpoint && !(endpoint.name in BUILT_IN)) return other(endpoint, words.slice(1), ctx);
  }
  if (first === 'week' || first === 'forecast') {
    if (rest) return week(rest, ctx);
    return (
      <>
        <Warn>mood {first}: which place?</Warn> <PlaceCmds places={elsewhere(session, 3)} before="mood week" />
      </>
    );
  }

  const split = words.findIndex(word => /^(vs\.?|versus)$/i.test(word));
  if (split >= 0) {
    const pair: [string, string] = [words.slice(0, split).join(' '), words.slice(split + 1).join(' ')];
    if (pair[0] && pair[1]) return versus(pair, ctx);
    const known = pair[0] || pair[1];
    return (
      <>
        <Warn>mood vs: it takes two places.</Warn>{' '}
        <PlaceCmds
          places={elsewhere(session, 2, known)}
          before={known ? `mood ${known.toLowerCase()} vs` : 'mood nairobi vs'}
        />
      </>
    );
  }
  return reading(words.join(' '), ctx);
}
