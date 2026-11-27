import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SITE = 'https://kathfk1234.github.io/KathFK1234/';
const html = readFileSync('index.html', 'utf8');
const image = readFileSync('public/og-image.png');

// Every meta tag as [property or name, content]; both forms are written across several lines
const metas = [...html.matchAll(/<meta\s+(?:property|name)="([^"]+)"\s+content="([^"]*)"/g)].map(([, key, content]) => [key, content]);
const tag = (key: string) => metas.filter(([found]) => found === key).map(([, content]) => content);

describe('link previews', () => {
  it.each([
    'description',
    'og:title',
    'og:description',
    'og:type',
    'og:site_name',
    'og:url',
    'og:image',
    'og:image:type',
    'og:image:width',
    'og:image:height',
    'og:image:alt',
    'twitter:card',
    'twitter:title',
    'twitter:description',
    'twitter:image',
    'twitter:image:alt',
  ])('has exactly one %s, with content', key => {
    expect(tag(key)).toHaveLength(1);
    expect(tag(key)[0]).not.toBe('');
  });

  it('points canonical and og:url at the Pages address', () => {
    expect(tag('og:url')).toEqual([SITE]);
    expect(html).toContain(`<link rel="canonical" href="${SITE}" />`);
  });

  it('gives crawlers the absolute address of the published image', () => {
    expect(tag('og:image')).toEqual([`${SITE}og-image.png`]);
    expect(tag('twitter:image')).toEqual(tag('og:image'));
  });

  it('declares the size and type the image really has', () => {
    expect(image.subarray(0, 8).toString('latin1')).toBe('\x89PNG\r\n\x1a\n');
    expect(tag('og:image:type')).toEqual(['image/png']);
    // A PNG's width and height sit straight after its signature and header
    expect(tag('og:image:width')).toEqual([String(image.readUInt32BE(16))]);
    expect(tag('og:image:height')).toEqual([String(image.readUInt32BE(20))]);
  });

  it('keeps the image small enough for WhatsApp to show it', () => {
    // WhatsApp documents no limit; 300 KB is the figure commonly reported for its thumbnails
    expect(statSync('public/og-image.png').size).toBeLessThan(300 * 1024);
  });

  it('asks large cards of X and leaves robots allowing every crawler', () => {
    expect(tag('twitter:card')).toEqual(['summary_large_image']);
    expect(tag('robots')).toEqual([]);
    expect(readFileSync('public/robots.txt', 'utf8')).not.toMatch(/^Disallow:\s*\S/m);
  });
});

describe('how the preview describes Katheu', () => {
  // Kept in step with the LinkedIn headline (2026-11-26): role first, then the backend and AI focus.
  it('leads with the role from LinkedIn in the title and both card titles', () => {
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    expect(title).toBe('Katheu Kilonzo | Software Engineer, Backend &amp; AI Systems');
    expect(tag('og:title')).toEqual([title]);
    expect(tag('twitter:title')).toEqual([title]);
  });

  it('gives every card the same description', () => {
    expect(tag('og:description')).toEqual(tag('description'));
    expect(tag('twitter:description')).toEqual(tag('description'));
  });

  it('gives search engines the same role and description in its structured data', () => {
    const person = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
    expect(person['@type']).toBe('Person');
    expect(person.jobTitle).toBe('Software Engineer, Backend & AI Systems');
    expect(person.description).toBe(tag('description')[0]);
    expect(person.url).toBe(SITE);
  });

  it('never calls Katheu a psychologist: she holds a BA in Psychology, not a licence', () => {
    expect(html).not.toMatch(/psychologist/i);
  });
});
