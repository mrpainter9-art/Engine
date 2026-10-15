#!/usr/bin/env node
// Stands in for `claude -p --output-format stream-json` in the e2e test: reads the prompt, answers, and in edit mode writes a file.
import fs from 'node:fs';
let prompt = '';
process.stdin.on('data', (d) => { prompt += d; });
process.stdin.on('end', () => {
  const edit = process.argv.includes('acceptEdits');
  const say = (o) => process.stdout.write(JSON.stringify(o) + '\n');
  say({ type: 'assistant', message: { content: [{ type: 'text', text: prompt.includes('Node types and their props') ? '엔진 설명을 받았어요.' : '설명이 없어요.' }] } });
  if (edit) {
    fs.mkdirSync('scripts', { recursive: true });
    fs.writeFileSync('scripts/from_ai.js', 'export default class { ready() { this.game.log("info", "AI가 만든 스크립트"); } }\n');
    say({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Write', input: { file_path: 'scripts/from_ai.js' } }] } });
  }
  say({ type: 'result', duration_ms: 1000, usage: { input_tokens: 1200, output_tokens: 34 }, total_cost_usd: 0.004 });
});
