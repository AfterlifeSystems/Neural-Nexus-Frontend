// src/components/geo/AvatarMapCard.jsx
//
// The avatar the person has picked out on a map: its portrait, its name and
// place, what it is about, and the one thing to do next — talk to it.
//
// Choosing a pin is a question ("who is this?") before it is a decision to
// open a conversation, so a pick shows this card rather than navigating. The
// sidebar's minimap and the world map both use it; the minimap in its compact
// form. Clicking the card folds the description away so the globe stays in
// view. The circle portrait and the Talk button both open the avatar.
// Directions sits under Talk and is inert until walk-to-avatar camera
// guidance is built.

import { useEffect, useId, useState } from 'react';
import {
  AudioLines,
  ChevronDown,
  ChevronUp,
  Navigation,
  X,
} from 'lucide-react';

import useAvatarReferenceImage from '../../hooks/useAvatarReferenceImage';
import { avatarDescriptionOf, mapMarkOf } from '../../services/avatarMapMark';
import { describeDistance, pinOf } from '../../services/avatarProximity';
import ProfileBubbleImage from '../ProfileBubbleImage';

/**
 * @param {Object} props
 * @param {Object} props.avatar The avatar record or nearby entry:
 *   {assistant_id, name, description, geo_location, distance_meters, inside_geofence}.
 * @param {boolean} [props.asAnonymousIdentity] Fetch the portrait as the visitor.
 * @param {boolean} [props.isOwned] Draw the mark in the owner's amber.
 * @param {boolean} [props.compact] The sidebar form.
 * @param {string} [props.footnote] A small line under the description (coordinates, radius).
 * @param {() => void} props.onTalk Open the avatar.
 * @param {() => void} [props.onClose] Put the card away.
 */
