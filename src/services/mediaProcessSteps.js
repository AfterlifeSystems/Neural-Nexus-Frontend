// src/services/mediaProcessSteps.js
//
// The portrait upload is one pipeline: upload, convert, six emotion
// portraits, seven emotion videos. Every step starts at 0/N and stays in the
// list until that step (and then the whole job) finishes. Replacing the list
// with one rotating sentence is what made converting 1/1 look like it had
// cancelled the portraits and loops.

export const PORTRAIT_STILL_TOTAL = 6;
export const PORTRAIT_LOOP_TOTAL = 7;

const countedStep = (id, label, total, { active = false } = {}) => ({
  id,
  label,
  state: active ? 'active' : 'pending',
  current: 0,
  total,
  expectedTotal: total,
});

const portraitSteps = () => [
  countedStep('upload', 'Uploading portrait', 1, { active: true }),
  countedStep('convert', 'Converting portrait', 1),
  countedStep('stills', 'Creating avatar portraits', PORTRAIT_STILL_TOTAL),
  countedStep('loops', 'Creating avatar emotion videos', PORTRAIT_LOOP_TOTAL),
];

const documentSteps = () => [
  countedStep('upload', 'Uploading', 1, { active: true }),
  countedStep('convert', 'Converting', 1),
  countedStep('index', 'Adding to memory', 1),
];

// Speech is identity media too: after the clip joins the voice corpus the
// transcript is indexed like any other upload.
const voiceSteps = () => [
  countedStep('upload', 'Uploading', 1, { active: true }),
  countedStep('convert', 'Converting', 1),
  countedStep('voice', 'Building the voice model', 1),
  countedStep('index', 'Adding to memory', 1),
];

export const STAGE_TO_STEP = {
  upload: 'upload',
  labeling: 'convert',
  converting_started: 'convert',
  converting: 'convert',
  converting_complete: 'convert',
  expanding: 'convert',
  indexing: 'index',
  emotion_stills: 'stills',
  idle_loops: 'loops',
  emotion_media_complete: 'loops',
  voice_clip_collected: 'voice',
  instant_clone_created: 'voice',
};

/** Steps that finish when their own count reaches total. Convert is not in
 *  this set: `converting` is emitted when the item *starts*, and the portraits
 *  and loops still run inside that same item. */
const COMPLETE_WHEN_FULL = new Set(['upload', 'stills', 'loops', 'index', 'voice']);

/**
 * @param {'portrait'|'voice'|'document'} kind
 * @returns {Array}
 */
export const stepsForMediaKind = (kind) => {
  if (kind === 'portrait') return portraitSteps();
  if (kind === 'voice') return voiceSteps();
  return documentSteps();
};

const fillCount = (step) => {
  if (step.expectedTotal != null) {
    step.total = step.total ?? step.expectedTotal;
    step.current = step.total;
  } else if (step.total != null) {
    step.current = step.total;
  }
};

/**
 * Mark `stepId` as the running step. Earlier steps become done (they stay in
 * the list at N/N). A late event for an earlier stage — converting_complete
 * after the portraits have already started — must not rewind the pipeline.
 *
 * @param {Array} steps
 * @param {string} stepId
 * @param {{current?: number, total?: number}} [counts]
 */
export const activateStep = (steps, stepId, { current, total } = {}) => {
  const index = steps.findIndex((step) => step.id === stepId);
  if (index < 0) return;

  const laterHasStarted = steps.some(
    (step, stepIndex) =>
      stepIndex > index && (step.state === 'active' || step.state === 'done')
  );
  if (laterHasStarted) {
    const step = steps[index];
    if (step.state !== 'done' && step.state !== 'error') {
      step.state = 'done';
      fillCount(step);
    }
    return;
  }

  for (let previous = 0; previous < index; previous += 1) {
    const step = steps[previous];
    if (step.state !== 'done') {
      step.state = 'done';
      fillCount(step);
    }
  }

  const step = steps[index];
  if (step.state === 'done' || step.state === 'error') return;
  step.state = 'active';
  if (current != null) step.current = current;
  if (total != null) {
    step.total = total;
  } else if (step.expectedTotal != null && step.total == null) {
    step.total = step.expectedTotal;
  }
};

