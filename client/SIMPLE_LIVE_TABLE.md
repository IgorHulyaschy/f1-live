# Simple Live Table

A simplified live timing table that displays real race data without the complexity of the full F1 data structure.

## Overview

This component is designed for displaying actual race data from your backend, showing:
- Driver positions (sorted by laps completed and latest lap time)
- Driver numbers and names
- Team names
- Total laps completed
- Latest lap time
- Latest sector times (S1, S2, S3)

## Data Structure

### Expected API Response

The component expects data from `GET /api/session`:

```typescript
{
  session: {
    id: string;
    name: string;
    country: string;
    type: 'race' | 'qualifying' | 'sprint' | 'sprint_qualifying' | 'practice';
    data: Date;
  },
  driversLapsData: [
    {
      id: string;
      name: string;
      number: number;
      team: string;
      shortName: string;
      avatarUrl?: string | null;
      laps: [
        {
          id: string;
          driverNumber: string;
          lapNumber: number;
          sector1Time?: number | null;  // in milliseconds
          sector2Time?: number | null;  // in milliseconds
          sector3Time?: number | null;  // in milliseconds
          time?: number | null;         // total lap time in milliseconds
          sessionId: string;
        }
      ]
    }
  ]
}
```

## Time Format

All times are in **milliseconds** and are automatically formatted:

- **Lap times over 1 minute:** `1:23.456` (1 minute, 23 seconds, 456 milliseconds)
- **Lap times under 1 minute:** `23.456` (23 seconds, 456 milliseconds)
- **Sector times:** `23.456` (always in seconds.milliseconds)
- **Null/undefined times:** `-` (dash)

## Usage

### Basic Setup

```tsx
import SimpleLiveTable from './components/SimpleLiveTable';

function App() {
  return <SimpleLiveTable />;
}
```

### With Routing

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SimpleLive from './pages/SimpleLive';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SimpleLive />} />
      </Routes>
    </BrowserRouter>
  );
}
```

## Features

### ✅ Auto-Refresh
The table automatically refetches data every 5 seconds to show live updates.

```tsx
const { data } = useSessionData({
  refetchInterval: 5000  // Refresh every 5 seconds
});
```

### ✅ Smart Sorting
Drivers are sorted by:
1. **Most laps completed** (primary)
2. **Fastest latest lap time** (secondary)

### ✅ Loading & Error States
- **Loading:** Shows "Loading Session Data..." message
- **Error:** Displays error message with details
- **No Data:** Shows "No Data Available" message
- **Empty:** Shows "No driver data" when session exists but has no drivers

### ✅ Live Badge
Displays a pulsing "LIVE" badge to indicate real-time data.

## Customization

### Change Refresh Interval

Edit `src/components/SimpleLiveTable/index.tsx`:

```tsx
const { data } = useSessionData({
  refetchInterval: 3000  // Refresh every 3 seconds
});
```

### Disable Auto-Refresh

```tsx
const { data } = useSessionData({
  refetchInterval: false  // Manual refresh only
});
```

### Custom Styling

Styles are in `src/components/SimpleLiveTable/styles.module.css`.

Key classes:
- `.container` - Main wrapper
- `.tableWrapper` - Table container
- `.titleBar` - Header section
- `.row` - Table row (with hover effects)
- `.driverInfo` - Driver name/number cell
- `.time` - Lap time styling
- `.sectorTime` - Sector time styling

## API Endpoint

### Required Endpoint

Your backend must implement:

```
GET /api/session
```

**Response:**
```json
{
  "session": {
    "id": "session-123",
    "name": "Monaco Grand Prix",
    "country": "Monaco",
    "type": "race",
    "data": "2024-05-26T00:00:00Z"
  },
  "driversLapsData": [
    {
      "id": "driver-1",
      "name": "Max Verstappen",
      "number": 1,
      "team": "Red Bull Racing",
      "shortName": "VER",
      "avatarUrl": null,
      "laps": [
        {
          "id": "lap-1",
          "driverNumber": "1",
          "lapNumber": 1,
          "sector1Time": 23456,
          "sector2Time": 28789,
          "sector3Time": 22345,
          "time": 74590,
          "sessionId": "session-123"
        }
      ]
    }
  ]
}
```

### Time Values

All time values should be in **milliseconds**:
- `23456` ms = `23.456` seconds
- `74590` ms = `1:14.590` (1 minute, 14.59 seconds)

### Null Handling

Missing times should be `null`:
```json
{
  "sector1Time": null,  // No sector 1 time yet
  "sector2Time": 28789,
  "sector3Time": null,
  "time": null          // Lap not completed
}
```

## File Structure

```
src/
├── components/
│   └── SimpleLiveTable/
│       ├── index.tsx           # Main component
│       └── styles.module.css   # Component styles
├── hooks/
│   └── useSessionData.ts       # Data fetching hook
├── utils/
│   └── lapTimeFormatter.ts     # Time formatting utilities
├── types/
│   └── real-data-we-have.types.ts  # Type definitions
└── pages/
    └── SimpleLive.tsx          # Page wrapper
```

## Utilities

### formatLapTime

```tsx
import { formatLapTime } from '../utils/lapTimeFormatter';

formatLapTime(83456)  // "1:23.456"
formatLapTime(23456)  // "23.456"
formatLapTime(null)   // "-"
```

### formatSectorTime

```tsx
import { formatSectorTime } from '../utils/lapTimeFormatter';

formatSectorTime(23456)  // "23.456"
formatSectorTime(null)   // "-"
```

## Example Data Flow

1. **Component Mounts** → Calls `useSessionData()`
2. **Hook Fetches** → `GET /api/session`
3. **Data Received** → Processes driver data
4. **Sorts Drivers** → By laps completed, then lap time
5. **Renders Table** → Shows formatted data
6. **Auto-Refresh** → Refetches every 5 seconds

## Troubleshooting

### No Data Showing

**Check:**
1. Backend is running at `VITE_API_URL`
2. Endpoint `/api/session` exists
3. Response matches expected format
4. Browser console for errors

### Times Not Formatting

**Ensure:**
- Times are in milliseconds (not seconds)
- Times are numbers (not strings)
- Times are in the response

### Table Not Updating

**Verify:**
- Auto-refresh is enabled (`refetchInterval: 5000`)
- Backend is sending new data
- Browser DevTools Network tab shows requests

## Routes

- `/` - SimpleLiveTable (real data)
- `/demo` - Full demo table (mock data)

## Next Steps

1. **Backend Integration:** Implement `/api/session` endpoint
2. **WebSocket Support:** Add real-time updates via WebSocket
3. **Enhanced Features:** Add position changes, fastest laps, etc.

---

**Status:** ✅ Ready for use with real race data!
