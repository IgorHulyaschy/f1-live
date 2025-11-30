# TanStack Query Setup

This project uses **TanStack Query v5** (formerly React Query) for server state management.

## Overview

TanStack Query handles:
- ✅ Data fetching and caching
- ✅ Automatic refetching and background updates
- ✅ Loading and error states
- ✅ Request deduplication
- ✅ Optimistic updates

## Configuration

### Query Client Setup

The QueryClient is configured in `src/lib/queryClient.ts`:

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 10,          // 10 seconds
      gcTime: 1000 * 60 * 5,          // 5 minutes (garbage collection)
      retry: 1,                        // Retry failed requests once
      refetchOnWindowFocus: false,     // Don't refetch on window focus
      refetchOnReconnect: true         // Refetch when reconnecting
    }
  }
});
```

### Provider Setup

The app is wrapped with `QueryClientProvider` in `src/main.tsx`:

```tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';

<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>
```

## API Service

### Base Service (`src/services/api.ts`)

Centralized API service with error handling:

```typescript
import { apiService } from '../services/api';

// Get current race session
const session = await apiService.getRaceSession();

// Get specific session
const session = await apiService.getRaceSession('session-123');

// Get all sessions
const sessions = await apiService.getSessions();
```

### Environment Variables

Configure API URL in `.env`:

```bash
VITE_API_URL=http://localhost:3000/api
```

## Custom Hooks

### useRaceSession

Fetch race session data with automatic live updates.

**Basic Usage:**
```tsx
import { useRaceSession } from '../hooks/useRaceSession';

function RaceComponent() {
  const { data, isLoading, error } = useRaceSession();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>{data.sessionName}</h1>
      <p>Lap {data.currentLap} / {data.totalLaps}</p>
    </div>
  );
}
```

**With Auto-Refresh for Live Data:**
```tsx
// Refetch every 5 seconds when session is live
const { data } = useRaceSession({
  refetchInterval: 5000
});
```

**Fetch Specific Session:**
```tsx
const { data } = useRaceSession({
  sessionId: 'session-123'
});
```

**Conditional Fetching:**
```tsx
const { data } = useRaceSession({
  enabled: userIsAuthenticated
});
```

**Options:**
- `sessionId` (optional) - Specific session ID, or current session if not provided
- `enabled` (default: `true`) - Whether the query should run
- `refetchInterval` (default: `5000`) - Auto-refetch interval in milliseconds for live data

### useSessions

Fetch list of available sessions.

```tsx
import { useSessions } from '../hooks/useSessions';

function SessionList() {
  const { data: sessions, isLoading } = useSessions();

  if (isLoading) return <div>Loading sessions...</div>;

  return (
    <ul>
      {sessions?.map(session => (
        <li key={session.sessionId}>
          {session.sessionName} - {session.isLive ? 'LIVE' : 'Finished'}
        </li>
      ))}
    </ul>
  );
}
```

## Types

### RaceSession
```typescript
interface RaceSession {
  sessionId: string;
  sessionName: string;
  sessionType: 'race' | 'qualifying' | 'practice';
  currentLap: number;
  totalLaps: number;
  isLive: boolean;
  drivers: Driver[];
}
```

### SessionInfo
```typescript
interface SessionInfo {
  sessionId: string;
  sessionName: string;
  sessionType: 'race' | 'qualifying' | 'practice';
  trackName: string;
  startTime: string;
  isLive: boolean;
}
```

### ApiError
```typescript
interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
}
```

## Advanced Usage

### Manual Refetching

```tsx
import { useRaceSession } from '../hooks/useRaceSession';

function RaceComponent() {
  const { data, refetch } = useRaceSession();

  return (
    <div>
      <button onClick={() => refetch()}>
        Refresh Data
      </button>
    </div>
  );
}
```

### Accessing Query State

```tsx
const {
  data,           // The data returned from the query
  error,          // Error object if query failed
  isLoading,      // True on initial load
  isFetching,     // True whenever fetching (including background)
  isSuccess,      // True when data is available
  isError,        // True if query failed
  refetch         // Function to manually refetch
} = useRaceSession();
```

### Dependent Queries

```tsx
// Only fetch race session if we have a session ID
const { data: sessions } = useSessions();
const selectedSessionId = sessions?.[0]?.sessionId;

