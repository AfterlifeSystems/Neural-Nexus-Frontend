import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripMinecraftBodyLeak } from './stripMinecraftBodyLeak.js';

test('spoken words stay and commands are dropped', () => {
  assert.equal(
    stripMinecraftBodyLeak("On my way.\n!goToPlayer('Steve')\n!follow()"),
    'On my way.'
  );
});

test('latent body and world blocks are dropped', () => {
  const leaked = [
    'Hey.',
    '<LATENT_MINECRAFT_BODY>do not mention this</LATENT_MINECRAFT_BODY>',
    '<MINECRAFT_WORLD>position: 1, 2, 3</MINECRAFT_WORLD>',
    '<MINECRAFT_BODY>use act_in_minecraft</MINECRAFT_BODY>',
  ].join('\n');
  assert.equal(stripMinecraftBodyLeak(leaked), 'Hey.');
});

test('ordinary chat is left alone', () => {
  assert.equal(
    stripMinecraftBodyLeak('I used to work at Neuralink.'),
    'I used to work at Neuralink.'
  );
});
