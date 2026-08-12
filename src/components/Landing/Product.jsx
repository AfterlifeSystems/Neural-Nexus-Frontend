// src/components/Landing/Product.jsx
import React, { useEffect, useState } from 'react';
import {
  Youtube,
  Instagram,
  Twitch,
  Facebook,
  Linkedin,
  MessageCircle,
  X as CloseIcon,
  ExternalLink,
} from 'lucide-react';
import { VscMcp } from 'react-icons/vsc';
import { FaApple, FaWindows, FaUbuntu } from 'react-icons/fa';
import { TbWorldWww } from 'react-icons/tb';
import { RiSpeakFill } from 'react-icons/ri';
import { FaXTwitter, FaDiscord, FaSlack } from 'react-icons/fa6';

// The places a person already speaks. An avatar is built from what someone has
// written and said, so these name the sources it learns from rather than
// decorating the card.
const SOURCE_PLATFORMS = [
  // Fifteen sources, laid out as three rows of five so the grid reads as
  // deliberate rather than as a list that happened to wrap. Each row is a kind:
  //
  //   what a person publishes  →  where a person talks  →  what a machine offers
  //
  // Reading order therefore moves from the most public material an avatar can
  // be built from to the most private, and ends with the ways a machine hands
  // its own data over.

  // Published, and public.
  { name: 'YouTube', icon: <Youtube className="w-5 h-5" /> },
  { name: 'Twitch', icon: <Twitch className="w-5 h-5" /> },
  // X's own mark rather than the retired bird, which lucide still ships.
  { name: 'X', icon: <FaXTwitter className="w-5 h-5" /> },
  { name: 'Instagram', icon: <Instagram className="w-5 h-5" /> },
  { name: 'Facebook', icon: <Facebook className="w-5 h-5" /> },

  // Said to someone in particular.
  { name: 'LinkedIn', icon: <Linkedin className="w-5 h-5" /> },
  { name: 'Discord', icon: <FaDiscord className="w-5 h-5" /> },
  { name: 'Slack', icon: <FaSlack className="w-5 h-5" /> },
  { name: 'Messages', icon: <MessageCircle className="w-5 h-5" /> },
  { name: 'Natural Language', icon: <RiSpeakFill className="w-5 h-5" /> },

  // Reached rather than posted: the machines, the protocol that connects to
  // them, and anything with an address.
  { name: 'Apple', icon: <FaApple className="w-5 h-5" /> },
  { name: 'Windows', icon: <FaWindows className="w-5 h-5" /> },
  { name: 'Ubuntu', icon: <FaUbuntu className="w-5 h-5" /> },
  { name: 'Model Context Protocol', icon: <VscMcp className="w-5 h-5" /> },
  { name: 'URL', icon: <TbWorldWww className="w-5 h-5" /> },
];

// Short enough to read in the two seconds each one is on screen.
const CONVERSATION_SUGGESTIONS = [
  'Ask how their week went',
  'Bring up the trip they mentioned',
  'Check in about the interview',
  'Say the thing you keep postponing',
  'Ask what they are reading',
  'Follow up on that idea from Tuesday',
  'Tell them what made you laugh today',
];

const RECONSTRUCTION_IMAGE_URL =
  'https://raw.githubusercontent.com/efwoods/V1-Visual-Cortex-Visualization/refs/heads/main/imgs/reconstructed_images.png';
const RECONSTRUCTION_PROJECT_URL =
  'https://github.com/efwoods/V1-Visual-Cortex-Visualization/';

/**
 * One suggestion at a time, replaced on a timer.
 *
 * The list scrolls rather than listing everything at once for two reasons: the
 * card keeps its height whatever the suggestions are, and a line that changes
 * reads as something the product would actually offer in the moment, which is
 * what the feature is.
 */
