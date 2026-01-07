import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { decodeGroup, DEFAULT_ECHO_RELAYS } from '@frostr/igloo-core';

type RelayCandidateSource = {
  relays?: unknown;
  relayUrls?: unknown;
  relay_urls?: unknown;
};

/**
 * Normalizes relay URLs to use secure WebSocket protocol (wss://).
 *
 * All relay connections MUST use TLS - this is enforced by CSP (connect-src 'self' wss:).
 * Insecure ws:// and http:// URLs are auto-upgraded to wss:// to prevent silent failures.
 */
const normalizeRelayUrl = (raw: string): string => {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return trimmed;

  // Auto-upgrade ws:// to wss:// (CSP blocks insecure WebSocket connections)
  if (/^wss?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^wss?:\/\//i, 'wss://');
  }

  // Convert http/https to wss:// (always secure, CSP requires it)
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^https?:\/\//i, 'wss://');
  }

  return `wss://${trimmed}`;
};

const getEnv = (name: string): string | undefined => {
  try {
    if (typeof process === 'undefined') return undefined;
    const value = process?.env?.[name];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
};

const getAppDataPath = (): string => {
  const override = getEnv('IGLOO_APPDATA');
  if (override) {
    return override;
  }

  const platform = os.platform();

  if (platform === 'win32') {
    return getEnv('APPDATA') ?? path.join(os.homedir(), 'AppData', 'Roaming');
  }

  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support');
  }

  return getEnv('XDG_CONFIG_HOME') ?? path.join(os.homedir(), '.config');
};

const getRelaysConfigPath = (): string => {
  return path.join(getAppDataPath(), 'igloo', 'relays.json');
};

const readConfiguredRelaysSync = (): string[] | undefined => {
  try {
    const raw = fs.readFileSync(getRelaysConfigPath(), 'utf8');
    const parsed = JSON.parse(raw) as { relays?: unknown };
    if (!parsed || typeof parsed !== 'object') {
      return undefined;
    }
    const relays = (parsed as { relays?: unknown }).relays;
    if (!Array.isArray(relays)) {
      return undefined;
    }
    return relays.filter((value): value is string => typeof value === 'string');
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = (error as { code?: string }).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') {
        return undefined;
      }
    }
    return undefined;
  }
};

const dedupeKey = (url: string): string => {
  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol.toLowerCase();
    const hostname = parsed.hostname.toLowerCase();
    const port = parsed.port ? `:${parsed.port}` : '';
    return `${protocol}//${hostname}${port}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    const match = url.match(/^(wss?):\/\/([^/?#]+)(.*)$/i);
    if (match) {
      return `${match[1].toLowerCase()}://${match[2].toLowerCase()}${match[3] ?? ''}`;
    }
    return url;
  }
};

const normalizeList = (candidates?: unknown): string[] => {
  if (!Array.isArray(candidates)) return [];
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of candidates) {
    if (typeof value !== 'string') continue;
    const normalized = normalizeRelayUrl(value);
    if (!normalized) continue;
    const key = dedupeKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
};

const extractGroupRelayCandidates = (source?: RelayCandidateSource | null): unknown => {
  if (!source || typeof source !== 'object') {
    return undefined;
  }

  if (Array.isArray(source.relays)) return source.relays;
  if (Array.isArray(source.relayUrls)) return source.relayUrls;
  if (Array.isArray(source.relay_urls)) return source.relay_urls;
  return undefined;
};

export type RelayPlan = {
  relays: string[];
  envRelays: string[];
  defaultRelays: string[];
  groupRelays: string[];
  explicitRelays: string[];
  groupExtras: string[];
};

export type ComputeRelayPlanOptions = {
  groupCredential?: string | null;
  decodedGroup?: RelayCandidateSource | null;
  explicitRelays?: string[] | null;
  envRelay?: string | null;
  baseRelays?: string[] | null;
};

export const computeRelayPlan = ({
  groupCredential,
  decodedGroup,
  explicitRelays,
  envRelay,
  baseRelays
}: ComputeRelayPlanOptions): RelayPlan => {
  let groupRelayCandidates = extractGroupRelayCandidates(decodedGroup ?? undefined);

  if (!groupRelayCandidates && typeof groupCredential === 'string' && groupCredential.trim().length > 0) {
    try {
      const decoded = decodeGroup(groupCredential) as RelayCandidateSource;
      groupRelayCandidates = extractGroupRelayCandidates(decoded);
    } catch {
      groupRelayCandidates = undefined;
    }
  }

  const envRelays = normalizeList(envRelay ? [envRelay] : []);
  const explicit = normalizeList(explicitRelays ?? undefined);
  const group = normalizeList(groupRelayCandidates);

  const configured = readConfiguredRelaysSync();
  const defaults = normalizeList(
    Array.isArray(configured) && configured.length > 0 ? configured : baseRelays ?? DEFAULT_ECHO_RELAYS
  );

  const dedupe = (values: string[]): string[] => {
    const seen = new Set<string>();
    const output: string[] = [];
    for (const value of values) {
      const key = dedupeKey(value);
      if (seen.has(key)) continue;
      seen.add(key);
      output.push(value);
    }
    return output;
  };

  let relays: string[];
  if (envRelays.length > 0) {
    if (explicit.length > 0) {
      relays = dedupe([...explicit, ...envRelays]);
    } else {
      relays = [...envRelays];
    }
  } else {
    // Preserve reliability guarantees: we always try trusted defaults first,
    // then any group-provided extras. Explicit overrides (from the UI) stay in
    // front so the caller can opt into a different ordering. Defaults include
    // entries from ~/.config/igloo/relays.json when present.
    relays = dedupe([...explicit, ...defaults, ...group]);
  }

  const defaultKeySet = new Set(defaults.map(dedupeKey));
  const groupExtras = group.filter(relay => !defaultKeySet.has(dedupeKey(relay)));

  return {
    relays,
    envRelays,
    defaultRelays: defaults,
    groupRelays: group,
    explicitRelays: explicit,
    groupExtras
  };
};

export { normalizeRelayUrl };
