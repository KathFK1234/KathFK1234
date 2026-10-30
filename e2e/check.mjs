// Opens the built site in Chrome at five widths and in five themes, and fails on a console error,
// a Content-Security-Policy violation, a failed asset, sideways scrolling or an accessibility problem.
// Usage: npm run build && npx vite preview --port 4791 & node e2e/check.mjs http://localhost:4791/
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer-core';

const url = process.argv[2];
if (!url) throw new Error('Usage: node e2e/check.mjs <url>');
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const commands = ['help', 'about', 'ls -l', 'tree projects', 'projects', 'skills', 'updates', 'cat README.md', 'grep psychology', 'man mood', 'history', 'nosuchcommand'];

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
const problems = [];
page.on('console', message => {
  if (message.type() === 'error' || /Content.Security.Policy/i.test(message.text())) problems.push(`console: ${message.text().slice(0, 200)}`);
});
page.on('pageerror', error => problems.push(`page error: ${error.message}`));
page.on('response', response => {
  if (response.status() >= 400 && response.url().startsWith(url)) problems.push(`HTTP ${response.status()} ${response.url()}`);
});

const run = async command => {
  await page.click('input');
  await page.keyboard.type(command);
  await page.keyboard.press('Enter');
};
const look = async label => {
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (sideways > 0) problems.push(`${label}: ${sideways}px of sideways scrolling`);
  await page.evaluate(axeSource);
  const found = await page.evaluate(async () => (await window.axe.run(document)).violations.map(violation => violation.id));
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
