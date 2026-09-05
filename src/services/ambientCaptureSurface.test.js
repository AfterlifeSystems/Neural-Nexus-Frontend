import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAmbientCaptureSurface } from './ambientCaptureSurface.js';

test('chat and voice mode may send observations', () => {
  assert.equal(isAmbientCaptureSurface('/chat/abc'), true);
  assert.equal(isAmbientCaptureSurface('/chat/abc', ''), true);
  assert.equal(isAmbientCaptureSurface('/chat/abc', '?'), true);
  assert.equal(isAmbientCaptureSurface('/chat/abc', '?thread=new'), true);
});

test('settings and inbox on the chat route do not send observations', () => {
  assert.equal(isAmbientCaptureSurface('/chat/abc', '?tab=settings'), false);
  assert.equal(
    isAmbientCaptureSurface('/chat/abc', '?tab=settings&section=voice'),
    false
  );
  assert.equal(isAmbientCaptureSurface('/chat/abc', '?tab=inbox'), false);
});

test('the gallery and other signed-in screens do not send observations', () => {
  assert.equal(isAmbientCaptureSurface('/avatars'), false);
  assert.equal(isAmbientCaptureSurface('/account'), false);
  assert.equal(isAmbientCaptureSurface('/billing'), false);
  assert.equal(isAmbientCaptureSurface('/'), false);
});
