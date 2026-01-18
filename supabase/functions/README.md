# Supabase Edge Functions

## fetch-usgs-data

This function fetches real-time river data from USGS and updates the conditions table.

### Deployment

```bash
supabase functions deploy fetch-usgs-data
```

### Scheduling

To run this function every 15 minutes, set up a cron job using Supabase's pg_cron extension:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the function to run every 15 minutes
SELECT cron.schedule(
  'fetch-usgs-data',
  '*/15 * * * *',  -- Every 15 minutes
  $$
  SELECT net.http_post(
    url := 'YOUR_EDGE_FUNCTION_URL',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);
```

Or use Vercel Cron Jobs:

```typescript
// app/api/cron/fetch-data/route.ts
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Call the edge function
  const response = await fetch('YOUR_EDGE_FUNCTION_URL');
  const data = await response.json();

  return Response.json(data);
}
```

Then in `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron/fetch-data",
    "schedule": "*/15 * * * *"
  }]
}
```

### Manual Testing

```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/fetch-usgs-data' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json'
```
