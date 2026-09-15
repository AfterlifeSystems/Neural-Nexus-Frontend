import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  mediaIntrinsicSize,
  objectContainBox,
  paintedMediaIn,
  paintedPortraitFrameFor,
  portraitChromePadding,
  portraitComposerReserveHeight,
  PORTRAIT_CHROME_GUTTER_PX,
  portraitWellMediaIn,
  portraitWellAspectsAgree,
  portraitWellIsSquare,
  portraitWellIsTall,
  portraitWellSizeForConstraint,
  portraitWellShouldHoldOutgoingSize,
  portraitWellShouldKeepRememberedSize,
  presentedStageMedia,
  portraitWellBoxStyle,
  portraitWellIsAspectSeed,
  portraitWellSizeIsUsable,
  portraitWellSizesEqual,
  recalledPortraitChrome,
  recalledPortraitWellSize,
  rememberPortraitChrome,
  rememberPortraitWellSize,
  seedPortraitWellAspectIfUnknown,
  suggestionSheetHeightIn,
  VOICE_SUGGESTION_SHEET_SELECTOR,
} from './voicePortraitBox.js';

const componentsDirectory = dirname(fileURLToPath(import.meta.url));

test('an incoming still does not resize a 9:16 well until the loop is painted', () => {
  assert.equal(
    portraitWellShouldHoldOutgoingSize(
      { width: 225, height: 400 },
      { width: 400, height: 400 },
      { width: 400, height: 400 }
    ),
    true
  );
  assert.equal(
    portraitWellShouldHoldOutgoingSize(
      { width: 225, height: 400 },
      { width: 225, height: 400 },
      { width: 720, height: 1280 }
    ),
    false
  );
});

test('a leftover generated canvas does not grow a reference-photo well', () => {
  assert.equal(
    portraitWellShouldKeepRememberedSize(
      { width: 400, height: 400 },
      { width: 225, height: 400 },
      false
    ),
    true
  );
  assert.equal(
    portraitWellShouldKeepRememberedSize(
      { width: 225, height: 400 },
      { width: 400, height: 400 },
      true
    ),
    true
  );
  assert.equal(
    portraitWellShouldKeepRememberedSize(
      { width: 400, height: 400 },
      { width: 225, height: 400 },
      true
    ),
    false
  );
});

test('a 9:16 aspect seed is not painted as a 9 by 16 pixel well', () => {
  assert.equal(portraitWellIsAspectSeed({ width: 9, height: 16 }), true);
  assert.equal(portraitWellIsAspectSeed({ width: 397, height: 706 }), false);
  assert.deepEqual(portraitWellBoxStyle({ width: 9, height: 16 }), {
    width: 'auto',
    height: '100%',
    maxWidth: '100%',
    aspectRatio: '9 / 16',
  });
  assert.deepEqual(portraitWellBoxStyle({ width: 400, height: 400 }), {
    width: 400,
    height: 400,
  });
});

test('LoopingVideo presentation payloads do not count as painted media', () => {
  assert.equal(
    presentedStageMedia({ src: 'loop.mp4', poster: 'still.png' }),
    null
  );
  const canvas = { tagName: 'CANVAS', width: 9, height: 16 };
  assert.equal(presentedStageMedia(canvas), canvas);
  assert.equal(presentedStageMedia(null), null);
});

test('a zero constraint does not count as a usable well', () => {
  assert.equal(portraitWellSizeIsUsable(null), false);
  assert.equal(portraitWellSizeIsUsable({ width: 0, height: 0 }), false);
  assert.equal(portraitWellSizeIsUsable({ width: 676.643, height: 676.643 }), true);
  assert.equal(
    portraitWellSizesEqual({ width: 676.643, height: 676.643 }, { width: 676.643, height: 676.643 }),
    true
  );
});

test('a square still in a 9:16 well keeps the standing frame on the well', () => {
  const well = { width: 225, height: 400 };
  const still = { tagName: 'IMG', naturalWidth: 400, naturalHeight: 400 };
  const painted = paintedPortraitFrameFor(well, still);
  assert.equal(painted.circle, false);
  assert.deepEqual(
    { x: painted.x, y: painted.y, width: painted.width, height: painted.height },
    { x: 0, y: 0, width: 225, height: 400 }
  );
});

