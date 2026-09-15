// src/components/Landing/Hero.jsx
import LiveAvatarDemo from './LiveAvatarDemo';
import ScanToStart from './ScanToStart';

export default function Hero() {
  return (
    <section
      id="home"
      className="min-h-screen flex items-center justify-center text-neutral-200 relative py-16 lg:py-28"
    >
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* The QR sits alongside the headline from lg up rather than beneath it,
            so it adds no height above the demo on short laptop viewports. */}
        <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:text-left">
          <div className="lg:flex-1">
            <h2 className="text-4xl md:text-6xl lg:text-5xl xl:text-6xl font-bold mb-4">
              Extend Consciousness with Authentic Artificial Intelligence
            </h2>
            <p className="text-lg md:text-xl bg-black/40 backdrop-blur-md [box-decoration-break:clone] [-webkit-box-decoration-break:clone] px-1.5">
              Create custom Avatars powered by word-of-mouth stories, social
              media, and personal data for seamless, authentic interactions.
            </p>
          </div>
          <ScanToStart className="lg:shrink-0" />
        </div>

        <div className="mt-8">
          <LiveAvatarDemo isEmbeddedInHero />
        </div>
      </div>
    </section>
  );
}
