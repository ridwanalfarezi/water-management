---
name: KolamPintar
description: A calm field dashboard for reliable pond pH monitoring and control.
colors:
  operational-blue: "#1457d4"
  operational-blue-deep: "#023990"
  acid-lime-accent: "#cfe416"
  field-background: "#fafafa"
  surface: "#ffffff"
  ink: "#09090b"
  ink-soft: "#18181b"
  border: "#e4e4e7"
  muted-surface: "#f4f4f5"
  muted-ink: "#71717a"
  safe: "#10b981"
  safe-surface: "#ecfdf5"
  safe-ink: "#064e3b"
  warning: "#f59e0b"
  warning-surface: "#fffbeb"
  warning-ink: "#92400e"
  critical: "#ef4444"
  critical-surface: "#fef2f2"
  critical-ink: "#7f1d1d"
  informational: "#0ea5e9"
  informational-surface: "#f0f9ff"
  informational-ink: "#075985"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.0125em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.333
    letterSpacing: "0.025em"
  technical:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.333
  micro:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.05em"
rounded:
  sm: "2px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.operational-blue}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.operational-blue-deep}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.field-background}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "24px"
  input:
    backgroundColor: "{colors.field-background}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  status-safe:
    backgroundColor: "{colors.safe-surface}"
    textColor: "{colors.safe-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  status-warning:
    backgroundColor: "{colors.warning-surface}"
    textColor: "{colors.warning-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  status-critical:
    backgroundColor: "{colors.critical-surface}"
    textColor: "{colors.critical-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
---

# Design System: KolamPintar

## Overview

**Creative North Star: "The Field Instrument"**

KolamPintar should feel like a dependable instrument an operator can read beside a pond in bright daylight: quiet at rest, unmistakable when attention is required, and explicit whenever a control request crosses from the dashboard to physical hardware. The interface serves the task; it does not perform for the user.

The visual system is restrained and state-led. Operational blue establishes identity, semantic colors communicate pond and device conditions, and the acid-lime brand accent remains rare. Familiar components and plain Indonesian copy build trust. The system explicitly rejects the generic SaaS dashboard: decorative gradients, glass surfaces, repetitive cards, and vague AI-first emphasis are forbidden.

**Key Characteristics:**

- Calm, compact, and readable in bright ambient light.
- Status text and hardware evidence always accompany color.
- Familiar controls with explicit focus, disabled, loading, and acknowledgement states.
- Technical detail is available through progressive disclosure.
- Competition credibility comes from real telemetry and traceable behavior.

## Colors

The palette is a restrained field palette: neutral surfaces carry the interface, operational blue marks identity and primary actions, and semantic colors are reserved for system meaning.

### Primary

- **Operational Blue:** Brand identity, active navigation, and primary actions.
- **Operational Blue Deep:** Brand headings and stronger hover emphasis.

### Secondary

- **Acid-Lime Accent:** A rare identity accent derived from the existing logo. It must never become a general status color or decorative wash.

### Tertiary

- **Safe Green:** Normal pond conditions, confirmed success, and connected states.
- **Attention Amber:** Conditions that need inspection or an uncertain/timed-out command.
- **Critical Red:** Disconnection, rejected actions, and conditions requiring immediate attention.
- **Informational Sky:** Waiting-for-data and neutral informational states.

### Neutral

- **Field Background:** The primary page canvas.
- **Surface:** Cards, controls, and elevated content areas.
- **Ink:** Primary labels, values, and action text.
- **Muted Ink:** Supporting text only; never use it for critical instructions or small placeholder text without a contrast check.
- **Border and Muted Surface:** Structural separation and secondary grouping.

### Named Rules

**The Meaning Before Hue Rule.** Every semantic color must be paired with a written label or recognizable icon; color alone never carries status.

**The Rare Accent Rule.** Acid-lime is identity punctuation, not decoration. It should occupy less than ten percent of any screen.

## Typography

**Display Font:** Inter (with the existing UI sans-serif and system fallbacks)

**Body Font:** Inter (with the existing UI sans-serif and system fallbacks)

**Character:** A single familiar sans-serif supports dense operational reading and predictable control labels. Inter is preserved as the current product font; changing it requires a dedicated typography review rather than an isolated detector fix.

### Hierarchy

