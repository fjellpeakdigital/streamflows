# StreamFlows

A real-time river conditions platform for fly fishing guides in New England. Track live USGS flow data, get alerts when conditions are optimal, and manage your favorite fishing spots.

## Features

### Public Features
- **River Archive** - Browse 50+ New England rivers with real-time conditions
- **Advanced Filtering** - Search by region, species, and status (optimal/high/low)
- **Visual Status Cards** - See current flow (CFS), temperature, and trend at a glance
- **Individual River Pages** - Detailed views with 24-hour flow charts and weather
- **Stats Dashboard** - Count of rivers by status for quick overview

### Guide Features (Logged-in Users)
- **Favorite Rivers** - Save and track your go-to fishing spots
- **Personal Notes** - Add observations and tips for each river
- **River Alerts** - Email notifications when conditions hit optimal ranges
- **CSV Export** - Download your data for offline use

### Admin/Automation
- **USGS Data Sync** - Automatic fetch every 15 minutes via cron
- **Status Calculation** - Intelligent status based on optimal flow ranges
- **Time-series Storage** - Historical data for trend analysis

## Tech Stack

- **Framework**: Next.js 14 (App Router, TypeScript)
- **Database**: Supabase (PostgreSQL + Auth + Real-time)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Charts**: Recharts
- **Deployment**: Vercel
- **Data Source**: USGS Water Services API

## Database Schema

```sql
rivers
├── id (uuid)
├── name (text)
├── slug (text)
├── usgs_station_id (text)
├── region (text)
├── optimal_flow_min (integer)
├── optimal_flow_max (integer)
└── latitude, longitude (decimal)

conditions
├── id (uuid)
├── river_id (uuid)
├── timestamp (timestamptz)
├── flow (decimal)
├── temperature (decimal)
├── gage_height (decimal)
└── status (enum)

user_favorites
├── id (uuid)
├── user_id (uuid)
└── river_id (uuid)

user_notes
├── id (uuid)
├── user_id (uuid)
├── river_id (uuid)
└── note (text)

user_alerts
├── id (uuid)
├── user_id (uuid)
├── river_id (uuid)
├── alert_type (enum)
└── threshold_value (decimal)
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Vercel account (for deployment)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/streamflows.git
cd streamflows
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CRON_SECRET=your-cron-secret
```

4. Set up Supabase:

**Option A: Local Development**
```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase
supabase start

# Run migrations
supabase db reset
```

**Option B: Supabase Cloud**
- Create a new project at [supabase.com](https://supabase.com)
- Run the migrations from `supabase/migrations/` in the SQL editor
- Run the seed data from `supabase/seed.sql`

5. Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

### Deploy to Vercel

1. Push your code to GitHub

2. Import to Vercel:
```bash
npm install -g vercel
vercel
```

3. Add environment variables in Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

4. The cron job will automatically run every 15 minutes to fetch USGS data

### Deploy Supabase Edge Functions (Optional)

If you prefer to use Supabase Edge Functions instead of Vercel cron:

```bash
# Deploy the function
supabase functions deploy fetch-usgs-data

# Set up pg_cron to run every 15 minutes
# (Run this SQL in your Supabase SQL editor)
SELECT cron.schedule(
  'fetch-usgs-data',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_EDGE_FUNCTION_URL',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);
```

## Project Structure

```
streamflows/
├── app/                    # Next.js app directory
│   ├── rivers/            # River archive and detail pages
│   ├── favorites/         # User favorites page
│   ├── alerts/            # User alerts page
│   ├── login/             # Authentication pages
│   ├── api/               # API routes
│   │   ├── favorites/     # Favorites API
│   │   ├── notes/         # Notes API
│   │   ├── alerts/        # Alerts API
│   │   └── cron/          # Cron jobs
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── navigation.tsx    # Nav component
│   └── river-card.tsx    # River card component
├── lib/                   # Utilities and helpers
│   ├── supabase/         # Supabase clients
│   ├── types/            # TypeScript types
│   ├── utils.ts          # Utility functions
│   └── river-utils.ts    # River-specific utilities
├── supabase/             # Supabase configuration
│   ├── migrations/       # Database migrations
│   ├── functions/        # Edge functions
│   └── seed.sql          # Seed data
└── public/               # Static assets
```

## Key Features Implementation

### Real-time River Status

The app calculates river status based on flow ranges:
- **Optimal**: Flow within optimal range
- **Elevated**: 1-1.5x optimal max
- **High**: >1.5x optimal max
- **Low**: Below optimal min
- **Ice Affected**: Winter months + very low flow

### Flow Trends

Calculates rising/falling/stable based on last 10 readings with 5% threshold.

### User Alerts

Users can set alerts for:
- Optimal flow conditions
- Custom flow thresholds
- Temperature thresholds

## API Endpoints

- `GET /api/favorites` - Get user favorites
- `POST /api/favorites` - Add favorite
- `DELETE /api/favorites` - Remove favorite
- `POST /api/notes` - Save/update note
- `DELETE /api/notes` - Delete note
- `GET /api/alerts` - Get user alerts
- `POST /api/alerts` - Create alert
- `PATCH /api/alerts` - Toggle alert
- `DELETE /api/alerts` - Delete alert
- `GET /api/cron/fetch-data` - Fetch USGS data (cron job)

## Design

The app uses a clean, outdoor-inspired design with:
- **Primary Color**: Coral (#FF6B6B) - "Back Alley Fly" brand
- **Secondary Color**: Navy (#2C3E50)
- **Aesthetic**: Rugged outdoors with premium polish
- **Responsive**: Mobile-first design

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- USGS Water Services for providing free, real-time river data
- Supabase for the amazing backend platform
- shadcn/ui for beautiful components
- The fly fishing community in New England

## Support

For issues and questions, please open an issue on GitHub.

---

Built with ❤️ for fly fishing guides in New England
