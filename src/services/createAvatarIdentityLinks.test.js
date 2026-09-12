import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addIdentityLinkDraft,
  collectIdentityLinks,
  composeCreateAvatarResearchHint,
  identityUrlsForUpload,
  researchHintFromIdentityLinks,
  takeIdentityLinkDraft,
} from './createAvatarIdentityLinks.js';

test('collectIdentityLinks keeps order and drops YouTube duplicates', () => {
  assert.deepEqual(
    collectIdentityLinks(
      ['https://example.com/one'],
      'https://youtu.be/dQw4w9WgXcQ\nhttps://example.com/one\nhttps://www.youtube.com/watch?v=dQw4w9WgXcQ'
    ),
    [
      'https://example.com/one',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    ]
  );
});

test('collectIdentityLinks returns the existing list when the draft is empty', () => {
  assert.deepEqual(collectIdentityLinks(['https://example.com/a'], '   '), [
    'https://example.com/a',
  ]);
  assert.deepEqual(collectIdentityLinks([], ''), []);
});

test('addIdentityLinkDraft rejects an empty or non-URL draft', () => {
  const existing = ['https://example.com/a'];
  assert.equal(addIdentityLinkDraft(existing, '').error.length > 0, true);
  assert.deepEqual(addIdentityLinkDraft(existing, '   ').links, existing);
  assert.equal(addIdentityLinkDraft(existing, 'not a url').error.length > 0, true);
  assert.equal(addIdentityLinkDraft(existing, 'not a url').leftover, 'not a url');
});

test('addIdentityLinkDraft accepts a pasted list and clears the leftover', () => {
  const result = addIdentityLinkDraft(
    [],
    'https://example.com/a  https://example.com/b'
  );
  assert.equal(result.error, '');
  assert.equal(result.leftover, '');
  assert.deepEqual(result.links, [
    'https://example.com/a',
    'https://example.com/b',
  ]);
});

test('takeIdentityLinkDraft allows an empty draft so create can send zero links', () => {
  const empty = takeIdentityLinkDraft([], '');
  assert.deepEqual(empty, { links: [], leftover: '', error: '' });
  const kept = takeIdentityLinkDraft(['https://example.com/a'], '  ');
  assert.deepEqual(kept, {
    links: ['https://example.com/a'],
    leftover: '',
    error: '',
  });
});

test('takeIdentityLinkDraft blocks create when leftover text is not a URL', () => {
  const result = takeIdentityLinkDraft(['https://example.com/a'], 'wikipedia');
  assert.equal(result.links[0], 'https://example.com/a');
  assert.equal(result.leftover, 'wikipedia');
  assert.match(result.error, /clear the field/);
});

test('takeIdentityLinkDraft drains a valid draft into the list', () => {
  const result = takeIdentityLinkDraft(
    ['https://example.com/a'],
    ' https://example.com/b '
  );
  assert.deepEqual(result.links, [
    'https://example.com/a',
    'https://example.com/b',
  ]);
  assert.equal(result.error, '');
});

test('researchHintFromIdentityLinks names one link or several', () => {
  assert.equal(researchHintFromIdentityLinks([]), '');
  assert.equal(
    researchHintFromIdentityLinks([' https://example.com/maya ']),
    'An identity source link was given: https://example.com/maya.'
  );
  assert.match(
    researchHintFromIdentityLinks([
      'https://example.com/a',
      'https://example.com/b',
    ]),
    /Identity source links were given: https:\/\/example\.com\/a, https:\/\/example\.com\/b\./
  );
});

test('composeCreateAvatarResearchHint appends identity links to the photo hint', () => {
  assert.equal(composeCreateAvatarResearchHint('Photo hint.', []), 'Photo hint.');
  assert.equal(
    composeCreateAvatarResearchHint('', ['https://example.com/a']),
    'An identity source link was given: https://example.com/a.'
  );
  assert.equal(
    composeCreateAvatarResearchHint('Photo hint.', ['https://example.com/a']),
    'Photo hint. An identity source link was given: https://example.com/a.'
  );
});

test('identityUrlsForUpload drops the photograph address and YouTube equivalents', () => {
  assert.deepEqual(
    identityUrlsForUpload(
      [
        'https://example.com/maya.jpg',
        'https://example.com/bio',
        'https://youtu.be/dQw4w9WgXcQ',
      ],
      ' https://example.com/maya.jpg '
    ),
    [
      'https://example.com/bio',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    ]
  );
  assert.deepEqual(
    identityUrlsForUpload(
      ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
      'https://youtu.be/dQw4w9WgXcQ'
    ),
    []
  );
});
