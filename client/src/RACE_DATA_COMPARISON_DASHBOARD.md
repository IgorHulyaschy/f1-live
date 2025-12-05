# Feature: Race Data Comparison Dashboard

## Overview

Implement a new feature for comparing race data between drivers using interactive, draggable charts. The page displays graphical comparisons (starting with lap times) that update in real-time via WebSocket connections.

## User Stories

1. As a user, I want to see a default comparison of lap times between the 2 leading drivers when I open the page
2. As a user, I want to select specific drivers to compare from a sidebar
3. As a user, I want to choose the type of data being compared (lap times for now, extensible for future data types)
4. As a user, I want to create multiple comparison charts on the same page
5. As a user, I want to drag and reposition charts anywhere on the canvas
6. As a user, I want to resize charts to my preferred dimensions
7. As a user, I want to remove charts I no longer need
8. As a user, I want to hide/show the sidebar to maximize chart viewing area
9. As a user, I want charts to update in real-time as new lap data comes in

## Feature Location

```
src/features/race-comparison/
├── components/
│   ├── ComparisonCanvas.tsx        # Main canvas area for charts
│   ├── ComparisonCanvas.module.css
│   ├── ComparisonChart.tsx         # Individual draggable/resizable chart
│   ├── ComparisonChart.module.css
│   ├── ComparisonSidebar.tsx       # Right sidebar for controls
│   ├── ComparisonSidebar.module.css
│   ├── DriverSelector.tsx          # Multi-select driver picker
│   ├── DataTypeSelector.tsx        # Data type dropdown/selector
│   ├── ChartControls.tsx           # Chart action buttons (remove, etc.)
│   └── index.ts
├── hooks/
│   ├── useComparisonCharts.ts      # Chart state management (positions, sizes, data)
│   ├── useComparisonData.ts        # Data fetching + WebSocket subscription
│   ├── useDraggable.ts             # Drag logic (or use library)
│   ├── useResizable.ts             # Resize logic (or use library)
│   └── index.ts
├── utils/
│   ├── chartDefaults.ts            # Default chart configs
│   ├── transformLapData.ts         # Transform API data for charts
│   └── index.ts
├── types.ts
├── constants.ts
└── index.ts
```

## Page Location

```
src/pages/RaceComparisonPage.tsx
```

## Types

```typescript
// features/race-comparison/types.ts

export type DataType = 'lapTime' | 'sector1' | 'sector2' | 'sector3' | 'speed' | 'gap';

export interface ChartPosition {
	x: number;
	y: number;
}

export interface ChartSize {
	width: number;
	height: number;
}

export interface ComparisonChart {
	id: string;
	driverIds: string[]; // Array of driver IDs being compared
	dataType: DataType;
	position: ChartPosition;
	size: ChartSize;
	createdAt: number;
}

export interface ChartDataPoint {
	lap: number;
	[driverId: string]: number | string; // Dynamic keys for each driver's value
}

export interface ChartData {
	chartId: string;
	dataType: DataType;
	driverIds: string[];
	points: ChartDataPoint[];
}

export interface Driver {
	id: string;
	name: string;
	team: string;
	teamColor: string;
	number: number;
}

export interface LapTimeUpdate {
	driverId: string;
	lap: number;
	time: number; // In milliseconds
	sector1: number;
	sector2: number;
	sector3: number;
}

export interface ComparisonState {
	charts: ComparisonChart[];
	sidebarOpen: boolean;
	selectedDriverIds: string[];
	selectedDataType: DataType;
}
```

## Constants

```typescript
// features/race-comparison/constants.ts

export const DEFAULT_CHART_SIZE = {
	width: 500,
	height: 300
};

export const MIN_CHART_SIZE = {
	width: 300,
	height: 200
};

export const MAX_CHART_SIZE = {
	width: 1000,
	height: 600
};

export const DATA_TYPE_OPTIONS: { value: DataType; label: string }[] = [
	{ value: 'lapTime', label: 'Lap Time' },
	{ value: 'sector1', label: 'Sector 1' },
	{ value: 'sector2', label: 'Sector 2' },
	{ value: 'sector3', label: 'Sector 3' }
	// Future options can be added here
];

export const CHART_COLORS = [
	'#e10600', // F1 Red
	'#3671C6', // Blue
	'#FF8000', // Orange
	'#27F4D2', // Cyan
	'#22c55e', // Green
	'#a855f7', // Purple
	'#fbbf24', // Yellow
	'#FF87BC' // Pink
];
```

