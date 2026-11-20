<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Every new feature gets a walkthrough

When you add or change a user-facing feature, also:
1. Add a What's New entry at the top of `UPDATES` in `src/lib/whats-new.ts`.
2. Add a guided walkthrough for it in `TOURS` in `src/lib/tours.ts`, keyed by that entry's `id`. Put `data-tour="…"` on each element a step highlights. Then check each step in a browser and make sure its target is on screen. Pages outside the admin layout need `<GuidedTour />` mounted (see `src/app/dj-dashboard/flyers/layout.tsx`).
3. If the feature is on a client-facing page that a tour can't run on, put the walkthrough on the admin controls for it and finish with a step pointing to the client view.
