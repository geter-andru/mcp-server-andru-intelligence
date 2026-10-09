#!/usr/bin/env node

/**
 * Andru Intelligence CLI
 *
 * Direct command-line access to all 19 Andru intelligence tools.
 * Works from any terminal — Claude Code, Cursor, Codex, plain shell.
 *
 * Usage:
 *   npx andru-intel <tool-name> [--param value ...]
 *   npx andru-intel list
 *   npx andru-intel help <tool-name>
 *   npx andru-intel assets [keywords] [--group Core|Advanced|Strategic|Buy-side] [--available]
 *   npx andru-intel generate "<asset name>" [--out file.md] [--no-wait]
 *   npx andru-intel get-asset <job_id> [--out file.md]
 *
 * Examples:
 *   npx andru-intel get_thesis_match --productDescription "AI sales platform" --stage "Series A"
 *   npx andru-intel simulate_buyer_persona --persona CFO --productDescription "DevOps automation"
 *   npx andru-intel get_sales_blueprint --companyStage "Series A" --arrTarget "$5M"
 *   npx andru-intel get_icp_fit_score --companyName "Acme Corp" --industry "SaaS"
 *
 * Environment:
 *   ANDRU_API_KEY  (required) — Your Andru Platform API key
 *   ANDRU_API_URL  (optional) — API base URL (default: https://api.andru-ai.com)
 */

import fs from 'node:fs';
import { tools } from './catalog.js';
import { AndruClient } from './client.js';

const DEFAULT_URL = 'https://api.andru-ai.com';
const POLL_MS = Number(process.env.ANDRU_POLL_MS) || 10_000;
const MAX_WAIT_MS = 15 * 60_000;

function printUsage() {
  console.log(`
andru-intel — Stakeholder understanding from your terminal

Usage:
  andru-intel <tool-name> [--param value ...]
  andru-intel list                  Show all available tools
  andru-intel help <tool-name>      Show tool parameters
  andru-intel usage                 Show wallet balance and recent charges

Assets (139 deliverables from Andru's catalog):
  andru-intel assets [keywords]     Search the catalog (free)
      --group <Core|Advanced|Strategic|Buy-side>   --available   Only assets you can generate today
  andru-intel generate "<asset>"    Generate an asset at its catalog price; waits and saves it as markdown
      --out <file.md>   Where to save (default: ./<asset-name>.md)   --no-wait   Return the job id only
  andru-intel get-asset <job_id>    Collect a generated asset as markdown   --out <file.md>

Examples:
  andru-intel assets board
  andru-intel generate "Board Presentation" --out board-deck.md
  andru-intel get_thesis_match --productDescription "AI sales platform" --stage "Series A"
  andru-intel simulate_buyer_persona --persona CFO
  andru-intel get_sales_blueprint --companyStage "Series A" --arrTarget "$5M"

Environment:
  ANDRU_API_KEY   Your API key (get one at https://platform.andru-ai.com/settings/developer)
  ANDRU_API_URL   API endpoint (default: https://api.andru-ai.com)

${tools.length} tools available. Run 'andru-intel list' to see them all.
`);
}

function printToolList() {
  console.log(`\n${tools.length} Andru Intelligence Tools:\n`);
  const maxName = Math.max(...tools.map(t => t.name.length));
  for (const tool of tools) {
    const name = tool.name.padEnd(maxName + 2);
    // Truncate description to fit terminal
    const desc = tool.description.length > 80
      ? tool.description.slice(0, 77) + '...'
      : tool.description;
    console.log(`  ${name}${desc}`);
  }
  console.log(`\nRun 'andru-intel help <tool-name>' for parameters.\n`);
}

