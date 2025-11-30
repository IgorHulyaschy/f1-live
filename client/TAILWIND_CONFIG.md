# Tailwind CSS v4 Configuration

This project uses **Tailwind CSS v4** with CSS-based configuration using the `@theme` directive.

## 🎯 Current Approach: Hybrid CSS Modules + Tailwind

This project follows a **hybrid styling approach** for better maintainability:

### ✅ Use CSS Modules for:
- **Repeating patterns** (base cell styles, button variants, containers)
- **Component-specific styles** (e.g., `Row/styles.module.css`)
- **Multi-property combinations** (flex layouts, complex positioning)
- **Pseudo-elements and animations** (::before, ::after, @keyframes)

### ✅ Use Tailwind for:
- **One-off utilities** (single `text-center`, `text-[#eab308]`)
- **Dynamic color values** that come from data
- **Quick prototyping** before moving to CSS Modules
- **Simple spacing adjustments**

### ❌ Avoid:
- Long Tailwind class strings (e.g., `"px-3 h-11 align-middle whitespace-nowrap..."`)
- Using `classnames` library for conditional Tailwind classes
- Mixing both approaches for the same pattern

## Important: Tailwind v4 Changes

**Tailwind CSS v4** introduced a new CSS-first configuration approach:
- ✅ Use `@theme` directive in CSS files for theme customization
- ⚠️ Traditional `tailwind.config.ts` is minimal (content paths only)
- 📝 All colors, fonts, shadows defined in `src/index.css`
- 🎨 Most styles now in CSS Modules instead of Tailwind classes

## Examples: Hybrid Approach

### ❌ Bad: Long Tailwind Strings
```tsx
// AVOID - Too many classes, hard to read and maintain
<td className="px-3 h-11 align-middle whitespace-nowrap sticky left-0 z-10 bg-inherit after:content-[''] after:absolute after:top-0 after:-right-3 after:bottom-0 after:w-3 after:bg-linear-to-r after:from-black/50 after:to-transparent">
```

### ✅ Good: CSS Modules for Repeating Patterns
```css
/* styles.module.css */
.stickyLeft {
  padding: 0 0.75rem;
  height: 2.75rem;
  vertical-align: middle;
  white-space: nowrap;
  position: sticky;
  left: 0;
  z-index: 10;
  background: inherit;
}

.stickyLeft::after {
  content: '';
  position: absolute;
  top: 0;
  right: -0.75rem;
  bottom: 0;
  width: 0.75rem;
  background: linear-gradient(to right, rgba(0, 0, 0, 0.5), transparent);
}
```

```tsx
// Clean and readable
<td className={styles.stickyLeft}>
```

### ✅ Good: Data Attributes for Variants
```css
/* status.module.css */
.status {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status[data-status='PIT'] { color: #3b82f6; }
.status[data-status='OUT'] { color: #f97316; }
.status[data-status='TRACK'] { color: #22c55e; }
```

```tsx
// No classnames library needed!
<span className={styles.status} data-status={driver.status}>
  {getStatusLabel(driver.status)}
</span>
```

### ✅ Good: Tailwind for True One-Offs
```tsx
// Simple one-off utilities are fine
<td className={`${styles.cell} text-center`}>
  <span className={styles.monoGray}>{driver.laps}</span>
</td>

<span className="text-[#eab308]">● Slower Sector</span>
<span className="text-[#22c55e]">↑ Gained Position</span>
```

## Configuration Files

### `src/index.css` - Main Configuration ✨
Theme customization is done here using the `@theme` directive:

```css
@theme {
  --font-sans: 'Outfit', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  --shadow-purple: 0 0 8px rgba(168, 85, 247, 0.4);
  --color-f1-red: #e10600;
}
```

### `tailwind.config.ts` - Minimal Config
Only used for content paths and plugins:

```typescript
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  plugins: []
} satisfies Config;
```

## Custom Theme Values

### Font Families

