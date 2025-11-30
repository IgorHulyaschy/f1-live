# F1 Live - Race Tracking Application

Real-time Formula 1 race tracking application built with React, TypeScript, and Vite.

## Tech Stack

- ⚛️ **React 18** - UI framework
- 📘 **TypeScript** - Type safety
- ⚡ **Vite** - Build tool and dev server
- 🎨 **Tailwind CSS v4** - Utility-first CSS (hybrid with CSS Modules)
- 🎭 **Framer Motion** - Animations
- 🔄 **TanStack Query** - Server state management
- 🎯 **React Router** - Client-side routing

## Styling Approach

This project uses a **hybrid styling approach**:
- 🎨 **CSS Modules** for repeating patterns and component-specific styles
- ⚡ **Tailwind CSS v4** for utilities and one-off styles

See [TAILWIND_CONFIG.md](./TAILWIND_CONFIG.md) for detailed styling guidelines.

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Configure your API URL in .env
VITE_API_URL=http://localhost:3000/api
```

### Development

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Features

- ✅ Real-time race standings
- ✅ Live lap timing and sector data
- ✅ Driver position changes
- ✅ Tire strategy tracking
- ✅ DRS detection
- ✅ Fastest lap indicators
- ✅ Responsive design
- ✅ WebSocket live updates
- ✅ Automatic reconnection
- ✅ Auto-refresh for live data

## Data Fetching

This project uses **TanStack Query** for data fetching and **WebSocket** for real-time updates.

- 📖 [TanStack Query Setup](./TANSTACK_QUERY_SETUP.md)
- 📖 [TanStack Query Guide](./TANSTACK_QUERY.md)
- 🔌 [WebSocket Setup](./WEBSOCKET_SETUP.md)
- 🔌 [WebSocket Guide](./WEBSOCKET.md)

### Quick Examples

**TanStack Query (REST API):**
```tsx
import { useRaceSession } from './hooks/useRaceSession';

function RaceComponent() {
  const { data, isLoading } = useRaceSession({
    refetchInterval: 5000  // Auto-refresh every 5 seconds
  });

  if (isLoading) return <div>Loading...</div>;

  return <div>{data.sessionName}</div>;
}
```

**WebSocket (Real-time):**
```tsx
import { useRaceSession } from './hooks/useRaceSession';
import { useLiveRaceUpdates } from './hooks/useLiveRaceUpdates';

function RaceComponent() {
  // Fetch initial data
  const { data, isLoading } = useRaceSession({
    refetchInterval: false  // Disable polling, use WebSocket instead
  });

  // Connect to live updates
  const { isConnected } = useLiveRaceUpdates({
    sessionId: data?.sessionId,
    enabled: data?.isLive  // Only connect for live sessions
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {isConnected && <span>● LIVE</span>}
      <div>{data.sessionName}</div>
    </div>
  );
}
```

## Project Structure

```
src/
├── components/        # React components
│   ├── Table/        # Main race table component
│   └── Icons/        # Icon components
├── hooks/            # Custom React hooks (TanStack Query)
├── services/         # API services
├── types/            # TypeScript type definitions
├── lib/              # Library configurations (QueryClient)
├── utils/            # Utility functions
├── pages/            # Page components
└── constants/        # App constants
```

## Documentation

### Styling
- 📖 [Tailwind CSS Configuration](./TAILWIND_CONFIG.md)
- 📝 [CSS Modules Usage](./CLASSNAMES_USAGE.md)

### Data Fetching
- 🔄 [TanStack Query Setup](./TANSTACK_QUERY_SETUP.md)
- 📚 [TanStack Query Guide](./TANSTACK_QUERY.md)

### Real-time Updates
- 🔌 [WebSocket Setup](./WEBSOCKET_SETUP.md)
- 📡 [WebSocket Guide](./WEBSOCKET.md)

## Development Notes

### Vite Plugins

Currently using [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) with Babel for Fast Refresh.

Alternative: [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses SWC for faster builds.

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
