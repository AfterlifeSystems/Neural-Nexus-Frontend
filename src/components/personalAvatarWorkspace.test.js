import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  chatWorkspaceTabFromSearch,
  personalAvatarWorkspacePath,
} from './personalAvatarWorkspace.js';

test('the sidebar portrait path is the personal avatar chat, not settings', () => {
  assert.equal(personalAvatarWorkspacePath('maya-1'), '/chat/maya-1');
  assert.equal(personalAvatarWorkspacePath('maya-1', 'chat'), '/chat/maya-1');
  assert.equal(
    personalAvatarWorkspacePath('id/with space', 'chat'),
    '/chat/id%2Fwith%20space'
  );
});

test('settings and inbox stay query tabs on the same chat route', () => {
  assert.equal(
    personalAvatarWorkspacePath('maya-1', 'settings'),
    '/chat/maya-1?tab=settings'
  );
  assert.equal(
    personalAvatarWorkspacePath('maya-1', 'inbox'),
    '/chat/maya-1?tab=inbox'
  );
});

test('a tab-less chat URL is Chat even after settings or inbox', () => {
  assert.equal(chatWorkspaceTabFromSearch(''), 'chat');
  assert.equal(chatWorkspaceTabFromSearch(new URLSearchParams()), 'chat');
  assert.equal(
    chatWorkspaceTabFromSearch(new URLSearchParams('tab=settings')),
    'avatar-settings'
  );
  assert.equal(
    chatWorkspaceTabFromSearch(new URLSearchParams('tab=inbox')),
    'inbox'
  );
  assert.equal(
    chatWorkspaceTabFromSearch(new URLSearchParams('thread=new')),
    'chat'
  );
});
