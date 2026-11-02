import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy } from '../vite.config';

// The policy exactly as the build writes it into the page
const transform = contentSecurityPolicy('https://moodforecastai-production.up.railway.app').transformIndexHtml as {
  handler: (html: string) => string;
};
const page = transform.handler(readFileSync('index.html', 'utf8'));
const policy = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(page)?.[1] ?? '';
const directive = (name: string) => policy.split('; ').find(part => part.startsWith(`${name} `));

describe('content security policy', () => {
  it('is written into the built page once', () => {
    expect(page.match(/Content-Security-Policy/g)).toHaveLength(1);
  });

  it('allows nothing by default and nothing inline or evaluated', () => {
    expect(directive('default-src')).toBe("default-src 'none'");
    expect(directive('script-src')).toBe("script-src 'self'");
    expect(policy).not.toMatch(/unsafe-|\*|http:/);
  });

  it('lets the page talk only to itself and the mood service', () => {
    expect(directive('connect-src')).toBe("connect-src 'self' https://moodforecastai-production.up.railway.app");
  });

  it('allows no base address, forms, plugins or untyped script sinks', () => {
    expect(directive('base-uri')).toBe("base-uri 'none'");
    expect(directive('form-action')).toBe("form-action 'none'");
    expect(directive('object-src')).toBe("object-src 'none'");
    expect(directive('require-trusted-types-for')).toBe("require-trusted-types-for 'script'");
  });

  it('allows each inline style block by its hash', () => {
    expect(directive('style-src')?.match(/'sha256-/g)).toHaveLength([...page.matchAll(/<style>/g)].length);
  });
});
