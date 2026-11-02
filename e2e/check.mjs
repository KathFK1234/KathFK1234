// Opens the built site in Chrome at five widths and in five themes, and fails on a console error,
// a Content-Security-Policy violation, a failed asset, sideways scrolling, text cut off inside the terminal
// or an accessibility problem. The mood service is answered from fixed data, so no network is needed.
// Usage: npm run build && npx vite preview --port 4791 & node e2e/check.mjs http://localhost:4791/
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer-core';

const url = process.argv[2];
if (!url) throw new Error('Usage: node e2e/check.mjs <url>');
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const commands = ['help', 'about', 'ls -l', 'tree projects', 'projects', 'skills', 'stack', 'updates', 'cat README.md', 'grep psychology', 'man mood', 'history', 'nosuchcommand', 'mood nairobi', 'mood nairobi vs tokyo', 'mood week nairobi'];

// MoodForecast AI stands in here with fixed answers, so the check needs no network and tests what the page does with them.
const place = (location, score, temp) => ({
  location,
  weather: { temp_c: temp, feels_like_c: temp, condition: 'Light Rain Showers', humidity: 70, wind_kph: 13.8, is_day: true },
  mood_score: score,
  mood_label: 'Steady',
  baseline_score: 65,
  factors: [{ label: 'Comfortable temperature', delta: 10 }],
  energy_level: 'Medium',
  risk_level: 'Moderate',
  recommendations: ['Take a stretch break every hour.'],
});
const MOOD = {
  '/openapi.json': {
    paths: {
      '/api/wellbeing/{location}': { get: { summary: 'How the weather feels in a place' } },
      '/api/forecast/{location}': { get: { summary: 'The week ahead' } },
    },
  },
  '/api/wellbeing/nairobi': place('Nairobi, KE', 70, 20.5),
  '/api/wellbeing/tokyo': place('Tokyo, JP', 42, 15.1),
  '/api/forecast/nairobi': {
    location: 'Nairobi, KE',
    daily: Array.from({ length: 7 }, (_, day) => ({
      date: `2026-11-0${day + 2}`, condition: 'Heavy Drizzle', temp_max_c: 26, temp_min_c: 16,
      precipitation_chance: 92, sunrise: '06:11', sunset: '18:21', mood_score: 62, mood_label: 'Steady',
    })),
  },
};

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
// New output fades in; measured mid-fade, its contrast would read as too low.
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
const problems = [];
page.on('console', message => {
  if (message.type() === 'error' || /Content.Security.Policy/i.test(message.text())) problems.push(`console: ${message.text().slice(0, 200)}`);
});
page.on('pageerror', error => problems.push(`page error: ${error.message}`));
await page.setRequestInterception(true);
page.on('request', request => {
  const { origin, pathname } = new URL(request.url());
  if (origin !== 'https://moodforecastai-production.up.railway.app') return request.continue();
  const body = MOOD[decodeURIComponent(pathname)];
  request.respond({
    status: body ? 200 : 404,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body ?? { detail: 'Not Found' }),
  });
});
page.on('response', response => {
  if (response.status() >= 400 && response.url().startsWith(url)) problems.push(`HTTP ${response.status()} ${response.url()}`);
});

const run = async command => {
  await page.focus('input');
  await page.keyboard.type(command);
  await page.keyboard.press('Enter');
  // A mood answer arrives a moment later; the prompt is back once it has been printed
  if (command.startsWith('mood ')) await page.waitForFunction(() => !/(contacting|asking) MoodForecast AI[^\n]*\.\.\.$/.test(document.querySelector('[role=log]').lastElementChild?.textContent ?? ''), { timeout: 5000 }).catch(() => {});
};
const look = async label => {
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (sideways > 0) problems.push(`${label}: ${sideways}px of sideways scrolling`);
  // The terminal hides what is wider than it, so anything past its edge is lost rather than scrollable
  const cut = await page.evaluate(() => {
    const terminal = document.querySelector('.terminal');
    return terminal.scrollWidth - terminal.clientWidth;
  });
  if (cut > 0) problems.push(`${label}: ${cut}px cut off at the terminal's right edge`);
  await page.evaluate(axeSource);
  const found = await page.evaluate(async () => (await window.axe.run(document)).violations.map(violation => `${violation.id} ${violation.nodes[0].target}`));
  if (found.length) problems.push(`${label}: ${found.join(', ')}`);
};

for (const width of [320, 390, 768, 1280, 1920]) {
  await page.setViewport({ width, height: 800 });
  await page.goto(url, { waitUntil: 'networkidle2' });
  if (!(await page.$('meta[http-equiv="Content-Security-Policy"]'))) problems.push(`${width}: no Content-Security-Policy`);
  for (const command of commands) await run(command);
  await look(`width ${width}`);
}
await page.setViewport({ width: 390, height: 844 });
for (const theme of ['teal', 'amber', 'matrix', 'violet', 'paper']) {
  await run(`theme ${theme}`);
  await run('cat README.md');
  await look(`theme ${theme}`);
}
await browser.close();

for (const problem of problems) console.error(problem);
console.log(`${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