## API Endpoints

### REST Endpoints

```typescript
// Initial data fetch

// GET /api/sessions/:sessionId/drivers
// Returns: Driver[]

// GET /api/sessions/:sessionId/laps?driverIds=VER,NOR,LEC
// Returns: { [driverId: string]: LapTimeUpdate[] }

// GET /api/sessions/:sessionId/leaders
// Returns: { drivers: Driver[] }  // Top 2 drivers by position
```

### WebSocket Events

```typescript
// Subscribe to lap updates
// Event: 'LapTime'
// Payload: LapTimeUpdate

// Example subscription (reference simple-race-timing pattern):
subscribe<LapTimeUpdate>('LapTime', (data) => {
	// Update chart data in query cache
});
```

## Component Specifications

### 1. ComparisonCanvas

**Purpose:** Main container for all charts, handles canvas-level interactions

**Props:**

```typescript
interface ComparisonCanvasProps {
	charts: ComparisonChart[];
	onChartMove: (chartId: string, position: ChartPosition) => void;
	onChartResize: (chartId: string, size: ChartSize) => void;
	onChartRemove: (chartId: string) => void;
}
```

**Behavior:**

- Fills available space (viewport minus sidebar when open)
- Provides bounds for chart dragging
- Handles chart z-index (bring to front on interaction)
- Shows empty state when no charts exist

**Styling:** CSS Module for canvas background, grid pattern (optional), empty state

### 2. ComparisonChart

**Purpose:** Individual draggable, resizable chart component

**Props:**

```typescript
interface ComparisonChartProps {
	chart: ComparisonChart;
	data: ChartDataPoint[];
	drivers: Driver[];
	onMove: (position: ChartPosition) => void;
	onResize: (size: ChartSize) => void;
	onRemove: () => void;
	onBringToFront: () => void;
}
```

**Behavior:**

- Draggable by header/title bar
- Resizable from corners and edges
- Displays chart title (data type + driver names)
- Shows loading state while data fetches
- Updates smoothly when new data arrives via WebSocket
- Constrained within canvas bounds

**Chart Library:** Use `recharts` (already available in project)

**Styling:**

- CSS Module for: container, header, resize handles, loading overlay
- Tailwind for: basic spacing, colors

### 3. ComparisonSidebar

**Purpose:** Controls panel for creating and configuring charts

**Props:**

```typescript
interface ComparisonSidebarProps {
	isOpen: boolean;
	onToggle: () => void;
	drivers: Driver[];
	selectedDriverIds: string[];
	onDriversChange: (driverIds: string[]) => void;
	selectedDataType: DataType;
	onDataTypeChange: (dataType: DataType) => void;
	onCreateChart: () => void;
	canCreate: boolean; // false if < 2 drivers selected
}
```

**Behavior:**

- Collapsible (slides in/out from right)
- Toggle button visible when collapsed
- Form validation: minimum 2 drivers required
- Shows driver list with team colors
- Remembers selections after chart creation (for quick multiple charts)

**Sections:**

1. Header with collapse button
2. Driver selection (multi-select with checkboxes)
3. Data type selection (dropdown or radio buttons)
4. Create button (disabled state when invalid)

**Styling:**

- CSS Module for: slide animation, collapsed state, section dividers
- Tailwind for: form elements, spacing, colors

### 4. DriverSelector

**Purpose:** Multi-select component for choosing drivers

**Props:**

```typescript
interface DriverSelectorProps {
	drivers: Driver[];
	selectedIds: string[];
	onChange: (ids: string[]) => void;
	minSelection?: number;
	maxSelection?: number;
}
```

**Behavior:**

