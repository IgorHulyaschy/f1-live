# Using classnames in the Project

This project uses the `classnames` library to manage conditional CSS classes in a clean and maintainable way.

## Installation

The `classnames` package is already installed:

```bash
npm install classnames
```

**Note:** TypeScript types are included with the package, no need for `@types/classnames`.

## Basic Usage

### Simple Conditional Classes

```tsx
import classNames from 'classnames';

// Instead of this:
<div className={`base-class ${isActive ? 'active' : ''}`} />

// Use this:
<div className={classNames('base-class', { active: isActive })} />
```

### Multiple Conditions

```tsx
const buttonClasses = classNames('btn', {
  'btn-primary': isPrimary,
  'btn-disabled': isDisabled,
  'btn-large': size === 'large'
});

<button className={buttonClasses}>Click me</button>
```

### Combining Static and Dynamic Classes

```tsx
const classes = classNames(
  'px-4 py-2 rounded-lg',  // Always applied
  {
    'bg-blue-500': isActive,    // Conditional
    'bg-gray-300': !isActive    // Conditional
  }
);
```

## Project Examples

### Row Component

**Before (template literals):**
```tsx
const posClass =
  driver.position === 1
    ? 'text-[#ffd700]'
    : driver.position === 2
      ? 'text-[#c0c0c0]'
      : driver.position === 3
        ? 'text-[#cd7f32]'
        : '';

<div className={`font-mono font-bold ${posClass}`}>
```

**After (classnames):**
```tsx
const positionClasses = classNames('font-mono font-bold text-[15px] text-center', {
  'text-[#ffd700]': driver.position === 1,
  'text-[#c0c0c0]': driver.position === 2,
  'text-[#cd7f32]': driver.position === 3
});

<div className={positionClasses}>
```

### Table Component

**Before:**
```tsx
<button
  className={`px-5 py-2.5 text-white ${
    isSimulating
      ? 'bg-[#22c55e] hover:bg-[#16a34a]'
      : 'bg-[#333] hover:bg-[#444]'
  }`}
>
```

**After:**
```tsx
const buttonBaseClasses = 'px-5 py-2.5 text-white border-none rounded-lg';

const autoSimulateButtonClasses = classNames(buttonBaseClasses, {
  'bg-[#22c55e] hover:bg-[#16a34a]': isSimulating,
  'bg-[#333] hover:bg-[#444]': !isSimulating
});

<button className={autoSimulateButtonClasses}>
```

### Reusable Class Variables

Create reusable class strings for consistency:

```tsx
const stickyLeftClasses =
  "px-3 h-11 sticky left-0 z-10 bg-inherit after:content-[''] after:absolute...";

// Reuse across multiple elements
<td className={stickyLeftClasses}>...</td>
<td className={stickyLeftClasses}>...</td>
```

## Advanced Patterns

### Function that Returns Classes

```tsx
const getSectorClasses = (status: string) =>
  classNames('px-3 h-11 align-middle whitespace-nowrap font-mono text-xs', {
    'text-[#a855f7] bg-[rgba(168,85,247,0.1)]': status === 'fastest',
    'text-[#22c55e] bg-[rgba(34,197,94,0.1)]': status === 'pb',
    'text-[#eab308]': status === 'yellow'
  });

// Usage
<td className={getSectorClasses(driver.s1Status)}>
```

### Combining with Other classNames Calls

```tsx
<th className={classNames(stickyLeftHeaderClasses, 'left-0')}>
```

## Benefits

1. **Readability**: Cleaner than template literals
2. **Maintainability**: Easy to add/remove conditions
3. **Type Safety**: Works seamlessly with TypeScript
4. **Performance**: Minimal overhead
5. **Consistency**: Standardized approach across the codebase

## Best Practices

### ✅ DO

```tsx
// Group base classes separately from conditionals
const classes = classNames(
  'base-class another-class',
  { 'conditional-class': condition }
);

// Use descriptive variable names
const buttonClasses = classNames(...);
const rowClasses = classNames(...);
```

### ❌ DON'T

```tsx
// Don't mix classNames with template literals
const bad = `${classNames('foo')} bar ${condition ? 'baz' : ''}`;

// Don't use for single static classes
const bad = classNames('just-one-class');  // Just use 'just-one-class'
```

## When to Use

- ✅ Multiple conditional classes
- ✅ Complex class logic
- ✅ Reusable class combinations
- ❌ Single static class (use string directly)
- ❌ Simple ternary with two options (template literal is fine)

## References

- [classnames on npm](https://www.npmjs.com/package/classnames)
- [GitHub Repository](https://github.com/JedWatson/classnames)
