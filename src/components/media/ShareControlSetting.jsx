// src/components/media/ShareControlSetting.jsx
import React from 'react';
import Switch from '../ui/Switch';
import useAvatarShareControl from '../../hooks/useAvatarShareControl';

/**
 * Let the avatar open the camera to take a look, and switch shares off.
 *
 * Off until the owner turns it on. The permission is remembered for this
 * browser only — it is a permission over this device's camera, and granting it
 * on a laptop should not arm it on a phone.
 *
 * **There is no matching switch for the screen, and that is deliberate.** A
 * camera needs a standing permission because the avatar really can reopen one
 * on its own: a granted camera permission persists on the origin. A screen
 * cannot work that way — no browser lets a page start a capture, and none
 * keeps a standing grant — so every screen look already requires the person to
 * press something and choose, in the browser's own picker, exactly what the
 * avatar will see. A switch here would govern something that cannot happen
 * without that fresh act anyway. Letting the avatar take a look is a
 * webcam-only feature for now, so the screen is not mentioned here at all.
 *
 * @param {Object} parameters
 * @param {string} parameters.assistantId The avatar.
 */
const ShareControlSetting = ({ assistantId }) => {
  const { shareControlAllowed, setShareControlAllowed } =
    useAvatarShareControl(assistantId);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-white/70">
            Let this avatar open the camera to take a look
          </p>
          <Switch
            checked={shareControlAllowed}
            onChange={(next) => setShareControlAllowed(next)}
            label="Let this avatar open the camera to take a look"
          />
        </div>
        <p className="text-xs text-white/40">
          When something it is asked about depends on what is in front of you,
          the avatar opens the camera for one look and closes it straight after.
          Your camera light is on for as long as the look takes. It is never
          left running, and watching does not start on a camera the avatar
          opened.
        </p>
        <p className="text-xs text-white/40">
          This also lets the avatar switch the camera or a screen share off when
          you ask.
        </p>
        <p className="text-xs text-white/40">
          Remembered for this browser only. Turn it on again on any other device
          you want it on.
        </p>
      </div>
    </div>
  );
};

export default ShareControlSetting;
