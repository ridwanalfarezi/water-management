# KolamPintar Impeccable Baseline

Date: 2026-07-20  
Target: `apps/web` pond list and pond detail product surfaces  
Method: source review, bundled deterministic detector, and read-only browser inspection at 390px, 768px, and 1280px. This is the setup baseline, not a persisted `$impeccable critique` snapshot.

## Baseline result

The dashboard has a sound operational foundation: status labels use plain Indonesian, critical command states are modeled explicitly, the empty pond list teaches recovery, technical detail is progressively disclosed, and the tested layouts do not overflow horizontally.

The main opportunity is ordering. On the pond detail screen, secondary content and repeated containers push the physical-control workflow down the page. Mobile compounds this with a crowded header and touch targets that are smaller than the 44px field-use target captured in `PRODUCT.md`.

## Prioritized findings

### P1 — Operational controls appear after secondary AI content

- **Evidence:** The detail order is overview metrics, a fixed-height chart, two AI cards, journal cards, then dosing controls.
- **Impact:** An operator who needs to verify or change control mode must scroll past duplicated advice before reaching the safety-critical workflow.
- **Direction:** Keep current pH, connection, flow, control mode, recency, chart, and controls ahead of summaries and journals. Treat AI guidance as secondary evidence, not the screen's lead.
- **Suggested command:** `$impeccable layout the pond detail reading order around monitoring and safe control`

### P1 — Mobile header and control targets are undersized for field use

- **Evidence:** At 390px the back link measures approximately 28×32px; the select and primary buttons measure 35–37px tall. The header fits, but pond title, subtitle, logo, back action, and connection pill compete on one row.
- **Impact:** One-handed use beside a pond is less reliable, especially in bright light or when the operator is moving.
- **Direction:** Establish 44px minimum field targets and let mobile identity/status reflow without losing the written connection state.
- **Suggested command:** `$impeccable adapt the pond dashboard for 390px, 768px, and 1280px viewports`

### P2 — Unknown flow and mode copy duplicates itself

- **Evidence:** With no telemetry the flow card renders `Belum diketahui` for both flow and mode, producing `Belum diketahui Belum diketahui`.
- **Impact:** Repetition looks broken and does not tell the operator which hardware fact is missing.
- **Direction:** Label the two concepts explicitly or suppress the subordinate mode until telemetry exists.
- **Suggested command:** `$impeccable clarify unknown flow, control-mode, and no-telemetry states`

### P2 — The empty chart has disproportionate visual weight

- **Evidence:** `h-87.5` reserves 350px even when the only content is `Menunggu bacaan pH...`.
- **Impact:** The blank region delays controls and makes an offline pond feel emptier than it is informative.
- **Direction:** Use a compact no-data state with a reason, recovery cue, and expansion to the full chart only when readings exist.
- **Suggested command:** `$impeccable harden the pH chart loading, empty, offline, and stale-data states`

### P2 — Repetitive card treatment weakens hierarchy

- **Evidence:** Metrics, chart, AI advice, summary, journal, controls, and alert all use similarly bordered and rounded containers.
- **Impact:** Everything receives comparable visual weight, creating the generic SaaS-dashboard pattern named in `PRODUCT.md`.
- **Direction:** Reserve cards for independently actionable or stateful groups; use spacing, section rhythm, and quieter inline groupings for secondary content.
- **Suggested command:** `$impeccable distill the pond detail page without removing operational evidence`

### P2 — Reduced-motion behavior is not defined

- **Evidence:** Connection and critical status dots use pulse/ping animation, but the application stylesheet has no `prefers-reduced-motion` override.
- **Impact:** This misses the captured WCAG/field-use requirement and makes motion decorative rather than strictly state-serving.
- **Direction:** Disable repeating ping/pulse effects under reduced motion while preserving written status and a static dot.
- **Suggested command:** `$impeccable harden motion and status accessibility`

## Deterministic detector

After documenting the existing 10px and 11px type roles in `DESIGN.md`, the bundled detector reports one baseline warning:

- `overused-font` at `apps/web/app/layout.tsx:22`: global Inter loading.

Inter is intentionally preserved during setup. Handle it only through a dedicated `$impeccable typeset` review so typography, loading behavior, hierarchy, and brand fit change together.

## Recommended sequence

1. `$impeccable adapt the pond dashboard for 390px, 768px, and 1280px viewports`
2. `$impeccable harden loading, empty, offline, stale-data, error, reduced-motion, and command-acknowledgement states`
3. `$impeccable layout the pond detail reading order around monitoring and safe control`
4. `$impeccable clarify unknown flow and mode copy`
5. `$impeccable distill repetitive card treatments`
6. `$impeccable typeset the dashboard after the operational hierarchy is approved`
7. `$impeccable polish the pond dashboard`

Use `$impeccable live` selectively for the mobile header, connection/status hierarchy, pond summary, and empty chart. Do not use Live Mode to redesign the entire dashboard in one pass.
