import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const hooksDirectory = dirname(fileURLToPath(import.meta.url));

test('the open assistant face source is read during render, not only on mount', () => {
  const hookSource = readFileSync(
    join(hooksDirectory, 'useAvatarFaceSource.js'),
    'utf8'
  );
  assert.match(hookSource, /const source = readAvatarFaceSource\(assistantId\)/);
  assert.doesNotMatch(
    hookSource,
    /useState\(\(\) => readAvatarFaceSource\(assistantId\)\)/
  );
});