function printToolHelp(toolName) {
  const tool = tools.find(t => t.name === toolName);
  if (!tool) {
    console.error(`Unknown tool: ${toolName}`);
    console.error(`Run 'andru-intel list' to see available tools.`);
    process.exit(1);
  }

  console.log(`\n${tool.name}`);
  console.log(`${'─'.repeat(tool.name.length)}`);
  console.log(tool.description);

  const props = tool.inputSchema?.properties || {};
  const required = new Set(tool.inputSchema?.required || []);

  if (Object.keys(props).length > 0) {
    console.log(`\nParameters:`);
    for (const [name, schema] of Object.entries(props)) {
      const req = required.has(name) ? ' (required)' : '';
      const type = schema.enum ? schema.enum.join(' | ') : schema.type;
      console.log(`  --${name}  [${type}]${req}`);
      if (schema.description) {
        // Indent description, truncate long ones
        const desc = schema.description.length > 100
          ? schema.description.slice(0, 97) + '...'
          : schema.description;
        console.log(`      ${desc}`);
      }
    }
  }

  console.log(`\nExample:`);
  const exampleArgs = [];
  for (const [name, schema] of Object.entries(props)) {
    if (required.has(name)) {
      const val = schema.enum ? schema.enum[0] : `"..."`;
      exampleArgs.push(`--${name} ${val}`);
    }
  }
  console.log(`  andru-intel ${tool.name} ${exampleArgs.join(' ')}\n`);
}

function parseArgs(argv) {
  const args = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        // Try to parse as JSON for arrays/objects/numbers
        try {
          args[key] = JSON.parse(next);
        } catch {
          args[key] = next;
        }
        i += 2;
      } else {
        args[key] = true;
        i += 1;
      }
    } else {
      i += 1;
    }
  }
  return args;
}

function requireClient() {
  const apiKey = process.env.ANDRU_API_KEY;
  if (!apiKey) {
    console.error('ANDRU_API_KEY not set.');
    console.error('Get your API key at https://platform.andru-ai.com/settings/developer');
    process.exit(1);
  }
  return new AndruClient(apiKey, process.env.ANDRU_API_URL || DEFAULT_URL);
}

const slug = (s) => String(s || 'andru-asset').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'andru-asset';
const firstJson = (result) => { try { return JSON.parse(result.content?.[0]?.text || '{}'); } catch { return {}; } };

async function assetsCommand(argv) {
  const opts = parseArgs(argv);
  const query = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && argv[i - 1] !== '--available')).join(' ');
  const client = requireClient();
  const result = await client.callTool('list_assets', {
    ...(query ? { query } : {}),
    ...(opts.group ? { group: opts.group } : {}),
    ...(opts.available ? { available_only: true } : {}),
    limit: Number(opts.limit) || 20,
  });
  const data = firstJson(result);
  if (!data.assets?.length) { console.log(data.hint || 'No assets matched.'); return; }
  console.log('');
  for (const a of data.assets) {
    const tag = a.available === 'yes' ? '' : '  (coming soon)';
    console.log(`  ${a.name}  ·  ${a.bucket} ${a.price}${a.needs_your_data ? '  ·  needs your data' : ''}${tag}`);
    console.log(`      ${a.what_it_is}`);
    console.log(`      Outcome: ${a.business_outcome}\n`);
  }
  console.log(`Generate one:  andru-intel generate "<asset name>"\n`);
}

