// src/components/geo/globePinMarker.js
//
// HTML pin used on both the interactive world globe and the page background.
// CSS2DRenderer centers this node and overwrites its transform, so the root
// stays zero-size and the stack's bottom tip is the lat/lng.

import { initialsOf } from '../../services/avatarMapMark';
import { avatarIdOf } from '../../services/avatarProximity';

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {Object} group
 * @param {(group: Object) => void} [onInspect]
 * @param {(group: Object|null) => void} [onHover]
 * @param {string|null} [selectedAssistantId]
 * @param {{interactive?: boolean}} [options]
 * @returns {HTMLElement}
 */
export function globeMarkerElement(
  group,
  onInspect,
  onHover,
  selectedAssistantId,
  options = {}
) {
  const interactive = options.interactive !== false;
  const el = document.createElement(interactive ? 'button' : 'div');
  if (interactive) el.type = 'button';
  const isSelected =
    group.avatars?.some(
      (avatar) => avatarIdOf(avatar) === selectedAssistantId
    ) ?? false;
  const ring = isSelected ? '#fbbf24' : 'rgba(251,191,36,0.55)';
  const pointer = interactive ? 'auto' : 'none';
  el.style.cssText = `border:0;background:transparent;padding:0;margin:0;width:0;height:0;overflow:visible;cursor:${interactive ? 'pointer' : 'default'};pointer-events:${pointer};`;
  const count = group.avatars?.length || group.count || 1;
  const labelAvatar = group.labelAvatar ?? group.avatars?.[0];
  const stack = document.createElement('div');
  stack.style.cssText = `position:absolute;left:0;top:0;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:${pointer};`;
  const caret = `<div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${ring}"></div>`;
  if (count <= 1 && labelAvatar) {
    const name = labelAvatar.name ?? 'Avatar';
    stack.innerHTML = `
      <div style="max-width:7rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:11px system-ui,sans-serif;color:#e5e5e5;background:rgba(0,0,0,0.7);padding:1px 6px;border-radius:999px;border:1px solid ${isSelected ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.1)'}">${escapeHtml(name)}</div>
      <div style="width:28px;height:28px;border-radius:999px;background:rgba(0,0,0,0.75);border:2px solid ${ring};box-shadow:${isSelected ? '0 0 0 3px rgba(251,191,36,0.35)' : 'none'};color:#f5f5f5;font:700 10px system-ui,sans-serif;display:flex;align-items:center;justify-content:center">${escapeHtml(initialsOf(name))}</div>
      ${caret}`;
  } else {
    stack.innerHTML = `<div style="min-width:32px;height:32px;padding:0 8px;border-radius:999px;background:rgba(0,0,0,0.8);border:2px solid ${ring};color:#fbbf24;font:700 13px system-ui,sans-serif;display:flex;align-items:center;justify-content:center">${count}</div>${caret}`;
  }
  el.appendChild(stack);
  if (interactive) {
    el.addEventListener('click', (event) => {
      event.stopPropagation();
      onInspect?.(group);
    });
    el.addEventListener('mouseenter', () => onHover?.(group));
    el.addEventListener('mouseleave', () => onHover?.(null));
  }
  return el;
}
