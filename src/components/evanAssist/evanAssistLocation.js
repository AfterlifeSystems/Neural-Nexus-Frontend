// A short name for wherever the person is standing in Neural Nexus, so Evan
// can talk about the screen they are looking at.

/**
 * @param {string} [pathname]
 * @param {string} [search]
 * @param {string} [activeAvatarName]
 * @returns {string}
 */
export function describeAssistLocation(
  pathname = '',
  search = '',
  activeAvatarName = ''
) {
  const path = pathname ?? '';
  const query = String(search ?? '');
  const params = new URLSearchParams(
    query.startsWith('?') ? query.slice(1) : query
  );
  const tab = params.get('tab');
  const named = String(activeAvatarName ?? '').trim();

  if (path === '/welcome' || path === '/') return 'the welcome page';
  if (path.startsWith('/avatars')) return 'the avatar gallery';
  if (path === '/account') return 'account settings';
  if (path === '/inbox' || tab === 'inbox') return 'the avatar inbox';
  if (path === '/billing' || /\/billing\/?$/.test(path)) return 'billing';
  if (tab === 'settings') {
    return named ? `settings for ${named}` : 'avatar settings';
  }
  if (path.startsWith('/chat/')) {
    return named ? `a conversation with ${named}` : 'a conversation';
  }
  if (path.startsWith('/share/')) {
    return named
      ? `a shared conversation with ${named}`
      : 'a shared avatar page';
  }
  if (path === '/login') return 'the sign-in page';
  if (path === '/signup') return 'the sign-up page';
  return 'Neural Nexus';
}
