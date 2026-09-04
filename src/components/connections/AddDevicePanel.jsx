// src/components/connections/AddDevicePanel.jsx
import React from 'react';
import { ExternalLink } from 'lucide-react';
import { FaApple, FaUbuntu, FaWindows } from 'react-icons/fa';

// Published connector repos. The catalog's install_url pointed at a GitHub
// path that 404s (`anubis-mcp-server-ubuntu`); these are the three that exist.
export const MCP_SERVER_DOWNLOADS = [
  {
    id: 'linux',
    label: 'Linux',
    detail: 'Ubuntu desktop',
    href: 'https://github.com/AfterlifeSystems/anubis-mcp-server-ubuntu-desktop',
    Icon: FaUbuntu,
  },
  {
    id: 'windows',
    label: 'Windows',
    detail: 'Windows 10 and 11',
    href: 'https://github.com/AfterlifeSystems/anubis-mcp-server-windows',
    Icon: FaWindows,
  },
  {
    id: 'macos',
    label: 'macOS',
    detail: 'Mac',
    href: 'https://github.com/AfterlifeSystems/anubis-mcp-server-mac-os',
    Icon: FaApple,
  },
];

/**
 * How to add another machine: download the connector for that OS, sign in,
 * and wait for it to appear under Connected the same way an existing desktop
 * does. This is not a custom MCP URL form.
 */
const AddDevicePanel = () => (
  <div className="space-y-4">
    <p className="text-white/70 text-sm whitespace-normal break-words">
      Add a device by installing the connector on that machine and signing in
      with your API key. It then shows up under Connected on its own — the same
      way a desktop already on this account does.
    </p>
    <p className="text-white/50 text-sm whitespace-normal break-words">
      Download the connector if this machine does not have it yet:
    </p>
    <ul className="space-y-2">
      {MCP_SERVER_DOWNLOADS.map((download) => (
        <li key={download.id}>
          <a
            href={download.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-colors"
          >
            <download.Icon
              className="w-5 h-5 text-neutral-200 shrink-0"
              aria-hidden="true"
            />
            <span className="min-w-0 flex-grow">
              <span className="block text-neutral-200 text-sm font-medium">
                Download for {download.label}
              </span>
              <span className="block text-white/50 text-xs">{download.detail}</span>
            </span>
            <ExternalLink className="w-4 h-4 text-white/40 shrink-0" aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  </div>
);

export default AddDevicePanel;