- Checkbox list with driver name, number, team color indicator
- Select all / deselect all buttons
- Shows selection count
- Optional min/max constraints with visual feedback

### 5. DataTypeSelector

**Purpose:** Dropdown for selecting comparison data type

**Props:**

```typescript
interface DataTypeSelectorProps {
	value: DataType;
	onChange: (value: DataType) => void;
	options: typeof DATA_TYPE_OPTIONS;
}
```

### 6. ChartControls

**Purpose:** Overlay controls for individual chart actions

**Props:**

```typescript
interface ChartControlsProps {
	onRemove: () => void;
	onFullscreen?: () => void; // Future enhancement
}
```

**Behavior:**

- Shows on chart hover or always visible in header
- Remove button with confirmation (optional)

## Hooks Specifications

### 1. useComparisonCharts

**Purpose:** Manages chart state (CRUD operations, positions, sizes)

```typescript
interface UseComparisonChartsReturn {
	charts: ComparisonChart[];
	addChart: (driverIds: string[], dataType: DataType) => string; // Returns chartId
	removeChart: (chartId: string) => void;
	updateChartPosition: (chartId: string, position: ChartPosition) => void;
	updateChartSize: (chartId: string, size: ChartSize) => void;
	bringToFront: (chartId: string) => void;
}
```

**Implementation Notes:**

- Use Zustand store or useState + useReducer
- Persist chart layout to localStorage (optional enhancement)
- Generate unique IDs for charts

### 2. useComparisonData

**Purpose:** Fetches initial data and subscribes to WebSocket updates

```typescript
interface UseComparisonDataOptions {
	sessionId: string;
	chartId: string;
	driverIds: string[];
	dataType: DataType;
}

interface UseComparisonDataReturn {
	data: ChartDataPoint[];
	isLoading: boolean;
	error: Error | null;
}
```

**Implementation Notes:**

- Use TanStack Query for initial fetch
- Subscribe to WebSocket on mount, unsubscribe on unmount
- Update query cache when WebSocket data arrives (reference simple-race-timing pattern)
- Transform raw API data to ChartDataPoint format

### 3. useDraggable

**Purpose:** Handles drag interactions for charts

```typescript
interface UseDraggableOptions {
	initialPosition: ChartPosition;
	bounds?: DOMRect;
	onDragEnd: (position: ChartPosition) => void;
}

interface UseDraggableReturn {
	position: ChartPosition;
	isDragging: boolean;
	dragHandleProps: {
		onMouseDown: (e: React.MouseEvent) => void;
		style: React.CSSProperties;
	};
}
```

**Alternative:** Consider using `@dnd-kit/core` or `react-draggable` library

### 4. useResizable

**Purpose:** Handles resize interactions for charts

```typescript
interface UseResizableOptions {
	initialSize: ChartSize;
	minSize: ChartSize;
	maxSize: ChartSize;
	onResizeEnd: (size: ChartSize) => void;
}

interface UseResizableReturn {
	size: ChartSize;
	isResizing: boolean;
	resizeHandleProps: (edge: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw') => {
		onMouseDown: (e: React.MouseEvent) => void;
		style: React.CSSProperties;
	};
}
```

**Alternative:** Consider using `re-resizable` or `react-resizable` library

## Page Component

```typescript
// pages/RaceComparisonPage.tsx

import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  ComparisonCanvas,
  ComparisonSidebar,
  useComparisonCharts,
  useComparisonData,
} from '@/features/race-comparison';

export function RaceComparisonPage() {
  const { sessionId } = useParams<{ sessionId: string }>();

  // Initialize with default chart showing top 2 drivers
  // Sidebar state
  // Chart management

  return (
    <div className="flex h-screen">
      <ComparisonCanvas ... />
      <ComparisonSidebar ... />
    </div>
  );
}
```

## Styling Guidelines

### Use Tailwind For:

- Page layout (flex, h-screen)
- Sidebar toggle button
- Form elements in sidebar
- Basic spacing and colors
- Chart header layout

### Use CSS Modules For:

- Canvas background pattern/grid
- Sidebar slide animation
- Chart drag/resize interactions
- Resize handles styling
- Loading overlays with animations
- Chart container shadow and borders

