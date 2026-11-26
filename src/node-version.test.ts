import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Railway builds the copy with the Node version in .node-version; CI builds and tests with
// the one in the workflow. They must be the same, or the live copy runs on an untested Node.
describe('Node version', () => {
  it('is the same for Railway and CI', () => {
    const pinned = readFileSync('.node-version', 'utf8').trim();
    const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
    const ci = [...workflow.matchAll(/node-version:\s*['"]?([\w.]+)/g)].map(match => match[1]);
    expect(ci.length).toBeGreaterThan(0);
    for (const version of ci) expect(version).toBe(pinned);
  });
});
