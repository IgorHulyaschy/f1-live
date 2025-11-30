# WebSocket Setup

This project uses **WebSocket** for real-time race data updates, integrated with **TanStack Query** for seamless data synchronization.

## Overview

The WebSocket implementation provides:
- ✅ Real-time race updates
- ✅ Automatic reconnection
- ✅ TanStack Query cache synchronization
- ✅ Connection status monitoring
- ✅ Heartbeat/keep-alive
- ✅ Type-safe message handling

## Architecture

```
┌─────────────────────────────────────────┐
│       React Components (Table)          │
└──────────────┬──────────────────────────┘
               │
               │ uses
               ▼
┌─────────────────────────────────────────┐
│      useLiveRaceUpdates Hook            │
│  (Subscribes to WS + Updates Cache)     │
└──────────────┬──────────────────────────┘
               │
               │ uses
               ▼
┌─────────────────────────────────────────┐
│         useWebSocket Hook                │
│    (Connection Management)               │
└──────────────┬──────────────────────────┘
               │
               │ uses
               ▼
┌─────────────────────────────────────────┐
│      WebSocketService Class              │
│  (Low-level WS + Reconnection)           │
└──────────────┬──────────────────────────┘
               │
               │ WebSocket
               ▼
┌─────────────────────────────────────────┐
│       Backend WebSocket Server           │
│         (Your F1 data API)               │
└─────────────────────────────────────────┘
```

## Configuration

### Environment Variables

Add to `.env`:

```bash
# WebSocket server URL
VITE_WS_URL=ws://localhost:3000/ws

# For secure connections (production)
VITE_WS_URL=wss://your-domain.com/ws
```

## Usage

### Basic WebSocket Connection

```tsx
import { useWebSocket } from '../hooks/useWebSocket';

function Component() {
  const { status, send, subscribe, isConnected } = useWebSocket();

  useEffect(() => {
    // Subscribe to a specific message type
    return subscribe('driver_update', (data) => {
      console.log('Driver updated:', data);
    });
  }, [subscribe]);

  return (
    <div>
      <p>Status: {status}</p>
      {isConnected && <p>✓ Connected to live updates</p>}
    </div>
  );
}
```

### Integrated Live Updates (Recommended)

Use `useLiveRaceUpdates` for automatic TanStack Query cache updates:

```tsx
import { useRaceSession } from '../hooks/useRaceSession';
import { useLiveRaceUpdates } from '../hooks/useLiveRaceUpdates';

function RaceTable() {
  // Fetch initial data
  const { data: session, isLoading } = useRaceSession({
    refetchInterval: false  // Disable polling, use WebSocket instead
  });

  // Connect to live updates
  const { isConnected } = useLiveRaceUpdates({
    sessionId: session?.sessionId,
    enabled: session?.isLive  // Only connect for live sessions
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {isConnected && <span>● LIVE</span>}
      {/* Your race table here */}
    </div>
  );
}
```

## Message Types

### Session Update
```typescript
{
  type: 'session_update',
  data: {
    sessionId: string;
    currentLap: number;
    totalLaps: number;
    isLive: boolean;
  }
}
```

### Driver Update
```typescript
{
  type: 'driver_update',
  data: {
    driver: Driver  // Complete driver object
  }
}
```

### Position Change
```typescript
{
  type: 'position_change',
  data: {
    driverId: string;
    oldPosition: number;
    newPosition: number;
    positionChange: number;  // -1, 0, or +1
  }
}
```

### Lap Update
```typescript
{
  type: 'lap_update',
  data: {
    driverId: string;
    lapTime: string;
    isFastest: boolean;
    lapNumber: number;
  }
}
```

### Sector Update
```typescript
{
  type: 'sector_update',
  data: {
    driverId: string;
    sector: 1 | 2 | 3;
    time: string;
    status: 'fastest' | 'pb' | 'yellow' | 'normal';
  }
}
```

