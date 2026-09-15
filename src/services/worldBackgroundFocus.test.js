import { test } from 'node:test';
import assert from 'node:assert/strict';

import { globeMarkerGroups } from './avatarProximity.js';
import { worldGlobeAutoRotateEnabled } from './globeMap.js';
import {
  assistantIdFromSelectionCard,
  avatarIdForGlobeFocus,
  avatarIdFromGlobeFocusPath,
  focusedGlobeAvatarFromLists,
  geoListingIdentityForViewer,
  getGalleryFocusedAssistantId,
  isWorldMapPath,
  setGalleryFocusedAssistantId,
  singleAvatarGlobeGroup,
} from './worldBackgroundFocus.js';

test('chat and share URLs name the open avatar; other screens do not', () => {
  assert.equal(
    avatarIdFromGlobeFocusPath('/chat/47cfdaa2-1196-4519-9127-31cb13ff9d3a'),
    '47cfdaa2-1196-4519-9127-31cb13ff9d3a'
  );
  assert.equal(
    avatarIdFromGlobeFocusPath('/share/avatar-1/c/thread-9'),
    'avatar-1'
  );
  assert.equal(avatarIdFromGlobeFocusPath('/avatars'), null);
  assert.equal(avatarIdFromGlobeFocusPath('/login'), null);
  assert.equal(avatarIdFromGlobeFocusPath('/map'), null);
});

test('the gallery front card names a focused avatar without putting it in the URL', () => {
  setGalleryFocusedAssistantId(null);
  assert.equal(getGalleryFocusedAssistantId(), null);
  assert.equal(avatarIdForGlobeFocus('/avatars'), null);
  assert.equal(
    assistantIdFromSelectionCard({ type: 'create', text: 'Create Avatar' }),
    null
  );
  assert.equal(
    assistantIdFromSelectionCard({
      type: 'avatar',
      avatar_data: { assistant_id: 'evan' },
    }),
    'evan'
  );
  setGalleryFocusedAssistantId('evan');
  assert.equal(getGalleryFocusedAssistantId(), 'evan');
  assert.equal(avatarIdForGlobeFocus('/avatars'), 'evan');
  assert.equal(
    avatarIdForGlobeFocus('/chat/from-url', 'gallery-id'),
    'from-url'
  );
  setGalleryFocusedAssistantId(null);
});

test('the globe holds still only when the selected avatar has a pin', () => {
  const pinned = {
    assistant_id: 'evan',
    geo_location: { latitude: 33.00393, longitude: -79.999795 },
  };
  const unpinned = { assistant_id: 'other', name: 'Other' };
  assert.equal(
    worldGlobeAutoRotateEnabled({
      hasFocusedPlace: Boolean(
        focusedGlobeAvatarFromLists('evan', [pinned, unpinned])
      ),
    }),
    false
  );
  assert.equal(
    worldGlobeAutoRotateEnabled({
      hasFocusedPlace: Boolean(
        focusedGlobeAvatarFromLists('other', [pinned, unpinned])
      ),
    }),
    true
  );
});

test('the interactive map path is not the page-background globe', () => {
  assert.equal(isWorldMapPath('/map'), true);
  assert.equal(isWorldMapPath('/map/'), true);
  assert.equal(isWorldMapPath('/chat/abc'), false);
});

test('a known record with a pin is the focused globe avatar', () => {
  const pin = { latitude: 33.00393, longitude: -79.999795 };
  const avatar = {
    assistant_id: 'evan',
    name: 'Evan Woods',
    geo_location: pin,
  };
  assert.deepEqual(focusedGlobeAvatarFromLists('evan', [avatar]), {
    avatar,
    pin,
  });
  assert.equal(focusedGlobeAvatarFromLists('other', [avatar]), null);
  const group = singleAvatarGlobeGroup(avatar, pin);
  assert.equal(group.count, 1);
  assert.equal(group.labelAvatar, avatar);
  assert.equal(group.latitude, pin.latitude);
});

test('every pinned avatar stays on the globe when one chat is open', () => {
  const evan = {
    assistant_id: 'evan',
    name: 'Evan Woods',
    geo_location: { latitude: 33.00393, longitude: -79.999795 },
  };
  const shivon = {
    assistant_id: 'shivon',
    name: 'Shivon Zilis',
    geo_location: { latitude: 37.48, longitude: -122.15 },
  };
  const groups = globeMarkerGroups([evan, shivon], 0.8);
  const ids = groups.flatMap((group) =>
    group.avatars.map((avatar) => avatar.assistant_id)
  );
  assert.ok(ids.includes('evan'));
  assert.ok(ids.includes('shivon'));
});

test('login and other unsigned screens list public pins as a visitor', () => {
  assert.deepEqual(geoListingIdentityForViewer(null), {
    asAnonymousIdentity: true,
  });
  assert.deepEqual(geoListingIdentityForViewer(undefined), {
    asAnonymousIdentity: true,
  });
  assert.deepEqual(geoListingIdentityForViewer({ email: 'a@b.c' }), {
    asAnonymousIdentity: false,
  });
});
