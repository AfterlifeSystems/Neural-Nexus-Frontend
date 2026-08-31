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
import { requestJson, streamServerSentEvents } from '../services/neuralNexusApiClient';
import { resolveAssistantId } from '../components/utils';

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
  const firstCharacter = text.trimStart().slice(0, 1);
  if (firstCharacter === '{' || firstCharacter === '[') {
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
  return 'Waiting for your confirmation on a correction';
}

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
 * @returns {Array} Messages in the shape MessageList expects.
 */
function normalizeThreadMessages(storedMessages) {
  if (!Array.isArray(storedMessages)) {
    return [];
  }
  return storedMessages
    .filter((storedMessage) => ['human', 'ai'].includes(storedMessage?.type))
    .map((storedMessage) => ({
      id: storedMessage.id,
      type: storedMessage.type,
      content: storedMessage.content ?? '',
      response_metadata: storedMessage.response_metadata ?? {},
    }));
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
   * @param {Object} _user Unused; kept for the existing call signature.
   * @param {Object} avatarForConversations The avatar whose threads to list.
   * @returns {Promise<Array>} Thread records.
   */
  async function getConversationList(_user, avatarForConversations) {
    const threads = await requestJson('/conversations', {
      query: { assistant_id: resolveAssistantId(avatarForConversations) },
    });
    const threadList = Array.isArray(threads) ? threads : [];
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

    const messagesResponse = await requestJson(
      `/conversations/${encodeURIComponent(threadId)}/messages`,
      { query: { assistant_id: resolveAssistantId(avatarForMessages) } }
    );
    setMessages(normalizeThreadMessages(messagesResponse?.messages));
  }

  /**
   * Stream one assistant turn into the messages array.
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
   * @param {Object} turn
   * @param {string} turn.assistantId The avatar this turn belongs to.
   * @param {string} turn.path Endpoint to stream from.
   * @param {FormData} turn.formData The request body.
   * @param {Object} turn.avatarForTurn The avatar record, for re-listing threads.
   * @param {string|null} turn.previousThreadId Thread before this turn, or null.
   * @returns {Promise<{success: boolean, reply: string, threadId: string|null}>}
   */
  async function streamAssistantTurn({
    assistantId,
    path,
    formData,
    avatarForTurn,
    previousThreadId,
  }) {
    const streamingMessageId = `streaming-${Date.now()}`;
    // The turn keeps running wherever the user goes; only its rendering is
    // conditional on that conversation still being the one on screen.
    const isStillOnScreen = () =>
      onScreenAssistantIdRef.current === assistantId;
    const updateMessagesIfStillOnScreen = (updater) => {
      if (isStillOnScreen()) {
        setMessages(updater);
      }
    };
    const setActivityIfStillOnScreen = (activity) => {
      if (isStillOnScreen()) {
        setAssistantActivity(activity);
      }
    };

    // The assistant message that the token stream grows. isLoading drives the
    // MessageList's typing indicator until the first token lands.
    updateMessagesIfStillOnScreen((previousMessages) => [
      ...previousMessages,
      {
        id: streamingMessageId,
        type: 'ai',
        content: '',
        isLoading: true,
        timestamp: new Date().toISOString(),
      },
    ]);

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
      onEvent: (streamEvent) => {
        if (streamEvent.type === 'assistant_token') {
          appendTokenToStreamingMessage(streamEvent.text ?? '');
        } else if (streamEvent.type === 'usage_estimate') {
          // The first frame of a turn: the request has been costed and the
          // model has not started speaking yet.
          setActivityIfStillOnScreen(ASSISTANT_ACTIVITY.thinking);
        } else if (streamEvent.type === 'keepalive_comment') {
          // Tokens have stopped but the turn has not: the server keeps this
          // line open while it runs its post-reply analysis.
          setActivityIfStillOnScreen(ASSISTANT_ACTIVITY.analyzing);
        } else if (
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

    if (terminalFrame?.type === 'interrupt') {
      // A paused turn has no assistant message: the approval panel IS its
      // output. Whatever the avatar managed to say before pausing is kept, but
      // a placeholder holding nothing readable — the usual case, because the
      // only thing streamed was the suppressed proposal — is dropped rather
      // than left showing a typing indicator that can never resolve.
      updateMessagesIfStillOnScreen((previousMessages) =>
        previousMessages
          .map((message) =>
            message.id === streamingMessageId
              ? { ...message, isLoading: false }
              : message
          )
          .filter(
            (message) =>
              message.id !== streamingMessageId ||
              (message.content ?? '').trim() !== ''
          )
      );
      // The correction may have been raised on a thread the server minted for
      // this very turn. Adopting it is what makes the resume addressable.
      if (terminalFrame.thread_id) {
        setActiveConversation(terminalFrame.thread_id);
      }
      setPendingInterrupt({
        threadId: terminalFrame.thread_id,
        assistantId,
        interrupt: terminalFrame.interrupt,
      });
    } else if (terminalFrame?.type === 'done') {
      // Adopt the authoritative content and metadata from the terminal frame;
      // the token stream is a preview, `done.content` is the record.
      updateMessagesIfStillOnScreen((previousMessages) =>
        previousMessages.map((message) =>
          message.id === streamingMessageId
            ? {
                ...message,
                isLoading: false,
                content: terminalFrame.content ?? message.content,
                usage: terminalFrame.usage,
              }
            : message
        )
      );
      if (terminalFrame.thread_id) {
        const wasNewConversation = previousThreadId !== terminalFrame.thread_id;
        setActiveConversation(terminalFrame.thread_id);
        if (wasNewConversation) {
          // The server just minted this conversation. Re-listing is what moves
          // it from the placeholder in the sidebar to a real entry the user can
          // return to; without it the conversation exists but cannot be found.
          getConversationList(null, avatarForTurn).catch((listError) => {
            console.error('Refreshing the conversation list failed:', listError);
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
    return {
      success: terminalFrame != null,
      reply: terminalFrame?.content ?? '',
      threadId: terminalFrame?.thread_id ?? null,
    };
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
   */
  async function sendMessageAwaitResponseUpdateMessages(
    _user,
    avatarForMessage,
    threadId,
    messageContent,
    attachedFiles = []
  ) {
    const assistantId = resolveAssistantId(avatarForMessage);

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

    return streamAssistantTurn({
      assistantId,
      path: `/message/${encodeURIComponent(assistantId)}`,
      formData,
      avatarForTurn: avatarForMessage,
      previousThreadId: threadId,
    });
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

      return await streamAssistantTurn({
        assistantId: interruptToResume.assistantId,
        path: `/message/${encodeURIComponent(
          interruptToResume.assistantId
        )}/resume`,
        formData,
        avatarForTurn: activeAvatar,
        previousThreadId: interruptToResume.threadId,
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
      toast.error(
        resumeError.message || 'Failed to send your decision. Please try again.'
      );
      return { success: false, reply: '', threadId: null };
    } finally {
      setPendingSendCount((count) => Math.max(0, count - 1));
      if (!turnPausedForUserRef.current) {
        setAssistantActivity(null);
      }
    }
  }

  async function handleSendMessageMediaContext() {
    if (
      !activeAvatar ||
      (!inputMessage.trim() && mediaFiles.length === 0)
    ) {
      console.log('Missing required data for sending message');
      return;
    }

    const messageContent = inputMessage;
    const attachedFiles = mediaFiles;
    const temporaryUserMessageId = `temp-${Date.now()}`;

    try {
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
      setInputMessage('');
      setMediaFiles([]);
      turnPausedForUserRef.current = false;
      setPendingSendCount((count) => count + 1);
      // Say something from the moment the turn starts. The first stream frame
      // can be seconds away, and an unlabelled ellipsis for that long is what
      // makes a working avatar look like a stuck one.
      setAssistantActivity(ASSISTANT_ACTIVITY.thinking);

      await sendMessageAwaitResponseUpdateMessages(
        user,
        activeAvatar,
        activeConversation,
        messageContent,
        attachedFiles
      );
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
        toast.error(sendError.message || 'Failed to send message');
      }
    } finally {
      setPendingSendCount((count) => Math.max(0, count - 1));
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

      const { reply } = await sendMessageAwaitResponseUpdateMessages(
        user,
        activeAvatar,
        activeConversation,
        '',
        [recordedAudio]
      );
      return reply ?? '';
    } catch (voiceError) {
      console.error('The spoken turn failed:', voiceError);
      toast.error(voiceError.message || 'Could not send that recording.');
      return '';
    } finally {
      setPendingSendCount((count) => Math.max(0, count - 1));
      if (!turnPausedForUserRef.current) {
        setAssistantActivity(null);
      }
    }
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
          .join(', ')} exceeds the ${MAX_FILE_SIZE_DESCRIPTION} limit and was not attached.`,
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
        pendingSendCount,
      }}
    >
      {children}
    </MediaContext.Provider>
  );
};

export const useMedia = () => useContext(MediaContext);
