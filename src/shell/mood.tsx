// The `mood` command: live calls to the MoodForecast AI service.
import type { ReactNode } from 'react';
import type { Ctx } from './commands';
import { Accent, Cmd, Dim, Rows, Warn } from './ui';

const MOOD_API = 'https://moodforecastai-production.up.railway.app';

interface Wellbeing {
  location: string;
  weather: { temp_c: number; condition: string; humidity: number; wind_kph: number };
  mood_score: number;
  energy_level: string;
  risk_level: string;
  ai_summary?: string | null;
  recommendations: string[];
}

export async function mood(args: string[], ctx: Ctx): Promise<ReactNode> {
  const location = args.join(' ') || 'Nairobi';
  ctx.print(<Dim>contacting MoodForecast AI for {location} ...</Dim>);

  try {
    const response = await fetch(`${MOOD_API}/api/wellbeing/${encodeURIComponent(location)}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (response.ok) {
      const data = (await response.json()) as Wellbeing;
      return (
        <>
          <Accent>{data.location}</Accent> <Dim>— live from the MoodForecast AI service</Dim>{'\n'}
          <Rows
            rows={[
              ['mood score', <Accent>{data.mood_score}/100</Accent>],
              ['energy', data.energy_level],
              ['risk', data.risk_level],
              ['weather', `${data.weather.condition}, ${data.weather.temp_c}°C, humidity ${data.weather.humidity}%`],
            ]}
          />
          {data.ai_summary ? `\n${data.ai_summary}\n` : null}
          {data.recommendations.length ? '\n' : null}
          {data.recommendations.map(item => `  • ${item}\n`)}
        </>
      );
    }

    const health = await fetch(`${MOOD_API}/health`, { signal: AbortSignal.timeout(8000) });
    if (!health.ok) throw new Error('health check failed');
    return (
      <>
        <Accent>service is up</Accent>, but it could not produce a reading for “{location}”{' '}
        <Dim>(HTTP {response.status})</Dim>.{'\n'}
        <Dim>
          The API is healthy; its upstream weather provider did not answer. Try another city, or see how the score is
          built:
        </Dim>{' '}
        <Cmd>cat ~/projects/moodforecast-ai/data/scoring-rules.md</Cmd>
      </>
    );
  } catch {
    return (
      <>
        <Warn>could not reach the MoodForecast AI service.</Warn>{'\n'}
        <Dim>It may be asleep or you may be offline. The project notes are still here:</Dim>{' '}
        <Cmd>cat ~/projects/moodforecast-ai/README.md</Cmd>
      </>
    );
  }
}