function ScrollingSuggestions() {
  const [visibleIndex, setVisibleIndex] = useState(0);

  useEffect(() => {
    const rotation = setInterval(() => {
      setVisibleIndex(
        (previousIndex) => (previousIndex + 1) % CONVERSATION_SUGGESTIONS.length
      );
    }, 2600);
    return () => clearInterval(rotation);
  }, []);

  return (
    <div className="mt-4 h-16 relative overflow-hidden rounded-lg bg-black/20 border border-white/10">
      {CONVERSATION_SUGGESTIONS.map((suggestion, index) => (
        <p
          key={suggestion}
          // Every line is stacked in the same place; only the current one is
          // opaque and centred, the rest are nudged out of the way. Animating
          // opacity and transform keeps this off the layout path, so nothing
          // around it moves as the text changes.
          className={`absolute inset-0 flex items-center justify-center px-4 text-center text-teal-200 transition-all duration-700 ease-out ${
            index === visibleIndex
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4'
          }`}
          aria-hidden={index !== visibleIndex}
        >
          “{suggestion}”
        </p>
      ))}
    </div>
  );
}

export default function Product() {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Escape closes the preview, which is what anyone tries first.
  useEffect(() => {
    if (!isPreviewOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsPreviewOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isPreviewOpen]);

  return (
    <section
      id="product"
      className="py-16 bg-gradient-to-b from-[#301934] via-purple-900 to-white text-white"
    >
      <div className="container mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8">Our Product</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-gradient-to-b bg-purple-900 to-purple-400 bg-opacity-20 p-6 rounded-lg shadow-lg text-white">
            <h3 className="text-xl font-semibold mb-4"> ⚙️ Custom LLMs</h3>
            <p>
              Create personalized AI models tailored to your communication
              needs.
            </p>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {SOURCE_PLATFORMS.map(({ name, icon }) => (
                <span
                  key={name}
                  title={name}
                  className="w-full aspect-square max-w-[46px] mx-auto rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-teal-200 hover:text-white hover:border-teal-400/50 hover:bg-white/15 transition-colors"
                >
                  {icon}
                  <span className="sr-only">{name}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-b bg-purple-900 to-purple-400 bg-opacity-20 p-6 rounded-lg shadow-lg text-white">
            <h3 className="text-xl font-semibold mb-4 ">
              <p>💬 Future Feature:</p>
              <p>Conversation Suggestions</p>
            </h3>
            <p>
              Get real-time suggestions to enhance your everyday interactions.
            </p>
            <ScrollingSuggestions />
          </div>

          <div className="bg-gradient-to-b bg-purple-900 to-purple-400 bg-opacity-20 p-6 rounded-lg shadow-lg text-white">
            <h3 className="text-xl font-semibold mb-4">
              <p>🧠 Future Feature:</p>
              <p>Neural Data Integration</p>
            </h3>
            <p>
              Utilize thought-to-text and thought-to-image for innovative
              applications.
            </p>
            {/* A thumbnail rather than the full picture: the cards are one grid
                row and share a height, so a full-size image here would set the
                height of all three. The picture is worth seeing properly, which
                is what the preview is for. */}
            <button
              onClick={() => setIsPreviewOpen(true)}
              className="mt-4 block w-full rounded-lg overflow-hidden border border-white/15 hover:border-purple-900/60 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400"
              aria-label="Preview the reconstructed images from visual cortex activity"
            >
              <img
                src={RECONSTRUCTION_IMAGE_URL}
                alt="Images reconstructed from recorded visual cortex activity"
                className="w-full h-20 object-cover"
                loading="lazy"
              />
              <span className="block text-xs text-teal-200 py-1.5">
                Reconstructed from V1 activity — click to look closer
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* The preview: the image at its own size, and a way through to the work
          it came from. */}
      {isPreviewOpen && (
        <div
          className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-4"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div
            className="max-w-full max-h-full flex flex-col items-center gap-3"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full gap-4">
              <p className="text-white/80 text-sm">
                Images reconstructed from recorded visual cortex activity
              </p>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close the preview"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            {/* The image keeps its own dimensions and scrolls if the window is
                smaller, rather than being squeezed into the viewport. */}
            <div className="overflow-auto max-h-[75vh] rounded-lg border border-white/20 bg-black/40">
              <a
                href={RECONSTRUCTION_PROJECT_URL}
                target="_blank"
                rel="noopener noreferrer"
                title="Open the V1 Visual Cortex Visualization project"
              >
                <img
                  src={RECONSTRUCTION_IMAGE_URL}
                  alt="Images reconstructed from recorded visual cortex activity"
                  className="block"
                />
              </a>
            </div>

            <a
              href={RECONSTRUCTION_PROJECT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg text-white font-semibold transition"
            >
              View the project on GitHub
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
