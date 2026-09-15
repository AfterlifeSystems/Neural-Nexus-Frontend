import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  avatarGalleryKeepAliveClassName,
  avatarWorkspaceKeepAliveClassName,
  createAvatarOverlayVisibility,
  avatarWorkspacePath,
  chatWorkspaceAvatarId,
  chatWorkspacePaintedTab,
  chatWorkspaceTabFromSearch,
  isAvatarChatLocation,
  isAvatarSelectionLocation,
  isAvatarSettingsLocation,
  isAvatarWorkspaceEscapeLocation,
  personalAvatarWorkspacePath,
  workspaceHeaderPortraitLabel,
  workspaceHeaderPortraitTab,
} from './personalAvatarWorkspace.js';

test('the workspace header portrait swaps chat and avatar selection', () => {
  assert.equal(workspaceHeaderPortraitTab('chat'), 'avatar-selection');
  assert.equal(
    avatarWorkspacePath('maya-1', workspaceHeaderPortraitTab('chat')),
    '/avatars'
  );
  assert.equal(workspaceHeaderPortraitTab('avatar-selection'), 'chat');
  assert.equal(
    avatarWorkspacePath('maya-1', workspaceHeaderPortraitTab('avatar-selection')),
    '/chat/maya-1'
  );
  assert.equal(workspaceHeaderPortraitTab('inbox'), 'chat');
  assert.equal(workspaceHeaderPortraitTab('avatar-settings'), 'chat');
  assert.equal(
    workspaceHeaderPortraitLabel('chat', 'Maya'),
    'Open avatar selection'
  );
  assert.equal(
    workspaceHeaderPortraitLabel('avatar-selection', 'Maya'),
    'Open chat with Maya'
  );
  const headerSource = readFileSync(
    new URL('./AvatarWorkspaceHeader.jsx', import.meta.url),
    'utf8'
  );
  assert.match(headerSource, /data-workspace-portrait/);
  assert.match(headerSource, /flex flex-col/);
  assert.match(
    headerSource,
    /onTabChange\(workspaceHeaderPortraitTab\(activeTab\)\)/
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

test('Escape on chat, inbox, or avatar settings leaves for avatar selection', () => {
  assert.equal(isAvatarWorkspaceEscapeLocation('/chat/maya-1'), true);
  assert.equal(isAvatarWorkspaceEscapeLocation('/inbox'), true);
  assert.equal(isAvatarWorkspaceEscapeLocation('/avatars'), false);
  assert.equal(isAvatarWorkspaceEscapeLocation('/account'), false);
});

test('ArrowUp only leaves from avatar settings', () => {
  assert.equal(isAvatarSettingsLocation('/chat/maya-1', '?tab=settings'), true);
  assert.equal(
    isAvatarSettingsLocation(
      '/chat/maya-1',
      new URLSearchParams('tab=settings')
    ),
    true
  );
  assert.equal(isAvatarSettingsLocation('/chat/maya-1', ''), false);
  assert.equal(isAvatarSettingsLocation('/chat/maya-1', '?tab=inbox'), false);
  assert.equal(isAvatarSettingsLocation('/inbox'), false);
  assert.equal(isAvatarSettingsLocation('/avatars'), false);
});

test('ArrowDown only leaves from chat', () => {
  assert.equal(isAvatarChatLocation('/chat/maya-1', ''), true);
  assert.equal(
    isAvatarChatLocation('/chat/maya-1', new URLSearchParams('thread=new')),
    true
  );
  assert.equal(isAvatarChatLocation('/chat/maya-1', '?tab=settings'), false);
  assert.equal(isAvatarChatLocation('/chat/maya-1', '?tab=inbox'), false);
  assert.equal(isAvatarChatLocation('/inbox'), false);
  assert.equal(isAvatarChatLocation('/avatars'), false);
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

test('settings through the gallery to chat paints chat on the first frame', () => {
  assert.equal(
    chatWorkspacePaintedTab({
      pathname: '/avatars',
      search: '',
      tabHeldUnderGallery: 'avatar-settings',
    }),
    'avatar-settings'
  );
  assert.equal(
    chatWorkspacePaintedTab({
      pathname: '/chat/maya-1',
      search: '',
      tabHeldUnderGallery: 'avatar-settings',
    }),
    'chat'
  );
  assert.equal(
    chatWorkspacePaintedTab({
      pathname: '/chat/maya-1',
      search: '?tab=settings',
      tabHeldUnderGallery: 'chat',
    }),
    'avatar-settings'
  );
  assert.equal(
    chatWorkspacePaintedTab({
      pathname: '/chat/maya-1',
      search: '?tab=inbox',
      tabHeldUnderGallery: 'avatar-settings',
      isPersonalAvatar: false,
    }),
    'chat'
  );
});

test('messages and voice mode share the same underline workspace tabs', () => {
  const headerSource = readFileSync(
    new URL('./AvatarWorkspaceHeader.jsx', import.meta.url),
    'utf8'
  );
  const stylesheet = readFileSync(
    new URL('../index.css', import.meta.url),
    'utf8'
  );
  assert.match(headerSource, /voice-workspace-tab/);
  assert.match(headerSource, /border-b-2 border-amber-400/);
  assert.match(
    stylesheet,
    /button\.voice-workspace-tab,\s*\.voice-stage button\.voice-workspace-tab/
  );
  assert.match(
    stylesheet,
    /button\.voice-workspace-tab\.voice-workspace-tab-active,\s*\.voice-stage button\.voice-workspace-tab\.voice-workspace-tab-active/
  );
  assert.match(stylesheet, /border-bottom:\s*2px solid rgb\(251 191 36\)/);
});

test('Create Avatar overlay inherits hide from the kept-alive gallery', () => {
  assert.equal(createAvatarOverlayVisibility(true, true), '');
  assert.equal(createAvatarOverlayVisibility(true, false), 'hidden');
  assert.equal(createAvatarOverlayVisibility(false, true), 'hidden');
  assert.equal(createAvatarOverlayVisibility(false, false), 'hidden');
});

test('the signed-in frame keeps the gallery mounted off Avatar Selection', () => {
  assert.equal(isAvatarSelectionLocation('/avatars'), true);
  assert.equal(isAvatarSelectionLocation('/chat/maya-1'), false);
  assert.equal(
    avatarGalleryKeepAliveClassName(true),
    'h-full w-full min-h-0'
  );
  assert.match(
    avatarGalleryKeepAliveClassName(false),
    /invisible pointer-events-none absolute inset-0/
  );
  const protectedSource = readFileSync(
    new URL('./ProtectedRoute.jsx', import.meta.url),
    'utf8'
  );
  const mainSource = readFileSync(
    new URL('../main.jsx', import.meta.url),
    'utf8'
  );
  const carouselSource = readFileSync(
    new URL('./AvatarSelectionComponent.jsx', import.meta.url),
    'utf8'
  );
  const gallerySource = readFileSync(
    new URL('./CircularGallery.jsx', import.meta.url),
    'utf8'
  );
  assert.match(protectedSource, /avatarGalleryKeepAliveClassName/);
  assert.match(protectedSource, /avatarWorkspaceKeepAliveClassName/);
  assert.match(protectedSource, /<AvatarSelectionComponent \/>/);
  assert.match(protectedSource, /keepChatMounted \? \(/);
  assert.match(protectedSource, /<ChatArea avatarId=\{keptChatAvatarId\} \/>/);
  assert.match(mainSource, /path="\/avatars" element=\{null\}/);
  assert.match(carouselSource, /isActive=\{galleryIsOpen\}/);
  assert.match(carouselSource, /user && galleryIsOpen/);
  assert.match(carouselSource, /!galleryIsOpen \|\|/);
  assert.match(carouselSource, /createAvatarOverlayVisibility/);
  assert.equal(
    /overlay\.style\.visibility = visible \? 'visible'/.test(carouselSource),
    false
  );
  assert.match(gallerySource, /setActive\(isActive\)/);
  assert.match(gallerySource, /removeEventListeners/);
  const chatSource = readFileSync(
    new URL('./ChatArea.jsx', import.meta.url),
    'utf8'
  );
  const voiceSource = readFileSync(
    new URL('./LiveVoiceMode.jsx', import.meta.url),
    'utf8'
  );
  assert.match(chatSource, /avatarIdFromParent \?\? avatarIdFromRoute/);
  assert.match(chatSource, /chatWorkspacePaintedTab/);
  assert.match(chatSource, /tabHeldUnderGalleryRef/);
  assert.match(chatSource, /search: workspaceSearch/);
  assert.match(chatSource, /chatWorkspaceTabFromSearch\(workspaceSearch\)/);
  assert.match(chatSource, /const workspaceSearch = location\.search/);
  assert.match(chatSource, /cachedPortraitOf/);
  assert.match(chatSource, /seedOpenedAvatarPortraitWell/);
  assert.match(chatSource, /workspaceAlreadyOpen/);
  assert.match(
    chatSource,
    /rounded-2xl border border-white\/10 bg-black\/25 backdrop-blur-md/
  );
  assert.match(carouselSource, /seedOpenedAvatarPortraitWell/);
  assert.doesNotMatch(carouselSource, /setActiveConversation\(null\)/);
  assert.match(
    chatSource,
    /!galleryIsCovering &&\s*activeTab === 'avatar-settings'/
  );
  assert.match(voiceSource, /stageIsShowing/);
  assert.match(voiceSource, /invisible pointer-events-none/);
  assert.match(voiceSource, /recalledPortraitWellSize/);
});

test('a chat workspace URL names the avatar that stays mounted under the gallery', () => {
  assert.equal(chatWorkspaceAvatarId('/chat/maya-1'), 'maya-1');
  assert.equal(
    chatWorkspaceAvatarId('/chat/id%2Fwith%20space'),
    'id/with space'
  );
  assert.equal(chatWorkspaceAvatarId('/avatars'), null);
  assert.equal(chatWorkspaceAvatarId('/inbox'), null);
  assert.equal(
    avatarWorkspaceKeepAliveClassName(true),
    'h-full min-h-0 overflow-y-auto overflow-x-hidden'
  );
  assert.match(
    avatarWorkspaceKeepAliveClassName(false),
    /invisible pointer-events-none absolute inset-0/
  );
});