### Tire Change
```typescript
{
  type: 'tire_change',
  data: {
    driverId: string;
    tire: 'S' | 'M' | 'H';
    tireAge: number;
    lapNumber: number;
  }
}
```

### Status Change
```typescript
{
  type: 'status_change',
  data: {
    driverId: string;
    status: 'PIT' | 'OUT' | 'TRACK';
  }
}
```

### DRS Update
```typescript
{
  type: 'drs_update',
  data: {
    driverId: string;
    inDRS: boolean;
  }
}
```

## Hooks API

### useWebSocket

Low-level WebSocket connection management.

```tsx
const {
  status,       // 'connecting' | 'connected' | 'disconnected' | 'error'
  send,         // Send message: send(type, data)
  subscribe,    // Subscribe to messages: subscribe(type, callback)
  reconnect,    // Manual reconnect
  isConnected,  // Boolean shortcut
  isConnecting  // Boolean shortcut
} = useWebSocket(options);
```

**Options:**
- `url` - WebSocket server URL (default: from env)
- `enabled` - Enable connection (default: `true`)
- `reconnectInterval` - Reconnect delay in ms (default: `3000`)
- `maxReconnectAttempts` - Max reconnection tries (default: `10`)
- `heartbeatInterval` - Keep-alive interval in ms (default: `30000`)
- `onConnect` - Callback when connected
- `onDisconnect` - Callback when disconnected
- `onError` - Callback on error
- `onMessage` - Global message handler

### useLiveRaceUpdates

High-level hook that integrates WebSocket with TanStack Query.

```tsx
const {
  status,       // Connection status
  isConnected   // Boolean
} = useLiveRaceUpdates(options);
```

**Options:**
- `sessionId` - Session ID to receive updates for
- `enabled` - Enable WebSocket connection (default: `true`)

**What it does:**
- Automatically subscribes to all race-related message types
- Updates TanStack Query cache when messages arrive
- Triggers React re-renders via cache updates
- Cleans up on unmount

## Advanced Usage

### Custom Message Handling

```tsx
const { subscribe } = useWebSocket();

useEffect(() => {
  // Subscribe to custom message type
  const unsubscribe = subscribe('custom_event', (data) => {
    console.log('Custom event:', data);
  });

  // Cleanup
  return unsubscribe;
}, [subscribe]);
```

### Multiple Message Types

```tsx
useEffect(() => {
  const unsubscribes = [
    subscribe('lap_update', handleLapUpdate),
    subscribe('sector_update', handleSectorUpdate),
    subscribe('tire_change', handleTireChange)
  ];

  return () => {
    unsubscribes.forEach(unsub => unsub());
  };
}, [subscribe]);
```

### Sending Messages to Server

```tsx
const { send, isConnected } = useWebSocket();

const requestDriverInfo = (driverId: string) => {
  if (isConnected) {
    send('request_driver_info', { driverId });
  }
};
```

### Connection Status UI

```tsx
const { status } = useWebSocket();

const statusColors = {
  connecting: '#fbbf24',  // Yellow
  connected: '#22c55e',   // Green
  disconnected: '#6b7280', // Gray
  error: '#ef4444'        // Red
};

const statusLabels = {
  connecting: 'Connecting...',
  connected: 'Live',
  disconnected: 'Offline',
  error: 'Connection Error'
};

return (
  <div style={{ color: statusColors[status] }}>
    ● {statusLabels[status]}
  </div>
);
```

### Manual Reconnection

```tsx
const { reconnect, status } = useWebSocket();

return (
  <div>
    {status === 'error' && (
      <button onClick={reconnect}>
        Retry Connection
      </button>
    )}
  </div>
);
```

## Backend WebSocket Server

Your backend needs to implement a WebSocket server that sends messages in this format:

```typescript
{
  type: 'message_type',
  data: { /* message-specific data */ },
  timestamp: '2024-01-01T12:00:00Z'  // Optional
}
```

### Example Server (Node.js + ws)