const activateNextPending = (steps, stepId) => {
  const index = steps.findIndex((step) => step.id === stepId);
  if (index < 0) return;
  const next = steps[index + 1];
  if (next && next.state === 'pending') {
    next.state = 'active';
  }
};

const maybeCompleteCaughtUp = (steps, stepId) => {
  if (!COMPLETE_WHEN_FULL.has(stepId)) return;
  const step = steps.find((candidate) => candidate.id === stepId);
  if (!step || step.total == null || step.current == null) return;
  if (step.current < step.total) return;
  step.state = 'done';
  fillCount(step);
  activateNextPending(steps, stepId);
};

/**
 * Apply one `media_progress` frame to the checklist. Portraits and loops are
 * never removed here — they stay at 0/N until their own events fill them.
 *
 * @param {Array} steps
 * @param {Object} progressEvent
 */
export const applyMediaProgress = (steps, progressEvent) => {
  if (!progressEvent) return;
  const stage = progressEvent.stage ?? progressEvent.type;
  const stepId = STAGE_TO_STEP[stage];
  if (!stepId) return;
  const current = progressEvent.current ?? progressEvent.documents_indexed;
  const total = progressEvent.total ?? progressEvent.documents_total;
  const closesStage =
    stage === 'emotion_media_complete' ||
    stage === 'instant_clone_created' ||
    stage === 'converting_complete';
  activateStep(steps, stepId, { current, total });
  if (closesStage) {
    const step = steps.find((candidate) => candidate.id === stepId);
    if (step && step.state !== 'error') {
      step.state = 'done';
      fillCount(step);
    }
  } else {
    maybeCompleteCaughtUp(steps, stepId);
  }
};

/**
 * Close steps that actually ran. Portrait stills and loops that never left
 * `pending` stay at 0/N — generation was skipped, and marking them done is
 * what made those rows vanish before they had run.
 *
 * @param {Array} steps
 * @param {'portrait'|'voice'|'document'} [kind]
 * @returns {boolean} Whether any step is still pending or active.
 */
export const finalizePipelineSteps = (steps, kind = 'document') => {
  const emotionIds = kind === 'portrait' ? ['stills', 'loops'] : [];
  for (const step of steps) {
    if (emotionIds.includes(step.id) && step.state === 'pending') {
      continue;
    }
    if (step.state === 'done' || step.state === 'error') continue;
    step.state = 'done';
    fillCount(step);
  }
  return steps.some(
    (step) => step.state === 'pending' || step.state === 'active'
  );
};

/**
 * Weighted 0–1 progress across the checklist. Each step is an equal slice;
 * an active step contributes its own current/total inside that slice.
 *
 * @param {Array} steps
 * @returns {{ratio: number, percent: number, label: string}}
 */
export const pipelineProgress = (steps) => {
  if (!Array.isArray(steps) || steps.length === 0) {
    return { ratio: 0, percent: 0, label: 'Processing' };
  }
  let weighted = 0;
  for (const step of steps) {
    const total = step.total || step.expectedTotal || 1;
    if (step.state === 'done') {
      weighted += 1;
    } else if (step.state === 'active' && total > 0) {
      weighted += Math.min(1, (step.current ?? 0) / total);
    }
  }
  const ratio = weighted / steps.length;
  const active = steps.find((step) => step.state === 'active');
  const failed = steps.find((step) => step.state === 'error');
  let label = 'Waiting';
  if (failed) {
    label = failed.label;
  } else if (active) {
    label =
      active.total != null
        ? `${active.label} ${active.current ?? 0}/${active.total}`
        : active.label;
  } else if (steps.every((step) => step.state === 'done')) {
    label = 'Complete';
  }
  return { ratio, percent: Math.round(ratio * 100), label };
};

const GENERIC_MEDIA_LABELS = new Set([
  'media upload',
  'item',
  'your media',
  'processing',
  'processing…',
  'document upload',
  'voice upload',
  'portrait upload',
  'playlist video',
]);

