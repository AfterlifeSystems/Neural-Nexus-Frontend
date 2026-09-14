/**
 * Drop Minecraft body leaks from a reply the person is meant to read.
 *
 * Commands and the latent world block belong on the act_in_minecraft tool,
 * not in chat. If a model still emits them as text, strip them before paint.
 */

const LEAKED_MINECRAFT_BODY_PATTERNS = [
  /<LATENT_MINECRAFT_BODY>[\s\S]*?<\/LATENT_MINECRAFT_BODY>/gi,
  /<MINECRAFT_BODY>[\s\S]*?<\/MINECRAFT_BODY>/gi,
  /<MINECRAFT_WORLD>[\s\S]*?<\/MINECRAFT_WORLD>/gi,
  /Closed command list:[^\n]*/gi,
  /Never read commands aloud[^\n]*/gi,
  /!([A-Za-z_]+)\([^)]*\)/g,
];

export function stripMinecraftBodyLeak(text) {
  let cleaned = String(text ?? '');
  for (const pattern of LEAKED_MINECRAFT_BODY_PATTERNS) {
    cleaned = cleaned.replace(pattern, ' ');
  }
  return cleaned.replace(/\s+/g, ' ').trim();
}
