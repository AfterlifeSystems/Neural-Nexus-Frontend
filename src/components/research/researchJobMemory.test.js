import { test } from 'node:test';
import assert from 'node:assert/strict';

import { activeResearchJobIdFor } from './researchJobMemory.js';

const AVATAR = 'avatar-a';
const OTHER_AVATAR = 'avatar-b';

test('the panel follows the job it started for the avatar on screen', () => {
  assert.equal(
    activeResearchJobIdFor({
      job: { assistantId: AVATAR, id: 'job-1' },
      assistantId: AVATAR,
      rememberedJobId: null,
    }),
    'job-1'
  );
});

test('a job started on another avatar is never followed here', () => {
  // The defect: switching avatars kept the previous avatar's job in state, so
  // the panel followed it under the new avatar's name and — because following
  // sets the running flag — refused to start research on the new avatar.
  assert.equal(
    activeResearchJobIdFor({
      job: { assistantId: OTHER_AVATAR, id: 'job-1' },
      assistantId: AVATAR,
      rememberedJobId: null,
    }),
    null
  );
  // The new avatar's own remembered job still wins over the stale state.
  assert.equal(
    activeResearchJobIdFor({
      job: { assistantId: OTHER_AVATAR, id: 'job-1' },
      assistantId: AVATAR,
      rememberedJobId: 'job-2',
    }),
    'job-2'
  );
});

test('a reload follows the job the browser remembered', () => {
  assert.equal(
    activeResearchJobIdFor({
      job: null,
      assistantId: AVATAR,
      rememberedJobId: 'job-3',
    }),
    'job-3'
  );
});

test('an avatar with no research running follows nothing', () => {
  assert.equal(
    activeResearchJobIdFor({ job: null, assistantId: AVATAR, rememberedJobId: null }),
    null
  );
  assert.equal(
    activeResearchJobIdFor({ job: null, assistantId: '', rememberedJobId: 'job-4' }),
    null
  );
});