/**
 * @param {unknown} label A card title or item name.
 * @returns {boolean} True when the label does not name a file or URL.
 */
export const isGenericMediaLabel = (label) => {
  const text = String(label ?? '').trim();
  if (!text) return true;
  return GENERIC_MEDIA_LABELS.has(text.toLowerCase());
};

/**
 * @param {'portrait'|'voice'|'document'} [kind]
 * @returns {string}
 */
export const fallbackTitleForKind = (kind) => {
  if (kind === 'portrait') return 'Portrait upload';
  if (kind === 'voice') return 'Voice upload';
  return 'Document upload';
};

/**
 * @param {Array<unknown>} candidates Possible labels, first real one wins.
 * @returns {string|null}
 */
export const firstRealMediaLabel = (candidates) => {
  if (!Array.isArray(candidates)) return null;
  for (const candidate of candidates) {
    const text = typeof candidate === 'string' ? candidate.trim() : '';
    if (text && !isGenericMediaLabel(text)) return text;
  }
  return null;
};

/**
 * @param {Object} progressEvent A `media_progress` frame.
 * @returns {string|null}
 */
export const labelFromProgressEvent = (progressEvent) =>
  firstRealMediaLabel([
    progressEvent?.item_filename,
    progressEvent?.filename,
    progressEvent?.url,
    progressEvent?.namespace_filename,
  ]);

/**
 * @param {Array<{label?: string}>} items
 * @param {string} [fallback]
 * @returns {string}
 */
export const titleFromUploadItems = (items, fallback) => {
  const named = (items ?? [])
    .map((item) => item?.label)
    .filter((label) => label && !isGenericMediaLabel(label));
  if (named.length === 1) return named[0];
  if (named.length > 1) return `${named.length} items`;
  return fallback ?? fallbackTitleForKind();
};

/**
 * Attach child job ids from the progress stream onto the items this upload
 * started with, append playlist children as they are enumerated, and replace
 * a generic "Media upload" placeholder once the stream names the file.
 *
 * @param {Array} items
 * @param {Object} progressEvent
 * @returns {Array}
 */
export const mergeUploadItems = (items, progressEvent) => {
  if (!progressEvent) return items;
  const current = Array.isArray(items) ? items : [];
  const itemJobId = progressEvent.item_job_id ?? null;
  const name = labelFromProgressEvent(progressEvent);
  const stage = progressEvent.stage ?? progressEvent.type;
  if (stage === 'playlist_child_added' && itemJobId) {
    if (current.some((item) => item.itemJobId === itemJobId || item.id === itemJobId)) {
      return current;
    }
    return [
      ...current,
      {
        id: itemJobId,
        label: name || 'Playlist video',
        itemJobId,
        state: 'running',
      },
    ];
  }
  if (!itemJobId && !name) return current;

  const matchIndex = current.findIndex((item) => {
    if (itemJobId && (item.itemJobId === itemJobId || item.id === itemJobId)) {
      return true;
    }
    return Boolean(name && (item.label === name || item.id === name));
  });
  if (matchIndex >= 0) {
    return current.map((item, index) => {
      if (index !== matchIndex) return item;
      return {
        ...item,
        itemJobId: item.itemJobId || itemJobId,
        label:
          name && isGenericMediaLabel(item.label) ? name : item.label,
        id: isGenericMediaLabel(item.id) && name ? name : item.id,
      };
    });
  }

  if (name && current.length === 1 && isGenericMediaLabel(current[0].label)) {
    return [
      {
        ...current[0],
        id: name,
        label: name,
        itemJobId: current[0].itemJobId || itemJobId,
      },
    ];
  }

  if (name) {
    const kept = current.filter((item) => !isGenericMediaLabel(item.label));
    return [
      ...kept,
      {
        id: itemJobId || name,
        label: name,
        itemJobId,
        state: 'running',
      },
    ];
  }

  return current.map((item, index) => {
    if (item.itemJobId || index > 0) return item;
    return { ...item, itemJobId };
  });
};
