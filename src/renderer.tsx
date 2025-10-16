import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/components/App';
import '../globals.css';
import { SimplePool } from 'nostr-tools';

// Minimal SimplePool shim: unwrap single-element filter arrays to a plain object
// to avoid nested [[filter]] REQ payloads that some relays reject. Mirrors server/cli.
try {
  const poolProto = SimplePool?.prototype as typeof SimplePool.prototype & { __iglooSubscribeFixApplied?: boolean } | undefined;
  if (poolProto && !poolProto.__iglooSubscribeFixApplied) {
    const original = poolProto.subscribeMany as (relays: unknown, filter: unknown, params: unknown) => any;
    if (typeof original === 'function') {
      poolProto.subscribeMany = function patchedSubscribeMany(this: any, relays: unknown, filter: unknown, params: unknown) {
        if (Array.isArray(filter) && filter.length === 1 && filter[0] && typeof filter[0] === 'object' && !Array.isArray(filter[0])) {
          return original.call(this, relays, filter[0], params);
        }
        return original.call(this, relays, filter, params);
      } as typeof poolProto.subscribeMany;
      Object.defineProperty(poolProto, '__iglooSubscribeFixApplied', { value: true });
    }
  }
} catch (error) {
  // Non-fatal in renderer; ping/peering will simply be flaky without it.
  console.warn('[Renderer] Failed to apply SimplePool subscribeMany shim:', error);
}

const Root: React.FC = () => {
  return (
    <div>
      <App />
    </div>
  );
};

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');
const root = createRoot(container);
root.render(<Root />);
