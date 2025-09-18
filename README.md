# BinBird App Starter (Next.js + Supabase)

## Quick Start
1. Copy `.env.example` to `.env.local` and fill in your Supabase values.
2. Install: `npm install`
3. Run: `npm run dev`
4. Deploy on Vercel and set the two env vars in the dashboard.

After deploy:
- Visit `/auth` and sign up.
- In Supabase SQL Editor, make your user admin:
  ```sql
  update user_profile set role='admin'
  where id = (select id from auth.users where email='YOUR_EMAIL');
  ```
- Create client/property/schedule (via DB for now), go to `/ops/generate`, then `/staff/today` to test uploads.
