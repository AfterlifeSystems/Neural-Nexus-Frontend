import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  portraitEmptyStateNotice,
  voiceEmptyStateNotice,
} from './researchBootstrapNotices.js';

test('an avatar nobody researched keeps its ordinary empty-state prompt', () => {
  // The generic "Drop, click, or paste a URL" is right when nothing has looked.
  assert.equal(portraitEmptyStateNotice(null), '');
  assert.equal(voiceEmptyStateNotice(null), '');
  assert.equal(portraitEmptyStateNotice({}), '');
});

test('a research that found the assets says nothing extra', () => {
  const found = {
    portrait_attempted: true,
    portrait_acquired: true,
    voice_attempted: true,
    voice_acquired: true,
  };
  assert.equal(portraitEmptyStateNotice(found), '');
  assert.equal(voiceEmptyStateNotice(found), '');
});

test('a subject that could not be identified is reported with the reason', () => {
  // This is the whole point of persisting the outcome: the progress stream is
  // gone by the time Settings is opened, and the owner still needs to know that
  // something looked and came back empty-handed.
  const notFound = {
    portrait_attempted: true,
    portrait_acquired: false,
    portrait_reason: '4 pictures were examined and none could be confirmed as Ada.',
    voice_attempted: true,
    voice_acquired: false,
    voice_reason: 'No recording of this subject speaking could be found.',
  };
  const portrait = portraitEmptyStateNotice(notFound);
  assert.match(portrait, /No photograph of this subject could be found/);
  assert.match(portrait, /none could be confirmed as Ada/);
  assert.match(portrait, /Add one here/);

  const voice = voiceEmptyStateNotice(notFound);
  assert.match(voice, /No recording of this subject speaking could be found/);
  assert.match(voice, /Upload one here/);
});

test('an outcome with no reason still says that the search came back empty', () => {
  assert.match(
    portraitEmptyStateNotice({ portrait_attempted: true, portrait_acquired: false }),
    /No photograph of this subject could be found\. Add one here\./
  );
  assert.match(
    voiceEmptyStateNotice({ voice_attempted: true, voice_acquired: false }),
    /No recording of this subject speaking could be found\. Upload one here\./
  );
});

test('an asset the research never went looking for keeps the ordinary prompt', () => {
  // Only the half that was attempted is reported on.
  const portraitOnly = {
    portrait_attempted: true,
    portrait_acquired: false,
    voice_attempted: false,
  };
  assert.notEqual(portraitEmptyStateNotice(portraitOnly), '');
  assert.equal(voiceEmptyStateNotice(portraitOnly), '');
});
