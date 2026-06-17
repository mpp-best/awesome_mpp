#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
//  Awesome MPP / x402 — README generator
// ─────────────────────────────────────────────────────────────────────────
//  Pulls the canonical project data from mpp.best, filters it for relevance
//  and quality, groups it into categories, and writes a clean README.md.
//
//  Run locally:   node scripts/generate-readme.mjs
//  In CI:         see .github/workflows/refresh.yml (monthly + manual)
//
//  Data source (public): raw projects.json from the mpp.best repo.
//  Override with LOCAL_JSON=/path/to/projects.json for offline testing.
// ─────────────────────────────────────────────────────────────────────────

import { writeFileSync, readFileSync } from 'node:fs';

const DATA_URL =
  'https://raw.githubusercontent.com/mpp-best/mpp.best/main/src/data/projects.json';

// Per-category cap keeps the list curated and readable.
const PER_CATEGORY = 80;

// A project is on-topic if any of these tokens appear in its name,
// description, or topics. Tokens are deliberately specific to avoid noise.
const TOPIC_TOKENS = [
  'x402', 'payment', 'micropayment', 'usdc', 'stablecoin',
  'agentic', 'agent payment', 'monetiz', 'wallet', 'm2m',
  'machine payment', 'mcp', '402 ',
];

// Categories in priority order (first match wins).
const CATEGORIES = [
  { id: 'x402',     title: '🔌 x402 Protocol',            test: (s) => /x402|\b402\b/.test(s) },
  { id: 'agents',   title: '🤖 AI Agent Payments',         test: (s) => /agent|agentic/.test(s) },
  { id: 'mcp',      title: '🧩 MCP Payments',              test: (s) => /\bmcp\b|model context protocol/.test(s) },
  { id: 'wallet',   title: '👛 Wallets & Keys',            test: (s) => /wallet|custod|keypair/.test(s) },
  { id: 'usdc',     title: '💵 USDC & Stablecoins',        test: (s) => /usdc|stablecoin/.test(s) },
  { id: 'other',    title: '💳 Payments & Infrastructure', test: () => true },
];

async function loadProjects() {
  if (process.env.LOCAL_JSON) {
    return JSON.parse(readFileSync(process.env.LOCAL_JSON, 'utf8'));
  }
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`Failed to fetch projects.json: ${res.status}`);
  return res.json();
}

const esc = (s) => String(s || '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
const haystack = (p) =>
  `${p.name} ${p.description || ''} ${(p.topics || []).join(' ')}`.toLowerCase();

function isRelevant(p) {
  const h = haystack(p);
  return TOPIC_TOKENS.some((t) => h.includes(t));
}

function isQuality(p) {
  // Keep genuine repos; drop empty 0-star noise.
  const hasDesc = (p.description || '').trim().length >= 15;
  return (p.stars || 0) >= 1 || hasDesc;
}

function categorize(p) {
  const h = haystack(p);
  for (const c of CATEGORIES) if (c.test(h)) return c.id;
  return 'other';
}

function row(p) {
  const stars = (p.stars || 0).toLocaleString();
  const lang = p.language && p.language !== 'N/A' ? p.language : '—';
  const desc = esc(p.description).slice(0, 100) || 'No description.';
  return `| [${esc(p.name)}](${p.url}) | ⭐${stars} | ${lang} | ${desc} |`;
}

function table(list) {
  return [
    '| Project | Stars | Language | Description |',
    '|---------|-------|----------|-------------|',
    ...list.map(row),
  ].join('\n');
}

function main() {
  return loadProjects().then((all) => {
    const repos = all
      .filter((p) => p && p.name && p.url && p.name.includes('/'))
      .filter(isRelevant)
      .filter(isQuality);

    // De-duplicate by name.
    const seen = new Set();
    const unique = repos.filter((p) => (seen.has(p.name) ? false : seen.add(p.name)));

    // Group + sort by stars, cap per category.
    const groups = {};
    for (const c of CATEGORIES) groups[c.id] = [];
    for (const p of unique) groups[categorize(p)].push(p);
    for (const id of Object.keys(groups)) {
      groups[id].sort((a, b) => (b.stars || 0) - (a.stars || 0));
    }

    const total = unique.length;
    const today = new Date().toISOString().slice(0, 10);

    const toc = CATEGORIES
      .filter((c) => groups[c.id].length)
      .map((c) => `- [${c.title}](#${c.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}) (${groups[c.id].length})`)
      .join('\n');

    const sections = CATEGORIES.filter((c) => groups[c.id].length)
      .map((c) => {
        const list = groups[c.id].slice(0, PER_CATEGORY);
        const more = groups[c.id].length > PER_CATEGORY
          ? `\n\n> +${groups[c.id].length - PER_CATEGORY} more in this category — [browse all on mpp.best](https://mpp.best).`
          : '';
        return `## ${c.title}\n\n${table(list)}${more}`;
      })
      .join('\n\n');

    const readme = `# 🤖 Awesome MPP / x402 — Machine Payments Ecosystem

> A curated, auto-updated list of open-source projects, SDKs, and tools for **AI agent payments**, the **x402 protocol**, **USDC micropayments**, **MCP server payments**, and **agentic commerce**.

### 🔎 Browse the full directory → **[mpp.best](https://mpp.best)**

[mpp.best](https://mpp.best) tracks open-source AI payment & x402 projects with search, categories, free developer tools (an [x402 response builder](https://mpp.best/tools/x402-builder) and a [USDC unit converter](https://mpp.best/tools/usdc-converter)), and in-depth [guides](https://mpp.best/blog). This repo is the open companion list.

**Useful links:** [x402 protocol guide](https://mpp.best/x402) · [Protocol comparison](https://mpp.best/compare) · [AI agent payments](https://mpp.best/ai-agent-payments) · [Submit a project](https://mpp.best/submit)

[![Awesome](https://awesome.re/badge.svg)](https://mpp.best)
[![Website](https://img.shields.io/badge/directory-mpp.best-D97A5E)](https://mpp.best)
![Resources](https://img.shields.io/badge/curated_repos-${total}-blue)
![Updated](https://img.shields.io/badge/updated-${today}-brightgreen)

> ⭐ **Find this useful? [Star the repo](https://github.com/mpp-best/awesome_mpp) and [submit your project](https://mpp.best/submit)** — the list refreshes automatically every month.

---

## 📋 Contents
${toc}

---

${sections}

## 🏅 Add the badge

Listed here? Add this badge to your project's README:

\`\`\`markdown
[![Listed on mpp.best](https://img.shields.io/badge/Listed%20on-mpp.best-D97A5E)](https://mpp.best)
\`\`\`

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), or simply [submit your project on mpp.best](https://mpp.best/submit).

---

*${total} curated projects · auto-generated from [mpp.best](https://mpp.best) on ${today}. Maintained by [mpp.best](https://mpp.best) — the AI payments & x402 directory.*
`;

    writeFileSync('README.md', readme);
    console.log(`Wrote README.md — ${total} projects across ${CATEGORIES.filter((c) => groups[c.id].length).length} categories.`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
