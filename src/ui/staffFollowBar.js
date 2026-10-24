// @ts-check
// STAFF-FOLLOW-UNLOCK (2026-10-24, mob: "follow needs a unlock button in game") - THE FOLLOW'S OWN BAR IN THE GAME. While a
// follow is locked the camera is the target's eyes and the Staff Panel's card (its Unlock) may be closed, so the game
// shows a small bar at the top of the screen: "Following" and an Unlock button that lets go at once (net/staffHook.js
// unlock - the host's own `held` then parks or rejoins as ever, scenes/staffFollowHost.js). One element, made on the
// first follow and only shown or hidden after; its words written only when they change. The button takes a free
// cursor's press (Y frees it, as for every window).
import { PIXEL_FONT_CSS, PIXEL_TEXT_SHADOW } from './pixelifyFive.js';
import { STAFF_TAG_COLORS } from './staffTags.js';
import { t } from '../systems/textManager.js';

const BAR_CSS = `position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:13;display:flex;gap:8px;align-items:center;${PIXEL_FONT_CSS}font-size:13px;color:${STAFF_TAG_COLORS.name};background:${STAFF_TAG_COLORS.plate};border:1px solid rgba(127,227,240,0.35);border-radius:3px;padding:3px 6px 3px 10px;text-shadow:${PIXEL_TEXT_SHADOW};pointer-events:auto;`;
const BUTTON_CSS = `${PIXEL_FONT_CSS}font-size:13px;color:${STAFF_TAG_COLORS.plain};background:rgba(224,80,60,0.35);border:1px solid ${STAFF_TAG_COLORS.high};border-radius:3px;padding:1px 8px;cursor:pointer;text-shadow:${PIXEL_TEXT_SHADOW};`;

/** @param {{ doc?: any, onUnlock: () => void }} deps */
export function createStaffFollowBar({ doc = globalThis.document, onUnlock }) {
  if (!doc?.createElement || !doc.body) return { show() {}, hide() {}, dispose() {} };
  let bar = /** @type {any} */ (null), words = /** @type {any} */ (null), said = '', shown = false;
  function make() {
    bar = doc.createElement('div');
    bar.setAttribute('data-staff-follow-bar', '');
    bar.style.cssText = BAR_CSS;
    words = doc.createElement('span');
    const unlock = doc.createElement('button');
    unlock.setAttribute('type', 'button');
    unlock.setAttribute('data-staff-unlock', '');
    unlock.style.cssText = BUTTON_CSS;
    unlock.textContent = t('net.staffFollow.unlock', 'Unlock');
    // the press is the unlock, and the world under it hears nothing of it (a swing, a look)
    for (const k of ['pointerdown', 'mousedown']) unlock.addEventListener?.(k, (/** @type {any} */ e) => e.stopPropagation?.());
    unlock.addEventListener?.('click', (/** @type {any} */ e) => { e.stopPropagation?.(); e.preventDefault?.(); onUnlock(); });
    bar.append(words, unlock);
    doc.body.append(bar);
  }
  return {
    /** Shown while a follow is locked. @param {string} [name] the target's name, when the page knows it */
    show(name = '') {
      if (!bar) make();
      const line = name ? t('net.staffFollow.following', 'Following {name}', { name }) : t('net.staffFollow.followingAnon', 'Following');
      if (line !== said) { said = line; words.textContent = line; }
      if (!shown) { shown = true; bar.style.display = 'flex'; }
    },
    hide() { if (bar && shown) { shown = false; bar.style.display = 'none'; } },
    dispose() { bar?.remove(); bar = null; shown = false; said = ''; },
  };
}
