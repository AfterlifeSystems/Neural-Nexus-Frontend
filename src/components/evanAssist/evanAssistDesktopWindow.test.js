import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canFloatAssistOnDesktop,
  canOfferAssistDesktopPopout,
  closeAssistDesktopWindow,
  copyStylesIntoDocument,
  decorateDesktopDocument,
  openAssistDesktopWindow,
  resizeAssistDesktopWindow,
} from './evanAssistDesktopWindow.js';

test('desktop float is available only when documentPictureInPicture exists', () => {
  assert.equal(canFloatAssistOnDesktop({}), false);
  assert.equal(
    canFloatAssistOnDesktop({
      documentPictureInPicture: { requestWindow: async () => ({}) },
    }),
    true
  );
});

test('desktop pop-out is not offered while the feature is disabled', () => {
  assert.equal(
    canOfferAssistDesktopPopout({
      documentPictureInPicture: { requestWindow: async () => ({}) },
    }),
    false
  );
});

test('copyStylesIntoDocument clones stylesheet nodes into the other head', () => {
  const cloned = [];
  const styleNode = {
    cloneNode: (deep) => {
      cloned.push(deep);
      return { kind: 'style' };
    },
  };
  const appended = [];
  const copied = copyStylesIntoDocument(
    {
      querySelectorAll: () => [styleNode],
      documentElement: { className: 'dark' },
    },
    {
      head: { appendChild: (node) => appended.push(node) },
      documentElement: { className: '' },
    }
  );
  assert.equal(copied, 1);
  assert.deepEqual(cloned, [true]);
  assert.deepEqual(appended, [{ kind: 'style' }]);
});

test('openAssistDesktopWindow requests a sized window and decorates it', async () => {
  const styles = [];
  const pipDocument = {
    head: { appendChild: (node) => styles.push(node) },
    documentElement: { className: '', style: {} },
    body: { style: {} },
  };
  const requested = [];
  const pipWindow = { document: pipDocument, closed: false };
  const opened = await openAssistDesktopWindow(
    { width: 320.4, height: 56.2 },
    {
      pictureInPicture: {
        requestWindow: async (options) => {
          requested.push(options);
          return pipWindow;
        },
      },
      sourceDocument: {
        querySelectorAll: () => [{ cloneNode: () => ({ id: 'sheet' }) }],
        documentElement: { className: '' },
      },
    }
  );
  assert.equal(opened, pipWindow);
  assert.deepEqual(requested, [{ width: 320, height: 56 }]);
  assert.equal(styles.length, 1);
  assert.equal(pipDocument.body.style.overflow, 'hidden');
});

test('openAssistDesktopWindow refuses a browser without Picture-in-Picture', async () => {
  await assert.rejects(
    () => openAssistDesktopWindow({ width: 320, height: 56 }, { pictureInPicture: null }),
    { name: 'NotSupportedError' }
  );
});

test('resizeAssistDesktopWindow rounds to the panel size', () => {
  const calls = [];
  resizeAssistDesktopWindow(
    { closed: false, resizeTo: (width, height) => calls.push({ width, height }) },
    { width: 380.9, height: 519.2 }
  );
  assert.deepEqual(calls, [{ width: 381, height: 519 }]);
  resizeAssistDesktopWindow({ closed: true, resizeTo: () => calls.push('nope') }, {
    width: 100,
    height: 100,
  });
  assert.equal(calls.length, 1);
});

test('closeAssistDesktopWindow ignores a missing or already-closed window', () => {
  const closed = [];
  closeAssistDesktopWindow(null);
  closeAssistDesktopWindow({ closed: true, close: () => closed.push('late') });
  closeAssistDesktopWindow({ closed: false, close: () => closed.push('ok') });
  assert.deepEqual(closed, ['ok']);
});

test('decorateDesktopDocument fills the floating window', () => {
  const target = {
    documentElement: { style: {} },
    body: { style: {} },
  };
  decorateDesktopDocument(target);
  assert.equal(target.body.style.margin, '0');
  assert.equal(target.body.style.height, '100%');
});
