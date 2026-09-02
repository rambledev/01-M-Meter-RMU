# RMU Meter Collection

ระบบบันทึกค่ามิเตอร์ไฟฟ้า — Mobile-first, Offline-first (MVP)

> สถานะ: **Phase 0 — Project Setup เท่านั้น** ยังไม่มี workflow จดมิเตอร์จริง
> ดูภาพรวมสถาปัตยกรรม/requirement เต็มใน [`docs/`](docs/) (เริ่มที่ [`docs/tech-stack.md`](docs/tech-stack.md))

## Approved Tech Stack (locked — see `docs/decision-log.md`)

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | 22.x |
| Framework | Next.js (App Router) | 16.3.4 |
| UI | React | 19.2.8 |
| Language | TypeScript | 5.9.3 |
| Styling | Tailwind CSS | 4.3.3 |
| ORM | Prisma / @prisma/client | 5.22.0 |
| Database | PostgreSQL | 17 |
| Package Manager | npm | — |

## Prerequisites

- Node.js 22.x
- npm
- Docker + Docker Compose (for PostgreSQL, and optionally the app container)

## Getting Started (local, without Docker)

```bash
npm install
cp .env.example .env   # then edit POSTGRES_PASSWORD etc. as needed
docker compose up -d db   # start PostgreSQL 17 only
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Getting Started (full stack via Docker Compose)

```bash
cp .env.example .env
docker compose up --build
```

This starts PostgreSQL 17 (`db`) and the Next.js app (`app`) together.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run a production build (after `npm run build`) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | TypeScript check only |

## Prisma

`prisma/schema.prisma` currently defines only the `datasource`/`generator` blocks —
**no models yet**. The real data model (Zone/Room/Meter/Reading/ReadingImage/User/SyncLog),
`prisma generate`, and migrations are Phase 1 work — see
[`docs/data-model.md`](docs/data-model.md).

## Project Structure

```
src/
├── app/            # Next.js App Router
└── lib/
    ├── db/         # Repository layer (Prisma) — Phase 1
    ├── offline/    # Dexie/IndexedDB offline data layer — Phase 2
    ├── sync/       # Online detection, auto-sync, retry — Phase 5
    ├── ocr/        # OCR provider wrapper — Phase 4
    └── export/     # Calculation Service + Excel generation — Phase 6
prisma/
└── schema.prisma   # datasource/generator only for now
docker-compose.yml  # PostgreSQL 17 + app
Dockerfile          # multi-stage, Next.js standalone output
```

Each `src/lib/*` folder has a short `README.md` explaining its responsibility until
the corresponding phase implements it — see [`docs/tech-stack.md`](docs/tech-stack.md) §5
for the full phase breakdown.
