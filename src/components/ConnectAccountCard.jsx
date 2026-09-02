// src/components/ConnectAccountCard.jsx
import React, { useState } from 'react';
import { Check, ExternalLink, Loader2 } from 'lucide-react';
import ConnectorIcon from './icons/ConnectorIcon';
import { connectMailbox } from '../services/avatarService';

/**
 * The sign-in card the avatar raises when it needs an account connected.
 *
 * Rendered from an `interrupt` frame whose kind is `connect_account`. Every
 * label, field, and help string comes from that payload rather than from this
 * file, so a provider added to the backend registry renders here with no change
 * — which is the whole reason the payload is shaped the way it is.
 *
 * THE CREDENTIAL DOES NOT GO THROUGH THE RESUME
 *   It would be simpler to hand what the owner types back as the interrupt's
 *   resume value and let the graph store it. That must never be built: a resume
 *   value is written into the graph's checkpointer, so the password would come
 *   to rest in the conversation's stored state and be readable by anything that
 *   replays the thread. The card posts the credential to its own endpoint,
 *   which verifies and encrypts it, and only then resumes the turn — carrying a
 *   decision and nothing else.
 *
 * @param {Object} parameters
 * @param {Object} parameters.interrupt The `connect_account` payload.
 * @param {Function} parameters.onDecision Called with `apply` or `cancel` once
 *   the owner has finished with the card; resumes the paused turn.
 * @param {boolean} [parameters.startOpen] Skip the offer step and show the form
 *   immediately. The settings screen uses this: the owner already pressed a
 *   Connect button there, so asking a second time would be a step for nothing.
 * @param {string} [parameters.className] Layout classes for the outer card.
 */
const ConnectAccountCard = ({
  interrupt,
  onDecision,
  startOpen = false,
  className = 'self-start w-full max-w-[85%]',
}) => {
  const {
    provider,
    display_name: displayName,
    card_description: cardDescription,
    icon_key: iconKey,
    tool_count: toolCount,
    credential_help_url: credentialHelpUrl,
    fields = [],
    already_connected: alreadyConnected = [],
  } = interrupt ?? {};

  // 'offer' → 'signing_in' → 'connected', or 'dismissed'. Held here rather than
  // derived from the turn, because the turn resumes the moment the account is
  // connected and the card must keep showing what it did.
  const [stage, setStage] = useState(startOpen ? 'signing_in' : 'offer');
  const [fieldValues, setFieldValues] = useState({});
  const [errorMessage, setErrorMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState(null);

  const setFieldValue = (name, value) =>
    setFieldValues((previous) => ({ ...previous, [name]: value }));

  const everyFieldFilled = fields.every((field) =>
    String(fieldValues[field.name] ?? '').trim()
  );

  const handleDismiss = () => {
    setStage('dismissed');
    onDecision?.('cancel');
  };

  const handleSubmit = async (submitEvent) => {
    submitEvent?.preventDefault();
    if (isSubmitting || !everyFieldFilled) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await connectMailbox({
        provider,
        emailAddress: fieldValues.email_address,
        appPassword: fieldValues.app_password,
      });
      setConnectedAddress(
        response?.account?.account_address ?? fieldValues.email_address
      );
      // Drop the password from component state the instant it is no longer
      // needed, so it does not sit in memory for the rest of the conversation.
      setFieldValues({});
      setStage('connected');
      onDecision?.('apply');
    } catch (connectError) {
      // Shown as written. The API's rejection names what was wrong — for Gmail,
      // that an app password is required and the account password will never
      // work — and replacing it with a generic failure is what sends someone
      // back to retype the same wrong secret.
      setErrorMessage(
        connectError?.message ??
          `${displayName ?? 'That account'} could not be connected.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (stage === 'dismissed') {
    return null;
  }

  return (
    <div
      className={`${className} bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 p-4`}
    >
      <div className="flex items-center gap-3">
        <ConnectorIcon iconKey={iconKey} />
        <div className="min-w-0 flex-grow">
          <p className="text-neutral-200 font-medium truncate">
            {displayName ?? provider}
          </p>
          {cardDescription && (
            <p className="text-white/60 text-sm truncate">{cardDescription}</p>
          )}
          {Number.isFinite(toolCount) && toolCount > 0 && (
            <p className="text-white/40 text-xs">
              {toolCount} {toolCount === 1 ? 'tool' : 'tools'}
            </p>
          )}
        </div>

        {stage === 'connected' ? (
          <span className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm">
            <Check className="w-4 h-4" aria-hidden="true" />
            Added
          </span>
        ) : (
          stage === 'offer' && (
            <button
              type="button"
              onClick={() => setStage('signing_in')}
              className="shrink-0 px-4 py-2 rounded-lg bg-neutral-100/10 hover:bg-neutral-100/15 border border-neutral-700 text-neutral-300 text-sm font-medium transition-colors"
            >
              Add {displayName ?? provider}
            </button>
          )
        )}
      </div>

      {stage === 'offer' && alreadyConnected.length > 0 && (
        <p className="mt-3 text-white/50 text-xs">
          Already connected:{' '}
          {alreadyConnected
            .map((account) => account.account_address)
            .join(', ')}
        </p>
      )}

      {stage === 'offer' && (
        <button
          type="button"
          onClick={handleDismiss}
          className="mt-3 text-white/40 hover:text-white/70 text-xs underline transition-colors"
        >
          Not now
        </button>
      )}

      {stage === 'signing_in' && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {fields.map((field) => (
            <div key={field.name}>
              <label
                htmlFor={`connect-${provider}-${field.name}`}
                className="block text-white/70 text-sm mb-1"
              >
                {field.label}
              </label>
              <input
                id={`connect-${provider}-${field.name}`}
                type={field.input_type || 'text'}
                value={fieldValues[field.name] ?? ''}
                placeholder={field.placeholder || ''}
                autoComplete={
                  field.input_type === 'password' ? 'off' : 'email'
                }
                onChange={(changeEvent) =>
                  setFieldValue(field.name, changeEvent.target.value)
                }
                className="w-full px-4 py-2.5 bg-black/50 border border-white/10 rounded-lg text-neutral-200 placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
              {field.help_text && (
                <p className="mt-1 text-white/50 text-xs">{field.help_text}</p>
              )}
            </div>
          ))}

          {credentialHelpUrl && (
            <a
              href={credentialHelpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-neutral-300 hover:text-neutral-100 text-xs underline"
            >
              Generate an app password
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          )}

          {errorMessage && (
            <p
              role="alert"
              className="text-red-300 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2"
            >
              {errorMessage}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isSubmitting || !everyFieldFilled}
              className="px-4 py-2 rounded-lg bg-neutral-100/10 hover:bg-neutral-100/15 disabled:opacity-40 disabled:hover:bg-neutral-100/10 border border-neutral-700 text-neutral-300 text-sm font-medium transition-colors inline-flex items-center gap-2"
            >
              {isSubmitting && (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              )}
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-white/50 hover:text-white/80 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {stage === 'connected' && connectedAddress && (
        <p className="mt-3 text-white/60 text-sm">
          Signed in as{' '}
          <span className="text-neutral-200">{connectedAddress}</span>. Drafts are
          saved to the mailbox; nothing is ever sent.
        </p>
      )}
    </div>
  );
};

export default ConnectAccountCard;
