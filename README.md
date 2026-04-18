# StockWise MVP

Intelligent equity analysis platform — stock search, financial statements, price charts, and DCF valuation.

---

## Project Structure

```
stockwise/
├── backend/
│   ├── server.js              # Express entry point
│   ├── routes/
│   │   ├── company.js         # All API routes
│   │   └── health.js          # Health check
│   ├── controllers/
│   │   └── company.js         # Business logic
│   ├── services/
│   │   └── fmp.js             # Financial Modeling Prep API
│   ├── utils/
│   │   ├── cache.js           # Redis caching
│   │   ├── normalize.js       # Data normalization
│   │   └── dcf.js             # DCF engine
│   ├── db/
│   │   └── schema.sql         # PostgreSQL schema
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── pages/
    │   ├── _app.js            # App wrapper + nav
    │   ├── index.js           # Search page
    │   └── stock/[ticker].js  # Stock detail page
    ├── components/
    │   ├── CompanyHeader.js   # Price, stats, 52w range
    │   ├── PriceChart.js      # Recharts area chart
    │   ├── FinancialTable.js  # Income / Balance / CF
    │   └── DCFTool.js         # Full DCF calculator
    ├── lib/
    │   └── api.js             # API helper functions
    ├── styles/
    │   └── globals.css        # Tailwind + design system
    ├── next.config.js
    ├── tailwind.config.js
    └── package.json
```

---

## API Routes

| Method | Route                          | Description                  |
|--------|--------------------------------|------------------------------|
| GET    | /api/health                    | Health check                 |
| GET    | /api/company/search?q=apple    | Search tickers               |
| GET    | /api/company/:ticker           | Company overview + price     |
| GET    | /api/company/:ticker/financials| Income, balance, cash flow   |
| GET    | /api/company/:ticker/chart     | Historical price data        |
| POST   | /api/company/:ticker/dcf       | Run DCF valuation            |

DCF POST body:
```json
{
  "growthRate": 0.10,
  "discountRate": 0.10,
  "terminalGrowth": 0.03,
  "forecastYears": 10
}
```

---

## Local Setup — Step by Step

### 1. Get your API keys (free tiers available)

- **Financial Modeling Prep**: https://financialmodelingprep.com/developer/docs
  - Free tier: 250 requests/day. Sufficient for testing.
- **Polygon.io**: https://polygon.io
  - Free tier: real-time data limited, historical data available.

### 2. Install PostgreSQL locally

**Mac:**
```bash
brew install postgresql@15
brew services start postgresql@15
createdb stockwise
```

**Windows:**
Download from https://www.postgresql.org/download/windows

**Create the schema:**
```bash
psql stockwise < backend/db/schema.sql
```

### 3. Install Redis locally

**Mac:**
```bash
brew install redis
brew services start redis
```

**Windows:**
Download from https://github.com/microsoftarchive/redis/releases

### 4. Set up the backend

```bash
cd backend
cp .env.example .env
```

Edit `.env` and fill in your values:
```
PORT=4000
DATABASE_URL=postgresql://localhost:5432/stockwise
REDIS_URL=redis://localhost:6379
FMP_API_KEY=your_key_here
POLYGON_API_KEY=your_key_here
FRONTEND_URL=http://localhost:3000
```

Install and run:
```bash
npm install
npm run dev
```

Backend runs at: http://localhost:4000
Test it: http://localhost:4000/api/health

### 5. Set up the frontend

```bash
cd frontend
cp .env.example .env.local
```

`.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Install and run:
```bash
npm install
npm run dev
```

Frontend runs at: http://localhost:3000

---

## Deployment — Production

### Backend → Railway (recommended, free tier available)

1. Create account at https://railway.app
2. Create a new project → Deploy from GitHub repo
3. Add a PostgreSQL service (Railway provides it free)
4. Add a Redis service (Railway provides it free)
5. Set environment variables in Railway dashboard:
   ```
   PORT=4000
   DATABASE_URL=<auto-filled by Railway>
   REDIS_URL=<auto-filled by Railway>
   FMP_API_KEY=your_key
   POLYGON_API_KEY=your_key
   FRONTEND_URL=https://your-frontend.vercel.app
   NODE_ENV=production
   ```
6. Run schema: In Railway console → `psql $DATABASE_URL < db/schema.sql`
7. Railway auto-deploys on every push to main branch.

Your backend URL will be something like: https://stockwise-backend.railway.app

### Frontend → Vercel (free tier)

1. Create account at https://vercel.com
2. Import your GitHub repo → select the `frontend` folder as root
3. Set environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://stockwise-backend.railway.app
   ```
4. Click Deploy.

Your app is live at: https://stockwise-xyz.vercel.app

---

## Week-by-Week Build Plan

### Week 1 — Foundation
- Set up repo on GitHub (backend + frontend folders)
- Get FMP and Polygon API keys
- Install PostgreSQL and Redis locally
- Get the backend health check running: GET /api/health
- Get the frontend search page loading

**Goal: Search a ticker and see the company name and price.**

### Week 2 — Data Pipeline
- Wire up GET /api/company/:ticker (company overview)
- Wire up GET /api/company/:ticker/financials
- Build CompanyHeader component
- Build FinancialTable component with income statement

**Goal: Search AAPL, see full financial statements.**

### Week 3 — Chart + Balance Sheet + Cash Flow
- Wire up GET /api/company/:ticker/chart
- Build PriceChart with 1Y/3Y/5Y toggle
- Add balance sheet and cash flow tabs to FinancialTable
- Add caching (Redis) to all endpoints

**Goal: Full stock page with chart and all 3 financial statements.**

### Week 4 — DCF Engine
- Build POST /api/company/:ticker/dcf backend
- Build DCFTool frontend component with sliders
- Show step-by-step cash flow projection table
- Show intrinsic value vs current price

**Goal: Run a DCF on any stock with a one-click calculation.**

### Week 5 — Polish + Testing
- Fix edge cases (negative FCF, missing data)
- Mobile responsive check
- Add error handling messages
- Test with 10 different tickers
- Share with 5 real users for feedback

### Week 6 — Deploy + Launch
- Push to GitHub
- Deploy backend to Railway
- Deploy frontend to Vercel
- Share with first beta users
- Collect feedback for v2 feature prioritisation

---

## Success Criteria (MVP)

- [ ] User can search any stock ticker
- [ ] Company overview loads in under 3 seconds
- [ ] Financial statements display clearly for 5 years
- [ ] Price chart shows with 1Y/3Y/5Y toggle
- [ ] DCF runs and shows intrinsic value with breakdown
- [ ] App works on mobile
- [ ] Deployed live at a public URL

---

## Future Features (Post-MVP)

These are deliberately excluded from MVP. Build only after validating:

- User accounts and saved watchlists
- Community valuations and comments
- Portfolio tracker with P&L
- Financial ratios (P/E, ROE, ROA comparisons)
- Peer/competitor comparison
- Email alerts for price targets
- Mobile app (React Native)
- Subscription paywall

---

## Notes

- The app works without Redis (falls back to direct API calls, just slower)
- FMP free tier (250 req/day) is enough for testing and early users
- All financial values are stored in millions USD internally
- The DCF engine requires positive Free Cash Flow — add a message for FCF-negative companies
