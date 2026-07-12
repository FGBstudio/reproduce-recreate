## Goal
In the region overlay (left "regional performance" card on the map), clicking a site row inside any of the 4 KPI popovers/drawers must open that site's dashboard, exactly like clicking its map marker.

## Files to change

### 1. `src/pages/Index.tsx`
Pass the existing `handleProjectSelect` handler down to `RegionOverlay`:
```tsx
<RegionOverlay
  currentRegion={currentRegion}
  visible={...}
  activeFilters={activeFilters}
  onProjectSelect={handleProjectSelect}
/>
```

### 2. `src/components/dashboard/RegionOverlay.tsx`
- Extend `RegionOverlayProps` with `onProjectSelect?: (project: Project) => void`.
- Build a resolver `resolveProject(siteId?: string, name?: string): Project | undefined` that looks up `regionProjects` by `siteId` first, then by `name` as a fallback (needed for `siteAqList`/`siteAlertsList` which come from `aggregated.*` and for `siteStatusList` which already has the project name).
- Enrich the four list data structures so each row carries a stable identifier:
  - `siteIntensityList` already has `siteId` → pass through.
  - `siteAqList` map from `aggregated.sitesWithAir` → also include `siteId`.
  - `siteAlertsList` map from `aggregated.sites` → also include `siteId`.
  - `siteStatusList` map from `regionProjects` → include the full `project` reference.
- Wrap each row in the 4 desktop popovers and 4 mobile drawer sections in a `<button>` (keeping current styling classes) whose `onClick` runs:
  ```ts
  const p = resolveProject(row.siteId, row.name);
  if (p && onProjectSelect) {
    onProjectSelect(p);
    setMobileDrawerContent(null); // close drawer on mobile
  }
  ```
- Rows without a match stay non-clickable (no cursor change) so mock/demo entries don't break.

## Out of scope
- No changes to marker click flow, KPI calculations, or list ordering.
- No new translations or icons.
