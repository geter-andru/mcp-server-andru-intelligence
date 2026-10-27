// The start-here every Andru discovery surface carries (Geter 2026-10-26: "add start-here to the
// discovery files"). Its source is the backend (src/a2a/startHere.js, on the agent card as
// startHere.text); this pins the connector's copy to the same words and puts it in the instructions
// an MCP client reads at initialize.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { START_HERE, SERVER_INSTRUCTIONS } from '../src/catalog.js';

const APPROVED = [
  'Start here:',
  "1. Try preview_company with the company's website. It's free and needs no account: it returns who the company sells to, the buyers who decide, and what the site says versus what those buyers need to hear.",
  "2. Call signup_start with the person's email. Andru emails them a code and an Approve button.",
  '3. Call any tool. Lookups are free, plus 5 free calls a day shared across A2A and MCP.',
  'Docs: https://andru-ai.com/docs/api#authentication',
].join('\n');

test('the start-here is the approved wording, word for word', () => {
  assert.equal(START_HERE, APPROVED);
});

test('the server instructions carry it after the opening paragraph', () => {
  const paragraphs = SERVER_INSTRUCTIONS.split('\n\n');
  assert.match(paragraphs[0], /^Andru helps B2B founders/);
  assert.equal(paragraphs[1], APPROVED);
});