- **Display** (700, 1.5rem, 1.25): Primary readings and exceptional page-level emphasis.
- **Title** (600, 1rem, 1.25): Page and card headings.
- **Body** (400, 0.875rem, 1.625): Guidance, explanations, and journal content, capped around 70 characters where prose runs long.
- **Label** (500, 0.75rem, 1.333): Status, metadata, and control labels. Uppercase is limited to very short measurement labels.
- **Technical** (400, 0.6875rem, 1.333): Device identifiers and protocol evidence inside progressive disclosure.
- **Micro** (500, 0.625rem, 1.2): Existing short badges and measurement units only; never instructional text.

### Named Rules

**The Reading Order Rule.** Current value, written status, and recency outrank explanation, history, and technical detail.

**The Fixed Product Scale Rule.** Product typography uses stable rem sizes; fluid display type and oversized marketing headings are prohibited.

## Elevation

The system is flat by default and uses borders plus light tonal layering for structure. Small shadows indicate a genuinely raised or interactive surface, such as a hoverable pond card or selected pond tab; they are never decorative atmosphere.

### Shadow Vocabulary

- **Resting Surface** (`0 1px 3px rgb(0 0 0 / 0.10), 0 1px 2px -1px rgb(0 0 0 / 0.10)`): Existing cards and compact status pills.
- **Interactive Lift** (`0 4px 6px -1px rgb(0 0 0 / 0.10), 0 2px 4px -2px rgb(0 0 0 / 0.10)`): Hoverable pond cards only.

### Named Rules

**The Flat-By-Default Rule.** Borders organize resting content. Shadow appears only to communicate selection, hover, or elevation.

## Components

Components are refined and restrained: familiar shapes, compact spacing, plain labels, and complete system states.

### Buttons

- **Shape:** Gently rounded rectangle (6px radius) with at least 8px vertical and 16px horizontal padding.
- **Primary:** Operational blue with white text; reserved for the safest recommended action.
- **Hover / Focus:** Darken or reduce opacity without moving layout. Focus uses a visible two-pixel ring with offset.
- **Secondary:** Neutral surface with a full border. Destructive or dosing actions must not borrow the primary treatment without a clear semantic reason.
- **Disabled / Loading:** Disabled remains legible and non-interactive. Loading keeps the action label or clearly states what is being applied.

### Chips

- **Style:** Full-pill status treatment with tinted semantic background, dark same-hue text, and a compact dot only as reinforcement.
- **State:** Selected pond tabs may use a raised neutral surface; connection and water statuses always include text.

### Cards / Containers

- **Corner Style:** Moderately rounded (12px radius).
- **Background:** White or a semantic tint when the whole container represents one state.
- **Shadow Strategy:** Resting Surface by default; Interactive Lift only on clickable pond summaries.
- **Border:** A full one-pixel structural or same-hue semantic border.
- **Internal Padding:** 20px for compact pond summaries and 24px for standard content cards.

### Inputs / Fields

- **Style:** Neutral field background, one-pixel border, 6px radius, and 8px by 12px internal padding.
- **Focus:** Visible two-pixel focus treatment; never remove focus without a replacement.
- **Error / Disabled:** Error text names the problem and recovery action. Disabled fields retain readable labels and do not rely on opacity alone.

### Navigation

- **Style:** Sticky top bar with compact identity, written current location, and explicit device/data status.
- **States:** Links use familiar hover and focus behavior. Pond selection uses a visible active surface and must wrap or scroll safely when pond count grows.
- **Mobile:** Preserve a 44px minimum touch target and prevent the title, back action, and connection status from competing for the same line.

### Pond Status Summary

The signature pond summary combines pond name, written condition, pH value, recency, and one clear entry action. Semantic tint supports scanning, but the written status and timestamp remain authoritative.

## Do's and Don'ts

### Do:

- **Do** lead every pond screen with pH, connection, control mode, flow state, and freshness in a stable reading order.
- **Do** distinguish requested, sent, applied, late, rejected, and timed-out control states in plain Indonesian.
- **Do** pair semantic color with text and preserve WCAG 2.2 AA contrast, keyboard focus, reduced motion, and 200% zoom behavior.
- **Do** keep secondary AI summaries, journals, and device identifiers below operational status or behind progressive disclosure.
- **Do** use the existing 6px control radius, 12px card radius, and 4px-based spacing rhythm consistently.

### Don't:

- **Don't** resemble a generic SaaS dashboard through decorative gradients, glass effects, vague AI-first messaging, or an endless grid of identical cards.
- **Don't** imply physical liquid flow merely because a command was published or acknowledged.
- **Don't** use color, animation, or a pulsing dot as the only carrier of risk or connectivity.
- **Don't** introduce new fonts, radii, shadows, or hard-coded colors without updating this design system.
- **Don't** let competition presentation displace the operator's primary monitoring and safety tasks.
