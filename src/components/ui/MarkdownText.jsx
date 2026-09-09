// src/components/ui/MarkdownText.jsx
import React from 'react';
import ReactMarkdown from 'react-markdown';

/**
 * Markdown rendered in the app's dark style.
 *
 * The typography plugin is not part of this build, so each element carries
 * its own classes here. Used for a report's summary and for a markdown
 * artifact under a reply; plain replies stay as pre-wrapped text.
 *
 * @param {Object} parameters
 * @param {string} parameters.text The markdown source.
 * @param {boolean} [parameters.compact] Smaller type for a caption strip.
 */
const MarkdownText = ({ text, compact = false }) => {
  if (!text) return null;
  const base = compact ? 'text-xs' : 'text-sm';
  const components = {
    h1: ({ children }) => (
      <h1 className="text-neutral-100 text-lg font-semibold mt-3 mb-1 first:mt-0">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-neutral-100 text-base font-semibold mt-3 mb-1 first:mt-0">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-neutral-200 font-semibold mt-2 mb-1 first:mt-0">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-neutral-200 font-medium mt-2 mb-1 first:mt-0">{children}</h4>
    ),
    p: ({ children }) => (
      <p className={`text-neutral-200 ${base} leading-relaxed my-1.5 first:mt-0 last:mb-0`}>
        {children}
      </p>
    ),
    ul: ({ children }) => (
      <ul className={`list-disc pl-5 my-1.5 space-y-0.5 text-neutral-200 ${base}`}>
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className={`list-decimal pl-5 my-1.5 space-y-0.5 text-neutral-200 ${base}`}>
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-amber-300 hover:text-amber-200 underline break-words"
      >
        {children}
      </a>
    ),
    strong: ({ children }) => (
      <strong className="text-neutral-100 font-semibold">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-white/15 pl-3 my-2 text-white/70">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="my-3 border-white/10" />,
    code: ({ className, children }) => {
      const isBlock = /language-/.test(className ?? '');
      return isBlock ? (
        <code className="block text-xs text-neutral-200 whitespace-pre">{children}</code>
      ) : (
        <code className="px-1 py-0.5 rounded bg-white/10 text-amber-200 text-[0.9em]">
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="my-2 p-3 rounded-lg bg-black/50 border border-white/10 overflow-x-auto">
        {children}
      </pre>
    ),
    table: ({ children }) => (
      <div className="my-2 overflow-x-auto">
        <table className={`min-w-full border-collapse ${base} text-neutral-200`}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => <thead className="text-white/70">{children}</thead>,
    th: ({ children }) => (
      <th className="text-left font-medium px-2 py-1 border-b border-white/15">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-2 py-1 border-b border-white/5 align-top">{children}</td>
    ),
    img: ({ src, alt }) => (
      <img
        src={src}
        alt={alt ?? ''}
        className="my-2 rounded-md border border-white/10 max-w-full"
      />
    ),
  };
  return (
    <div className="min-w-0 break-words [overflow-wrap:anywhere]">
      <ReactMarkdown components={components}>{text}</ReactMarkdown>
    </div>
  );
};

export default MarkdownText;
