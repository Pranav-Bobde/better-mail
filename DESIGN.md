## Overview

This app uses a shadcn-style product UI system for a dense mail workspace. It is not
a marketing site system. The design should feel quiet, utilitarian, dark-first, and
built for repeated scanning: folders, message lists, selected email content, reply
controls, and compact toolbars.

The source of truth is the current code:

- Theme tokens: `packages/ui/src/styles/globals.css`
- shadcn config: `packages/ui/components.json` and `apps/web/components.json`
- App theme default: `apps/web/src/shared/components/providers.tsx`
- App shell: `apps/web/src/features/mail/components/*`
- Fonts: `apps/web/src/app/layout.tsx`

When code and this doc disagree, update this doc or the code immediately. Do not
silently keep stale design guidance.

## Product Feel

- Domain: mail client / AI email workspace.
- Primary mode: dark-first product app.
- Visual posture: compact, neutral, paneled, low decoration.
- Interaction posture: keyboard-friendly, icon-first toolbars, resizeable panes,
  clear active states.
- Density: high enough for inbox triage, but not spreadsheet-tight.

Avoid landing-page composition. No hero bands, mesh gradients, marketing CTA pills,
decorative blobs, illustrative sections, or long explanatory text inside the app UI.

## Theme Source

The project uses shadcn CSS variables. Components should use semantic tokens such as
`bg-background`, `text-foreground`, `border-border`, `bg-muted`, `text-muted-foreground`,
`bg-primary`, and `text-primary-foreground`.

Prefer semantic palette tokens in app components. Keep hardcoded color utilities narrow
and intentional when they match the current shadcn mail pattern:

- Unread mail dot: `bg-blue-600`
- Tabs trigger text: `text-zinc-600 dark:text-zinc-200`
- Active dark sidebar row/text: `dark:bg-muted`, `dark:text-white`, and related hover
  states

Do not add new hardcoded palette utilities without first checking whether a semantic
token already covers the state.

Current shadcn config:

- Style: `base-lyra`
- Base color config: `neutral`
- CSS variables: `true`
- Icon library: `lucide`
- Radius token: `0.5rem`
- Fonts: Geist Sans and Geist Mono from Next font

The generated CSS tokens are a neutral/zinc-like HSL palette. Treat the semantic token
names as the contract, not the exact hue family label.

## Color System

### Light Tokens

- Background: `hsl(0 0% 100%)`
- Foreground: `hsl(240 10% 3.9%)`
- Card/popover: `hsl(0 0% 100%)`
- Primary: `hsl(240 5.9% 10%)`
- Primary foreground: `hsl(0 0% 98%)`
- Secondary/muted/accent: `hsl(240 4.8% 95.9%)`
- Muted foreground: `hsl(240 3.8% 46.1%)`
- Border/input: `hsl(240 5.9% 90%)`
- Ring: `hsl(240 5.9% 10%)`
- Destructive: `hsl(0 84.2% 60.2%)`

Light mode should look clean and shadcn-native, but it is secondary to dark mode.

### Dark Tokens

- Background: `hsl(240 10% 3.9%)`
- Foreground: `hsl(0 0% 98%)`
- Card/popover: `hsl(240 10% 3.9%)`
- Primary: `hsl(0 0% 98%)`
- Primary foreground: `hsl(240 5.9% 10%)`
- Secondary/muted/accent: `hsl(240 3.7% 15.9%)`
- Muted foreground: `hsl(240 5% 64.9%)`
- Border/input: `hsl(240 3.7% 15.9%)`
- Ring: `hsl(240 4.9% 83.9%)`
- Destructive: `hsl(0 62.8% 30.6%)`

Dark mode is the default via `ThemeProvider defaultTheme="dark"`. New UI should be
checked in dark mode first.

### Sidebar Tokens

Sidebar tokens mirror the same semantic palette:

- Light sidebar: white surface, dark text, neutral border/accent.
- Dark sidebar: app background, light text, dark muted/accent surfaces.

Use `bg-background` and `border-border` for the current mail shell unless a dedicated
sidebar primitive is introduced.

## Typography

The app uses Geist Sans for all normal UI text and Geist Mono for technical labels
only when needed.

- Body text: `text-sm` or `text-xs`
- Toolbar/control text: `text-sm`, medium weight when active
- Pane headings: `text-xl font-bold` only for top-level pane titles such as `Inbox`
- Card/list item title: `font-semibold`
- Metadata: `text-xs text-muted-foreground`

Do not use hero-scale typography. Do not use negative tracking. Do not use all-caps
labels unless a component pattern explicitly requires a small technical label.

## Layout

The main screen is a three-pane mail workspace:

- Left navigation pane: folders, categories, account switcher, theme toggle.
- Middle list pane: search, tabs, scrollable message cards.
- Right detail pane: message toolbar, sender metadata, body, reply form.

Resizable pane defaults:

- Sidebar: `20%`
- Message list: `32%`
- Message detail: `48%`

Resizable pane hard limits:

- Sidebar expanded min/max: `15%` to `20%`
- Sidebar collapsed size: `4%`
- Message list min: `30%`
- Message detail min: `340px` to keep the toolbar readable at tablet widths

