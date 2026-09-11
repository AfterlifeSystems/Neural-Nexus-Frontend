// src/components/research/researchProgress.js
//
// Pure helpers for the deep-research panel: turning one progress frame into a
// sentence, and one finished job into the sentence that says what the research
// changed. Kept apart from the component so both can be tested without a DOM.

/**
 * The host of a source URL, for a compact citation link.
 *
 * @param {string} url A source page a fact was verified against.
 * @returns {string} The hostname, or the URL itself when unparseable.
 */
export const hostnameOf = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

/**
 * A sentence for one progress frame from GET /research_job/{id}/progress.
 *
 * @param {Object} event One `research_progress` frame.
 * @returns {string} What to show the owner, or '' when the frame says nothing.
 */
export const describeResearchStage = (event) => {
  const topic = event?.topic ? ` (${event.topic})` : '';
  switch (event?.stage) {
    case 'scoping':
      return 'Reading what this avatar already knows…';
    case 'scoped': {
      const topics = (event.topics ?? []).join(' · ');
      return topics
        ? `Researching: ${topics}`
        : 'Working out what to research…';
    }
    case 'researching':
      return 'Searching the web…';
    case 'searching':
      return `Searching${topic}: ${(event.queries ?? []).join(' · ')}`;
    case 'searched':
      return `Found ${(event.sources ?? []).length} sources${topic}.`;
    case 'reflecting':
      return `Still missing${topic}: ${event.gap_summary ?? 'searching again…'}`;
    case 'compressing':
      return `Tidying up what was found${topic}…`;
    case 'extracting':
      return `Reading the sources${topic}…`;
    case 'extracted':
      return `Extracted ${event.facts ?? 0} facts${topic}.`;
    case 'read':
      return `Read ${event.sources ?? 0} sources.`;
    case 'verifying':
      return 'Checking every fact against the other sources…';
    case 'verified':
      return `Verified: ${event.consistent ?? 0} agreed, ${event.inconsistent ?? 0} contradicted, ${event.unverified ?? 0} from a single source.`;
    case 'applying':
      return `Adding ${event.facts ?? 0} facts to what this avatar knows…`;
    case 'applied':
      return `Added ${event.applied ?? 0} facts; ${event.proposals ?? 0} need your decision.`;
    case 'verified_media':
      return event.media_sources
        ? `Found ${event.media_sources} verified source${event.media_sources === 1 ? '' : 's'} to learn from directly.`
        : 'No verified media to learn from.';
    case 'learning_from_media':
      return `Reading and transcribing ${event.media_sources ?? 0} verified source${event.media_sources === 1 ? '' : 's'}…`;
    case 'media_started':
      // The media batch outlives the research job, so this says where it went
      // rather than pretending the work is finished.
      return event.media_batch?.status === 'refused'
        ? `The verified sources could not be learned from: ${event.media_batch?.detail ?? 'refused'}`
        : 'The verified sources are being learned from; they appear in this avatar\'s uploaded material as they finish.';
    // ── acquiring the portrait and the voice ───────────────────────────────
    case 'bootstrap_scoping': {
      const wanted = [
        event.needs_portrait ? 'a picture' : null,
        event.needs_voice ? 'a recording' : null,
      ].filter(Boolean);
      return wanted.length
        ? `Looking for ${wanted.join(' and ')} of this subject…`
        : '';
    }
    case 'finding_portrait':
      return `Looking at ${event.candidates ?? 0} picture${event.candidates === 1 ? '' : 's'} of this subject…`;
    case 'vetting_portrait':
      return 'Checking whether that picture really shows the subject…';
    case 'portrait_found':
      return `Found a photograph on ${hostnameOf(event.url)}.`;
    case 'portrait_not_found':
      return `No usable photograph was found${event.reason ? `: ${event.reason}.` : '.'} Add a portrait in Settings.`;
    case 'portrait_stored':
      return 'The portrait is set.';
    case 'portrait_pending':
      return 'The portrait is still being processed; it appears in Settings when it finishes.';
    case 'finding_voice':
      return `Looking for a video in which this subject speaks the most (${event.candidates ?? 0} to check)…`;
    case 'voice_found': {
      const minutes = Math.round((event.duration_seconds ?? 0) / 60);
      const named = event.title ? `“${event.title}”` : 'a recording';
      return minutes
        ? `Found ${named} (${minutes} min); learning the voice from it.`
        : `Found ${named}; learning the voice from it.`;
    }
    case 'voice_not_found':
      return `No usable recording was found${event.reason ? `: ${event.reason}.` : '.'} Upload one in Settings.`;
    case 'voice_stored':
      return 'The reference voice is set from that recording.';
    case 'voice_pending':
      return 'That recording is still being transcribed; the voice appears in Settings when it finishes.';
    case 'bootstrap_done': {
      const got = [
        event.portrait_acquired ? 'a portrait' : null,
        event.voice_acquired ? 'a reference voice' : null,
      ].filter(Boolean);
      return got.length
        ? `Acquired ${got.join(' and ')} for this avatar.`
        : 'Nothing could be acquired for this avatar; add a portrait and a recording in Settings.';
    }
    default:
      return event?.stage ? String(event.stage) : '';
  }
};

/**
 * The stages that belong to acquiring the portrait and the voice.
 *
 * Acquisition runs alongside fact verification, so its frames interleave with
 * the research frames on one stream. The panel keeps them on a separate line
 * rather than letting the two tracks overwrite each other.
 */
export const ACQUISITION_STAGES = new Set([
  'bootstrap_scoping',
  'finding_portrait',
  'vetting_portrait',
  'portrait_found',
  'portrait_not_found',
  'portrait_stored',
  'portrait_pending',
  'finding_voice',
  'voice_found',
  'voice_not_found',
  'voice_stored',
  'voice_pending',
  'bootstrap_done',
]);

/**
 * Whether one progress frame reports that an acquired asset is now stored.
 *
 * @param {Object} event One `research_progress` frame.
 * @param {'portrait'|'voice'} asset Which asset to ask about.
 * @returns {boolean} True when that asset just landed.
 */
export const reportsAssetStored = (event, asset) =>
  event?.stage === (asset === 'portrait' ? 'portrait_stored' : 'voice_stored');

/**
 * The sentence for a finished research job.
 *
 * @param {Object} snapshot The `research_done` frame (a job snapshot).
 * @returns {string} What the research did, or why the research stopped.
 */
export const describeResearchOutcome = (snapshot) => {
  if (!snapshot) return '';
  if (snapshot.status === 'cancelled') return 'Research cancelled.';
  if (snapshot.status === 'error') {
    return `Research failed${snapshot.error ? `: ${snapshot.error}` : '.'}`;
  }
  const applied = snapshot.result?.applied ?? 0;
  const proposals = snapshot.result?.proposals ?? 0;
  const learned = `${applied} ${applied === 1 ? 'fact was' : 'facts were'} added to what this avatar knows`;
  if (!proposals) {
    return `Research finished: ${learned}. Nothing was contradicted.`;
  }
  return `Research finished: ${learned}; ${proposals} ${
    proposals === 1 ? 'fact contradicts' : 'facts contradict'
  } what the sources or this avatar already say — review ${proposals === 1 ? 'it' : 'them'} below.`;
};

