# WebSocket Setup Complete ✅

Real-time WebSocket functionality has been successfully configured!

## What Was Created

### Core Service & Hooks
- ✅ `src/services/websocket.ts` - WebSocket service with reconnection
- ✅ `src/hooks/useWebSocket.ts` - React hook for WebSocket connections
- ✅ `src/hooks/useLiveRaceUpdates.ts` - TanStack Query integration hook
- ✅ `src/types/websocket.types.ts` - TypeScript types for messages

### Documentation & Examples
- ✅ `WEBSOCKET.md` - Complete WebSocket documentation
- ✅ `TableWithLiveUpdates.example.tsx` - Full integration example
- ✅ `.env.example` - Updated with WebSocket URL

## Quick Start

### 1. Configure Environment

Update `.env`:
```bash
VITE_WS_URL=ws://localhost:3000/ws
```

For production (secure WebSocket):
```bash
VITE_WS_URL=wss://your-domain.com/ws
```

### 2. Basic Usage

```tsx
import { useRaceSession } from '../hooks/useRaceSession';
import { useLiveRaceUpdates } from '../hooks/useLiveRaceUpdates';

function RaceComponent() {
  // Fetch initial data
  const { data: session } = useRaceSession({
    refetchInterval: false  // Disable polling
  });

  // Connect to live updates
  const { isConnected } = useLiveRaceUpdates({
    sessionId: session?.sessionId,
    enabled: session?.isLive
  });

  return (
    <div>
      {isConnected && <span>● LIVE</span>}
      {/* Your UI here - updates automatically! */}
    </div>
  );
}
```

## How It Works

### 1. Data Flow

```
WebSocket Server
      ↓
      ↓ Real-time messages
      ↓
useLiveRaceUpdates
      ↓
      ↓ Updates cache
      ↓
TanStack Query
      ↓
      ↓ Triggers re-render
      ↓
React Components
```

### 2. Message Format

Your backend should send messages like:

```json
{
  "type": "lap_update",
  "data": {
    "driverId": "VER",
    "lapTime": "1:15.234",
    "isFastest": true,
    "lapNumber": 45
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 3. Supported Message Types

| Type | Description |
|------|-------------|
| `session_update` | Session info (lap count, etc) |
| `driver_update` | Complete driver data |
| `position_change` | Position changes |
| `lap_update` | Lap time updates |
| `sector_update` | Sector time updates |
| `tire_change` | Tire changes |
| `status_change` | Driver status (PIT, TRACK, OUT) |
| `drs_update` | DRS availability |

## Features

### ✅ Automatic Reconnection
- Reconnects automatically on connection loss
- Configurable retry attempts and intervals
- Exponential backoff support

### ✅ TanStack Query Integration
- Updates cached data automatically
- No manual cache manipulation needed
- Triggers React re-renders seamlessly

### ✅ Connection Management
- Connection status monitoring
- Heartbeat/keep-alive
- Clean disconnection on unmount

### ✅ Type Safety
- Full TypeScript support
- Type-safe message handling
- Autocomplete for message types

## Architecture

### Low-Level: WebSocketService
```tsx
import { WebSocketService } from '../services/websocket';

const ws = new WebSocketService({
  url: 'ws://localhost:3000/ws',
  reconnectInterval: 3000,
  maxReconnectAttempts: 10
});

ws.on('lap_update', (data) => {
  console.log('Lap update:', data);
});
```

### Mid-Level: useWebSocket Hook
```tsx
import { useWebSocket } from '../hooks/useWebSocket';

const { status, subscribe, send } = useWebSocket();

useEffect(() => {
  return subscribe('lap_update', (data) => {
    console.log('Lap update:', data);
  });
}, [subscribe]);
```

### High-Level: useLiveRaceUpdates (Recommended)
```tsx
import { useLiveRaceUpdates } from '../hooks/useLiveRaceUpdates';

const { isConnected } = useLiveRaceUpdates({
  sessionId: 'race-2024'
});

// Cache updates automatically!
// Just use useRaceSession() and data is always fresh
```

## Integration Example

```tsx
function RaceTable() {
  // Fetch initial data via REST API
  const { data: session, isLoading } = useRaceSession({
    refetchInterval: false  // ← Disable polling
  });

  // Connect to WebSocket for live updates
  const { status, isConnected } = useLiveRaceUpdates({
    sessionId: session?.sessionId,
    enabled: !!session?.isLive  // ← Only if live
  });

  if (isLoading) return <Spinner />;

  return (
    <div>
      {/* Status indicator */}
      <div style={{ color: isConnected ? '#22c55e' : '#ef4444' }}>
        {isConnected ? '● LIVE' : '○ Offline'}
      </div>

      {/* Data updates automatically! */}
      <RaceStandings drivers={session.drivers} />
    </div>
  );
}
```

## Backend Requirements

### Node.js + ws Example

```javascript
const WebSocket = require('ws');
const wss = new WebSocket.Server({
  port: 3000,
  path: '/ws'
});