test('a 9:16 loop fills the well so the hairline sits on the portrait', () => {
  const well = { width: 225, height: 400 };
  const loop = { tagName: 'VIDEO', videoWidth: 9, videoHeight: 16 };
  const painted = paintedPortraitFrameFor(well, loop);
  assert.equal(painted.circle, false);
  assert.deepEqual(
    { x: painted.x, y: painted.y, width: painted.width, height: painted.height },
    { x: 0, y: 0, width: 225, height: 400 }
  );
});

test('object-contain letterboxes a tall portrait in a square well', () => {
  assert.deepEqual(objectContainBox(400, 400, 9, 16), {
    x: (400 - 400 * (9 / 16)) / 2,
    y: 0,
    width: 400 * (9 / 16),
    height: 400,
  });
});

test('object-contain letterboxes a wide frame in a square well', () => {
  assert.deepEqual(objectContainBox(400, 400, 16, 9), {
    x: 0,
    y: (400 - 400 * (9 / 16)) / 2,
    width: 400,
    height: 400 * (9 / 16),
  });
});

test('a missing media size fills the well so the glow still has a home', () => {
  assert.deepEqual(objectContainBox(400, 400), {
    x: 0,
    y: 0,
    width: 400,
    height: 400,
  });
});

test('a video reports its decoded size', () => {
  assert.deepEqual(
    mediaIntrinsicSize({
      tagName: 'VIDEO',
      videoWidth: 720,
      videoHeight: 1280,
    }),
    { width: 720, height: 1280 }
  );
  assert.equal(
    mediaIntrinsicSize({ tagName: 'VIDEO', videoWidth: 0, videoHeight: 0 }),
    null
  );
});

test('the portrait well matches a tall clip instead of staying square', () => {
  const size = portraitWellSizeForConstraint(
    { clientWidth: 800, clientHeight: 400 },
    { tagName: 'VIDEO', videoWidth: 9, videoHeight: 16 }
  );
  assert.deepEqual(size, {
    width: 400 * (9 / 16),
    height: 400,
  });
});

test('the portrait well matches a wide clip in a tall stage', () => {
  const size = portraitWellSizeForConstraint(
    { clientWidth: 400, clientHeight: 800 },
    { tagName: 'CANVAS', width: 16, height: 9 }
  );
  assert.deepEqual(size, {
    width: 400,
    height: 400 * (9 / 16),
  });
});

test('an unread clip still gets a square portrait so the stage is not empty', () => {
  assert.deepEqual(
    portraitWellSizeForConstraint({ clientWidth: 800, clientHeight: 400 }, null),
    { width: 400, height: 400 }
  );
});

test('seeding a well aspect does not replace a measured well', () => {
  rememberPortraitWellSize('maya-seed', { width: 180, height: 320 });
  seedPortraitWellAspectIfUnknown('maya-seed', 9, 16);
  assert.deepEqual(recalledPortraitWellSize('maya-seed'), {
    width: 180,
    height: 320,
  });
  seedPortraitWellAspectIfUnknown('maya-new', 9, 16);
  assert.deepEqual(recalledPortraitWellSize('maya-new'), {
    width: 9,
    height: 16,
  });
});

test('seeding a 9:16 well replaces a square still recall', () => {
  rememberPortraitWellSize('maya-square-seed', { width: 547, height: 547 });
  seedPortraitWellAspectIfUnknown('maya-square-seed', 9, 16);
  assert.deepEqual(recalledPortraitWellSize('maya-square-seed'), {
    width: 9,
    height: 16,
  });
});

test('a remembered 9:16 well wins over a square still still on stage', () => {
  assert.equal(portraitWellIsSquare({ width: 400, height: 400 }), true);
  assert.equal(portraitWellIsTall({ width: 9, height: 16 }), true);
  assert.equal(
    portraitWellAspectsAgree({ width: 400, height: 400 }, { width: 9, height: 16 }),
    false
  );
  assert.deepEqual(
    portraitWellSizeForConstraint(
      { clientWidth: 800, clientHeight: 655 },
      { tagName: 'IMG', naturalWidth: 400, naturalHeight: 400 },
      { width: 9, height: 16 }
    ),
    {
      width: 655 * (9 / 16),
      height: 655,
    }
  );
});

