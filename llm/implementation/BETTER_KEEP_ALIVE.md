BETTER KEEP ALIVE — Keeping the signer truly online

Context
- App: igloo-desktop (Electron + React)
- Core libs: @frostr/igloo-core (node helpers), @frostr/bifrost (signing node), @cmdcode/nostr‑p2p (nostr client built on nostr-tools SimplePool).
- Symptom: signer “runs” but silently stops receiving nostr messages/requests. No errors; UI still shows running.

What actually happens today
- Signer UI creates a Bifrost node via igloo-core’s createConnectedNode and marks it running on the `ready` event (src/components/Signer.tsx:handleStartSigner).
- Bifrost wraps NostrNode and forwards events. Critical bits (node_modules/@frostr/bifrost/src/class/client.ts):
  - Creates NostrNode with a subscription filter (authors + self) (line ~74–77).
  - Listens to `ready` and emits `ready` (line ~83–86).
  - Listens to `closed` and emits `closed` (line ~78–81). NOTE: NostrNode emits `close`, not `closed`.
- NostrNode (node_modules/@cmdcode/nostr-p2p/src/class/client.ts) does:
  - Subscribes once with SimplePool.subscribeMany and emits `ready` (lines ~259–266).
  - On close, emits `close` (line ~274–282). It does not auto-resubscribe nor emit `closed`.
- nostr-tools SimplePool has an optional heartbeat (`enablePing`) that closes stale websockets (node_modules/nostr-tools/README.md, pool.js/relay.js). NostrNode constructs SimplePool() with defaults (no heartbeat).
- igloo-core’s isNodeReady checks `node.client.connected` (node_modules/@frostr/igloo-core/dist/node.js), but NostrNode doesn’t expose `connected`; relying on it will be misleading.

Primary failure modes we observed
1) Event name mismatch prevents liveness updates: Bifrost listens to `closed` from NostrNode, which only emits `close`. UI never sees a close, so it keeps showing “running” while subscriptions are dead.
2) No subscription renewal: If relays close the REQ/CLOSE cycle or the socket drops, there’s no `onclose` handler and no re‑subscribe/reconnect.
3) No heartbeat: Without SimplePool.enablePing or an app-level heartbeat, some platforms leave dead websockets “connected”. Messages stop; nothing trips an error.

Design goals
- Surgical: minimal changes in igloo-desktop, no forks required.
- Robust: auto-detect stale/closed states and heal without user action.
- Observable: clear logs and counters for diagnosis.

Proposed approach (layered, least-invasive first)
1) Bridge the close event (fixes liveness): After node creation, attach to `node.client` and re-emit `closed` when it fires `close`.
   Example (in Signer.tsx after createConnectedNode):
   - const client: any = (result.node as any).client;
   - client?.on?.('close', () => { addLog('disconnect', 'Underlying nostr client closed'); result.node.emit?.('closed', result.node); });

2) Add a KeepAliveManager (app-level watchdog):
   - Heartbeat: every 15s send a self‑ping via Bifrost (`node.req.ping(selfPubkey)`). Allow 5s timeout.
   - Inactivity watchdog: track last `message` timestamp; if > 30s with no events OR 2 consecutive heartbeat failures:
     a) try `node.client.update(node.client.filter)` to re‑issue the REQ; if that fails or times out,
     b) call `node.client.connect()`; if still failing,
     c) tear down and recreate the node via igloo-core createConnectedNode using the same credentials/relays; swap it into Signer state.
   - Backoff: 1s → 2s → 5s → 10s (cap at 30s), with jitter.
   - Cleanup: fully detach listeners and clear timers on stop/unmount.

3) Prefer 2+ relays and validate URLs: Require at least two healthy relays in the Signer UI (we already allow editing). Log per‑relay connection status from SimplePool (optional).

4) Optional upstream improvements (non-blocking for us):
   - Patch @cmdcode/nostr-p2p: either emit `closed` alias for `close`, or update @frostr/bifrost to listen to `close`.
   - Construct SimplePool with `{ enablePing: true }` to use built‑in heartbeat; expose that as a Bifrost/NostrNode option. Until then, our self‑ping covers it.

