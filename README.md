# 🚗 Cardle — Daily Car Price Guessing Game

Cardle is a Wordle-inspired daily game where players guess the auction sale price of real cars. Each day features 5 cars with details from real auction results. Score points based on how close your guess is to the actual sold price.

## Features

- **Daily Challenge**: 5 cars per day, same for all players, resets at midnight EST
- **Practice Mode**: Unlimited random games to hone your skills
- **Scoring System**: Up to 1,000 points per car (5,000 max per game) based on guess accuracy
- **User Accounts**: Register to track stats, streaks, and game history
- **Share Scores**: Wordle-style sharing with emoji grid and link
- **Guest Play**: Play without an account (daily game tracked by session)
- **Professional Dark UI**: Automotive-themed design with smooth animations

## Scoring

| Emoji | Points    | Rating    | Accuracy   |
|-------|-----------|-----------|------------|
| 🟩    | 950–1,000 | Spot On   | Within 5%  |
| 🟩    | 850–949   | Excellent | Within 15% |
| 🟨    | 700–849   | Good      | Within 30% |
| 🟧    | 400–699   | Fair      | Within 60% |
| 🟥    | 1–399     | Poor      | Within 100%|
| ⬛    | 0         | Miss      | Over 100%  |

**Formula**: `Score = 1000 × (1 − |guess − actual| / actual)`

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+ (tested with Node 24)
- npm

### Setup

```bash
git clone <your-repo-url>
cd carguessr
npm install
```

### Run in Development

```bash
npm run dev
```

This starts:
- **Express API server** on `http://localhost:3001`
- **Vite dev server** on `http://localhost:5173` (with API proxy)

Open `http://localhost:5173` in your browser.

### Production Build

```bash
npm run build
npm start
```

The Express server serves the built React app from `dist/` on port 3001.

## Tech Stack

| Layer     | Technology              |
|-----------|------------------------|
| Frontend  | React 18 + Vite        |
| Styling   | Tailwind CSS 3         |
| Backend   | Express.js             |
| Database  | SQLite via sql.js      |
| Auth      | JWT + bcrypt           |
| Routing   | React Router 6         |

## Project Structure

```
carguessr/
├── server/
│   ├── index.js            # Express server entry
│   ├── db.js               # Database (SQLite), scoring, daily car selection
│   ├── middleware/auth.js   # JWT authentication middleware
│   ├── routes/auth.js       # Register, login, profile
│   ├── routes/game.js       # Daily game, practice, sharing, stats
│   └── data/cars.json       # Car auction dataset (40 cars)
├── src/
│   ├── main.jsx             # React entry
│   ├── App.jsx              # Router + layout
│   ├── index.css            # Tailwind + custom styles
│   ├── api.js               # API client
│   ├── context/AuthContext.jsx
│   ├── components/
│   │   ├── Navbar.jsx
│   │   ├── Footer.jsx
│   │   ├── CarCard.jsx      # Car details display
│   │   ├── PriceGuess.jsx   # Price input with presets
│   │   ├── ScoreDisplay.jsx # Final score breakdown
│   │   └── ShareButton.jsx  # Wordle-style sharing
│   └── pages/
│       ├── Home.jsx         # Landing page
│       ├── Game.jsx         # Game engine (daily + practice)
│       ├── Auth.jsx         # Login + register
│       ├── Profile.jsx      # User stats + history
│       └── SharedGame.jsx   # View shared results
├── package.json
├── vite.config.js
├── tailwind.config.js
├── nodemon.json
└── .env
```

## API Endpoints

### Authentication
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Sign in
- `GET /api/auth/me` — Get current user

### Game
- `GET /api/game/daily` — Get today's 5 cars (no prices)
- `POST /api/game/daily/guess` — Submit a guess, get score + actual price
- `POST /api/game/practice/start` — Start a practice game
- `POST /api/game/practice/:id/guess` — Submit practice guess
- `GET /api/game/share/:code` — Get shared game results
- `GET /api/game/user/stats` — User statistics

## Deployment (Free Hosting)

### Option 1: Render.com (Recommended)

1. Push your code to GitHub
2. Go to [render.com](https://render.com) and create a free account
3. Click **New > Web Service**
4. Connect your GitHub repo
5. Configure:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment Variables**:
     - `JWT_SECRET` = (generate a random 32+ char string)
     - `NODE_ENV` = `production`
     - `PORT` = `3001`
6. Deploy!

> Note: Render's free tier spins down after 15 min of inactivity and may lose the SQLite database on redeploy. For persistent data, upgrade to a paid instance or use an external database.

### Option 2: Railway.app

1. Push code to GitHub
2. Go to [railway.app](https://railway.app)
3. **New Project > Deploy from GitHub repo**
4. Add environment variables (same as above)
5. Railway auto-detects Node.js and deploys

### Option 3: Fly.io

```bash
# Install flyctl
fly launch
fly secrets set JWT_SECRET=your-secret-here
fly deploy
```

## Adding More Cars

Edit `server/data/cars.json` to add entries:

```json
{
  "id": 41,
  "year": 2023,
  "make": "Porsche",
  "model": "718 Cayman",
  "trim": "GT4 RS",
  "mileage": 1200,
  "exteriorColor": "Python Green",
  "interiorColor": "Black/Green",
  "engine": "4.0L Flat-6",
  "transmission": "7-Speed PDK",
  "drivetrain": "RWD",
  "condition": "Excellent",
  "mechanicalNotes": "Description of condition and history...",
  "highlights": ["Feature 1", "Feature 2"],
  "soldPrice": 185000,
  "soldDate": "2025-12-01",
  "auctionSource": "Bring a Trailer"
}
```

The daily game algorithmically selects 5 cars per day. More cars = more variety.

## Environment Variables

| Variable     | Description                          | Default     |
|-------------|--------------------------------------|-------------|
| `JWT_SECRET` | Secret key for JWT tokens            | (required)  |
| `PORT`       | Server port                          | `3001`      |
| `NODE_ENV`   | `development` or `production`        | `development` |

## License

MIT
# cardle