Defined in `src/index.css`:
```css
@theme {
  --font-sans: 'Outfit', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

Usage:
```tsx
<div className="font-sans">Outfit font</div>
<code className="font-mono">JetBrains Mono</code>
```

### Box Shadows

Defined in `src/index.css`:
```css
@theme {
  --shadow-purple: 0 0 8px rgba(168, 85, 247, 0.4);
  --shadow-red: 0 0 8px rgba(239, 68, 68, 0.4);
  --shadow-yellow: 0 0 8px rgba(251, 191, 36, 0.4);
  --shadow-white: 0 0 8px rgba(255, 255, 255, 0.3);
}
```

Usage:
```tsx
<div className="shadow-purple">Purple glow</div>
<div className="shadow-red">Red glow</div>
```

### Custom Colors

#### F1 Brand Colors
```css
@theme {
  --color-f1-red: #e10600;
  --color-f1-red-dark: #c00500;
}
```

Usage:
```tsx
<button className="bg-f1-red hover:bg-f1-red-dark">Click me</button>
```

#### Team Colors
```css
@theme {
  --color-team-red-bull: #1e3a8a;
  --color-team-ferrari: #dc0000;
  --color-team-mclaren: #ff8700;
  --color-team-mercedes: #00d2be;
  --color-team-aston-martin: #006f62;
  --color-team-alpine: #0090ff;
  --color-team-williams: #005aff;
  --color-team-rb: #2b4562;
  --color-team-sauber: #00e701;
  --color-team-haas: #ffffff;
}
```

Usage:
```tsx
<div className="bg-team-ferrari text-white">Ferrari</div>
<div className="bg-team-red-bull">Red Bull</div>
```

## Adding New Theme Values

### Adding Colors
Edit `src/index.css` and add to the `@theme` block:

```css
@theme {
  /* Your new color */
  --color-my-custom: #123456;

  /* Or a color scale */
  --color-accent-50: #f0f9ff;
  --color-accent-100: #e0f2fe;
  /* ... */
}
```

Then use:
```tsx
<div className="bg-my-custom">Custom color</div>
<div className="text-accent-100">Accent</div>
```

### Adding Shadows
```css
@theme {
  --shadow-custom-glow: 0 0 20px rgba(255, 0, 0, 0.5);
}
```

Usage:
```tsx
<div className="shadow-custom-glow">Glowing element</div>
```

### Adding Fonts
```css
@theme {
  --font-display: 'Inter Display', serif;
}
```

Usage:
```tsx
<h1 className="font-display">Display heading</h1>
```

## Custom Utilities

### Linear Gradients

Defined in `@layer utilities`:
```css
@layer utilities {
  .bg-linear-to-b {
    background-image: linear-gradient(to bottom, var(--tw-gradient-stops));
  }
}
```

Usage:
```tsx
<div className="bg-linear-to-b from-blue-500 to-purple-600">
  Gradient background
</div>
```

Available gradients:
- `bg-linear-to-b` - Bottom
- `bg-linear-to-r` - Right
- `bg-linear-to-l` - Left
- `bg-linear-to-br` - Bottom-right

### Scrollbar Utilities
```tsx
<div className="scrollbar-thin scrollbar-track-primary scrollbar-thumb-gray">
  Scrollable content
</div>
```

## Project Evolution

### Phase 1: Plain CSS → Tailwind
Initially used plain CSS, then migrated to Tailwind CSS for rapid development.

### Phase 2: Tailwind v3 → Tailwind v4
Migrated to Tailwind v4 with `@theme` directive for CSS-based configuration.

### Phase 3: Tailwind → CSS Modules Hybrid ✨ (Current)
Refactored to use CSS Modules for repeating patterns with Tailwind for utilities.

**Benefits of Current Approach:**
- ✅ Clean, semantic class names
- ✅ No `classnames` dependency needed
- ✅ Better organization and maintainability
- ✅ Easier to read and modify
- ✅ Type-safe with TypeScript
- ✅ Scoped styles prevent conflicts

## Migration Guide

### From Tailwind v3 to v4 Config

#### ❌ Old Way (v3)
```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif']
      }
    }
  }
}
```

#### ✅ New Way (v4)
```css
/* src/index.css */
@theme {
  --font-sans: 'Outfit', system-ui, sans-serif;
}
```

### From Tailwind Classes to CSS Modules

#### ❌ Before: Tailwind with classnames
```tsx
import classNames from 'classnames';

const buttonClasses = classNames(
  'px-5 py-2.5 text-white border-none rounded-lg font-semibold text-sm',
  {
    'bg-[#22c55e] hover:bg-[#16a34a]': isActive,
    'bg-[#333] hover:bg-[#444]': !isActive
  }
);

