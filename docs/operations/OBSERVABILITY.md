---
title: Observability
status: scaffold
updated: 2026-10-09
---

# Observability

> How the system is watched: errors, logs, metrics, uptime, alerts and product analytics.

> **Status: scaffold.** The structure is set; nothing below that is not marked as current state has been decided. Fill it in with the owner, then change the status to `draft` and, once approved, `accepted`.

## Role

Defines what is recorded and what is never recorded, so problems are found quickly without capturing children's personal data.

## Read this when

- Adding logging, an event or an alert.
- Investigating an incident.

## To define

- [ ] Error tracking.
- [ ] Log format, levels, retention and personal-data scrubbing.
- [ ] Metrics and service-level objectives.
- [ ] Tracing, if any.
- [ ] Uptime checks and alert routing.
- [ ] Product analytics: events, naming, consent behavior.
- [ ] Dashboards.

## Current state

- Pulse hosts Plausible CE, Umami and Uptime Kuma, each a pinned upstream image. The frontend loads Plausible, Umami and Google Analytics 4 only after consent (`frontend/src/lib/analytics.tsx`).

## Related

- [[INFRASTRUCTURE]]
- [[SECURITY-GUIDE]]
- [[CHILD-SAFETY-AND-PRIVACY]]
- [[INCIDENT-RESPONSE]]
- [[FRONTEND-GUIDE]]
- [[BACKEND-GUIDE]]
- [[PERFORMANCE-AND-SCALING]]
- [[RATE-LIMITING-AND-ABUSE]]

Back to [[INDEX]].

## Update this document when

- A signal, event, alert or retention rule changes.
