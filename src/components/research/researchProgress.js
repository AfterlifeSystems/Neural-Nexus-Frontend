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
    default:
      return event?.stage ? String(event.stage) : '';
  }
};

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

