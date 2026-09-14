import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  GITHUB_SPONSORS_BUTTON_EMBED,
  GITHUB_SPONSORS_PAGE_URL,
} from './githubSponsors.js';

test('the sponsor button points at the efwoods GitHub Sponsors page', () => {
  assert.equal(GITHUB_SPONSORS_PAGE_URL, 'https://github.com/sponsors/efwoods');
  assert.equal(
    GITHUB_SPONSORS_BUTTON_EMBED.src,
    'https://github.com/sponsors/efwoods/button'
  );
  assert.equal(GITHUB_SPONSORS_BUTTON_EMBED.title, 'Sponsor efwoods');
  assert.equal(GITHUB_SPONSORS_BUTTON_EMBED.height, 32);
  assert.equal(GITHUB_SPONSORS_BUTTON_EMBED.width, 114);
});
