// src/context/MediaContext.jsx
//
// Conversation state and the message-sending path, over the Neural Nexus API.
// Flow:
//   The ChatArea holds the InputBar and the MessageList.
//   The InputBar sends a message through this context.
//   This context POSTs to /message/{assistant_id} with stream=true and grows
//   the assistant message token-by-token as server-sent events arrive.
//   The MessageList renders the messages array on every update.

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
} from 'react';

import { useAuth } from './AuthContext';

import { toast } from 'react-hot-toast';
import {
  requestJson,
  streamServerSentEvents,
} from '../services/neuralNexusApiClient';
import {
  isSharedAvatarChatPath,
  resolveAssistantId,
  buildSharedConversationUrl,
} from '../components/utils';
import {
  isBillingRefusal,
  showRequestFailureToast,
} from '../components/requestFailureToast';
import { buildBillingRefusalMessage } from '../components/BillingRefusalNotice';
import { followMediaJobWithToast } from '../services/mediaJobProgress.jsx';
import {
  loadThreadAttachments,
  pruneExpiredAttachments,
  saveMessageAttachments,
} from '../services/attachmentArchive';
import {
  buildAmbientMessageRequest,
  deleteConversationThread,
  updateConversationThread,
} from '../services/avatarService';
import { notifyAmbientObservation } from '../services/desktopNotifications';
import {
  overlayLocalPinState,
  setConversationPinnedLocally,
} from '../services/pinnedConversations';
import {
  applyRememberedAvatarResponseMetrics,
  attachResponseTimeMs,
  rememberAvatarResponseMetrics,
  resolveMessageResponseTimeMs,
} from '../services/messageResponseMetrics';
import {
  isConversationSuggestionList,
  localFollowUpSuggestions,
  looksLikeLeakedModelJson,
  parseConversationSuggestionList,
} from '../services/conversationSuggestions';

const MediaContext = createContext();

/**
 * The conversation the user has started but not yet sent anything to.
 *
 * A conversation does not exist server-side until its first message — the send
 * mints it and reports the real id on the terminal frame. This stands in for it
 * until then, so an empty new conversation can be selected and shown in the
 * list like any other. It must never be sent as a thread_id.
 */
export const NEW_CONVERSATION_ID = '__new__';

/**
 * What the avatar is doing during a turn, in the user's words.
 *
 * These are derived from the frames the message stream actually emits — a
 * costing frame, then tokens, then keepalives while post-reply analysis runs.
 * The server sends no descriptive status of its own on this stream, so nothing
 * here claims more than the frames support: each phrase is true of the frame
 * that set it.
 */
const ASSISTANT_ACTIVITY = {
  thinking: 'Thinking',
  responding: 'Responding',
  analyzing: 'Reflecting on the reply',
  suggestingEdits: 'Suggesting edits',
};

/**
 * Field names that only ever appear in the fact-correction tool's structured
 * output (`ProposedFactEdit` on the server), never in something the avatar says.
 */
const INTERNAL_JSON_MARKERS = [
  '"asserts_inaccurate_fact"',
  '"corrected_text"',
  '"corrected_context"',
];

/**
 * Recognize model output that was never meant for the reader.
 *
 * While the graph works out how to correct a fact it emits its structured
 * proposal through the SAME `assistant_token` channel the spoken reply uses, so
 * a correction turn would otherwise paint raw JSON into the conversation before
 * pausing. There is no separate channel and no flag on the frame to key on, so
 * the text itself is the only available signal: a reply the avatar speaks does
 * not open with a JSON delimiter, and never contains these field names.
 *
 * @param {string} textSoFar Everything streamed for this turn so far.
 * @returns {boolean} True when the stream is carrying internal JSON.
 */
function streamedTextIsInternalJson(textSoFar) {
  const text = textSoFar ?? '';
  if (looksLikeLeakedModelJson(text)) {
    return true;
  }
  return INTERNAL_JSON_MARKERS.some((marker) => text.includes(marker));
}

/**
 * Describe a paused turn awaiting the user's decision.
 *
 * @param {Object} interrupt The interrupt payload from the stream.
 * @returns {string} A sentence for the status line.
 */
function describeInterrupt(interrupt) {
  if (interrupt?.kind === 'mcp_connect_consent') {
    return 'Waiting for your decision on connecting a data server';
  }
  if (interrupt?.kind === 'connect_account') {
    const displayName = interrupt?.display_name || 'an account';
    return `Waiting for you to connect ${displayName}`;
  }
  return 'Waiting for your confirmation on a correction';
}

// Everything the API adds to a person's own words so that the avatar can read
// what they attached. A turn carrying files is stored as the typed message,
// then a marker naming each attachment (and, for a text file or a PDF, the text
// read out of it), then — once the graph has looked at the pictures — a written
// description of each image. All of it is written for the model, all of it is
// appended after the typed message, and each piece opens its own line:
//
//   please describe this image
//
//   [Image: mom_facebook_contextual_image.jpg]
//
//   ---
//   Image descriptions:
//   [mom_facebook_contextual_image.jpg]
//   - Woman with curly light brown hair …
//
// Built by `process_files_for_message` and `resolve_human_message_images` in the
// API. The first of these openers to appear on a line of its own is where the
// person's message ends and the machinery begins.
const MODEL_FACING_ATTACHMENT_OPENERS = [
  '[Image: ',
  '[File: ',
  '[Error processing file: ',
  '---\nImage descriptions:\n',
];

/**
 * Return what the person actually sent, without the account of their
 * attachments that the API appended for the avatar to read.
 *
 * Reopening a thread that carried an image showed the typed message run
 * together with a filename in brackets and a bulleted paragraph nobody wrote,
 * because the transcript the API stores IS all of those joined: the graph
 * replaces an attachment with a written description before the avatar reads the
 * turn, and the thread keeps the replacement from then on. Those additions
 * belong to the avatar's reading of the turn rather than to the turn, and the
 * attachments themselves come back from this browser's own archive a few lines
 * below — so the transcript shows the words and the files exactly as they were
 * sent, which is what was on screen before the page was reloaded.
 *
 * An opener only counts where it begins a line, so a message that happens to
 * mention one mid-sentence is left alone.
 *
 * @param {string} messageText The stored text of one message.
 * @returns {string} The text with the appended attachment account removed.
 */
function withoutModelFacingAttachmentText(messageText) {
  if (typeof messageText !== 'string') {
    return messageText;
  }
  let attachmentTextIndex = -1;
  for (const opener of MODEL_FACING_ATTACHMENT_OPENERS) {
    let openerIndex = messageText.indexOf(opener);
    while (openerIndex > 0 && messageText[openerIndex - 1] !== '\n') {
      openerIndex = messageText.indexOf(opener, openerIndex + 1);
    }
    if (
      openerIndex !== -1 &&
      (attachmentTextIndex === -1 || openerIndex < attachmentTextIndex)
    ) {
      attachmentTextIndex = openerIndex;
    }
  }
  if (attachmentTextIndex === -1) {
    return messageText;
  }
  return messageText.slice(0, attachmentTextIndex).trimEnd();
}

/**
 * Flatten one stored message's content to the text the transcript shows.
 *
 * Content is usually a plain string, but a turn the graph never rewrote keeps
 * the block list it was sent as — text blocks beside image blocks. Rendering
 * that list as-is is what printed a turn's blocks butted against one another
 * with nothing between them, because an array handed to React is drawn by
 * drawing each entry in turn. The text blocks are joined the way the API joins
 * them, and the image blocks are dropped: the attachments are restored
 * separately, from this browser's archive.
 *
 * @param {string|Array|null} storedContent Content as the API returned it.
 * @returns {string} The text to render.
 */
