// @ts-check
// LOCKPICK (2026-10-26; bible/06-Systems/Lockpicking.md section 4): THE LOCK'S DOOR - the one place a host opens a lock's
// window through (THE ONE CONSTRUCTION SEAM), the Broker's door's shape (ui/brokerDoor.js): the window
// (ui/lockpickWindow.js) in a host of its own, wrapped in the generic overlay shape every host's frame drives, registered
// with the overlay stack, and handed to the host's slot (townTalk.showOverlay on the street, a building's or a dungeon's
// own) - so the world stands still under it offline, as under every window. THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS
// TOLD: `done` reads true only once the DOM is gone, and the host's `onClose` runs last, once.
//
// Both skins open it - a lock is picked offline on the classic skin as online on the enhanced - so it is no lazy chunk of
// the enhanced skin's: the window is small and imported whole. A page with no document answers null.
import { registerOverlay } from './enhanced/enhancedOverlays.js';
import { mountLockpickWindow } from './lockpickWindow.js';

/** The overlay standing now, or null. */
let _open = null;
/** Is a lock's window up. */
export const lockpickDoorOpen = () => !!_open && !_open.done;
/** Shut it, if it is up - and say whether it was. */
export function closeLockpickDoor() {
  const was = lockpickDoorOpen();
  _open?.dispose();
  return was;
}

/**
 * Open the window, as an overlay for the host's slot. `deps` is lockpickWindow.js's own, less `onExit` - the door's close
 * is the window's way out - and plus `onClose`, the host's word that it is shut (once, last).
 * @param {any} deps
 * @returns {any} the overlay, or null with no document
 */
export function createLockpickOverlay(deps) {
  if (typeof document === 'undefined') return null;
  _open?.dispose();
  let fired = false;
  /** @type {any} */
  let view = null;
  const host = document.createElement('div');
  host.id = 'lockpick-host';
  document.body.append(host);
  try { if (document.pointerLockElement) document.exitPointerLock?.(); } catch { /* no lock to let go */ }   // the pins are clicked
  let unregister = () => {};
  /** `self` - the window shut by the player (Esc, Leave, the pad's back, Tab's put-away) or its own hold's end; a
   *  replacement in the slot (the death screen, another window - its `dispose`) is not (AUDIT LOCKPICK A3) */
  const close = (self = false) => {
    if (fired) return;
    unregister();
    view?.unmount();
    view = null;
    host.remove();
    fired = true;   // last: `done` must not read true while the DOM is up
    if (_open === overlay) _open = null;
    deps.onClose?.(self);
  };
  unregister = registerOverlay(() => close(true));
  const overlay = {
    isChoiceWindow: true,
    get done() { return fired; },
    /** A host's mapped press - the gamepad's, where a host routes one (the keyboard is the window's own capture). */
    input(a) {
      if (a === 'left' || a === 'right') view?.act(a);
      else if (a === 'up' || a === 'confirm' || a === 'select') view?.act('press');
      else if (a === 'back') close(true);
    },
    click() { /* the window is a fixed div over the canvas; pointers never get here */ },
    wheel() {},
    hover() {},
    tick() { /* its own animation frame draws it */ },
    draw() { /* DOM, not canvas */ },
    dispose() { close(false); },
    /** The host's own end of a window: the opened lock's hold run out. */
    shut() { close(true); },
    repaint() { view?.repaint(); },
    /** The picks are gone: only Leave stays. */
    out() { view?.out(); },
  };
  _open = overlay;
  view = mountLockpickWindow(host, { ...deps, onExit: () => close(true), onGone: () => close(false) });
  return overlay;
}
