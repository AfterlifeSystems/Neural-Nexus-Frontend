import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  avatarSpokenLines,
  forgetAvatarSpokenLines,
  isAvatarSelfEcho,
  isAvatarSpeechFragment,
  rememberAvatarSpeech,
  rememberAvatarSpokenLine,
  spokenSimilarity,
  spokenWordsOf,
} from './selfEchoGuard.js';

const avatarLine =
  'I understand. It can be hard to tell what an image really is when you are seeing something unfamiliar.';

test('punctuation and capitalisation do not affect the words', () => {
  assert.deepEqual(spokenWordsOf('Yeah, exactly!'), ['yeah', 'exactly']);
  assert.deepEqual(spokenWordsOf(null), []);
});

test('the avatar hearing its own reply back is an echo', () => {
  const heard =
    'It can be hard to tell what an image really is when you are seeing something unfamiliar.';
  assert.ok(spokenSimilarity(heard, avatarLine) >= 0.7);
  assert.equal(isAvatarSelfEcho(heard, [avatarLine]), true);
});

test('half of the avatar reply, caught mid-sentence, is still an echo', () => {
  assert.equal(
    isAvatarSelfEcho('when you are seeing something unfamiliar', [avatarLine]),
    true
  );
});

test('a person answering in their own words is not an echo', () => {
  assert.equal(
    isAvatarSelfEcho(
      'That is a really strange way of putting it, but I think I follow you',
      [avatarLine]
    ),
    false
  );
});

test('short agreement is never dropped, even when the avatar said it too', () => {
  assert.equal(isAvatarSelfEcho('Yeah, exactly.', ['Yeah, exactly.']), false);
});

test('nothing matches when the avatar has not spoken', () => {
  assert.equal(isAvatarSelfEcho('It can be hard to tell', []), false);
  assert.equal(isAvatarSelfEcho('It can be hard to tell', undefined), false);
});

test('only the last few spoken lines are remembered', () => {
  let spoken = [];
  for (const line of ['one', 'two', 'three', 'four']) {
    spoken = rememberAvatarSpeech(spoken, line);
  }
  assert.deepEqual(spoken, ['two', 'three', 'four']);
});

test('an empty line is not remembered', () => {
  assert.deepEqual(rememberAvatarSpeech(['one'], '   '), ['one']);
});

test('the tail of a reply, caught as the speakers finished, is an echo', () => {
  const spoken = 'I am sorry something feels like a problem. I am here with you.';
  assert.equal(
    isAvatarSelfEcho('like a problem', [spoken], {
      followedAvatarSpeech: true,
    }),
    true
  );
});

test('the same words later are a person speaking, not an echo', () => {
  const spoken = 'I am sorry something feels like a problem. I am here with you.';
  assert.equal(isAvatarSelfEcho('like a problem', [spoken]), false);
});

test('a fragment must be the avatar words in order', () => {
  const spoken = 'I am sorry something feels like a problem.';
  assert.equal(
    isAvatarSelfEcho('a problem like', [spoken], {
      followedAvatarSpeech: true,
    }),
    false
  );
});

test('two words are never a fragment, however close the avatar just was', () => {
  assert.equal(
    isAvatarSpeechFragment('a problem', ['it feels like a problem']),
    false
  );
});

test('agreeing in two words is never dropped, even inside the window', () => {
  assert.equal(
    isAvatarSelfEcho('Yeah, exactly.', ['Yeah, exactly.'], {
      followedAvatarSpeech: true,
    }),
    false
  );
});

test('a real answer right after the avatar stops still goes through', () => {
  assert.equal(
    isAvatarSelfEcho('no I think that is completely wrong', [
      'I am sorry something feels like a problem.',
    ], { followedAvatarSpeech: true }),
    false
  );
});

test('the lines the avatar spoke are remembered for whoever is listening', () => {
  forgetAvatarSpokenLines();
  assert.deepEqual(avatarSpokenLines(), []);
  rememberAvatarSpokenLine(
    'That sounds like a beautiful place to share with your family.'
  );
  // The screen that speaks and the screen that listens are not always the
  // same one, so the guard asks the module rather than a component's ref.
  assert.equal(
    isAvatarSelfEcho(
      'That sounds like a beautiful place to share with your family.',
      avatarSpokenLines()
    ),
    true
  );
  forgetAvatarSpokenLines();
  assert.equal(
    isAvatarSelfEcho(
      'That sounds like a beautiful place to share with your family.',
      avatarSpokenLines()
    ),
    false
  );
});

test('only the last few spoken lines are kept', () => {
  forgetAvatarSpokenLines();
  for (const line of ['one', 'two', 'three', 'four']) {
    rememberAvatarSpokenLine(line);
  }
  assert.deepEqual(avatarSpokenLines(), ['two', 'three', 'four']);
  forgetAvatarSpokenLines();
});
