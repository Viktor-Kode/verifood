# Verifood

Spot the red flags before you buy.

Verifood is a phone-friendly web app for shoppers in Abeokuta markets. Shoppers answer a few Yes/No questions about a packaged food product, see any red flags, and report problems onto a live market-level map.

Built by Team Auth for the Ogun Innovate Hackathon (Agritech track), 25 November 2026, Ogun Tech Hub, Abeokuta.

**Live app:** `<add the deployed URL>`

## The problem

A pack can look fine and still be unsafe. Shoppers cannot see inside it, cannot easily check it, and nobody warns the next shopper. NAFDAC has reported large seizures of unregistered food, warned about fake versions of popular products, and flagged expired goods sold with new dates.

## How it works

1. **Check.** Pick a product and tap Yes or No on a short checklist (NAFDAC number, batch and expiry, seal, print).
2. **Spot.** See any red flags. If there are none, the app says: "No red flags found. This does not prove the product is genuine."
3. **Report.** One tap sends a report about the product to the live map for your market area.

## Design principles

- Red flags, not proof. The app never says a product is "fake" or "genuine".
- Reports are about products, never sellers.
- Every report stays "unverified".
- Market-area level only. No names or phone numbers are kept.
- Sample reports are flagged `isDemo` and shown with a "Demo" label.
- Each device can send 5 reports per hour.
- Points users to NAFDAC (hotline 0800-162-3322).

## Tech stack

- **Frontend:** Next.js, TypeScript, Tailwind CSS
- **Backend:** Express (Node.js), MySQL
- **Hosting:** one Nobus Cloud VM, with nginx routing `/api` to Express and everything else to Next.js
- **Live updates:** the map polls the API every 3 seconds

## Project structure

```
verifood/
  frontend/          Next.js app
    public/products/   product pictures (file names stored in MySQL)
    src/api/client.ts  the one API client file
  backend/           Express API
  README.md
```

## Run locally

Requirements: Node.js 18+ and MySQL.

```bash
# Backend (port 5000)
cd backend
npm install
cp .env.example .env     # fill in the values below
npm run dev

# Frontend (port 3000)
cd frontend
npm install
npm run dev
```

Backend `.env`:

```
PORT=5000
DB_HOST=localhost
DB_USER=
DB_PASSWORD=
DB_NAME=verifood
```

## API

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/products` | List products |
| GET | `/api/products/:id` | A product with its checks |
| POST | `/api/reports` | Send a report (429 if over the limit) |
| GET | `/api/reports` | Reports for the map |

## Data

- `products`: name, brand, category, image file name
- `checks`: four checks per product, each with what to look for and a source link
- `reports`: product, market area, red flags, status, `is_demo`, device id, time

## Limits

- Verifood helps spot red flags on the outside of a pack. It cannot see inside a product or prove it is safe.
- Sample reports on the map are demo data.
- Product pictures are reference images. Compare them with the real pack.

## Team

Team Auth: Viktor (backend, data, deployment), plus two teammates on the shopper app, the map, content and pitch.