### CSS Variables Needed (add to styles/variables.css):

```css
:root {
	--sidebar-width: 320px;
	--sidebar-collapsed-width: 48px;
	--chart-header-height: 40px;
	--chart-border-radius: 8px;
	--chart-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	--resize-handle-size: 12px;
}
```

## Initial State & Default Behavior

1. On page load:
    - Fetch session drivers list
    - Fetch top 2 leading drivers
    - Create default chart comparing leaders' lap times
    - Position default chart in center of canvas

2. Sidebar:
    - Open by default on desktop
    - Closed by default on mobile (if responsive)
    - Pre-select the 2 leading drivers

3. Charts:
    - Default size: 500x300
    - Snap to grid: optional enhancement
    - Z-index management: last interacted chart on top

## WebSocket Integration Pattern

Reference the `simple-race-timing` feature for WebSocket patterns. Key points:

```typescript
// Inside useComparisonData hook
useEffect(() => {
	if (!isConnected) return;

	return subscribe<LapTimeUpdate>('LapTime', (lap) => {
		// Only update if this lap is for a driver we're tracking
		if (!driverIds.includes(lap.driverId)) return;

		queryClient.setQueryData<ChartDataPoint[]>(['comparison-data', chartId], (old) => {
			if (!old) return old;

			const existingPointIndex = old.findIndex((p) => p.lap === lap.lap);
			const newPoint = transformLapUpdate(lap, dataType);

			if (existingPointIndex !== -1) {
				return old.map((point, i) =>
					i === existingPointIndex ? { ...point, [lap.driverId]: newPoint } : point
				);
			}

			return [...old, { lap: lap.lap, [lap.driverId]: newPoint }];
		});
	});
}, [isConnected, chartId, driverIds, dataType, queryClient, subscribe]);
```

## Library Recommendations

| Purpose     | Recommendation                | Alternative        |
| ----------- | ----------------------------- | ------------------ |
| Charts      | recharts (already in project) | visx, chart.js     |
| Drag & Drop | @dnd-kit/core                 | react-draggable    |
| Resizable   | re-resizable                  | react-resizable    |
| State       | Zustand (if complex)          | useState + Context |

## Testing Considerations

1. **Unit Tests:**
    - `transformLapData` utility
    - Chart position/size calculations
    - Driver selection validation

2. **Integration Tests:**
    - Chart creation flow
    - WebSocket data updates
    - Drag and resize interactions

3. **E2E Tests:**
    - Full user flow: open page → select drivers → create chart → verify data

## Future Enhancements (Out of Scope)

- [ ] Chart templates/presets
- [ ] Export chart as image
- [ ] Share chart configuration via URL
- [ ] Additional data types (tire degradation, fuel load, etc.)
- [ ] Chart annotations
- [ ] Comparison overlays (same chart, multiple data types)
- [ ] Layout save/restore
- [ ] Mobile responsive design

## Acceptance Criteria

1. [ ] Page loads with default chart showing top 2 drivers' lap times
2. [ ] Sidebar can be toggled open/closed
3. [ ] User can select 2+ drivers from sidebar
4. [ ] User can select data type (lap time)
5. [ ] Creating chart adds it to canvas
6. [ ] Charts can be dragged within canvas bounds
7. [ ] Charts can be resized within min/max constraints
8. [ ] Charts can be removed
9. [ ] Charts update in real-time via WebSocket
10. [ ] Multiple charts can exist simultaneously
11. [ ] Charts maintain correct z-index (last touched on top)

## Implementation Order

1. Set up feature folder structure
2. Implement types and constants
3. Create basic ComparisonCanvas and ComparisonChart (static)
4. Add ComparisonSidebar with driver/data type selection
5. Implement useComparisonCharts hook
6. Implement useComparisonData with REST fetching
7. Add recharts integration
8. Implement drag functionality
9. Implement resize functionality
10. Add WebSocket integration
11. Add default chart on page load
12. Polish styling and animations
13. Test and refine

Begin by creating the feature folder structure and implementing the types.
