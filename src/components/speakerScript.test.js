import assert from 'node:assert/strict';
import { test } from 'node:test';
import { speakerIdentityOf } from './speakerIdentity.js';
import {
  SPEAKER_ROLE_AVATAR,
  SPEAKER_ROLE_OTHER,
  SPEAKER_ROLE_SCENE,
  SPEAKER_ROLE_USER,
  editableScriptText,
  hasSpeakerScript,
  hasThirdPartySpeakerScript,
  speakerBubbleRowsOf,
  speakerCaptionText,
  speakerLabelOf,
  speakerLinesOf,
  speakerRoleOf,
  spokenTurnText,
  withoutAddressedAvatarPrefix,
} from './speakerScript.js';

const humanEvan = { humanTurn: true, avatarName: 'Evan' };
const speakerTwo = speakerIdentityOf('Speaker 2');

test('the owner is unlabelled even when named as the avatar; others get a guest identity', () => {
  const lines = speakerLinesOf(
    [
      { speaker: 'Evan', text: 'Hello.', is_owner: true },
      { speaker: 'Evan', text: 'How are you?', is_owner: true },
      { speaker: 'Speaker 2', text: '   ' },
      { speaker: 'Speaker 2', text: 'Fine, thanks.' },
      { speaker: 'Evan', text: 'Good.', is_owner: true },
    ],
    humanEvan
  );
  assert.deepEqual(
    lines.map((line) => ({
      label: line.label,
      role: line.role,
      text: line.text,
      identityName: line.identity?.name ?? null,
    })),
    [
      { label: '', role: SPEAKER_ROLE_USER, text: 'Hello. How are you?', identityName: null },
      {
        label: speakerTwo.name,
        role: SPEAKER_ROLE_OTHER,
        text: 'Fine, thanks.',
        identityName: speakerTwo.name,
      },
      { label: '', role: SPEAKER_ROLE_USER, text: 'Good.', identityName: null },
    ]
  );
});

test('matching the avatar voice on a human turn is the user, not a third party', () => {
  assert.equal(
    speakerRoleOf({ speaker: 'Evan', is_avatar: true }, humanEvan),
    SPEAKER_ROLE_USER
  );
  assert.equal(
    speakerRoleOf(
      { speaker: 'Evan', is_avatar: true },
      { humanTurn: false, avatarName: 'Evan' }
    ),
    SPEAKER_ROLE_AVATAR
  );
  assert.equal(speakerLabelOf(SPEAKER_ROLE_USER, { speaker: 'Evan' }), '');
  assert.equal(speakerLabelOf(SPEAKER_ROLE_AVATAR, { speaker: 'Evan' }), '');
  assert.equal(speakerLabelOf(SPEAKER_ROLE_OTHER, { speaker: 'Speaker 2' }), speakerTwo.name);
});

test('owner wins when the segment is also flagged as the avatar', () => {
  assert.equal(
    speakerRoleOf(
      { speaker: 'Evan', is_owner: true, is_avatar: true },
      humanEvan
    ),
    SPEAKER_ROLE_USER
  );
});

test('overheard voices only split out when someone else spoke', () => {
  assert.equal(
    speakerBubbleRowsOf(
      { speakers: { segments: [{ speaker: 'Evan', text: 'Hi.', is_owner: true }] } },
      humanEvan
    ),
    null
  );
  const rows = speakerBubbleRowsOf(
    {
      speakers: {
        segments: [
          { speaker: 'Evan', text: 'Hi.', is_owner: true },
          { speaker: 'Speaker 2', text: 'Hello.' },
        ],
      },
    },
    humanEvan
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[1].identity.name, speakerTwo.name);
  assert.equal(hasThirdPartySpeakerScript({ content: 'typed' }), false);
});

test('caption text names only third-party lines', () => {
  assert.equal(
    speakerCaptionText(
      [
        { speaker: 'Evan', text: 'Hello.', is_owner: true },
        { speaker: 'Speaker 2', text: 'Hi there.' },
      ],
      humanEvan
    ),
    `Hello.\n${speakerTwo.name}: Hi there.`
  );
});

test('hasSpeakerScript needs at least one segment', () => {
  assert.equal(hasSpeakerScript({ speakers: { segments: [{ speaker: 'A', text: 'x' }] } }), true);
  assert.equal(hasSpeakerScript({ speakers: { segments: [] } }), false);
  assert.equal(hasSpeakerScript({ content: 'typed' }), false);
  assert.equal(hasSpeakerScript(null), false);
});

test('editableScriptText prefers unlabelled speaker words, then content, then blocks', () => {
  assert.equal(editableScriptText({ content: 'typed' }), 'typed');
  assert.equal(
    editableScriptText({
      content: '',
      speakers: {
        segments: [
          { speaker: 'Evan', text: 'Hello.', is_owner: true },
          { speaker: 'Evan', text: 'There.', is_owner: true },
        ],
      },
    }),
    'Hello. There.'
  );
  assert.equal(
    editableScriptText({ content: [{ type: 'text', text: 'block' }] }),
    'block'
  );
});

test('a human turn named as this avatar is shown as the person, not the addressee', () => {
  const talkingToGrant = { humanTurn: true, avatarName: 'Grant Imahara' };
  assert.equal(
    spokenTurnText(
      {
        content: 'Grant Imahara: Hey',
        speakers: {
          segments: [{ speaker: 'Grant Imahara', text: 'Hey' }],
        },
      },
      talkingToGrant
    ),
    'Hey'
  );
  assert.equal(
    spokenTurnText(
      { content: "Shivon Zilis: I'm here, Evan. What's on your mind?" },
      { humanTurn: true, avatarName: 'Shivon Zilis' }
    ),
    "I'm here, Evan. What's on your mind?"
  );
  assert.equal(
    withoutAddressedAvatarPrefix(
      'Grant Imahara: Hey\nHow are you?',
      'Grant Imahara'
    ),
    'Hey\nHow are you?'
  );
  assert.equal(
    withoutAddressedAvatarPrefix(
      'See Grant Imahara: the clip is on.',
      'Grant Imahara'
    ),
    'See Grant Imahara: the clip is on.'
  );
  assert.equal(
    editableScriptText({ content: 'Grant Imahara: Hey' }, talkingToGrant),
    'Hey'
  );
});

test('sound that is nobody talking is ambience, not a participant', () => {
  // A television in the next room sets the scene the words were said in. It is
  // labelled — that is what makes it readable — but it is never given a
  // person's identity, and it does not make the turn a conversation with a
  // third party.
  const segments = [
    { speaker: 'background', text: 'a television in the next room', is_scene: true },
    { speaker: 'Evan', text: 'Where were we?', is_owner: true },
  ];
  const [ambience, person] = speakerLinesOf(segments, { humanTurn: true });
  assert.equal(ambience.role, SPEAKER_ROLE_SCENE);
  assert.equal(ambience.label, 'background');
  assert.equal(ambience.identity, null);
  assert.equal(person.label, '');
  assert.equal(
    hasThirdPartySpeakerScript({ speakers: { segments } }, { humanTurn: true }),
    false
  );
});