const AvatarMapCard = ({
  avatar,
  asAnonymousIdentity = false,
  isOwned = false,
  compact = false,
  footnote = '',
  onTalk,
  onClose,
}) => {
  const assistantId = avatar?.assistant_id ?? avatar?.avatar_id ?? null;
  const portrait = useAvatarReferenceImage(assistantId, {
    asAnonymousIdentity,
  });
  const name = avatar?.name ?? 'Avatar';
  const pin = pinOf(avatar);
  const description = avatarDescriptionOf(avatar);
  const whereabouts = avatar?.inside_geofence
    ? 'you are here'
    : describeDistance(avatar?.distance_meters);
  const detailsId = useId();
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);

  useEffect(() => {
    setIsDetailsOpen(true);
  }, [assistantId, name]);

  const toggleDetails = () => setIsDetailsOpen((wasOpen) => !wasOpen);
  const portraitSize = compact ? 'h-12 w-12' : 'h-16 w-16';
  const detailsToggleLabel = isDetailsOpen
    ? `Hide ${name}'s details`
    : `Show ${name}'s details`;
  return (
    <section
      aria-label={`${name} on the map`}
      onClick={toggleDetails}
      className={`relative flex w-full cursor-pointer rounded-xl border border-white/10 bg-black/60 backdrop-blur-lg ${
        isDetailsOpen ? 'items-start' : 'items-center'
      } ${compact ? 'gap-3 px-3 py-2.5' : 'gap-3 px-4 py-3'}`}
    >
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <div
          className={`relative ${portraitSize} shrink-0 overflow-hidden rounded-full border border-amber-300/50 bg-black/60 ${
            isOwned ? 'text-amber-200' : 'text-neutral-200'
          }`}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onTalk();
            }}
            title={`Talk to ${name}`}
            aria-label={`Talk to ${name}`}
            className="profile-bubble-disc absolute inset-0 overflow-hidden rounded-full bg-black/60 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          >
            {portrait ? (
              <ProfileBubbleImage
                src={portrait}
                alt={`${name}'s portrait`}
                assistantId={assistantId}
                className="h-full w-full"
              />
            ) : (
              mapMarkOf(avatar).initials
            )}
          </button>
        </div>
        {isDetailsOpen ? (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onTalk();
              }}
              className="inline-flex items-center justify-center gap-1 rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-xs font-medium text-neutral-200 hover:bg-black/60 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-amber-400/50"
            >
              <AudioLines
                className="h-3.5 w-3.5 text-amber-300"
                aria-hidden="true"
              />
              Talk
            </button>
            {/*
              Directions is not wired yet. When it is, it opens voice mode over
              the live camera — not the ordinary message thread — with a
              walk-to-avatar guide for the real-world pin.

              Closer to the pin, the avatar is drawn larger, up to a maximum;
              farther away, smaller. When the avatar is off camera, a bearing
              arrow in the centre of the camera view (three.js) plus the
              AudioLines mark from the message composer point the phone toward
              the pin, so the person can walk into the field of view.

              Pathfinding should not be raw line-of-sight. Use a NavMesh via
              three-pathfinding (https://github.com/donmccurdy/three-pathfinding):
              zone from walking surfaces, findPath from the device to the pin,
              smooth the nodes with THREE.CatmullRomCurve3, draw a glowing
              ribbon (Line2 or TubeGeometry, additive blend, small Y offset)
              that fades a short distance ahead — Skyrim clairvoyance, not a
              line across the whole map.

              PRECISE FEATURE REQUEST:
              further away I am and larger (to a maximum) the closer I am to the pinned  
     location; when the avatar is not in the field of view there should be an  
     arrow and the icon used in the message area to point me at which          
    direction I should point my phone to walk towards the avatar (there is a   
    camera view as the background with a three.js arrow in the center guiding  
     the way)     

     example of "guidance" https://preview.redd.it/clairvoyance-v0-ncgji632vnef1.jpeg?width=1080&crop=smart&auto=webp&s=55fed809d1943d2c069f8effad8d56feaf33a860


Step 1: Handling the Pathfinding (The Core Logic)To get the actual data points for the path, you shouldn't rely on raw raycasting or basic line-of-sight metrics. You need a NavMesh. The standard tool for this in the Three.js ecosystem is the three-pathfinding library.Build a NavMesh: Export your environment's walking surfaces from Blender as a separate geometry mesh.Initialize Pathfinding: Load that mesh into three-pathfinding.Calculate Route: Find the path from the player's position to the destination vector.javascriptimport { Pathfinding } from 'three-pathfinding';

const pathfinding = new Pathfinding();
const ZONE = 'level1';
let navMeshGroup;

// Load your NavMesh geometry
pathfinding.createZone(ZONE, navMeshGeom);

// Find the path (returns an array of THREE.Vector3 points)
const start = player.position;
const end = targetWaypoint.position;
const groupID = pathfinding.getGroup(ZONE, start);
const pathPoints = pathfinding.findPath(start, end, ZONE, groupID);
Use code with caution.Step 2: Smoothing out the TrailThe raw path points returned from a NavMesh can look jagged because they go sharply from node to node. To make it feel fluid like the spell in Skyrim, pass the points through a THREE.CatmullRomCurve3 to generate smooth, continuous coordinates.javascript// Create a smooth bezier-like curve through the path points
const curve = new THREE.CatmullRomCurve3(pathPoints);
const smoothPoints = curve.getPoints(50); // Get 50 subdivision points
Use code with caution.Step 3: Visualizing the "Clairvoyance" TrailSkyrim’s trail is a glowing, translucent, animated particle ribbon that hovers slightly above the ground. You have a few ways to draw this in Three.js depending on your visual goals:Option A: The Simple Glowing Line (Fastest)Use THREE.Line2 (from the Fat Lines extension) to give the line thickness and apply an emissive or additive material.javascriptimport { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';

// Format smoothPoints to flat array [x1, y1, z1, x2, y2, z2...]
const positions = [];
smoothPoints.forEach(p => positions.push(p.x, p.y + 0.2, p.z)); // Offset Y slightly above ground

const geometry = new LineGeometry();
geometry.setPositions(positions);

const matLine = new LineMaterial({
    color: 0x00aaff, // Skyrim Clairvoyance light blue/purple
    linewidth: 0.01, // Thickness in world units
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending // Gives it a magical "glow" overlay
});

const clairvoyanceLine = new Line2(geometry, matLine);
scene.add(clairvoyanceLine);
Use code with caution.Option B: The Animated Ribbon (Most Accurate to Skyrim)If you want the trail to actually look like a magical mist flowing forward, you can construct a ribbon mesh using THREE.TubeGeometry or a custom extrude geometry along the curve, then map an animated panning texture to it.javascriptconst tubeGeometry = new THREE.TubeGeometry(curve, 64, 0.1, 8, false);

// A texture with a wispy alpha map
const magicTexture = new THREE.TextureLoader().load('magic_mist.png');
magicTexture.wrapS = THREE.RepeatWrapping;

const tubeMaterial = new THREE.MeshBasicMaterial({
    map: magicTexture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false // Prevents ugly rectangular outlines over geometry
});

const magicRibbon = new THREE.Mesh(tubeGeometry, tubeMaterial);
scene.add(magicRibbon);

// Inside your requestAnimationFrame loop, animate the spell forward:
function animate() {
    requestAnimationFrame(animate);
    magicTexture.offset.x -= 0.01; // Creates the "flowing" forward movement
    renderer.render(scene, camera);
}
Use code with caution.Tips for Perfect Replication:Y-Offset: Always add a small vertical offset (e.g., y + 0.2) to the path nodes so the visual trail doesn't clip or Z-fight with your terrain graphics.Proximity Truncation: Skyrim's Clairvoyance doesn't draw the trail all the way across the map; it fades out a certain distance ahead of the player. You can control this by only drawing the first few segments of your smoothPoints array near the player, updating it dynamically as they walk.

https://github.com/donmccurdy/three-pathfinding
            */}
            {/* <button
              type="button"
              aria-disabled="true"
              title="Directions are not available yet"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              className="inline-flex items-center justify-center gap-1 rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-xs font-medium text-neutral-200 opacity-60"
            >
              <Navigation
                className="h-3.5 w-3.5 text-amber-300"
                aria-hidden="true"
              />
              Directions
            </button> */}
          </>
        ) : null}
      </div>

      <div
        className={`min-w-0 flex-1 ${
          isDetailsOpen ? 'space-y-0.5' : 'flex items-center'
        }`}
      >
        <div className="flex w-full items-center gap-1.5">
          <p
            className={`min-w-0 flex-1 font-medium text-neutral-100 ${
              compact ? 'text-xs' : 'text-sm'
            }`}
          >
            {name}
            {pin?.location_name ? (
              <span className="text-amber-300"> · {pin.location_name}</span>
            ) : null}
          </p>
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                toggleDetails();
              }}
              aria-expanded={isDetailsOpen}
              aria-controls={detailsId}
              title={detailsToggleLabel}
              aria-label={detailsToggleLabel}
              className="rounded-md p-1 text-white/50 hover:bg-white/10 hover:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            >
              {isDetailsOpen ? (
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
            {onClose ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onClose();
                }}
                title="Close"
                aria-label={`Close ${name}`}
                className="rounded-md p-1 text-white/50 hover:bg-white/10 hover:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
        <div id={detailsId} hidden={!isDetailsOpen} className="space-y-1">
          {description ? (
            <p
              className={`whitespace-pre-line leading-relaxed text-white/70 ${
                compact ? 'text-xs line-clamp-4' : 'text-sm'
              }`}
            >
              {description}
            </p>
          ) : (
            <p className="text-xs text-white/40">
              This avatar has no description yet.
            </p>
          )}
          {whereabouts ? (
            <p className="text-[11px] text-white/40">{whereabouts}</p>
          ) : null}
          {footnote ? (
            <p className="font-mono text-[10px] text-white/40">{footnote}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default AvatarMapCard;