Implementation sketch (new helper)
- File: src/lib/signer-keepalive.ts
- API:
  - createKeepAlive(node, creds, options): returns { start(), stop(), onReplace(cb) }.
  - Options: { heartbeatMs=15000, timeoutMs=5000, staleMs=30000, maxBackoffMs=30000 }.
- Behavior:
  - Attach listeners to node: `message` (update lastSeen), `ready` (mark ready), `closed`/client `close` (trigger heal).
  - Heartbeat loop: `node.req.ping(selfPubkey)`; if 2x fail or elapsed > staleMs: try update() → connect() → recreate().
  - Expose onReplace(cb) to let Signer swap `nodeRef.current` and rewire UI listeners.

Code snippet (illustrative)
```ts
// src/lib/signer-keepalive.ts
import { createConnectedNode } from '@frostr/igloo-core';
import type { BifrostNode } from '@frostr/bifrost';

export function createKeepAlive(
  node: BifrostNode,
  creds: { group: string; share: string; relays: string[]; selfPubkey: string },
  opt = { heartbeatMs: 15000, timeoutMs: 5000, staleMs: 30000, maxBackoffMs: 30000 }
) {
  let current = node; let timer: any; let lastSeen = Date.now();
  let failures = 0; let stopped = false; let onReplace: ((n: BifrostNode)=>void)|null = null;

  const bridgeClose = () => { (current as any)?.client?.on?.('close', () => current.emit?.('closed', current)); };
  const onMsg = () => { lastSeen = Date.now(); failures = 0; };

  async function heal() {
    if (stopped) return;
    try { await (current as any).client.update((current as any).client.filter); return; } catch {}
    try { await (current as any).client.connect(); return; } catch {}
    try {
      const { node: fresh } = await createConnectedNode({ ...creds });
      current = fresh; bridgeClose(); onReplace?.(fresh); lastSeen = Date.now(); failures = 0; return;
    } catch {}
  }

  async function tick() {
    if (stopped) return;
    const stale = Date.now() - lastSeen > opt.staleMs;
    try {
      const res = await Promise.race([
        (current as any).req.ping(creds.selfPubkey),
        new Promise((_, r) => setTimeout(() => r(new Error('timeout')), opt.timeoutMs))
      ]);
      if ((res as any)?.ok) { failures = 0; lastSeen = Date.now(); }
      else { failures++; }
    } catch { failures++; }
    if (stale || failures >= 2) await heal();
    timer = setTimeout(tick, opt.heartbeatMs);
  }

  function start() {
    stopped = false; bridgeClose(); current.on('message', onMsg); tick();
  }
  function stop() { stopped = true; clearTimeout(timer); current.off?.('message', onMsg); }
  return { start, stop, onReplace: (cb: (n: BifrostNode)=>void) => { onReplace = cb; } };
}
```

Wiring in Signer.tsx (minimal)
- Create the manager after node creation; pass credentials + self pubkey (we already compute self via decode utilities in PeerList).
- Add logs on: heartbeat failure, heal attempt, resubscribe, reconnect, recreate.

Why this works
- We fix the event mismatch locally, so the app correctly drops to “not running” if sockets die.
- We keep subscriptions warm and detect stalls with self‑ping (works because Bifrost allows ‘/ping/req’ universally in its filter).
- We attempt cheapest recoveries first (update → connect) before a full node swap.
- No upstream changes are required; upstream improvements can later replace the app heartbeat.

Test plan
- Unit: simulate `close` emission on `node.client` and assert Signer flips to disconnected and KeepAlive triggers heal.
- Integration: spin a dummy relay that drops pings; verify our self‑ping detects stall and resubscribes, then reconnects.
- Long‑run: 2h soak test with relays that idle‑timeout websockets; ensure no missed messages (check ping log cadence + received requests).

Operational tips
- Always configure at least 2 relays. Prefer one global + one regional. Default to `wss://relay.primal.net` and `wss://relay.damus.io` when user has only one.
- Surface “last activity” and “last heal” timestamps in the Event Log for field diagnostics.

Follow‑ups (nice to have)
- PR to @frostr/bifrost: listen to NostrNode `close` (or emit both `close` and `closed`).
- PR to @cmdcode/nostr-p2p: expose a knob that builds SimplePool({ enablePing: true }) from options; or pass-through the option.

Scope of change
- Files in this repo only; no dependency forks. The helper is small, isolated, and reversible.

