// src/components/geo/WorldMapScreen.jsx
//
// The world map screen: every public avatar standing somewhere real, on a globe.
// The globe itself is loaded on demand, because it carries its own copy of
// three.js that the rest of the application does not need.

import { Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { voiceChatPath } from '../../services/voiceModePreference';

const WorldAvatarGlobe = lazy(() => import('./WorldAvatarGlobe'));

const WorldMapScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-3 p-4">
      <header>
        <h1 className="text-lg font-semibold text-neutral-100">
          Avatars in the world
        </h1>
        <p className="text-sm text-white/50">
          Every shared avatar that stands at a real place — a memorial, a marker,
          a monument, a storefront. Spin the globe and come closer to see the
          places separate; walk up to one and it will greet you where you stand.
        </p>
      </header>

      <div className="min-h-0 flex-1">
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center rounded-xl border border-white/10 bg-black/60 backdrop-blur-lg">
              <span className="inline-flex items-center gap-2 text-sm text-white/50">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Building the globe…
              </span>
            </div>
          }
        >
          <WorldAvatarGlobe
            onOpenAvatar={(avatar) =>
              navigate(voiceChatPath(avatar.assistant_id, { cameraBackground: true }))
            }
          />
        </Suspense>
      </div>
    </div>
  );
};

export default WorldMapScreen;
