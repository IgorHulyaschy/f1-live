# TanStack Query - Setup Complete ✅

TanStack Query has been successfully configured for this project!

## What Was Installed

```bash
npm install @tanstack/react-query
```

## Files Created

### Configuration
- ✅ `src/lib/queryClient.ts` - QueryClient configuration
- ✅ `src/main.tsx` - Updated with QueryClientProvider

### API Service
- ✅ `src/services/api.ts` - API service with error handling
- ✅ `src/types/api.types.ts` - API response types

### React Query Hooks
- ✅ `src/hooks/useRaceSession.ts` - Hook for race session data
- ✅ `src/hooks/useSessions.ts` - Hook for sessions list

### Documentation
- ✅ `TANSTACK_QUERY.md` - Complete usage guide
- ✅ `.env.example` - Environment variable template

### Examples
- ✅ `src/components/Table/TableWithQuery.example.tsx` - Example integration

## Quick Start

### 1. Configure Environment

Create `.env` file:
```bash
VITE_API_URL=http://localhost:3000/api
```

### 2. Use in Components

```tsx
import { useRaceSession } from '../hooks/useRaceSession';

function MyComponent() {
  const { data, isLoading, error } = useRaceSession();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{data.sessionName}</div>;
}
```

### 3. Auto-Refresh for Live Data

```tsx
const { data } = useRaceSession({
  refetchInterval: 5000  // Refresh every 5 seconds
});
```

## File Structure

```
src/
├── lib/
│   └── queryClient.ts           # Query client config
├── services/
│   └── api.ts                   # API service layer
├── hooks/
│   ├── useRaceSession.ts        # Race session query hook
│   └── useSessions.ts           # Sessions list query hook
├── types/
│   ├── api.types.ts             # API types
│   ├── driver.types.ts          # Driver types (existing)
│   └── table.types.ts           # Table types (existing)
└── main.tsx                     # App entry with QueryClientProvider
```

## API Endpoints Expected

Your backend should provide these endpoints:

```
GET /api/sessions/current        # Get current session
GET /api/sessions/:id            # Get session by ID
GET /api/sessions                # Get all sessions
```

## Example Response

### GET /api/sessions/current

```json
{
  "sessionId": "race-2024-monaco",
  "sessionName": "Monaco Grand Prix",
  "sessionType": "race",
  "currentLap": 45,
  "totalLaps": 78,
  "isLive": true,
  "drivers": [
    {
      "id": "VER",
      "name": "M. Verstappen",
      "team": "Red Bull Racing",
      "position": 1,
      "positionChange": 0,
      "lastLap": "1:15.234",
      "gap": "Leader",
      "interval": "-",
      "s1": "24.123",
      "s2": "28.456",
      "s3": "22.655",
      "s1Status": "fastest",
      "s2Status": "pb",
      "s3Status": "normal",
      "tire": "S",
      "tireAge": 12,
      "laps": 45,
      "status": "TRACK",
      "hasFastestLap": true,
      "inDRS": false
    }
    // ... more drivers
  ]
}
```

## Migration Path

### Current State (Mock Data)
The Table component currently uses `MOCKED_DATA` from constants.

### Future State (TanStack Query)
See `TableWithQuery.example.tsx` for a complete example of migrating to TanStack Query.

### Migration Steps:
1. Set up backend API endpoints
2. Configure `VITE_API_URL` in `.env`
3. Replace Table component code with example from `TableWithQuery.example.tsx`
4. Remove mock data constants

## Features

### ✅ Automatic Caching
- Data is cached automatically
- Reduces unnecessary API calls
- Improves performance

### ✅ Background Refetching
- Automatically refetches data for live sessions
- Configurable refresh intervals
- Only refetches when session is live

### ✅ Loading States
- Built-in `isLoading` state
- `isFetching` for background updates
- Easy to show spinners/skeletons

### ✅ Error Handling
- Automatic retry on failure
- Detailed error messages
- Easy error state management

### ✅ Request Deduplication
- Multiple components can use same query
- Only one network request is made
- Data is shared across components

## Advanced Features

### Query Invalidation
```tsx
import { useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();
queryClient.invalidateQueries({ queryKey: ['race-session'] });
```

### Manual Refetch
```tsx
const { refetch } = useRaceSession();

<button onClick={() => refetch()}>Refresh</button>
```

### Dependent Queries
```tsx
const { data: sessions } = useSessions();
const sessionId = sessions?.[0]?.sessionId;

const { data: session } = useRaceSession({
  sessionId,
  enabled: !!sessionId  // Only run when we have an ID
});
```

## Next Steps

1. **Set up backend API** - Implement the required endpoints
2. **Test with real data** - Replace mock data with API calls
3. **Add DevTools** (optional) - Install `@tanstack/react-query-devtools`
4. **Optimize** - Fine-tune refetch intervals and cache times

## Resources

- 📖 [Full Documentation](./TANSTACK_QUERY.md)
- 🔗 [TanStack Query Docs](https://tanstack.com/query/latest)
- 📝 [Example Component](./src/components/Table/TableWithQuery.example.tsx)

---

**Status:** ✅ Ready to use!

All setup is complete. You can now start using TanStack Query in your components!
