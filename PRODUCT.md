# Product

## Register

product

## Platform

web

## Users

KolamPintar primarily serves pond operators who need to understand water conditions and act safely from a phone or desktop, often outdoors and under time pressure. Competition judges are the secondary audience: the interface should make the system's real telemetry, control feedback, and resilience easy to verify without turning the product into a marketing demo.

## Product Purpose

KolamPintar monitors pond pH from a physical ESP32, records operational context, and controls an acid-dosing solenoid. Success means an operator can quickly tell whether the pond and device are safe, understand what the system is doing, and confirm whether a requested control change reached the hardware. Local automatic control continues when Wi-Fi, MQTT, or the web dashboard is unavailable.

## Positioning

Reliable pond pH monitoring and local automatic dosing that keeps protecting the pond even when the network is lost.

## Brand Personality

Calm, clear, dependable. The interface should reassure through precise status, plain Indonesian copy, and visible evidence. It should feel operational and trustworthy without becoming cold, intimidating, or over-decorated.

## Anti-references

Do not resemble a generic SaaS dashboard: no decorative gradients, glass effects, repetitive card grids, vague AI-first messaging, or startup-template polish that competes with pond status and control safety.

## Design Principles

- **Status before decoration.** Current pH, connection, control mode, flow state, freshness, and risk must be understood before secondary content.
- **Every control earns trust.** Separate requested, sent, applied, late, rejected, and timed-out states; never imply physical flow from a command alone.
- **Readable in the field.** Optimize for daylight, one-handed mobile use, short scan paths, resilient layouts, and plain language.
- **Disclose technical detail progressively.** Show operator-facing meaning first and retain device identifiers, relay details, and protocol evidence behind explicit disclosure.
- **Demonstrate with evidence.** Competition presentation should rely on real telemetry, acknowledgements, offline behavior, and traceable records rather than decorative claims.

## Accessibility & Inclusion

Target WCAG 2.2 AA. All important states must be communicated with text or iconography as well as color, keyboard focus must remain visible, status changes must be announced where appropriate, and motion must respect `prefers-reduced-motion`. Layout and contrast must remain readable on mobile screens in bright ambient light and at browser zoom up to 200%.