function messageContentAsText(storedContent) {
  if (typeof storedContent === 'string') {
    return storedContent;
  }
  if (!Array.isArray(storedContent)) {
    return storedContent ?? '';
  }
  return storedContent
    .map((contentBlock) => {
      if (typeof contentBlock === 'string') {
        return contentBlock;
      }
      if (contentBlock?.type === 'text') {
        return contentBlock.text ?? '';
      }
      return '';
    })
    .filter(Boolean)
    .join('\n\n');
}

/** Prefix of the hidden turn that asks the avatar for follow-up suggestions. */
export const SUGGESTION_PROMPT_MARKER =
  '[neural-nexus:conversation-suggestions]';

/** Prefix of the hidden turn that asks the avatar to write its description. */
export const DESCRIPTION_PROMPT_MARKER =
  '[neural-nexus:generate-description]';

/**
 * Turn stored thread history into the shape the message list renders.
 *
 * A loaded thread contains the graph's full transcript, including tool and
 * system turns that were never meant for the user; rendering those verbatim
 * fills the conversation with machine chatter, so only human and assistant
 * turns survive. `response_metadata` is carried across deliberately — it holds
 * the artifacts (reports, plots) a data-analysis turn produced, which would
 * otherwise disappear the moment a conversation is reopened.
 *
 * @param {Array} storedMessages Messages as returned by the API.
 * @param {string|null} [threadId] Thread these rows belong to, so a duration
 *   remembered from the live `done` frame can be put back after reload.
 * @returns {Array} Messages in the shape MessageList expects.
 */
function normalizeThreadMessages(storedMessages, threadId = null) {
  if (!Array.isArray(storedMessages)) {
    return [];
  }
  const normalized = storedMessages
    .filter((storedMessage) => ['human', 'ai'].includes(storedMessage?.type))
    // A hidden turn is context the avatar was given, never something the
    // person typed: an ambient webcam / screen observation. The API already
    // drops these; this keeps a transcript honest if one ever slips through.
    .filter((storedMessage) => !storedMessage?.additional_kwargs?.hidden)
    .map((storedMessage) => {
      const messageText = messageContentAsText(storedMessage.content);
      const usage =
        storedMessage.usage ?? storedMessage.response_metadata?.usage ?? null;
      const responseMetadata = storedMessage.response_metadata ?? {};
      const totalResponseTimeMs = resolveMessageResponseTimeMs({
        ...storedMessage,
        usage,
        response_metadata: responseMetadata,
      });
      return {
        id: storedMessage.id,
        type: storedMessage.type,
        // The triage record of an ambient observation this reply answers
        // (`decision` of respond or notify); a notify reply renders as a card.
        ambient: storedMessage.response_metadata?.ambient ?? null,
        // Only a person's own turn is trimmed. The account of the attachments
        // is appended to what the person sent, so an avatar that writes those
        // same words is quoting, and its reply is shown whole.
        content:
          storedMessage.type === 'human'
            ? withoutModelFacingAttachmentText(messageText)
            : messageText,
        response_metadata: responseMetadata,
        // The reply's classified emotion, which picks the avatar's emotion
        // still beside the bubble. Absent on human turns and on replies made
        // before sentiment was recorded.
        sentiment: storedMessage.response_metadata?.sentiment ?? null,
        usage,
        request_id:
          storedMessage.request_id ??
          storedMessage.response_metadata?.request_id ??
          null,
        total_response_time_ms: totalResponseTimeMs,
        timestamp:
          storedMessage.timestamp ??
          storedMessage.created_at ??
          storedMessage.additional_kwargs?.created_at ??
          storedMessage.response_metadata?.created_at ??
          null,
        feedback: storedMessage.feedback ?? null,
      };
    })
    .filter((message, index, list) => {
      if (
        message.content?.startsWith?.(SUGGESTION_PROMPT_MARKER) ||
        message.content?.startsWith?.(DESCRIPTION_PROMPT_MARKER)
      ) {
        return false;
      }
      const previous = list[index - 1];
      if (
        previous?.content &&
        (previous.content.startsWith(SUGGESTION_PROMPT_MARKER) ||
          previous.content.startsWith(DESCRIPTION_PROMPT_MARKER)) &&
        message.type === 'ai'
      ) {
        return false;
      }
      if (message.type === 'ai' && isConversationSuggestionList(message.content)) {
        return false;
      }
      return true;
    });
  return applyRememberedAvatarResponseMetrics(threadId, normalized);
}

