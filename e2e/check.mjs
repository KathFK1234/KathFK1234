// Opens the built site in Chrome at five widths and in five themes, and fails on a console error,
// a Content-Security-Policy violation, a failed asset, sideways scrolling, text cut off inside the terminal
// or an accessibility problem, then the keyboard: Tab, history, Shift+Tab out of the prompt and Enter on a command.
// The mood service is answered from fixed data, so no network is needed.
// Usage: npm run build && npx vite preview --port 4791 & node e2e/check.mjs http://localhost:4791/
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer-core';

const url = process.argv[2];
if (!url) throw new Error('Usage: node e2e/check.mjs <url>');
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const commands = ['help', 'about', 'ls -l', 'tree projects', 'projects', 'skills', 'stack', 'updates', 'cat README.md', 'grep psychology', 'man mood', 'history', 'cat privacy.txt', 'nosuchcommand', 'mood nairobi', 'mood nairobi vs tokyo', 'mood week nairobi'];

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
  // A half-typed command, so the grey suggestion after it is measured too; Ctrl+U clears it again
  await page.focus('input');
  await page.keyboard.type('he');
  // axe cannot measure text over a gradient and only marks it for review, so the background glow is swapped
  // for one solid colour: the glow at its brightest over --bg, the hardest place for the text to be read.
  await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const bg = style.getPropertyValue('--bg').trim().match(/[0-9a-f]{2}/gi).map(part => parseInt(part, 16));
    const [r, g, b, alpha] = style.getPropertyValue('--glow').match(/[\d.]+/g).map(Number);
    const brightest = [r, g, b].map((channel, index) => Math.round(channel * alpha + bg[index] * (1 - alpha)));
    document.body.style.backgroundImage = 'none';
    document.body.style.backgroundColor = `rgb(${brightest.join(', ')})`;
  });
  await page.evaluate(axeSource);
  const result = await page.evaluate(async () => {
    const { violations, incomplete } = await window.axe.run(document);
    return {
      found: violations.map(violation => `${violation.id} ${violation.nodes[0].target}`),
      // Text it still could not measure because of what is behind it (block-character bars are not text)
      unmeasured: incomplete
        .filter(check => check.id === 'color-contrast')
        .flatMap(check => check.nodes)
        .filter(node => ['bgGradient', 'bgImage'].includes(node.any[0]?.data?.messageKey)).length,
    };
  });
  await page.evaluate(() => document.body.removeAttribute('style'));
  if (result.found.length) problems.push(`${label}: ${result.found.join(', ')}`);
  if (result.unmeasured) problems.push(`${label}: axe could not measure the contrast of ${result.unmeasured} elements`);
  await page.keyboard.down('Control');
  await page.keyboard.press('u');
  await page.keyboard.up('Control');
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
// The keyboard: Tab completes, the arrows walk history, Shift+Tab leaves the prompt, Enter runs a focused command
await page.goto(url, { waitUntil: 'networkidle2' });
await page.focus('input');
const input = () => page.$eval('input', element => element.value);
await page.keyboard.type('pro');
await page.keyboard.press('Tab');
if ((await input()) !== 'projects ') problems.push(`keyboard: Tab turned "pro" into "${await input()}"`);
await page.keyboard.press('Enter');
// A Tab with several choices opens the menu, and screen readers are told what it offers
await page.keyboard.type('c');
await page.keyboard.press('Tab');
const said = () => page.evaluate(() => document.querySelector('[role="status"]')?.textContent ?? '(no status region)');
if (!/^\d+ completions: /.test(await said())) problems.push(`keyboard: the Tab menu was announced as "${await said()}"`);
await page.keyboard.press('Tab');
if (!/, 1 of \d+$/.test(await said())) problems.push(`keyboard: a second Tab was announced as "${await said()}"`);
await page.keyboard.down('Control');
await page.keyboard.press('u');
await page.keyboard.up('Control');
await page.keyboard.press('ArrowUp');
if ((await input()) !== 'projects') problems.push(`keyboard: ArrowUp gave "${await input()}"`);
await page.keyboard.down('Shift');
await page.keyboard.press('Tab');
await page.keyboard.up('Shift');
const left = await page.evaluate(() => document.activeElement?.tagName);
if (left !== 'BUTTON') problems.push(`keyboard: Shift+Tab left focus on ${left}, not a command or nav button`);
// Back to a nav button: its focus ring is the site's own, 2px and solid, not the browser's
await page.keyboard.down('Shift');
for (let step = 0; step < 80 && !(await page.evaluate(() => document.activeElement?.matches('.navlinks button'))); step++) {
  await page.keyboard.press('Tab');
}
await page.keyboard.up('Shift');
const ring = await page.evaluate(() => {
  const style = getComputedStyle(document.activeElement);
  return document.activeElement.matches('.navlinks button') && style.outlineStyle === 'solid' && parseFloat(style.outlineWidth) >= 2;
});
if (!ring) problems.push('keyboard: a focused nav button shows no clear focus ring of its own');
const before = await page.$$eval('.prompt-line .typed', lines => lines.length);
await page.keyboard.press('Enter');
await new Promise(resolve => setTimeout(resolve, 200));
if ((await page.$$eval('.prompt-line .typed', lines => lines.length)) <= before) problems.push('keyboard: Enter on a focused command did not run it');
await page.keyboard.type('x');
if ((await page.evaluate(() => document.activeElement?.tagName)) !== 'INPUT') problems.push('keyboard: typing after a button did not return to the prompt');

// A line that sounds like crisis gets helplines, reaches no service and is not saved in the history
await page.focus('input');
await page.keyboard.type('mood i want to die');
await page.keyboard.press('Enter');
await new Promise(resolve => setTimeout(resolve, 300));
const crisis = await page.evaluate(() => ({
  helplines: document.body.innerText.includes('Kenya Red Cross'),
  saved: (localStorage.getItem('katheu:history') ?? '').includes('want to die'),
}));
if (!crisis.helplines) problems.push('crisis: "mood i want to die" did not show the helplines');
if (crisis.saved) problems.push('crisis: "mood i want to die" was saved in the history');

// Nothing blinks or pulses for more than five seconds on its own (WCAG 2.2.2)
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
await page.goto(url, { waitUntil: 'networkidle2' });
await new Promise(resolve => setTimeout(resolve, 5500));
const moving = await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').map(animation => animation.animationName));
if (moving.length) problems.push(`still moving after five seconds: ${moving.join(', ')}`);

await browser.close();

for (const problem of problems) console.error(problem);
console.log(`${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