wss.on('connection', (ws) => {
  console.log('Client connected');

  // Send lap update every 30 seconds
  const interval = setInterval(() => {
    ws.send(JSON.stringify({
      type: 'lap_update',
      data: {
        driverId: 'VER',
        lapTime: '1:15.234',
        isFastest: true,
        lapNumber: 45
      }
    }));
  }, 30000);

  ws.on('close', () => {
    clearInterval(interval);
  });
});
```

### Message Format Rules

1. **Must be JSON** - String messages are parsed as JSON
2. **Must have `type` field** - Used for routing to subscribers
3. **Must have `data` field** - Actual message payload
4. **Optional `timestamp`** - ISO 8601 format

## Configuration Options

### WebSocket Service
```tsx
{
  url: string;                    // WebSocket server URL
  reconnectInterval?: number;     // Delay between reconnects (default: 3000ms)
  maxReconnectAttempts?: number;  // Max retry count (default: 10)
  heartbeatInterval?: number;     // Keep-alive interval (default: 30000ms)
  autoConnect?: boolean;          // Auto-connect on init (default: true)
}
```

### useWebSocket Hook
```tsx
{
  url?: string;                   // Override default URL
  enabled?: boolean;              // Enable connection (default: true)
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  onConnect?: () => void;         // Connection callback
  onDisconnect?: () => void;      // Disconnection callback
  onError?: (e: Event) => void;   // Error callback
  onMessage?: (msg) => void;      // Global message handler
}
```

### useLiveRaceUpdates Hook
```tsx
{
  sessionId?: string;             // Session to receive updates for
  enabled?: boolean;              // Enable connection (default: true)
}
```

## Best Practices

### ✅ Recommended

1. **Use with TanStack Query**
```tsx
// Initial fetch + live updates
const { data } = useRaceSession({ refetchInterval: false });
useLiveRaceUpdates({ sessionId: data?.sessionId });
```

2. **Conditional Connection**
```tsx
// Only connect for live sessions
useLiveRaceUpdates({
  enabled: session?.isLive
});
```

3. **Show Connection Status**
```tsx
const { isConnected } = useLiveRaceUpdates();
return <div>{isConnected && '● LIVE'}</div>;
```

### ❌ Avoid

1. **Don't use both polling and WebSocket**
```tsx
// ❌ Bad - wastes bandwidth
useRaceSession({ refetchInterval: 5000 });
useLiveRaceUpdates();

// ✅ Good - WebSocket only
useRaceSession({ refetchInterval: false });
useLiveRaceUpdates();
```

2. **Don't forget to disable when not live**
```tsx
// ❌ Bad - always connected
useLiveRaceUpdates();

// ✅ Good - conditional
useLiveRaceUpdates({ enabled: session?.isLive });
```

## Troubleshooting

### Connection Issues

**Problem:** WebSocket won't connect

**Check:**
1. `VITE_WS_URL` in `.env`
2. Backend server is running
3. Firewall/proxy settings
4. Browser console for errors

### No Messages Received

**Problem:** Connected but no data

**Check:**
1. Server sending correct message format
2. Message types match subscriptions
3. Browser DevTools → Network → WS tab
4. Server-side error logs

### Frequent Disconnections

**Problem:** Keeps disconnecting

**Solutions:**
1. Increase `heartbeatInterval`
2. Check server timeout settings
3. Verify network stability
4. Increase `reconnectInterval`

## Examples

- 📝 **Full Integration:** `src/components/Table/TableWithLiveUpdates.example.tsx`
- 📚 **Complete Docs:** `WEBSOCKET.md`
- 🔧 **Types Reference:** `src/types/websocket.types.ts`

## Status

✅ **Ready for real-time updates!**

- Service: Implemented
- Hooks: Implemented
- TanStack Query integration: Implemented
- Types: Implemented
- Documentation: Complete
- Examples: Provided

## Next Steps

1. **Start your backend WebSocket server**
2. **Configure `VITE_WS_URL` in `.env`**
3. **Use `useLiveRaceUpdates` in components**
4. **Test with real race data**

Your app is now ready for real-time Formula 1 race updates! 🏎️💨