Use stable pane dimensions. Resize handles must not allow text overlap, broken toolbar
layout, or unreadable controls.

Mobile behavior is intentionally limited right now: the mail example is hidden under
desktop/tablet breakpoint and shows a simple availability message.

## Surfaces

Surfaces are flat and border-led.

- Page: `bg-background text-foreground`
- App shell: `rounded-lg border bg-background shadow`
- Pane dividers: `Separator` / `border-border`
- Search area: `bg-background/95` with backdrop blur support
- List cards: `rounded-lg border p-3`
- Selected list card: `bg-muted`
- Hover state: `hover:bg-accent`

Use subtle shadows only where the current shadcn component already applies them
(`shadow`, `shadow-sm`). Avoid heavy elevation.

## Shape

The radius source is `--radius: 0.5rem`.

Component radius behavior:

- Buttons: `rounded-md`
- Inputs/textareas: `rounded-md`
- Tabs list: `rounded-lg`
- Tabs trigger: `rounded-md`
- Badges: `rounded-md`
- Mail cards: `rounded-lg`
- App shell: `rounded-lg`

Do not increase card radius beyond the existing shadcn scale. The app should feel
sharp and operational, not soft or playful.

## Components

### Buttons

Use `Button` / `buttonVariants` from `@code-main/ui`.

- Default: primary filled action.
- Ghost: icon toolbar buttons and sidebar inactive rows.
- Outline: low-priority framed controls.
- Destructive: destructive intent only.
- Icon sizes: use `size="icon"` for toolbar icons.
- Text button sizes: `sm` for dense app rows, default for normal forms.

Toolbar buttons should be icon-first with tooltips and accessible `sr-only` text.

### Inputs And Textareas

Inputs are `h-9`, `rounded-md`, `border-input`, `bg-transparent`, `text-sm`, and use
`focus-visible:ring-1`.

Reply textarea stays simple and framed. Do not add rich text chrome until the editor
feature exists.

### Tabs

Tabs are compact segmented controls:

- List: `h-9`, `rounded-lg`, `bg-muted`, `p-1`
- Trigger: `rounded-md`, `text-sm`, active `bg-background text-foreground shadow`

Use tabs for real view switches such as `All mail` and `Unread`.

### Badges

Badges are small metadata chips:

- `default`: prominent semantic label
- `secondary`: normal low-emphasis label
- `outline`: personal/non-work style labels

Do not use badges as decoration.

### Resizable Panels

Use `ResizablePanelGroup`, `ResizablePanel`, and `ResizableHandle`.

- Handles are visible enough for desktop interaction.
- Use `withHandle` on pane separators.
- Persist layout with cookies only for UI preference.
- Keep pane ids stable if persisted layout support is extended.

### Tooltips

Tooltips are required for icon-only controls that are not immediately obvious. The
app wraps content in `TooltipProvider`.

## Iconography

Use lucide icons by default. Use custom SVGs only when lucide does not provide the needed brand/logo/specialized icon, and keep those SVGs scoped to the component that needs them.

Expected patterns:

- Archive, trash, junk, snooze, reply, reply-all, forward in mail toolbar.
- Inbox, file, send, archive, users, alert, messages, cart in sidebar.
- Icons should usually be `size-4`.
- Icon-only buttons should have `sr-only` text and tooltip labels.

## Interaction

- Active sidebar row uses the default button variant.
- Inactive sidebar rows use ghost.
- Selected mail item uses `bg-muted`.
- Unread mail uses a small blue dot.
- Disabled toolbar actions use button disabled styling.
- Resize should feel stable, bounded, and non-destructive.
- Theme switching must use the app theme provider. Dark-specific classes are allowed
  only for the current shadcn mail parity overrides listed in the theme section.

## Accessibility

- Icon-only actions need accessible names through `sr-only` text or labels.
- Tooltips are supplemental, not the only accessible name.
- Focus states use `focus-visible:ring-1 focus-visible:ring-ring`.
- Inputs and textareas keep visible focus rings.
- Collapsed sidebar nav uses tooltips and `sr-only` labels.

## Do

- Use semantic shadcn tokens.
- Keep dark mode as the first QA target.
- Keep mail UI dense, bordered, and scannable.
- Use `bg-muted`, `bg-accent`, and `border-border` for state and structure.
- Use `text-muted-foreground` for timestamps, placeholders, and low-priority copy.
- Use lucide icons for tools and navigation.
- Keep page sections full-screen/app-shell oriented.
- Keep component copy short and operational.

## Don't

- Do not use the old Vercel marketing hero guidance.
- Do not use mesh gradients, gradient orbs, decorative blobs, or marketing imagery.
- Do not create landing pages for the app screen.
- Do not use oversized headlines inside panes.
- Do not hardcode arbitrary grays when a semantic token exists.
- Do not use cards inside cards.
- Do not add heavy shadows or high-radius surfaces.
- Do not add visible instructional text explaining how to use the UI.

## QA Checklist

Before calling a UI change done:

- Dark mode checked.
- Light mode sanity checked if the change touches tokens or contrast.
- Desktop pane layout checked at normal browser width.
- Text does not overlap at pane min sizes.
- Icon-only controls have labels/tooltips.
- `pnpm run verify` passes.
