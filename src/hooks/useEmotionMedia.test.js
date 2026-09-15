import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const hooksDirectory = dirname(fileURLToPath(import.meta.url));

test('the open assistant emotion manifest is read from cache during render', () => {
  const hookSource = readFileSync(
    join(hooksDirectory, 'useEmotionMedia.js'),
    'utf8'
  );
  assert.match(
    hookSource,
    /manifestCache\.get\(assistantId\) \?\? null/
  );
  assert.match(hookSource, /if \(loaded\.assistantId !== assistantId\)/);
  assert.doesNotMatch(
    hookSource,
    /useState\(\s*\(\) => manifestCache\.get\(assistantId\) \?\? null\s*\)/
  );
});
