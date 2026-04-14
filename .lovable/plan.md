

# Fix Timeline Milestone Names

## Problem
For timeline milestones, the `category` column is set to the literal string `"Timeline"`, while the actual phase name (e.g., "Pre-assessment", "Construction phase", "LEED GC training") is stored in the `requirement` column. The code currently maps `title: m.category`, resulting in every timeline item showing "Timeline" as its name.

## Fix
One line change in `src/components/dashboard/ProjectDetail.tsx` at line 4660:

**Before:**
```tsx
title: m.category,
```

**After:**
```tsx
title: m.requirement || m.category,
```

This uses the `requirement` field (which contains the real phase name) as the display title, falling back to `category` if `requirement` is empty. No other files need changes.

