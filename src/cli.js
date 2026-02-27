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
 *
 * Examples:
 *   npx andru-intel get_thesis_match --productDescription "AI sales platform" --stage "Series A"
 *   npx andru-intel simulate_buyer_persona --persona CFO --productDescription "DevOps automation"
 *   npx andru-intel get_sales_blueprint --companyStage "Series A" --arrTarget "$5M"
 *   npx andru-intel get_icp_fit_score --companyName "Acme Corp" --industry "SaaS"
 *
 * Environment:
 *   ANDRU_API_KEY  (required) — Your Andru Platform API key
 *   ANDRU_API_URL  (optional) — API base URL (default: https://hs-andru-test.onrender.com)
 */

import { tools } from './catalog.js';
import { AndruClient } from './client.js';

function printUsage() {
  console.log(`
andru-intel — Buyer intelligence from your terminal

Usage:
  andru-intel <tool-name> [--param value ...]
  andru-intel list                  Show all available tools
  andru-intel help <tool-name>      Show tool parameters

Examples:
  andru-intel get_thesis_match --productDescription "AI sales platform" --stage "Series A"
  andru-intel simulate_buyer_persona --persona CFO
  andru-intel get_sales_blueprint --companyStage "Series A" --arrTarget "$5M"

Environment:
  ANDRU_API_KEY   Your API key (get one at https://platform.andru-ai.com/settings/api-keys)
  ANDRU_API_URL   API endpoint (default: https://hs-andru-test.onrender.com)

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
    console.error('Get your API key at https://platform.andru-ai.com/settings/api-keys');
    console.error('');
    console.error('Usage: ANDRU_API_KEY=sk_live_... andru-intel ' + toolName + ' [args]');
    process.exit(1);
  }

  const apiUrl = process.env.ANDRU_API_URL || 'https://hs-andru-test.onrender.com';
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