export const MediaProvider = ({ children }) => {
  const { activeAvatar, user } = useAuth();

  const [messages, setMessages] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [conversationList, setConversationList] = useState([]);
  // Set when the graph pauses for human approval (an `interrupt` frame). A
  // future approval interface resumes via POST /message/{assistant_id}/resume.
  const [pendingInterrupt, setPendingInterrupt] = useState(null);
  // What the avatar is doing right now, shown beside the typing indicator. Null
  // between turns.
  const [assistantActivity, setAssistantActivity] = useState(null);
  // Whether the turn that just finished stopped to ask the user something. A
  // ref rather than state because the cleanup that reads it runs in the same
  // tick the stream ends, before any state update would be visible.
  const turnPausedForUserRef = useRef(false);
  // Counts the pauses raised in this session, so each one is distinguishable
  // from the last. A second correction can arrive on the same thread and the
  // same avatar as the first, so thread and avatar together do not identify a
  // pause — and the panel resets the choices it holds by remounting on a
  // changed key.
  const interruptSequenceRef = useRef(0);
  // Which avatar's conversation is on screen right now.
  //
  // A send is deliberately not tied to the screen that started it: this
  // provider sits above the router, so navigating away — to another avatar, to
  // billing, anywhere — leaves the request running and the server still records
  // the turn. What must NOT survive is the rendering: tokens for a turn started
  // with one avatar would otherwise be painted into whichever conversation the
  // user has since opened. Each turn remembers its target and checks this
  // before touching the messages on screen.
  const onScreenAssistantIdRef = useRef(null);
  // How many turns are in flight, so the interface can say that something is
  // still being sent after the user has moved on.
  const [pendingSendCount, setPendingSendCount] = useState(0);
  // Voice mode raises this while the person is speaking or the avatar is, so
  // ambient capture never sends a snapshot into the middle of an exchange.
  const [ambientHold, setAmbientHold] = useState(false);
  // Attachments belonging to a turn that is still in flight. Clearing
  // `mediaFiles` the moment a message is sent took the only sign that a file
  // was involved off the screen, leaving the user watching an empty composer
  // with no idea their upload was still being read. These outlive the send and
  // are shown, dimmed, until the whole turn finishes. Appended and filtered by
  // identity rather than replaced, so a second send while the first is still
  // running neither hides the first turn's files nor clears the second's.
  const [attachmentsInFlight, setAttachmentsInFlight] = useState([]);
  // Object URLs minted while restoring a thread's archived attachments. They
  // stay valid for as long as that transcript is on screen and are released
  // when another thread replaces it, so reopening conversations in a long
  // session does not accumulate them.
  const restoredAttachmentUrlsRef = useRef([]);

  useEffect(() => {
    onScreenAssistantIdRef.current = resolveAssistantId(activeAvatar);
  }, [activeAvatar]);

  const [inputMessage, setInputMessage] = useState('');

  const [type, setType] = useState('user');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isThoughtToImageEnabled, setIsThoughtToImageEnabled] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // The API accepts attachments far larger than this; the previous 1 MB ceiling
  // was a client-side invention that silently discarded any photo taken on a
  // phone. 25 MB matches the transcription ceiling documented on the server and
  // is the largest attachment the message endpoint is expected to carry.
  const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
  const MAX_FILE_SIZE_DESCRIPTION = '25 MB';

  const [dataExchangeTypes] = useState({
    text: true,
    voice: true,
    fileUpload: true,
    custom: true,
    neuralText: true,
    neuralImage: true,
    neuralMotion: true,
    blueToothControl: true,
    telepathy: true,
  });

  const startThoughtToImage = async () => {
    if (!user?.enable_grok_imagine) return;
    setIsThoughtToImageEnabled(true);
  };

  const stopThoughtToImage = () => {
    setIsThoughtToImageEnabled(false);
  };

  const startTranscription = () => {
    setIsTranscribing(true);
  };

  const stopTranscription = () => {
    setIsTranscribing(false);
  };

  /**
   * Load every conversation thread for this user + avatar, newest first.
   * GET /conversations
   *
   * The identity this asks under must be the identity the turns were sent
   * under. On a shared avatar's public chat those turns are anonymous, so the
   * threads belong to the anonymous visitor; listing them with the credential
   * of whatever account this browser is signed into searches THAT account's
   * threads instead — which is why an owner opening their own shared link was
   * shown their private chats with the avatar rather than the guest's.
   *
   * @param {Object} _user Unused; kept for the existing call signature.
   * @param {Object} avatarForConversations The avatar whose threads to list.
   * @returns {Promise<Array>} Thread records.
   */
  async function getConversationList(_user, avatarForConversations) {
    const threads = await requestJson('/conversations', {
      query: { assistant_id: resolveAssistantId(avatarForConversations) },
      asAnonymousIdentity: isSharedAvatarChatPath(),
    });
    const threadList = overlayLocalPinState(
      Array.isArray(threads) ? threads : []
    );
    setConversationList(threadList);
    return threadList;
  }

  /**
   * Make a thread the active conversation.
   *
   * @param {Object} _avatarForConversation Unused; kept for the existing call signature.
   * @param {string} threadId The thread to activate.
   * @returns {Promise<string>} The activated thread identifier.
   */
  async function switchActiveConveration(_avatarForConversation, threadId) {
    setActiveConversation(threadId);
    // A paused turn belongs to the thread it paused on. Carrying its panel into
    // a different conversation would offer the user decisions about documents
    // they are no longer looking at, and resume the wrong thread if acted on.
    setPendingInterrupt(null);
    return threadId;
  }

  /**
   * Forget everything about the conversation currently on screen.
   *
   * Called before loading a different avatar's history. Without it the previous
   * avatar's bubbles stay on screen across the two round trips the load takes —
   * and stay forever if either request fails.
   */
  function resetConversationState() {
    setMessages([]);
    setActiveConversation(null);
    setConversationList([]);
    setPendingInterrupt(null);
  }

  /**
   * Load one thread's message history into state.
   * GET /conversations/{thread_id}/messages
   *
   * `threadId` is required rather than defaulting to whatever is in context.
   * The defaulting chain this replaced read `activeConversation` and
   * `conversationList` out of the render this function was created in, so when
   * an avatar with no threads was opened it resolved to the PREVIOUS avatar's
   * thread and loaded a stranger's conversation. A caller that wants the active
   * conversation now has to say so explicitly, which no longer silently means
   * "some other avatar's conversation".
   *
   * @param {Object} _user Unused; kept for the existing call signature.
   * @param {Object} avatarForMessages The avatar the thread belongs to.
   * @param {string|null} threadId Thread to load; a falsy value clears the list.
   */
  async function getActiveConversationMessages(
    _user,
    avatarForMessages,
    threadId
  ) {
    if (!threadId) {
      setMessages([]);
      return;
    }

    // Anonymous for the same reason the listing above is: the API refuses a
    // thread whose stamped user is not the caller, so asking for a guest's
    // thread while holding a session credential is not merely inaccurate — it
    // is a 404, and the transcript the visitor picked never opens.
    const messagesResponse = await requestJson(
      `/conversations/${encodeURIComponent(threadId)}/messages`,
      {
        query: { assistant_id: resolveAssistantId(avatarForMessages) },
        asAnonymousIdentity: isSharedAvatarChatPath(),
      }
    );
    const storedMessages = normalizeThreadMessages(
      messagesResponse?.messages,
      threadId
    );

    // Put the attachments back. The server returns none — an upload is read
    // into text and the bytes dropped — so anything shown here comes from this
    // browser's own archive, matched to messages by their order in the thread.
    releaseRestoredAttachmentUrls();
    const archivedAttachments = await loadThreadAttachments(threadId);
    let humanMessageOrdinal = -1;
    const restoredMessages = storedMessages.map((storedMessage) => {
      if (storedMessage.type !== 'human') return storedMessage;
      humanMessageOrdinal += 1;
      const archivedForMessage = archivedAttachments.get(humanMessageOrdinal);
      if (!archivedForMessage?.length) return storedMessage;
      return {
        ...storedMessage,
        media: archivedForMessage.map((archivedAttachment) => {
          const objectUrl = URL.createObjectURL(archivedAttachment.blob);
          restoredAttachmentUrlsRef.current.push(objectUrl);
          return {
            filename: archivedAttachment.filename,
            content_type: archivedAttachment.contentType,
            url: objectUrl,
          };
        }),
      };
    });
    setMessages(restoredMessages);
  }

  /**
   * Send one message and stream the reply into the messages array.
   * POST /message/{assistant_id} with stream=true.
   *
   * @param {Object} _user Unused; kept for the existing call signature.
   * @param {Object} avatarForMessage The avatar to message.
   * @param {string} threadId Thread to continue, or null to start a new one.
   * @param {string} messageContent The user's message text.
   * @param {File[]} [attachedFiles] Files to attach to this turn.
   * @returns {Promise<{success: boolean, reply: string, threadId: string|null}>}
   */
  async function sendMessageAwaitResponseUpdateMessages(
    _user,
    avatarForMessage,
    threadId,
    messageContent,
    attachedFiles = []
  ) {
    const formData = new FormData();
    formData.append('message', messageContent);
    formData.append('stream', 'true');
    // The sentinel names a conversation the server has never heard of; sending
    // it would ask the API to continue a thread that does not exist. Omitting
    // thread_id is exactly how a new conversation is requested.
    if (threadId && threadId !== NEW_CONVERSATION_ID) {
      formData.append('thread_id', threadId);
    }
    for (const attachedFile of attachedFiles) {
      formData.append('files', attachedFile);
    }
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (userTimezone) {
      formData.append('user_timezone', userTimezone);
    }

    return runAssistantTurnStream({
      _user,
      avatarForMessage,
      threadId,
      path: `/message/${encodeURIComponent(resolveAssistantId(avatarForMessage))}`,
      formData,
    });
  }

  /**
   * Send a user-visible turn.
   *
   * A JSON follow-up list is hidden from the transcript and offered as chips
   * locally. Posting the same user text again to "ask for speech" used to
   * store a second identical human message and often hid the real reply too.
   */
  async function sendVisibleAssistantTurn(
    avatarForMessage,
    threadId,
    messageContent,
    attachedFiles = []
  ) {
    return sendMessageAwaitResponseUpdateMessages(
      user,
      avatarForMessage,
      threadId,
      messageContent,
      attachedFiles
    );
  }

  /**
   * Stream one assistant turn — a new message or a resumed one — into the
   * messages array.
   *
   * Both ways a turn can start — a fresh message, or resuming a turn that
   * paused for the user's approval — produce the SAME server-sent event
   * sequence and need the same handling of it, so the lifecycle lives here once
   * and each entry point supplies only its own path and body.
   *
   * The sequence is: an optional `usage_estimate` frame, `assistant_token`
   * frames that each carry a text fragment, and a terminal `done` frame with
   * the authoritative full content and the thread_id (the server creates the
   * thread when none is passed) — or an `interrupt` frame when the graph pauses
   * for human approval.
   *
   * @param {Object} parameters
   * @param {Object} parameters.avatarForMessage The avatar being streamed.
   * @param {string} parameters.threadId Thread being continued, or null.
   * @param {string} parameters.path The endpoint to stream from.
   * @param {FormData} parameters.formData The request body.
   * @param {boolean} [parameters.hideFromTranscript] Collect the reply without
   *   painting a bubble (used for conversation-suggestion harvests).
   * @param {boolean} [parameters.deferBubbleUntilFirstToken] Paint the reply
   *   bubble only once a token arrives, so a turn that ends without a reply (an
   *   ambient observation the avatar ignored) leaves no trace on screen.
   * @param {Function} [parameters.onExtraEvent] Receives every stream event the
   *   lifecycle here does not handle itself (for example `ambient_decision`).
   * @param {Function} [parameters.bubbleDecorator] Given the bubble about to
   *   be painted, returns extra fields for it (for example the ambient triage
   *   record that turns the bubble into a notification card).
   */
  async function runAssistantTurnStream({
    avatarForMessage,
    threadId,
    path,
    formData,
    hideFromTranscript = false,
    deferBubbleUntilFirstToken = false,
    onExtraEvent = null,
    bubbleDecorator = null,
  }) {
    const assistantId = resolveAssistantId(avatarForMessage);
    const streamingMessageId = `streaming-${Date.now()}`;
    const streamStartedAtMs = performance.now();
    // The turn keeps running wherever the user goes; only its rendering is
    // conditional on that conversation still being the one on screen.
    const isStillOnScreen = () =>
      onScreenAssistantIdRef.current === assistantId;
    const updateMessagesIfStillOnScreen = (updater) => {
      if (hideFromTranscript) return;
      if (isStillOnScreen()) {
        setMessages(updater);
      }
    };
    const setActivityIfStillOnScreen = (activity) => {
      if (hideFromTranscript) return;
      if (isStillOnScreen()) {
        setAssistantActivity(activity);
      }
    };

    // The assistant message that the token stream grows. isLoading drives the
    // MessageList's typing indicator until the first token lands.
    let bubblePainted = false;
    const paintBubble = () => {
      if (bubblePainted) return;
      bubblePainted = true;
      const decoration = bubbleDecorator ? bubbleDecorator() : null;
      updateMessagesIfStillOnScreen((previousMessages) => [
        ...previousMessages,
        {
          id: streamingMessageId,
          type: 'ai',
          content: '',
          isLoading: true,
          timestamp: new Date().toISOString(),
          ...(decoration ?? {}),
        },
      ]);
    };
    if (!deferBubbleUntilFirstToken) {
      paintBubble();
    }
    // A deferred turn stays silent until it has something to say: no bubble
    // and no "Thinking…" status while the server decides whether to reply.
    const setActivityUnlessDeferred = (activity) => {
      if (deferBubbleUntilFirstToken && !bubblePainted) return;
      setActivityIfStillOnScreen(activity);
    };

    // Everything streamed so far, whether or not it was shown. The suppression
    // test reads the accumulated text rather than each fragment: the structured
    // output arrives in pieces, and a piece from the middle of it looks like
    // ordinary prose on its own.
    let streamedText = '';
    let turnStreamedInternalJson = false;

    const appendTokenToStreamingMessage = (tokenText) => {
      streamedText += tokenText;
      if (
        turnStreamedInternalJson ||
        streamedTextIsInternalJson(streamedText)
      ) {
        // Latched for the rest of the turn: once the stream is known to be
        // carrying the correction tool's proposal, no later fragment of it
        // should reach the transcript either.
        turnStreamedInternalJson = true;
        setActivityIfStillOnScreen(ASSISTANT_ACTIVITY.suggestingEdits);
        return;
      }
      paintBubble();
      updateMessagesIfStillOnScreen((previousMessages) =>
        previousMessages.map((message) =>
          message.id === streamingMessageId
            ? {
                ...message,
                isLoading: false,
                content: message.content + tokenText,
              }
            : message
        )
      );
      setActivityIfStillOnScreen(ASSISTANT_ACTIVITY.responding);
    };

    let terminalFrame = null;

    await streamServerSentEvents(path, {
      method: 'POST',
      formData,
      // A turn on a shared avatar's public chat belongs to the anonymous
      // visitor, never to whatever account this browser is signed into. The
      // API resolves the anonymous identity only for a caller that presents no
      // credential at all, so the credential is withheld here rather than
      // merely unused: sending it would attribute the guest's conversation —
      // and meter its tokens against the allotment — of the signed-in account,
      // which during testing is the administrator's.
      asAnonymousIdentity: isSharedAvatarChatPath(),
      onEvent: (streamEvent) => {
        if (streamEvent.type === 'assistant_token') {
          appendTokenToStreamingMessage(streamEvent.text ?? '');
          setActivityIfStillOnScreen(ASSISTANT_ACTIVITY.responding);
        } else if (streamEvent.type === 'usage_estimate') {
          // The first frame of a turn: the request has been costed and the
          // model has not started speaking yet.
          setActivityUnlessDeferred(ASSISTANT_ACTIVITY.thinking);
        } else if (streamEvent.type === 'media_job_started') {
          // The avatar called update_avatar_identity_with_media: the media is
          // processed in the background, and its progress gets the same toast
          // an upload from the settings screen gets. Not awaited — the turn's
          // reply keeps streaming while the job runs.
          followMediaJobWithToast(streamEvent.job_id, streamEvent.description);
          setActivityIfStillOnScreen(ASSISTANT_ACTIVITY.thinking);
        } else if (streamEvent.type === 'status') {
          // The avatar started or finished a tool. The phrase is what the
          // avatar is doing right now ("Listing files on linux-pc-dev",
          // "Running analysis code"). A data-analysis turn spends most of its
          // time here, before the first reply token, so this is the only
          // signal a person waiting gets that the turn is progressing.
          setActivityUnlessDeferred(
            streamEvent.text || ASSISTANT_ACTIVITY.thinking
          );
        } else if (streamEvent.type === 'keepalive_comment') {
          // Tokens have stopped but the turn has not: the server keeps this
          // line open while it runs its post-reply analysis.
          setActivityUnlessDeferred(ASSISTANT_ACTIVITY.analyzing);
        } else if (
          streamEvent.type !== 'done' &&
          streamEvent.type !== 'interrupt'
        ) {
          onExtraEvent?.(streamEvent);
        }
        if (
          streamEvent.type === 'done' ||
          streamEvent.type === 'interrupt'
        ) {
          terminalFrame = streamEvent;
          turnPausedForUserRef.current = streamEvent.type === 'interrupt';
          setActivityIfStillOnScreen(
            streamEvent.type === 'interrupt'
              ? describeInterrupt(streamEvent.interrupt)
              : null
          );
        }
      },
    });

    if (terminalFrame?.type === 'interrupt' && hideFromTranscript) {
      // A hidden harvest must not steal the open conversation or raise a panel.
      return {
        success: false,
        reply: '',
        threadId: terminalFrame.thread_id ?? null,
      };
    }

    if (terminalFrame?.type === 'interrupt') {
      // Finalize the bubble the tokens were streaming into, exactly as the
      // `done` branch does. Without this the placeholder keeps `isLoading`
      // forever and a paused turn leaves a typing indicator bouncing with no
      // content and no way to answer.
      //
      // A copy of the interrupt is recorded on the message that raised it, so
      // the transcript keeps which thread and avatar the pause belonged to.
      // What the user answers is the single InterruptPanel, which renders from
      // `pendingInterrupt` below; nothing renders from these fields.
      //
      // Whatever the avatar managed to say before pausing is kept, but a
      // placeholder holding nothing readable is dropped rather than left as an
      // empty bubble. That is the usual case for a correction: the only thing
      // streamed was the proposal, and `appendTokenToStreamingMessage`
      // suppresses that from the transcript, so the message it was growing
      // never receives any text.
      updateMessagesIfStillOnScreen((previousMessages) =>
        previousMessages
          .map((message) => {
            if (message.id !== streamingMessageId) return message;
            const serverTimeMs = resolveMessageResponseTimeMs(terminalFrame);
            const clientTimeMs = Math.round(performance.now() - streamStartedAtMs);
            const totalResponseTimeMs =
              serverTimeMs ?? (clientTimeMs > 0 ? clientTimeMs : null);
            const timed = attachResponseTimeMs(message, totalResponseTimeMs);
            return {
              ...message,
              ...timed,
              isLoading: false,
              interrupt: terminalFrame.interrupt ?? null,
              interruptThreadId: terminalFrame.thread_id ?? threadId ?? null,
              interruptAssistantId: assistantId,
            };
          })
          .filter(
            (message) =>
              message.id !== streamingMessageId ||
              (message.content ?? '').trim() !== ''
          )
      );
      if (terminalFrame.thread_id && !hideFromTranscript) {
        // A turn can pause before the thread has ever been seen here — a first
        // message that immediately asks a question. Adopting the id now is what
        // lets the resume address the right thread.
        setActiveConversation(terminalFrame.thread_id);
      }
      // This is what raises the panel and tells the composer a turn is waiting.
      interruptSequenceRef.current += 1;
      setPendingInterrupt({
        sequence: interruptSequenceRef.current,
        threadId: terminalFrame.thread_id,
        assistantId,
        interrupt: terminalFrame.interrupt,
      });
    } else if (terminalFrame?.type === 'done') {
      const leakedSuggestions = parseConversationSuggestionList(
        terminalFrame.content ?? ''
      );
      const hideSuggestionReply =
        !hideFromTranscript && Boolean(leakedSuggestions);
      // A harvest that landed on this turn answers with a JSON list. That list
      // is chips, not something the avatar said — drop the bubble and let the
      // caller ask again for a spoken reply.
      if (hideSuggestionReply) {
        updateMessagesIfStillOnScreen((previousMessages) =>
          previousMessages.filter((message) => message.id !== streamingMessageId)
        );
      } else {
        // A deferred turn that produced a reply without streaming tokens still
        // gets its bubble now; one that produced nothing leaves no trace.
        if (String(terminalFrame.content ?? '').trim()) {
          paintBubble();
        }
        // Adopt the authoritative content and metadata from the terminal frame;
        // the token stream is a preview, `done.content` is the record.
        updateMessagesIfStillOnScreen((previousMessages) =>
          previousMessages.map((message) => {
            if (message.id !== streamingMessageId) return message;
            const serverTimeMs = resolveMessageResponseTimeMs(terminalFrame);
            const clientTimeMs = Math.round(performance.now() - streamStartedAtMs);
            const totalResponseTimeMs =
              serverTimeMs ?? (clientTimeMs > 0 ? clientTimeMs : null);
            const timed = attachResponseTimeMs(terminalFrame, totalResponseTimeMs);
            const finalized = {
              ...message,
              isLoading: false,
              content: terminalFrame.content ?? message.content,
              usage: timed.usage,
              request_id: terminalFrame.request_id ?? null,
              total_response_time_ms: timed.total_response_time_ms,
              response_metadata: timed.response_metadata,
              ambient:
                terminalFrame.response_metadata?.ambient ??
                message.ambient ??
                null,
              // Classified once the whole reply is known; the chat swaps the
              // avatar's icon to the matching emotion still, and voice mode
              // picks the emotion's idle loop and lip-sync still from it.
              sentiment: terminalFrame.response_metadata?.sentiment ?? null,
            };
            rememberAvatarResponseMetrics(
              terminalFrame.thread_id ?? threadId,
              finalized
            );
            return finalized;
          })
        );
      }
      if (terminalFrame.thread_id && !hideFromTranscript) {
        const wasNewConversation = threadId !== terminalFrame.thread_id;
        setActiveConversation(terminalFrame.thread_id);
        if (wasNewConversation) {
          // The server just minted this conversation. Re-listing is what moves
          // it from the placeholder in the sidebar to a real entry the user can
          // return to; without it the conversation exists but cannot be found.
          getConversationList(null, avatarForMessage).catch((listError) => {
            console.error(
              'Refreshing the conversation list failed:',
              listError
            );
          });
        }
      }
    } else {
      // The stream ended without a terminal frame — surface whatever tokens
      // arrived, but warn, because the reply may be truncated.
      updateMessagesIfStillOnScreen((previousMessages) =>
        previousMessages.map((message) =>
          message.id === streamingMessageId
            ? { ...message, isLoading: false }
            : message
        )
      );
      toast.error('The response stream ended unexpectedly.');
    }

    // `reply` is the authoritative text from the terminal frame — what live
    // mode speaks aloud. It is returned rather than read back off the messages
    // array, because that array may belong to a different conversation by now.
    const leakedSuggestions = parseConversationSuggestionList(
      terminalFrame?.content ?? ''
    );
    const hideSuggestionReply =
      !hideFromTranscript && Boolean(leakedSuggestions);
    return {
      success: terminalFrame != null,
      reply: hideSuggestionReply ? '' : (terminalFrame?.content ?? ''),
      leakedSuggestions,
      shouldRetryForSpokenReply: hideSuggestionReply,
      threadId: terminalFrame?.thread_id ?? null,
      sentiment: hideSuggestionReply
        ? null
        : (terminalFrame?.response_metadata?.sentiment ?? null),
    };
  }

  /**
   * Answer the question a paused turn asked, and stream the continuation.
   * POST /message/{assistant_id}/resume
   *
   * The graph pauses whenever it wants the owner's decision — which documents a
   * fact correction should rewrite or remove, or whether to connect a data
   * server. Until this is called the run stays parked on the server and the
   * conversation cannot move on, so every path that opens the panel must end
   * here.
   *
   * @param {string} decision `'apply'` to carry the decisions out, `'cancel'`
   *   to abandon the whole thing and change nothing.
   * @param {Array} [items] Per-document decisions, for a fact correction. Each
   *   entry is `{index, action, corrected_text, correction_context}` where
   *   `action` is `'accept'`, `'remove'`, or `'skip'`. Any matched document not
   *   named here is skipped by the server, so omitting this changes nothing.
   * @returns {Promise<{success: boolean, reply: string, threadId: string|null}>}
   */
  async function resumePendingInterrupt(decision, items) {
    const interruptToResume = pendingInterrupt;
    if (!interruptToResume) {
      return { success: false, reply: '', threadId: null };
    }

    const formData = new FormData();
    formData.append('thread_id', interruptToResume.threadId);
    formData.append('decision', decision);
    if (items) {
      // The API takes the per-document decisions as ONE form field holding a
      // JSON list, not as repeated fields.
      formData.append('items', JSON.stringify(items));
    }
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (userTimezone) {
      formData.append('user_timezone', userTimezone);
    }

    // Close the panel before streaming rather than after. The decision has been
    // made, and the continuation may pause again on a second correction — which
    // re-arms this with the NEW interrupt, so clearing it afterwards would
    // discard the follow-up question instead of the one just answered.
    setPendingInterrupt(null);

    try {
      turnPausedForUserRef.current = false;
      setPendingSendCount((count) => count + 1);
      setAssistantActivity(ASSISTANT_ACTIVITY.thinking);

      return await runAssistantTurnStream({
        _user: user,
        avatarForMessage: activeAvatar,
        threadId: interruptToResume.threadId,
        path: `/message/${encodeURIComponent(
          interruptToResume.assistantId
        )}/resume`,
        formData,
      });
    } catch (resumeError) {
      console.error('Failed to resume the paused turn:', resumeError);
      setMessages((previousMessages) =>
        previousMessages.filter(
          (message) => !message.id?.startsWith('streaming-')
        )
      );
      // The server still has the run parked, so putting the panel back is what
      // lets the user try again instead of stranding the correction.
      setPendingInterrupt(interruptToResume);
      reportTurnFailure(
        resumeError,
        'Failed to send your decision. Please try again.'
      );
      return { success: false, reply: '', threadId: null };
    } finally {
      setPendingSendCount((count) => Math.max(0, count - 1));
      if (!turnPausedForUserRef.current) {
        setAssistantActivity(null);
      }
    }
  }

  /**
   * Report a turn that could not be carried out.
   *
   * Where the report goes depends on which failure it is, and the two are
   * reported in one place each rather than both.
   *
   * A spent allotment is reported in the TRANSCRIPT alone. It belongs there:
   * every later message is refused the same way, so the refusal has to outlive
   * a toast, and the notice in the transcript already carries the same sentence
   * and the same way through to billing (see BillingRefusalNotice). Toasting it
   * as well said the same thing twice, and said it over the conversation the
   * reader was trying to read.
   *
   * Every other failure is reported by TOAST alone. Those are one-off — a
   * dropped connection, a rejected attachment — with nothing to come back to,
   * and a transcript entry for each would be a log the reader cannot clear.
   *
   * @param {Error} turnError The error the turn failed with.
   * @param {string} fallbackMessage What to say when the error carries no
   *   sentence of its own.
   */
  function reportTurnFailure(turnError, fallbackMessage) {
    if (isBillingRefusal(turnError)) {
      setMessages((previousMessages) => [
        ...previousMessages,
        buildBillingRefusalMessage(turnError),
      ]);
      return;
    }
    showRequestFailureToast(turnError, { fallbackMessage });
  }

  /**
   * Release the object URLs held for the transcript currently on screen.
   */
  function releaseRestoredAttachmentUrls() {
    for (const objectUrl of restoredAttachmentUrlsRef.current) {
      URL.revokeObjectURL(objectUrl);
    }
    restoredAttachmentUrlsRef.current = [];
  }

  // Old cached attachments are dropped once per session rather than on a timer:
  // the archive is a convenience, and pruning it is not worth a scheduled task.
  useEffect(() => {
    pruneExpiredAttachments();
    return releaseRestoredAttachmentUrls;
  }, []);

  /**
   * Send a turn: the composer's contents, or a message the interface supplies
   * on the user's behalf.
   *
   * `messageTextOverride` is what a one-click starter prompt sends — the
   * suggestion offered in an empty shared-avatar chat. It cannot be expressed
   * by writing the suggestion into the composer and calling this function,
   * because `inputMessage` is React state: the new value is not readable in
   * the tick it is set, so this function would send the empty string the
   * composer still holds. A supplied message also leaves the composer alone —
   * whatever the visitor was part-way through typing, and anything they had
   * attached, is still theirs to send afterwards.
   *
   * @param {string} [messageTextOverride] Text to send instead of the
   *   composer's contents.
   * @param {File[]} [extraFiles] Stills from a live webcam or screen share,
   *   captured at send so they travel with this turn.
   */
  async function handleSendMessageMediaContext(
    messageTextOverride,
    extraFiles = []
  ) {
    const messageWasSuppliedByTheInterface =
      typeof messageTextOverride === 'string';
    const messageContent = messageWasSuppliedByTheInterface
      ? messageTextOverride
      : inputMessage;
    const attachedFiles = [
      ...(messageWasSuppliedByTheInterface ? [] : mediaFiles),
      ...(Array.isArray(extraFiles) ? extraFiles : []),
    ];

    if (!activeAvatar || (!messageContent.trim() && attachedFiles.length === 0)) {
      console.log('Missing required data for sending message');
      return;
    }

    const temporaryUserMessageId = `temp-${Date.now()}`;
    // Which of the user's messages this turn will be, counted before the
    // optimistic one is added. The archive keys attachments by this ordinal
    // because the server assigns the message its own id, which the browser
    // never learns.
    const humanMessageOrdinal = messages.filter(
      (existingMessage) => existingMessage.type === 'human'
    ).length;

    try {
      setPendingSendCount((count) => count + 1);
      // Optimistically render the user's message immediately.
      setMessages((previousMessages) => [
        ...previousMessages,
        {
          id: temporaryUserMessageId,
          content: messageContent,
          type: 'human',
          timestamp: new Date().toISOString(),
          // `url` is what makes an attachment visible: the image bubble, the
          // audio and video players, and the download link all read it. It was
          // absent, so an attached image rendered "Loading image…" forever. The
          // API returns no address for a file the browser already holds, and an
          // object URL points straight at it with no round trip.
          media: attachedFiles.map((attachedFile) => ({
            filename: attachedFile.name,
            content_type: attachedFile.type,
            url: URL.createObjectURL(attachedFile),
          })),
          content_type:
            attachedFiles.length > 0 && !messageContent ? 'media' : 'text',
        },
      ]);
      if (!messageWasSuppliedByTheInterface) {
        setInputMessage('');
        setMediaFiles([]);
      }
      setAttachmentsInFlight((current) => [...current, ...attachedFiles]);
      turnPausedForUserRef.current = false;
      // Say something from the moment the turn starts. The first stream frame
      // can be seconds away, and an unlabelled ellipsis for that long is what
      // makes a working avatar look like a stuck one.
      setAssistantActivity(ASSISTANT_ACTIVITY.thinking);

      const turnResult = await sendVisibleAssistantTurn(
        activeAvatar,
        activeConversation,
        messageContent,
        attachedFiles
      );

      // Keep a local copy of what was attached so reopening or reloading this
      // conversation still shows it. The thread identifier is only known now
      // when the turn created the conversation, which is why this waits for the
      // turn rather than running beside the send.
      if (attachedFiles.length > 0) {
        const threadIdForArchive = turnResult?.threadId ?? activeConversation;
        if (threadIdForArchive) {
          await saveMessageAttachments(
            threadIdForArchive,
            humanMessageOrdinal,
            attachedFiles
          );
        }
      }
    } catch (sendError) {
      console.error('Failed to send message:', sendError);

      // Remove the optimistic user message and any unfinished assistant
      // message so the failed turn leaves no half-rendered artifacts.
      setMessages((previousMessages) =>
        previousMessages.filter(
          (message) =>
            message.id !== temporaryUserMessageId &&
            !message.id?.startsWith('streaming-')
        )
      );

      if (sendError.status === 413) {
        toast.error(
          `The server rejected the attachment as too large (over ${MAX_FILE_SIZE_DESCRIPTION}).`
        );
      } else {
        reportTurnFailure(sendError, 'Failed to send message');
      }
    } finally {
      setPendingSendCount((count) => Math.max(0, count - 1));
      setAttachmentsInFlight((current) =>
        current.filter((heldFile) => !attachedFiles.includes(heldFile))
      );
      // The turn is over however it ended; leaving the status up would keep
      // claiming the avatar is working on a reply that is never coming. The one
      // exception is a turn that paused for the user: that status describes a
      // state that outlives the request and is cleared when the user answers.
      if (!turnPausedForUserRef.current) {
        setAssistantActivity(null);
      }
    }
  }

  /**
   * Resend a user turn, replacing everything after it.
   *
   * Used by edit-accept, retry, and regenerate (which resends the user message
   * immediately before the avatar reply).
   *
   * @param {string} userMessageId The human message to resend from.
   * @param {string} [replacementText] Edited text; defaults to the original.
   */
  async function resendFromUserMessage(userMessageId, replacementText) {
    const sourceMessage = messages.find(
      (message) => message.id === userMessageId
    );
    if (!sourceMessage || !activeAvatar) return;
    const text =
      typeof replacementText === 'string'
        ? replacementText
        : sourceMessage.content ?? '';
    if (!String(text).trim()) return;

    const temporaryUserMessageId = `temp-${Date.now()}`;
    // Lock the composer before rewriting the transcript. If the count rises
    // after that rewrite, the suggestion harvest sees a new last avatar
    // reply with pendingSendCount still 0 and starts a hidden turn on the
    // same thread — which is how an edited message got a list of follow-ups
    // as its "reply".
    setPendingSendCount((count) => count + 1);
    setMessages((previousMessages) => {
      const cutIndex = previousMessages.findIndex(
        (message) => message.id === userMessageId
      );
      if (cutIndex < 0) return previousMessages;
      return [
        ...previousMessages.slice(0, cutIndex),
        {
          id: temporaryUserMessageId,
          content: text,
          type: 'human',
          timestamp: new Date().toISOString(),
        },
      ];
    });

    try {
      turnPausedForUserRef.current = false;
      setAssistantActivity(ASSISTANT_ACTIVITY.thinking);
      await sendVisibleAssistantTurn(
        activeAvatar,
        activeConversation,
        text,
        []
      );
    } catch (resendError) {
      reportTurnFailure(resendError, 'Could not resend that message.');
    } finally {
      setPendingSendCount((count) => Math.max(0, count - 1));
      if (!turnPausedForUserRef.current) {
        setAssistantActivity(null);
      }
    }
  }

  /**
   * Regenerate an avatar reply by resending the user turn that produced it.
   *
   * @param {string} avatarMessageId The assistant message to replace.
   */
  async function regenerateAvatarReply(avatarMessageId) {
    const avatarIndex = messages.findIndex(
      (message) => message.id === avatarMessageId
    );
    if (avatarIndex < 0) return;
    const precedingUser = [...messages.slice(0, avatarIndex)]
      .reverse()
      .find((message) => message.type === 'human' || message.type === 'user');
    if (!precedingUser) return;
    await resendFromUserMessage(precedingUser.id);
  }

  /**
   * Record thumbs / written feedback on an avatar reply.
   *
   * The API currently accepts like/dislike as inert form fields on a new
   * message; the rating is stored on the bubble so the UI is live even when
   * persist is deferred. A dedicated persist call is attempted and ignored
   * when the endpoint is absent.
   *
   * @param {string} messageId The assistant message.
   * @param {Object} feedback `{ type: 'like'|'dislike', comment?: string }`
   */
  async function submitMessageFeedback(messageId, feedback) {
    const rated = messages.find((message) => message.id === messageId);
    setMessages((previousMessages) =>
      previousMessages.map((message) =>
        message.id === messageId ? { ...message, feedback } : message
      )
    );
    if (!rated?.request_id || !activeAvatar) return;
    try {
      await requestJson('/message_feedback', {
        method: 'POST',
        body: {
          request_id: rated.request_id,
          assistant_id: resolveAssistantId(activeAvatar),
          thread_id: activeConversation,
          feedback_type: feedback.type,
          comment: feedback.comment ?? null,
        },
      });
    } catch {
      // Persist is optional until the API wires FeedbackData; the UI already
      // reflects the rating on this message.
    }
  }

  /**
   * Follow-up chips for the composer. These used to come from a hidden
   * /message turn that asked for a JSON array; that turn is what made the
   * avatar answer "hey mom" with the list instead of talking. Chips are
   * derived from the last real reply so the graph is never asked to speak
   * in that format.
   *
   * @param {Object} [options]
   * @param {string[]} [options.exclude] Prompts already on screen; skip on a re-roll.
   * @returns {Promise<string[]>} Up to three suggestion strings.
   */
  async function fetchConversationSuggestions({ exclude = [] } = {}) {
    return localFollowUpSuggestions(messages, { exclude });
  }

  /**
   * Speak one turn: send recorded audio as the message and return what the
   * avatar said back.
   *
   * Voice is a different medium for the same conversation, not a separate one.
   * The recording goes to the same endpoint as a typed message (the API
   * transcribes an audio attachment), lands in the same thread, and appears in
   * the same transcript — so a spoken exchange is readable afterwards and can
   * be reopened from the conversation list like any other.
   *
   * @param {File} recordedAudio The recorded turn.
   * @returns {Promise<string>} The avatar's reply text, for speaking aloud.
   */
  /**
   * Send a turn the browser has already transcribed (dictation or live audio).
   *
   * Unlike `sendVoiceTurn`, which attaches the recording for the server to
   * transcribe, the words are known here, so the transcript shows what was
   * said rather than a "spoken message" placeholder. Returns the reply and its
   * classified sentiment so voice mode can pick the emotion's assets.
   *
   * @param {string} text The recognized words.
   * @returns {Promise<{reply: string, sentiment: Object|null}>}
   */
  /**
   * Send one ambient observation — webcam / screen snapshots taken on the
   * capture timer — as a hidden turn on the current conversation.
   *
   * Nothing is painted for the person's side: the avatar was handed context,
   * not a message. The server's triage decides what happens next. `ignore`
   * ends the turn silently; `respond` streams a reply into an ordinary bubble;
   * `notify` streams a heads-up that renders as a notification card. A thread
   * minted by an observation is adopted exactly like one minted by a typed
   * turn, so the conversation appears in the sidebar.
   *
   * @param {File[]} files The snapshots.
   * @param {Object} options
   * @param {boolean} [options.voiceMode] The person is in voice mode.
   * @returns {Promise<{decision: string|null, summary: string|null, reply: string, sentiment: Object|null, threadId: string|null, observationId: string|null}>}
   */
  async function sendAmbientObservation(files, { voiceMode = false } = {}) {
    if (!activeAvatar || !files?.length) {
      return {
        decision: null,
        summary: null,
        reply: '',
        sentiment: null,
        threadId: null,
        observationId: null,
      };
    }
    const threadId =
      activeConversation && activeConversation !== NEW_CONVERSATION_ID
        ? activeConversation
        : null;
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const { path, formData } = buildAmbientMessageRequest(
      resolveAssistantId(activeAvatar),
      files,
      {
        threadId,
        capturedAt: new Date().toISOString(),
        voiceMode,
        userTimezone,
      }
    );
    let decision = null;
    // A first observation mints the conversation. Counting it as a pending send
    // keeps the composer from minting a second thread in the same moment.
    const mintsThread = threadId == null;
    if (mintsThread) setPendingSendCount((count) => count + 1);
    try {
      const outcome = await runAssistantTurnStream({
        _user: user,
        avatarForMessage: activeAvatar,
        threadId,
        path,
        formData,
        deferBubbleUntilFirstToken: true,
        onExtraEvent: (streamEvent) => {
          if (streamEvent.type === 'ambient_decision') {
            decision = streamEvent;
            if (streamEvent.decision === 'notify') {
              notifyAmbientObservation(activeAvatar?.name, streamEvent.summary);
            }
          }
        },
        bubbleDecorator: () =>
          decision
            ? {
                ambient: {
                  decision: decision.decision,
                  observation_id: decision.observation_id,
                  observation_kind: decision.observation_kind,
                  summary: decision.summary,
                  reason: decision.reason,
                },
              }
            : {},
      });
      return {
        decision: decision?.decision ?? null,
        summary: decision?.summary ?? null,
        reply: outcome?.reply ?? '',
        sentiment: outcome?.sentiment ?? null,
        threadId: outcome?.threadId ?? null,
        observationId: decision?.observation_id ?? null,
      };
    } finally {
      if (mintsThread) setPendingSendCount((count) => Math.max(0, count - 1));
    }
  }

  async function sendSpokenTurn(text) {
    const words = String(text ?? '').trim();
    if (!activeAvatar || !words) {
      return { reply: '', sentiment: null };
    }
    setPendingSendCount((count) => count + 1);
    try {
      setMessages((previousMessages) => [
        ...previousMessages,
        {
          id: `temp-${Date.now()}`,
          content: words,
          type: 'human',
          timestamp: new Date().toISOString(),
        },
      ]);
      turnPausedForUserRef.current = false;
      setAssistantActivity(ASSISTANT_ACTIVITY.thinking);
      const { reply, sentiment } = await sendVisibleAssistantTurn(
        activeAvatar,
        activeConversation,
        words,
        []
      );
      return { reply: reply ?? '', sentiment: sentiment ?? null };
    } catch (turnError) {
      console.error('The spoken turn failed:', turnError);
      reportTurnFailure(turnError, 'Could not send what you said.');
      return { reply: '', sentiment: null };
    } finally {
      setPendingSendCount((count) => Math.max(0, count - 1));
      if (!turnPausedForUserRef.current) {
        setAssistantActivity(null);
      }
    }
  }

  async function sendVoiceTurn(recordedAudio) {
    if (!activeAvatar || !recordedAudio) {
      return '';
    }
    const temporaryUserMessageId = `temp-${Date.now()}`;
    setPendingSendCount((count) => count + 1);
    try {
      setMessages((previousMessages) => [
        ...previousMessages,
        {
          id: temporaryUserMessageId,
          // The transcript is not known until the server has heard it; the
          // bubble says what was sent rather than pretending to know the words.
          content: '🎙 Spoken message',
          type: 'human',
          timestamp: new Date().toISOString(),
          media: [
            {
              filename: recordedAudio.name,
              content_type: recordedAudio.type,
              url: URL.createObjectURL(recordedAudio),
            },
          ],
        },
      ]);
      turnPausedForUserRef.current = false;
      setAssistantActivity(ASSISTANT_ACTIVITY.thinking);

      const { reply } = await sendVisibleAssistantTurn(
        activeAvatar,
        activeConversation,
        '',
        [recordedAudio]
      );
      return reply ?? '';
    } catch (voiceError) {
      console.error('The spoken turn failed:', voiceError);
      reportTurnFailure(voiceError, 'Could not send that recording.');
      return '';
    } finally {
      setPendingSendCount((count) => Math.max(0, count - 1));
      if (!turnPausedForUserRef.current) {
        setAssistantActivity(null);
      }
    }
  }

  /**
   * Pin, unpin, rename, or delete a conversation, then refresh the sidebar list.
   */
  async function pinConversation(threadId, pinned = true) {
    if (!threadId || threadId === NEW_CONVERSATION_ID) return;
    setConversationPinnedLocally(threadId, pinned);
    setConversationList((current) =>
      overlayLocalPinState(
        (current ?? []).map((conversation) =>
          conversation.thread_id === threadId
            ? {
                ...conversation,
                metadata: { ...(conversation.metadata ?? {}), pinned },
              }
            : conversation
        )
      )
    );
    try {
      // Top-level `pinned`, not inside `thread_metadata`, so a later message
      // update that rewrites the nested object cannot drop the flag.
      await updateConversationThread(threadId, { pinned });
    } catch (pinError) {
      console.error('Could not persist the pin on the server:', pinError);
    }
    try {
      // Refresh metadata from the server, then overlay + chronological sort
      // so the PATCH's updated_at cannot restack the list.
      await getConversationList(user, activeAvatar);
    } catch {
      // The sidebar already kept the row from the local flag.
    }
  }

  async function renameConversation(threadId, title) {
    if (!threadId || threadId === NEW_CONVERSATION_ID) return;
    await updateConversationThread(threadId, {
      thread_metadata: { conversation_title: title },
    });
    await getConversationList(user, activeAvatar);
  }

  async function deleteConversation(threadId) {
    if (!threadId || threadId === NEW_CONVERSATION_ID) return;
    await deleteConversationThread(threadId);
    if (activeConversation === threadId) {
      setActiveConversation(NEW_CONVERSATION_ID);
      setMessages([]);
    }
    await getConversationList(user, activeAvatar);
  }

  /**
   * Mark the thread readable by anyone with the link, then return that URL.
   *
   * The messages endpoint still refuses a stranger's thread unless the owner
   * has set `shared` on it. Copying the URL without that flag would look like
   * a working share and 404 for everyone else.
   *
   * @param {string} threadId The conversation.
   * @returns {Promise<string>} The read-only share URL.
   */
  async function shareConversation(threadId) {
    if (!threadId || threadId === NEW_CONVERSATION_ID) {
      throw new Error('Start a conversation before sharing it.');
    }
    await updateConversationThread(threadId, {
      thread_metadata: { shared: true },
    });
    const shareUrl = buildSharedConversationUrl(
      resolveAssistantId(activeAvatar),
      threadId
    );
    if (!shareUrl) {
      throw new Error('Could not build a share link for this conversation.');
    }
    return shareUrl;
  }

  /**
   * Accept the files small enough to send, and say which ones were not.
   *
   * Both attachment entry points funnel through here. Silence was the bug: an
   * over-size file used to disappear between choosing it and sending, so the
   * message went out without the picture the user thought they had attached.
   *
   * @param {File[]} candidateFiles Files the user chose.
   * @returns {File[]} The files that will be sent.
   */
  const acceptFilesWithinSizeLimit = (candidateFiles) => {
    const acceptedFiles = candidateFiles.filter(
      (candidateFile) => candidateFile.size <= MAX_FILE_SIZE_BYTES
    );
    const rejectedFiles = candidateFiles.filter(
      (candidateFile) => candidateFile.size > MAX_FILE_SIZE_BYTES
    );
    if (rejectedFiles.length > 0) {
      toast.error(
        `${rejectedFiles
          .map((rejectedFile) => rejectedFile.name)
          .join(
            ', '
          )} exceeds the ${MAX_FILE_SIZE_DESCRIPTION} limit and was not attached.`,
        { duration: 6000 }
      );
    }
    return acceptedFiles;
  };

  const handleFileUpload = (event) => {
    if (!activeAvatar || !dataExchangeTypes.fileUpload) return;
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setMediaFiles((previousFiles) => [
      ...previousFiles,
      ...acceptFilesWithinSizeLimit(files),
    ]);
    event.target.value = '';
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setMediaFiles((previousFiles) => [
      ...previousFiles,
      ...acceptFilesWithinSizeLimit(files),
    ]);
    event.target.value = '';
  };

  const removeFile = (index) => {
    setMediaFiles((previousFiles) =>
      previousFiles.filter((_, fileIndex) => fileIndex !== index)
    );
  };

  return (
    <MediaContext.Provider
      value={{
        messages,
        setMessages,
        messagesEndRef,
        inputMessage,
        setInputMessage,
        handleSendMessageMediaContext,
        dataExchangeTypes,
        fileInputRef,
        handleFileUpload,
        mediaFiles,
        setMediaFiles,
        handleFileChange,
        removeFile,
        type,
        setType,
        isTranscribing,
        startTranscription,
        stopTranscription,
        isThoughtToImageEnabled,
        startThoughtToImage,
        stopThoughtToImage,
        getConversationList,
        conversationList,
        getActiveConversationMessages,
        resetConversationState,
        switchActiveConveration,
        sendMessageAwaitResponseUpdateMessages,
        setActiveConversation,
        activeConversation,
        pendingInterrupt,
        setPendingInterrupt,
        resumePendingInterrupt,
        assistantActivity,
        sendVoiceTurn,
        sendSpokenTurn,
        sendAmbientObservation,
        ambientHold,
        setAmbientHold,
        pendingSendCount,
        attachmentsInFlight,
        resendFromUserMessage,
        regenerateAvatarReply,
        submitMessageFeedback,
        fetchConversationSuggestions,
        pinConversation,
        renameConversation,
        deleteConversation,
        shareConversation,
      }}
    >
      {children}
    </MediaContext.Provider>
  );
};

export const useMedia = () => useContext(MediaContext);
