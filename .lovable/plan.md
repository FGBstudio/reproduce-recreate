## Problem

The previous rewrite of `src/pages/Auth.tsx` left the old implementation appended below the new one. The file now contains two `const Auth = () => {...}` declarations and two `export default Auth;` statements (lines 7-42 new, lines 44-450 legacy), which esbuild rejects with:

- `The symbol "Auth" has already been declared`
- `Multiple exports with the same name "default"`

The dev server therefore fails to scan `index.html`, and the preview is broken.

## Fix

Truncate `src/pages/Auth.tsx` to the new implementation only:

- Keep lines 1-42 exactly as-is (imports, new `Auth` component, single `export default Auth`).
- Delete everything from line 43 to end of file (legacy `AuthMode` type, duplicate `Auth` component, duplicate default export, and any now-unused imports that lived only in the legacy block).

No other files need to change — `LoginForm`, `LoginModal`, `Globe3D`, `IdleOverlay`, `CityTicker`, and `FloatingBentoPanel` from the previous turn stay intact.

## Verification

After the edit, check the vite daemon log for a clean rebuild (no "already been declared" / "Multiple exports" errors) and confirm `/auth` renders the new landing.