async function collect(client, jobId, outPath) {
  const started = Date.now();
  let last = '';
  for (;;) {
    const result = await client.callTool('get_asset', { job_id: jobId });
    const meta = firstJson(result);
    if (meta.status === 'complete') {
      const markdown = result.content?.[1]?.text;
      if (!markdown) { console.log(meta.message || 'Finished — it is in your Andru library.'); return; }
      const file = outPath || `${slug(meta.asset)}.md`;
      fs.writeFileSync(file, markdown);
      process.stderr.write('\n');
      console.log(`Saved ${meta.asset} to ${file}  (charged ${meta.charged}; also in your Andru library: ${meta.library_url})`);
      return;
    }
    if (meta.status !== 'generating') {
      process.stderr.write('\n');
      console.error(meta.message || `Asset job ${meta.status || 'failed'}.`);
      process.exit(1);
    }
    const line = `  ${meta.asset}: ${meta.progress ?? 0}%${meta.stage ? ` (${meta.stage})` : ''}`;
    if (line !== last) { process.stderr.write(`\r${line}   `); last = line; }
    if (Date.now() - started > MAX_WAIT_MS) {
      process.stderr.write('\n');
      console.log(`Still building. Collect it later:  andru-intel get-asset ${jobId}`);
      return;
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

async function generateCommand(argv) {
  const opts = parseArgs(argv);
  const asset = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--out'].includes(argv[i - 1])));
  if (!asset) { console.error('Usage: andru-intel generate "<asset name>" [--out file.md] [--no-wait]'); process.exit(1); }
  const client = requireClient();
  const result = await client.callTool('generate_asset', { asset });
  const data = firstJson(result);
  if (data.status !== 'generating') {
    console.error(data.message || 'Could not start the asset.');
    if (data.suggestions?.length) console.error(`Try: ${data.suggestions.join(' · ')}`);
    if (data.topup_url) console.error(`Top up: ${data.topup_url}`);
    process.exit(1);
  }
  console.log(`Generating ${data.asset} — ${data.price}`);
  if (opts['no-wait']) { console.log(`Collect it with:  andru-intel get-asset ${data.job_id}`); return; }
  await collect(client, data.job_id, typeof opts.out === 'string' ? opts.out : null);
}

async function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    printUsage();
    process.exit(0);
  }

  const command = argv[0];

  if (command === 'list') {
    printToolList();
    process.exit(0);
  }

  if (command === 'help') {
    if (!argv[1]) {
      printUsage();
    } else {
      printToolHelp(argv[1]);
    }
    process.exit(0);
  }

  if (command === 'assets') { await assetsCommand(argv.slice(1)); process.exit(0); }
  if (command === 'generate') { await generateCommand(argv.slice(1)); process.exit(0); }
  if (command === 'get-asset') {
    if (!argv[1]) { console.error('Usage: andru-intel get-asset <job_id> [--out file.md]'); process.exit(1); }
    const opts = parseArgs(argv.slice(2));
    await collect(requireClient(), argv[1], typeof opts.out === 'string' ? opts.out : null);
    process.exit(0);
  }

  if (command === 'usage' || command === 'billing') {
    const apiKey = process.env.ANDRU_API_KEY;
    if (!apiKey) {
      console.error('ANDRU_API_KEY not set.');
      console.error('Get your API key at https://platform.andru-ai.com/settings/developer');
      process.exit(1);
    }

    const apiUrl = process.env.ANDRU_API_URL || 'https://api.andru-ai.com';
    const client = new AndruClient(apiKey, apiUrl);

    try {
      const res = await client.getUsage();
      const d = res.data;

      console.log(`\nAndru Wallet`);
      console.log(`${'─'.repeat(40)}`);
      console.log(`  Balance:  ${d.balance?.formatted || '$0.00'}`);
      console.log(`  Plan:     ${d.plan}${d.unlimited ? ' (unlimited)' : ''}`);
      if (d.free_calls_remaining != null) console.log(`  Free calls left today: ${d.free_calls_remaining} of ${d.free_calls_per_day ?? d.free_calls_per_month}`);

      if (d.recent_mcp_charges && d.recent_mcp_charges.length > 0) {
        console.log(`\nRecent MCP Usage:`);
        for (const charge of d.recent_mcp_charges) {
          const tool = charge.tool.padEnd(30);
          const amt = charge.amount_formatted.padStart(8);
          const date = new Date(charge.date).toLocaleString();
          console.log(`  ${tool} ${amt}  ${date}`);
        }
      } else {
        console.log(`\nNo recent MCP tool charges.`);
      }

      console.log(`\nTop up: ${d.topup_url}\n`);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
    process.exit(0);
  }

  // Tool execution
  const toolName = command;
  const tool = tools.find(t => t.name === toolName);
  if (!tool) {
    console.error(`Unknown tool: ${toolName}`);
    console.error(`Run 'andru-intel list' to see available tools.`);
    process.exit(1);
  }

  const apiKey = process.env.ANDRU_API_KEY;
  if (!apiKey) {
    console.error('ANDRU_API_KEY not set.');
    console.error('Get your API key at https://platform.andru-ai.com/settings/developer');
    console.error('');
    console.error('Usage: ANDRU_API_KEY=sk_live_... andru-intel ' + toolName + ' [args]');
    process.exit(1);
  }

  const apiUrl = process.env.ANDRU_API_URL || 'https://api.andru-ai.com';
  const client = new AndruClient(apiKey, apiUrl);
  const toolArgs = parseArgs(argv.slice(1));

  try {
    const result = await client.callTool(toolName, toolArgs);

    if (result.isError) {
      const text = result.content?.[0]?.text || 'Unknown error';
      console.error(text);
      process.exit(1);
    }

    // Print result — if it's JSON, pretty-print it
    const text = result.content?.[0]?.text || '{}';
    try {
      const parsed = JSON.parse(text);
      console.log(JSON.stringify(parsed, null, 2));
    } catch {
      console.log(text);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
