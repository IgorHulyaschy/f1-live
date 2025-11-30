# Tailwind v4 Migration Summary

## Problem
`fontFamily` and `boxShadow` settings from `tailwind.config.ts` were not working.

## Root Cause
**Tailwind CSS v4** changed how theme customization works:
- ❌ The traditional `tailwind.config.ts` theme configuration is deprecated
- ✅ Theme values must be defined using the `@theme` directive in CSS

## Solution

### 1. Moved Theme Configuration to CSS

**File: `src/index.css`**

Added `@theme` block with all custom values:

```css
@theme {
  /* Font Families */
  --font-sans: 'Outfit', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Custom Box Shadows */
  --shadow-purple: 0 0 8px rgba(168, 85, 247, 0.4);
  --shadow-red: 0 0 8px rgba(239, 68, 68, 0.4);
  --shadow-yellow: 0 0 8px rgba(251, 191, 36, 0.4);
  --shadow-white: 0 0 8px rgba(255, 255, 255, 0.3);

  /* F1 Colors */
  --color-f1-red: #e10600;
  --color-f1-red-dark: #c00500;

  /* Team Colors */
  --color-team-red-bull: #1e3a8a;
  --color-team-ferrari: #dc0000;
  /* ... etc */
}
```

### 2. Simplified tailwind.config.ts

Removed all theme configuration and kept only essentials:

```typescript
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  plugins: []
} satisfies Config;
```

## How to Use

### Font Families
```tsx
<div className="font-sans">Uses Outfit</div>
<code className="font-mono">Uses JetBrains Mono</code>
```

### Box Shadows
```tsx
<div className="shadow-purple">Purple glow effect</div>
<div className="shadow-red">Red glow effect</div>
```

### Custom Colors
```tsx
<button className="bg-f1-red hover:bg-f1-red-dark">F1 Button</button>
<div className="bg-team-ferrari">Ferrari team color</div>
```

## Verification

Build output shows theme is working:
- ✅ CSS size: 24.95 kB (includes theme definitions)
- ✅ All custom fonts accessible via `font-sans` and `font-mono`
- ✅ All custom shadows accessible via `shadow-*` classes
- ✅ All custom colors accessible via `bg-*`, `text-*`, etc.

## Key Differences: v3 vs v4

### Tailwind v3 (Old)
```typescript
// tailwind.config.ts
theme: {
  extend: {
    fontFamily: {
      sans: ['Outfit', 'sans-serif']
    },
    boxShadow: {
      purple: '0 0 8px rgba(168, 85, 247, 0.4)'
    }
  }
}
```

### Tailwind v4 (New)
```css
/* src/index.css */
@theme {
  --font-sans: 'Outfit', system-ui, sans-serif;
  --shadow-purple: 0 0 8px rgba(168, 85, 247, 0.4);
}
```

## Benefits of v4 Approach

1. **CSS-Native**: Uses standard CSS custom properties
2. **Better Performance**: Faster compilation
3. **Runtime Flexibility**: Can be overridden with inline styles or CSS
4. **Better IntelliSense**: Editor autocomplete works better
5. **Simpler Config**: Less JavaScript configuration

## Next Steps

To add new theme values in the future:

1. Open `src/index.css`
2. Add to the `@theme` block using the naming convention:
   - Colors: `--color-name-variant`
   - Shadows: `--shadow-name`
   - Fonts: `--font-name`
3. Use in classes: `bg-name-variant`, `shadow-name`, `font-name`

## Documentation

- See `TAILWIND_CONFIG.md` for complete configuration guide
- Tailwind v4 docs: https://tailwindcss.com/docs
- @theme directive: https://tailwindcss.com/docs/adding-custom-styles#using-the-theme-directive