```javascript
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3000, path: '/ws' });

wss.on('connection', (ws) => {
  console.log('Client connected');

  // Send initial data
  ws.send(JSON.stringify({
    type: 'session_update',
    data: {
      sessionId: 'race-2024',
      currentLap: 1,
      totalLaps: 57,
      isLive: true
    }
  }));

  // Simulate lap updates every 30 seconds
  const interval = setInterval(() => {
    ws.send(JSON.stringify({
      type: 'lap_update',
      data: {
        driverId: 'VER',
        lapTime: '1:15.234',
        isFastest: true,
        lapNumber: 2
      }
    }));
  }, 30000);

  ws.on('close', () => {
    clearInterval(interval);
    console.log('Client disconnected');
  });
});
```

## Features

### Automatic Reconnection

The WebSocket service automatically reconnects on:
- Connection loss
- Network interruption
- Server restart

**Configuration:**
```tsx
useWebSocket({
  reconnectInterval: 5000,      // Wait 5s between attempts
  maxReconnectAttempts: 10      // Try up to 10 times
});
```

### Heartbeat / Keep-Alive

Automatically sends ping messages to keep connection alive:

```tsx
useWebSocket({
  heartbeatInterval: 30000  // Ping every 30 seconds
});
```

Server should respond to ping messages or they're ignored.

### Cache Synchronization

When using `useLiveRaceUpdates`, all WebSocket updates automatically sync with TanStack Query cache:

```tsx
// Cache is updated automatically
const { data } = useRaceSession();

useLiveRaceUpdates({ sessionId: data?.sessionId });

// data automatically updates when WebSocket messages arrive
// No manual cache manipulation needed!
```

## Best Practices

### ✅ Do's

1. **Use for live sessions only**
```tsx
useLiveRaceUpdates({
  enabled: session?.isLive  // Only connect when needed
});
```

2. **Disable polling when using WebSocket**
```tsx
useRaceSession({
  refetchInterval: false  // Don't poll when using WebSocket
});
```

3. **Show connection status**
```tsx
const { isConnected } = useLiveRaceUpdates();

return <div>{isConnected && '● LIVE'}</div>;
```

4. **Handle disconnection gracefully**
```tsx
if (!isConnected) {
  return <div>Reconnecting to live updates...</div>;
}
```

### ❌ Don'ts

1. **Don't use both polling and WebSocket**
```tsx
// ❌ Bad - redundant data fetching
useRaceSession({ refetchInterval: 5000 });
useLiveRaceUpdates();

// ✅ Good - WebSocket only
useRaceSession({ refetchInterval: false });
useLiveRaceUpdates();
```

2. **Don't connect when not needed**
```tsx
// ❌ Bad - always connected
useLiveRaceUpdates();

// ✅ Good - conditional
useLiveRaceUpdates({ enabled: session?.isLive });
```

3. **Don't forget cleanup**
```tsx
// ✅ Good - subscription returns cleanup
useEffect(() => {
  return subscribe('lap_update', handleLap);
}, [subscribe]);
```

## Troubleshooting

### Connection Issues

**Problem:** WebSocket won't connect

**Solutions:**
1. Check `VITE_WS_URL` in `.env`
2. Verify server is running
3. Check browser console for errors
4. Verify firewall/proxy settings

### Messages Not Received

**Problem:** WebSocket connected but no messages

**Solutions:**
1. Check server is sending messages in correct format
2. Verify message type matches subscriptions
3. Check browser DevTools Network tab → WS
4. Enable debug logging in WebSocketService

### Frequent Reconnections

**Problem:** WebSocket keeps disconnecting

**Solutions:**
1. Increase `heartbeatInterval`
2. Check server timeout settings
3. Verify network stability
4. Increase `reconnectInterval`

## Example Component

See `src/components/Table/TableWithLiveUpdates.example.tsx` for a complete working example.

## Resources

- [WebSocket API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [TanStack Query](https://tanstack.com/query/latest)
- [ws (Node.js WebSocket)](https://github.com/websockets/ws)

---

**Status:** ✅ Ready for real-time updates!
