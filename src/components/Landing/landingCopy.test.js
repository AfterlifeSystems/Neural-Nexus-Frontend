import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const landingDirectory = dirname(fileURLToPath(import.meta.url));

const readLandingSource = (fileName) =>
  readFileSync(join(landingDirectory, fileName), 'utf8');

const collapsed = (source) => source.replace(/\s+/g, ' ');

test('welcome page copy does not keep the leftover grammar errors', () => {
  const aboutSource = readLandingSource('About.jsx');
  const productSource = readLandingSource('Product.jsx');
  const founderSource = readLandingSource('Founder.jsx');
  const termsSource = readLandingSource('TermsOfService.jsx');
  const sharedAvatarChatSource = readFileSync(
    join(landingDirectory, '..', 'SharedAvatarChat.jsx'),
    'utf8'
  );
  const anonymousSidebarSource = readFileSync(
    join(landingDirectory, '..', 'AnonymousSidebar.jsx'),
    'utf8'
  );

  const aboutText = collapsed(aboutSource);
  const productText = collapsed(productSource);
  const founderText = collapsed(founderSource);
  const termsText = collapsed(termsSource);
  const sharedAvatarChatText = collapsed(sharedAvatarChatSource);
  const anonymousSidebarText = collapsed(anonymousSidebarSource);

  assert.equal(aboutText.includes('aim towards'), false);
  assert.equal(aboutText.includes('well being'), false);
  assert.equal(aboutText.includes('well-being'), true);
  assert.equal(aboutText.includes('We aim to extend'), true);

  assert.equal(productText.includes('Realtime Conversation'), false);
  assert.equal(productText.includes('Real-time Conversation'), true);
  assert.equal(productText.includes('aria-hidden={index !== visibleIndex}'), false);

  assert.equal(
    founderText.includes('A strong data science and engineering professional'),
    false
  );
  assert.equal(founderText.includes('I am a data scientist and engineer'), true);
  assert.equal(founderText.includes('alt={FOUNDER.name}'), false);
  assert.equal(founderText.includes('alt=""'), true);

  assert.equal(termsText.includes('[Your State]'), false);
  assert.equal(termsText.includes('[Your City]'), false);

  assert.equal(
    sharedAvatarChatText.includes('kept against this network connection'),
    false
  );
  assert.equal(
    sharedAvatarChatText.includes('These chats stay with this visit, not'),
    true
  );
  assert.equal(
    anonymousSidebarText.includes('kept against this network connection'),
    false
  );
  assert.equal(
    anonymousSidebarText.includes('These chats stay with this visit, not'),
    true
  );
  assert.equal(
    collapsed(readLandingSource('LandingPage.jsx')).includes('relative z-10'),
    true
  );
  assert.equal(
    collapsed(readLandingSource('Hero.jsx')).includes(
      'relative z-10 w-full max-w-7xl'
    ),
    true
  );
});