test('a remembered well keeps the clip aspect before the video reports a size', () => {
  rememberPortraitWellSize('maya-1', { width: 180, height: 320 });
  assert.deepEqual(recalledPortraitWellSize('maya-1'), {
    width: 180,
    height: 320,
  });
  assert.deepEqual(
    portraitWellSizeForConstraint(
      { clientWidth: 800, clientHeight: 400 },
      null,
      recalledPortraitWellSize('maya-1')
    ),
    {
      width: 400 * (9 / 16),
      height: 400,
    }
  );
});

test('padding is not counted in the well so a square stays square', () => {
  const previous = globalThis.getComputedStyle;
  globalThis.getComputedStyle = () => ({
    paddingLeft: '24px',
    paddingRight: '24px',
    paddingTop: '24px',
    paddingBottom: '24px',
  });
  try {
    assert.deepEqual(
      portraitWellSizeForConstraint(
        { clientWidth: 448, clientHeight: 448, nodeType: 1 },
        { tagName: 'IMG', naturalWidth: 400, naturalHeight: 400 }
      ),
      { width: 400, height: 400 }
    );
  } finally {
    globalThis.getComputedStyle = previous;
  }
});

test('the visible face is the layer that is not at opacity 0', () => {
  const outgoing = { classList: { contains: (name) => name === 'opacity-0' } };
  const incoming = { classList: { contains: () => false } };
  assert.equal(
    paintedMediaIn({
      querySelectorAll: () => [outgoing, incoming],
    }),
    incoming
  );
});

test('voice mode contains a 9:16 loop so the whole portrait is on stage', () => {
  const liveVoice = readFileSync(join(componentsDirectory, 'LiveVoiceMode.jsx'), 'utf8');
  assert.match(liveVoice, /object-contain/);
  assert.match(liveVoice, /object-cover/);
  assert.match(liveVoice, /paintedPortraitFrameFor/);
  assert.match(liveVoice, /rememberPortraitWellSize/);
  assert.match(
    readFileSync(join(componentsDirectory, 'openedAvatarPortraitWell.js'), 'utf8'),
    /seedOpenedAvatarPortraitWell/
  );
  assert.match(liveVoice, /seedOpenedAvatarPortraitWell/);
  assert.match(liveVoice, /wellForAssistantIdRef/);
  assert.match(liveVoice, /openedPortraitWellSize/);
  assert.match(liveVoice, /portraitWellBoxStyle/);
  assert.doesNotMatch(liveVoice, /key=\{assistantId\}/);
  assert.match(liveVoice, /holdNarrowRail/);
  assert.match(
    liveVoice,
    /setPortraitWellSize\(recalledPortraitWellSize\(assistantId\)\)/
  );
  assert.match(liveVoice, /portraitWellSizeIsUsable/);
  assert.doesNotMatch(liveVoice, /visibility: 'hidden'/);
  assert.match(
    liveVoice,
    /Do not remove the class in this effect's cleanup/
  );
  assert.doesNotMatch(liveVoice, /min\(100vw, 100dvh\)/);
});

test('the well follows the painted 9:16 loop, not the square still', () => {
  const still = {
    tagName: 'IMG',
    naturalWidth: 400,
    naturalHeight: 400,
    classList: { contains: () => false },
  };
  const loop = {
    tagName: 'CANVAS',
    width: 720,
    height: 1280,
    classList: { contains: () => false },
  };
  const root = { querySelectorAll: () => [still, loop] };
  assert.equal(portraitWellMediaIn(root), loop);
  assert.deepEqual(
    portraitWellSizeForConstraint(
      { clientWidth: 400, clientHeight: 800 },
      portraitWellMediaIn(root)
    ),
    { width: 400, height: 400 * (16 / 9) }
  );
});

test('voice portrait padding clears the header and the reserved message bar', () => {
  assert.deepEqual(portraitChromePadding(80, 120), {
    paddingTop: 80 + PORTRAIT_CHROME_GUTTER_PX,
    paddingBottom: 120 + PORTRAIT_CHROME_GUTTER_PX,
  });
  assert.deepEqual(portraitChromePadding(0, 0), {
    paddingTop: PORTRAIT_CHROME_GUTTER_PX,
    paddingBottom: PORTRAIT_CHROME_GUTTER_PX,
  });
  const liveVoice = readFileSync(
    join(componentsDirectory, 'LiveVoiceMode.jsx'),
    'utf8'
  );
  assert.match(liveVoice, /portraitChromePadding/);
  assert.match(liveVoice, /stageHeaderHeight/);
  assert.match(liveVoice, /portraitComposerReserveHeight/);
  assert.match(liveVoice, /portraitComposerReserve/);
});

