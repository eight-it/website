#!/usr/bin/env node
// Update the status ticker in index.html from public RSS feeds.
// Usage: node scripts/update-ticker.mjs
// Requires Node 18+ (built-in fetch). No npm dependencies.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_PATH = join(__dirname, '..', 'index.html');
const MARKER_START = '<!-- ticker:start -->';
const MARKER_END = '<!-- ticker:end -->';

const FEEDS = [
  {
    source: 'Cloudflare',
    cssClass: 'status-source-cf',
    url: 'https://www.cloudflarestatus.com/history.rss',
    fallbackHref: 'https://www.cloudflarestatus.com/',
    limit: 2,
  },
  {
    source: 'CISA',
    cssClass: 'status-source-cisa',
    url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml',
    fallbackHref: 'https://www.cisa.gov/news-events/cybersecurity-advisories',
    limit: 2,
  },
  {
    source: 'Threat Intel',
    cssClass: 'status-source-sec',
    url: 'https://www.bleepingcomputer.com/feed/',
    fallbackHref: 'https://www.bleepingcomputer.com/',
    limit: 2,
  },
  {
    source: 'NIST',
    cssClass: 'status-source-nist',
    type: 'json',
    url: () => {
      // NVD API requires literal colons (no %3A encoding) and both pubStartDate + pubEndDate, no Z suffix.
      const fmt = (d) => new Date(d).toISOString().replace('Z', '');
      const start = fmt(Date.now() - 7 * 86_400_000);
      const end = fmt(Date.now());
      return `https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${start}&pubEndDate=${end}&resultsPerPage=20`;
    },
    fallbackHref: 'https://nvd.nist.gov/vuln/search',
    limit: 2,
    parse: (json) => {
      const vulns = json.vulnerabilities || [];
      vulns.sort((a, b) => new Date(b.cve.published) - new Date(a.cve.published));
      return vulns.map(v => {
        const desc = (v.cve.descriptions || []).find(d => d.lang === 'en')?.value || '';
        return {
          title: `${v.cve.id}: ${desc}`,
          link: `https://nvd.nist.gov/vuln/detail/${v.cve.id}`,
          date: v.cve.published,
        };
      });
    },
  },
];

// Microsoft 365 has no public RSS — pinned static item that links to its status page.
const STATIC_ITEMS = [
  {
    source: 'Microsoft 365',
    cssClass: 'status-source-ms',
    href: 'https://status.cloud.microsoft/',
    headline: 'Service health — see public status page',
    time: 'live',
  },
];

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pickTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  const m = block.match(re);
  if (!m) return '';
  return decodeEntities(m[1].replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim());
}

function parseRss(xml, limit) {
  const out = [];
  const itemRe = /<(item|entry)[^>]*>([\s\S]*?)<\/\1>/g;
  let m;
  while ((m = itemRe.exec(xml)) && out.length < limit) {
    const block = m[2];
    const title = pickTag(block, 'title');
    let link = pickTag(block, 'link');
    if (!link) {
      const hrefMatch = block.match(/<link[^>]*href=["']([^"']+)["']/);
      if (hrefMatch) link = hrefMatch[1];
    }
    const date = pickTag(block, 'pubDate') || pickTag(block, 'updated') || pickTag(block, 'published');
    out.push({ title, link, date });
  }
  return out;
}

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const h = Math.floor(diffMs / 3_600_000);
  if (h < 1) return 'now';
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  const wk = Math.floor(days / 7);
  if (wk < 5) return `${wk}w ago`;
  return d.toISOString().slice(0, 10);
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

async function fetchFeed(feed) {
  try {
    const url = typeof feed.url === 'function' ? feed.url() : feed.url;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'eightit-ticker/1.0 (+https://eightit.com)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let items;
    if (feed.type === 'json') {
      const json = await res.json();
      items = feed.parse(json).slice(0, feed.limit);
    } else {
      const xml = await res.text();
      items = parseRss(xml, feed.limit);
    }
    if (items.length === 0) console.warn(`[ticker] ${feed.source}: feed parsed empty`);
    return items.map(it => ({
      source: feed.source,
      cssClass: feed.cssClass,
      href: it.link || feed.fallbackHref,
      headline: truncate(it.title, 90) || feed.source,
      time: relativeTime(it.date),
    }));
  } catch (err) {
    console.warn(`[ticker] ${feed.source}: ${err.message}`);
    return [];
  }
}

function renderItem(item, focusable) {
  const tabAttr = focusable ? '' : ' tabindex="-1"';
  const target = focusable ? ' target="_blank" rel="noopener noreferrer"' : '';
  return `          <li><a class="status-item" href="${escapeHtml(item.href)}"${target}${tabAttr}>
            <span class="status-source ${item.cssClass}">${escapeHtml(item.source)}</span>
            <span class="status-headline">${escapeHtml(item.headline)}</span>
            <span class="status-time">${escapeHtml(item.time || '')}</span>
          </a></li>`;
}

function renderList(items, focusable, hidden) {
  const aria = hidden ? ' aria-hidden="true"' : '';
  return `        <ul class="status-ticker-list"${aria}>\n${items.map(it => renderItem(it, focusable)).join('\n')}\n        </ul>`;
}

async function main() {
  const fetchedGroups = await Promise.all(FEEDS.map(fetchFeed));

  if (fetchedGroups.every(g => g.length === 0)) {
    console.error('[ticker] All feeds failed. Aborting; existing HTML left untouched.');
    process.exit(1);
  }

  // Round-robin interleave so consecutive items don't share a source.
  // Static items are folded in as another group so they get woven in too.
  const groups = [...fetchedGroups, STATIC_ITEMS];
  const maxLen = Math.max(...groups.map(g => g.length));
  const items = [];
  for (let i = 0; i < maxLen; i++) {
    for (const group of groups) {
      if (group[i]) items.push(group[i]);
    }
  }

  const block = `${MARKER_START}\n${renderList(items, true, false)}\n${renderList(items, false, true)}\n        ${MARKER_END}`;

  const html = await readFile(HTML_PATH, 'utf8');
  const start = html.indexOf(MARKER_START);
  const end = html.indexOf(MARKER_END);
  if (start === -1 || end === -1) {
    console.error(`[ticker] Markers not found. Add ${MARKER_START} and ${MARKER_END} around the ticker lists in index.html.`);
    process.exit(1);
  }

  const updated = html.slice(0, start) + block + html.slice(end + MARKER_END.length);
  await writeFile(HTML_PATH, updated);
  console.log(`[ticker] Wrote ${items.length} items to index.html`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
