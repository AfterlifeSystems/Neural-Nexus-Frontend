import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  avatarWorkspacePath,
  chatWorkspaceTabFromSearch,
  personalAvatarWorkspacePath,
  workspaceHeaderPortraitTab,
} from './personalAvatarWorkspace.js';

test('the workspace header portrait opens chat from inbox, settings, and selection', () => {
  assert.equal(workspaceHeaderPortraitTab(), 'chat');
  assert.equal(
    avatarWorkspacePath('maya-1', workspaceHeaderPortraitTab()),
    '/chat/maya-1'
  );
  const headerSource = readFileSync(
    new URL('./AvatarWorkspaceHeader.jsx', import.meta.url),
    'utf8'
  );
  assert.match(headerSource, /data-workspace-portrait/);
  assert.match(headerSource, /flex flex-col/);
  assert.match(
    headerSource,
    /onTabChange\(workspaceHeaderPortraitTab\(\)\)/
  );
  const portraitIndex = headerSource.indexOf('data-workspace-portrait');
  const navIndex = headerSource.indexOf('aria-label="Avatar workspace"');
  assert.ok(portraitIndex > 0 && portraitIndex < navIndex);
});

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

test('avatar selection is its own path; the other tabs stay on the workspace', () => {
  assert.equal(avatarWorkspacePath('maya-1', 'avatar-selection'), '/avatars');
  assert.equal(avatarWorkspacePath(null, 'avatar-selection'), '/avatars');
  assert.equal(avatarWorkspacePath('maya-1', 'chat'), '/chat/maya-1');
  assert.equal(
    avatarWorkspacePath('maya-1', 'avatar-settings'),
    '/chat/maya-1?tab=settings'
  );
  assert.equal(avatarWorkspacePath('maya-1', 'inbox'), '/chat/maya-1?tab=inbox');
  assert.equal(avatarWorkspacePath(null, 'chat'), null);
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