test('the portrait reserve is the folded handle, not the open composer', () => {
  assert.equal(
    portraitComposerReserveHeight({
      collapsedDockHeight: 72,
      lastCollapsedReserveHeight: 72,
    }),
    72
  );
  assert.equal(
    portraitComposerReserveHeight({
      lastCollapsedReserveHeight: 72,
    }),
    72
  );
});

test('remembered chrome padding is restored for the same avatar', () => {
  rememberPortraitChrome('maya-1', {
    headerHeight: 80,
    collapsedDockHeight: 72,
  });
  assert.deepEqual(recalledPortraitChrome('maya-1'), {
    headerHeight: 80,
    collapsedDockHeight: 72,
  });
});

test('the voice stage keeps a collapsed-handle floor for the reserve', () => {
  const liveVoice = readFileSync(
    join(componentsDirectory, 'LiveVoiceMode.jsx'),
    'utf8'
  );
  assert.match(liveVoice, /data-voice-collapsed-dock-floor/);
  assert.match(liveVoice, /VOICE_COMPOSER_DOCK_PADDING_CLASS/);
  assert.match(liveVoice, /stageVisible/);
  const chatArea = readFileSync(
    join(componentsDirectory, 'ChatArea.jsx'),
    'utf8'
  );
  assert.match(chatArea, /voiceModeStageShouldMount/);
  assert.match(chatArea, /stageVisible=\{isLiveModeOpen\}/);
});

test('the suggestion list in the voice dock is what the reserve subtracts', () => {
  const suggestions = readFileSync(
    join(componentsDirectory, 'ConversationSuggestions.jsx'),
    'utf8'
  );
  assert.match(suggestions, /data-voice-suggestion-sheet/);
  assert.equal(
    suggestionSheetHeightIn({
      querySelector: (selector) =>
        selector === VOICE_SUGGESTION_SHEET_SELECTOR
          ? { hidden: false, getBoundingClientRect: () => ({ height: 188 }) }
          : null,
    }),
    188
  );
  assert.equal(
    suggestionSheetHeightIn({
      querySelector: () => ({
        hidden: true,
        getBoundingClientRect: () => ({ height: 188 }),
      }),
    }),
    0
  );
});

test('the suggestion list reserve includes its margin so the well does not twitch', () => {
  const previous = globalThis.getComputedStyle;
  globalThis.getComputedStyle = () => ({
    marginTop: '0px',
    marginBottom: '4px',
  });
  try {
    assert.equal(
      suggestionSheetHeightIn({
        querySelector: () => ({
          hidden: false,
          nodeType: 1,
          getBoundingClientRect: () => ({ height: 200 }),
        }),
      }),
      204
    );
  } finally {
    globalThis.getComputedStyle = previous;
  }
});

test('chrome padding shrinks a 9:16 well so the head clears the header', () => {
  const previous = globalThis.getComputedStyle;
  const chrome = portraitChromePadding(80, 120);
  globalThis.getComputedStyle = () => ({
    paddingLeft: '24px',
    paddingRight: '24px',
    paddingTop: `${chrome.paddingTop}px`,
    paddingBottom: `${chrome.paddingBottom}px`,
  });
  try {
    const media = { tagName: 'CANVAS', width: 9, height: 16 };
    const padded = portraitWellSizeForConstraint(
      { clientWidth: 400, clientHeight: 800, nodeType: 1 },
      media
    );
    const unpadded = portraitWellSizeForConstraint(
      { clientWidth: 400, clientHeight: 800 },
      media
    );
    assert.ok(padded.height < unpadded.height);
    assert.ok(padded.width < unpadded.width);
  } finally {
    globalThis.getComputedStyle = previous;
  }
});

test('an unpainted canvas does not size the well to 300 by 150', () => {
  const canvas = {
    tagName: 'CANVAS',
    width: 300,
    height: 150,
    classList: { contains: () => false },
  };
  assert.equal(
    portraitWellMediaIn({ querySelectorAll: () => [canvas] }),
    null
  );
  assert.deepEqual(
    portraitWellSizeForConstraint(
      { clientWidth: 400, clientHeight: 800 },
      portraitWellMediaIn({ querySelectorAll: () => [canvas] })
    ),
    { width: 400, height: 400 }
  );
});
