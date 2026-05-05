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
      // NVD API requires literal colons (no %3A encoding) and no Z suffix.
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

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
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
    return items.map(it => ({
      source: feed.source,
      cssClass: feed.cssClass,
      href: it.link || feed.fallbackHref,
      headline: truncate(it.title, 90) || feed.source,
      time: relativeTime(it.date),
    }));
  } catch {
    return [];
  }
}

export async function onRequestGet(context) {
  const cache = caches.default;
  const cacheKey = new Request('https://eightit.com/__ticker-cache__');

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const fetchedGroups = await Promise.all(FEEDS.map(fetchFeed));
  const groups = [...fetchedGroups, STATIC_ITEMS];
  const maxLen = Math.max(...groups.map(g => g.length));
  const items = [];
  for (let i = 0; i < maxLen; i++) {
    for (const group of groups) {
      if (group[i]) items.push(group[i]);
    }
  }

  const response = new Response(JSON.stringify(items.length ? items : null), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=900',
    },
  });

  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
