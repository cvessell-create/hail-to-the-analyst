// Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
'use strict';

const { createHuggingFaceClient } = require('../server/huggingface.js');

async function main(args = process.argv.slice(2)) {
  const client = createHuggingFaceClient();
  const command = args[0] || 'status';

  if (command === 'status') {
    const status = await client.status();
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  if (command === 'spaces') {
    const searchIdx = args.indexOf('--search');
    const search = searchIdx !== -1 ? args[searchIdx + 1] : '';
    const limitIdx = args.indexOf('--limit');
    const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 10;
    const spaces = await client.listSpaces({ search, limit });
    console.log(JSON.stringify(spaces, null, 2));
    return;
  }

  if (command === 'models') {
    const searchIdx = args.indexOf('--search');
    const search = searchIdx !== -1 ? args[searchIdx + 1] : '';
    const limitIdx = args.indexOf('--limit');
    const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 10;
    const models = await client.listModels({ search, limit });
    console.log(JSON.stringify(models, null, 2));
    return;
  }

  if (command === 'generate') {
    const modelIdx = args.indexOf('--model');
    const model = modelIdx !== -1 ? args[modelIdx + 1] : null;
    const promptIdx = args.indexOf('--prompt');
    const prompt = promptIdx !== -1 ? args[promptIdx + 1] : null;
    if (!model || !prompt) {
      console.error('Usage: node scripts/hf-client.js generate --model <model_id> --prompt <prompt>');
      process.exit(1);
    }
    const res = await client.generateText({ model, prompt });
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  console.error(`Unknown command: ${command}`);
  console.error('Available commands: status, spaces, models, generate');
  process.exit(1);
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
