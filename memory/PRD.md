# PRD — Studio01 Barbearia

## Problem Statement
Barbershop "Studio01 Barbearia" (CNPJ 62.773.547/0001-87) needs a website where clients pick their own appointment time directly online, with an auto-updating time grid. Services & prices provided (Barba, Cavanhaque, Coloração, Corte Simples R$20, Corte Degradê R$40, Corte Todo na Tesoura, Corte Degradê+Tesoura, Pézinho, Pigmentação, Platinado/Nevou, Reflexo/Luzes, Sobrancelha).

## User Choices
- Auth: Login with account (email + password, JWT via httpOnly cookie)
- Admin panel password-protected (owner: filipe.capoli@gmail.com)
- Hours: Tuesday–Saturday 09:00–19:00 (updated 2026-06), 40-min slots (peak days after 19:00 = first-come at counter)
- Confirmation: on-screen + WhatsApp link
- Multiple barbers (3 seeded)

## Architecture
- Backend: FastAPI + MongoDB (motor). JWT auth (bcrypt), collections: users, barbers, appointments, blocks.
- Endpoints: /api/auth/*, /api/services, /api/barbers, /api/config, /api/availability, /api/appointments(+me, cancel), /api/admin/*(appointments, status, blocks, metrics)
- Frontend: React 19 + Tailwind v4 + framer-motion. Pages: Home (/), Admin (/admin). Dark monochrome barbershop theme (Barlow Condensed headings, amber accents).

## Personas
- Client: registers/logs in, picks services+barber+date+time from live grid, confirms, opens WhatsApp, views/cancels own appointments.
- Owner/Admin: views daily grid per barber, blocks/unblocks slots, confirms/cancels appointments, sees metrics (revenue, occupancy).

## Implemented (2026-06)
- Full booking flow with auto-refreshing slot grid (20s poll) — DONE
- JWT auth (register/login/logout/me) — DONE
- Services menu with prices, barbers section — DONE
- My appointments (view + cancel) — DONE
- Admin dashboard: metrics, per-barber time grid, block toggle, status management — DONE
- Tested: 100% backend + frontend pass (iteration_1)

- Real shop WhatsApp 5521972016917 — DONE
- Admin barbers CRUD (add/edit/remove) — DONE
- Day-before email reminder (Resend managed + cron 18:00 America/Sao_Paulo → POST /api/cron/reminders) — DONE
- Tested: iteration_2 100% pass

- Client reschedule (same barber, new date/time, live grid) — DONE (iteration_3 100%)

- Location Rua Guará 10, Penha Circular – RJ; barbers Capoli & Novaes; public "Painel Admin" links (nav + footer) — DONE

- Barber photo upload (Emergent Object Storage), Google Maps location section, per-barber days/hours — DONE (iteration_4 100%)

## Backlog / Next
- P1: Real WhatsApp number of the shop (currently placeholder 5511999999999)
- P1: Admin CRUD for barbers (add/remove/edit)
- P2: Email confirmation (Resend)
- P2: Reschedule flow for clients
- P2: Reflect appointment duration across multiple slots (currently single-slot booking)