const { data: session } = useRaceSession({
  sessionId: selectedSessionId,
  enabled: !!selectedSessionId  // Only run when we have an ID
});
```

### Background Refetching

The `useRaceSession` hook automatically refetches data in the background when:
1. The session is marked as `isLive: true`
2. Every `refetchInterval` milliseconds (default: 5000ms)

```tsx
// This will auto-refresh every 3 seconds for live sessions
const { data } = useRaceSession({
  refetchInterval: 3000
});
```

## Query Keys

Query keys are used for caching and invalidation:

```typescript
// Race session query key
['race-session', sessionId]  // sessionId is undefined for current session

// Sessions list query key
['sessions']
```

### Manual Cache Invalidation

```tsx
import { useQueryClient } from '@tanstack/react-query';
import { RACE_SESSION_QUERY_KEY } from '../hooks/useRaceSession';

function Component() {
  const queryClient = useQueryClient();

  const handleInvalidate = () => {
    // Invalidate all race session queries
    queryClient.invalidateQueries({
      queryKey: [RACE_SESSION_QUERY_KEY]
    });
  };

  return <button onClick={handleInvalidate}>Refresh</button>;
}
```

## Error Handling

### Component-Level Error Handling

```tsx
const { data, error, isError } = useRaceSession();

if (isError) {
  return (
    <div>
      <h2>Error Loading Race Data</h2>
      <p>{error.message}</p>
      {error.code && <p>Error Code: {error.code}</p>}
    </div>
  );
}
```

### Error Boundaries

Use React Error Boundaries for global error handling:

```tsx
import { ErrorBoundary } from 'react-error-boundary';

<ErrorBoundary fallback={<ErrorFallback />}>
  <RaceComponent />
</ErrorBoundary>
```

## Best Practices

### ✅ Do's

1. **Use the custom hooks** - Don't call `apiService` directly in components
2. **Enable when ready** - Use `enabled` option for conditional queries
3. **Set appropriate staleTime** - Configure based on data freshness needs
4. **Handle loading states** - Always show loading UI
5. **Handle errors** - Provide clear error messages

```tsx
// ✅ Good
const { data, isLoading, error } = useRaceSession();

if (isLoading) return <Spinner />;
if (error) return <ErrorMessage error={error} />;

return <RaceTable data={data} />;
```

### ❌ Don'ts

1. **Don't call API directly** - Always use React Query hooks
2. **Don't ignore loading states** - Can cause UI flicker
3. **Don't forget error handling** - Can cause poor UX
4. **Don't over-refetch** - Set sensible refetch intervals

```tsx
// ❌ Bad - calling API directly
const [data, setData] = useState(null);

useEffect(() => {
  apiService.getRaceSession().then(setData);
}, []);

// ✅ Good - using the hook
const { data } = useRaceSession();
```

## DevTools (Optional)

Install TanStack Query DevTools for debugging:

```bash
npm install @tanstack/react-query-devtools
```

Add to your app:

```tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

<QueryClientProvider client={queryClient}>
  <App />
  <ReactQueryDevtools initialIsOpen={false} />
</QueryClientProvider>
```

## Migration from Mock Data

### Before (Mock Data)
```tsx
import { MOCKED_DATA } from './constants';

function Table() {
  const [drivers, setDrivers] = useState(MOCKED_DATA);

  return <RaceTable drivers={drivers} />;
}
```

### After (TanStack Query)
```tsx
import { useRaceSession } from '../hooks/useRaceSession';

function Table() {
  const { data, isLoading } = useRaceSession();

  if (isLoading) return <Spinner />;

  return <RaceTable drivers={data.drivers} />;
}
```

## Resources

- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [TanStack Query v5 Migration Guide](https://tanstack.com/query/latest/docs/react/guides/migrating-to-v5)
- [React Query Essentials](https://tanstack.com/query/latest/docs/react/guides/important-defaults)
