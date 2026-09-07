import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countEmotionMediaFailures,
  emotionMediaFailureMessage,
  emotionMediaWasModerated,
  emotionMediaWasWithheld,
  preferEmotionMediaReuploadDirection,
  REUPLOAD_IMAGE_RETRY_DIRECTION,
} from './emotionMediaFailures.js';

const moderatedLoop = (emotion) => ({
  emotion,
  asset_kind: 'idle_loop',
  error_code: 'content_moderated',
});

test('seven moderated loops are named and never invite a retry', () => {
  const failures = ['neutral', 'joy', 'anger', 'sadness', 'fear', 'surprise', 'disgust'].map(
    moderatedLoop
  );
  assert.deepEqual(countEmotionMediaFailures(failures), {
    failedStills: 0,
    failedLoops: 7,
    moderated: 7,
    predicted: 0,
    creditsExhausted: 0,
    total: 7,
  });
  const message = emotionMediaFailureMessage({ failures });
  assert.match(message, /^xAI's content moderation refused 7 emotion videos/);
  assert.match(message, /repeats both the charge and the refusal/);
  assert.doesNotMatch(message, /Try again/i);
  assert.equal(emotionMediaWasModerated({ failures }), true);
});

test('the server sentence wins when present', () => {
  const generation = {
    failures: [moderatedLoop('joy')],
    summary: { message: 'Server said so.' },
  };
  assert.equal(emotionMediaFailureMessage(generation), 'Server said so.');
  assert.equal(
    emotionMediaFailureMessage({ failures: [moderatedLoop('joy')], failure_message: 'Frame said so.' }),
    'Frame said so.'
  );
});

test('a transient failure directs the owner to re-upload the image', () => {
  const failures = [
    { emotion: 'anger', asset_kind: 'still', error_code: 'vendor_error' },
    { emotion: 'anger', asset_kind: 'idle_loop', error_code: 'vendor_error' },
  ];
  assert.equal(
    emotionMediaFailureMessage({ failures }),
    `1 portrait and 1 emotion video could not be generated. ${REUPLOAD_IMAGE_RETRY_DIRECTION}`
  );
  assert.equal(emotionMediaWasModerated({ failures }), false);
});

test('six portraits and seven videos use the same re-upload direction', () => {
  const stills = ['neutral', 'joy', 'anger', 'sadness', 'fear', 'surprise'].map(
    (emotion) => ({ emotion, asset_kind: 'still', error_code: 'vendor_error' })
  );
  const loops = ['neutral', 'joy', 'anger', 'sadness', 'fear', 'surprise', 'disgust'].map(
    (emotion) => ({ emotion, asset_kind: 'idle_loop', error_code: 'vendor_error' })
  );
  assert.equal(
    emotionMediaFailureMessage({ failures: [...stills, ...loops] }),
    `6 portraits and 7 emotion videos could not be generated. ${REUPLOAD_IMAGE_RETRY_DIRECTION}`
  );
});

test('a server sentence that invites a blind retry is rewritten to re-upload', () => {
  assert.equal(
    preferEmotionMediaReuploadDirection(
      '6 portraits and 7 emotion videos could not be generated. Retrying is reasonable.'
    ),
    `6 portraits and 7 emotion videos could not be generated. ${REUPLOAD_IMAGE_RETRY_DIRECTION}`
  );
  assert.equal(
    emotionMediaFailureMessage({
      failures: [{ emotion: 'joy', asset_kind: 'still', error_code: 'vendor_error' }],
      summary: {
        message:
          '6 portraits and 7 emotion videos could not be generated. Retrying is reasonable.',
      },
    }),
    `6 portraits and 7 emotion videos could not be generated. ${REUPLOAD_IMAGE_RETRY_DIRECTION}`
  );
  assert.equal(
    preferEmotionMediaReuploadDirection('Server said so.'),
    'Server said so.'
  );
});

test('a mixed run counts the refused ones', () => {
  const failures = [
    moderatedLoop('joy'),
    { emotion: 'fear', asset_kind: 'idle_loop', error_code: 'vendor_error' },
  ];
  assert.match(emotionMediaFailureMessage({ failures }), /refused 1 of them/);
  assert.equal(emotionMediaWasModerated({ failures }), false);
});

test('nothing failed means nothing to say', () => {
  assert.equal(emotionMediaFailureMessage(null), '');
  assert.equal(emotionMediaFailureMessage({ failures: [] }), '');
  assert.equal(emotionMediaWasModerated({ failures: [] }), false);
});

test('a withheld run says nothing was charged and offers generate anyway', () => {
  const warning =
    'Emotion media was not generated and nothing was charged: this reference image shows a well-known trademarked character. Use a calmer portrait. Or choose "generate anyway".';
  const failures = ['joy', 'anger'].map((emotion) => ({
    emotion,
    asset_kind: 'still',
    error_code: 'moderation_predicted',
    message: warning,
  }));
  assert.equal(countEmotionMediaFailures(failures).predicted, 2);
  assert.equal(emotionMediaFailureMessage({ failures }), warning);
  assert.equal(emotionMediaWasWithheld({ failures }), true);
  assert.equal(emotionMediaWasWithheld({ withheld: true, failures: [] }), true);
  assert.equal(emotionMediaWasModerated({ failures }), false);
  const bare = [{ asset_kind: 'idle_loop', error_code: 'moderation_predicted' }];
  assert.match(emotionMediaFailureMessage({ failures: bare }), /nothing was charged/);
  assert.match(emotionMediaFailureMessage({ failures: bare }), /generate anyway/);
});

test('an exhausted credit line explains the whole run', () => {
  const failures = [
    { emotion: 'joy', asset_kind: 'still', error_code: 'vendor_credits_exhausted' },
    { emotion: 'anger', asset_kind: 'still', error_code: 'not_attempted' },
    { emotion: 'neutral', asset_kind: 'idle_loop', error_code: 'not_attempted' },
  ];
  assert.equal(countEmotionMediaFailures(failures).creditsExhausted, 1);
  const message = emotionMediaFailureMessage({ failures });
  assert.match(message, /used all of its available credits/);
  assert.match(message, /Nothing was generated/);
  assert.equal(emotionMediaWasWithheld({ failures }), false);
  assert.equal(emotionMediaWasModerated({ failures }), false);
});