<button className={buttonClasses}>
  {isActive ? 'Stop' : 'Start'}
</button>
```

#### ✅ After: CSS Modules with data attributes
```css
/* styles.module.css */
.button {
  padding: 0.625rem 1.25rem;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-weight: 600;
  font-size: 0.875rem;
}

.button[data-active='true'] {
  background: #22c55e;
}

.button[data-active='true']:hover {
  background: #16a34a;
}

.button[data-active='false'] {
  background: #333;
}

.button[data-active='false']:hover {
  background: #444;
}
```

```tsx
import styles from './styles.module.css';

<button className={styles.button} data-active={isActive}>
  {isActive ? 'Stop' : 'Start'}
</button>
```

## Benefits of Current Approach

### Tailwind v4 Benefits
1. **CSS-Native**: Theme values are CSS custom properties
2. **Better Performance**: Faster build times
3. **IntelliSense**: Better autocomplete in editors
4. **Simpler**: Less config, more CSS
5. **Dynamic**: Can be overridden with CSS

### CSS Modules Benefits
1. **Semantic Class Names**: `styles.stickyLeft` instead of 20+ Tailwind classes
2. **No Runtime Dependencies**: No need for `classnames` library
3. **Type Safety**: TypeScript autocomplete for class names
4. **Scoped Styles**: No global namespace pollution
5. **Better Organization**: Styles grouped by component
6. **Easier Refactoring**: Change styles in one place
7. **Pseudo-elements**: Natural support for ::before, ::after
8. **Data Attributes**: Clean variant management without conditionals

## Best Practices

### Creating CSS Modules

**Component Structure:**
```
Row/
├── index.tsx          # Component logic
├── styles.module.css  # Main component styles
├── position.module.css # Position-specific styles
├── sector.module.css   # Sector-specific styles
└── tire.module.css     # Tire-specific styles
```

**When to create separate CSS files:**
- ✅ Create separate module for logically grouped styles (e.g., `header.module.css`)
- ✅ Split by feature when file gets too large (>150 lines)
- ❌ Don't create a file for 3-4 lines of styles
- ❌ Don't duplicate styles across multiple files

### Naming Conventions

**CSS Module Classes:**
```css
/* Use camelCase */
.stickyLeft { }
.driverInfo { }
.monoText { }

/* Data attributes in kebab-case */
[data-status='PIT'] { }
[data-active='true'] { }
```

**File Names:**
```
styles.module.css    # Main component styles
header.module.css    # Feature-specific styles
position.module.css  # Domain-specific styles
```

### Composing Styles

Use the `composes` keyword for shared styles:

```css
.button {
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: 0.5rem;
}

.primaryButton {
  composes: button;
  background: #e10600;
  color: white;
}

.secondaryButton {
  composes: button;
  background: #333;
  color: #aaa;
}
```

### Combining with Tailwind

```tsx
// ✅ Good: CSS Module for structure, Tailwind for one-off
<div className={styles.container}>
  <span className={styles.label}>Driver</span>
  <span className="text-[#888]">VER</span>  {/* One-off color */}
</div>

// ❌ Bad: Mixing for same concern
<div className={`${styles.container} p-4 rounded-lg`}>
  {/* Container should handle all its own styling */}
</div>
```

## Content Paths

Tailwind scans these files for class names:
```typescript
content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}']
```

## Resources

### Tailwind CSS
- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)
- [Tailwind v4 Blog Post](https://tailwindcss.com/blog/tailwindcss-v4)
- [@theme Directive](https://tailwindcss.com/docs/adding-custom-styles#using-the-theme-directive)

### CSS Modules
- [CSS Modules GitHub](https://github.com/css-modules/css-modules)
- [Vite CSS Modules](https://vitejs.dev/guide/features.html#css-modules)
- [TypeScript + CSS Modules](https://www.typescriptlang.org/docs/handbook/modules.html#ambient-modules)

## Summary

This project uses a **hybrid approach**:
- 🎨 **CSS Modules** for component styles and repeating patterns
- ⚡ **Tailwind v4** for utilities and one-off styles
- 🚫 **Avoid** long Tailwind class strings and `classnames` library

**When in doubt:** If you're typing the same Tailwind classes more than twice, move it to CSS Modules.
