# BinBird App Starter (Next.js + Supabase)

## Quick Start
1. Copy `.env.example` to `.env.local` and fill in your Supabase values.
2. Install dependencies: `npm install`
3. Apply the database schema: `supabase db push`
   - Alternatively, run the SQL in `supabase/migrations/20240101000000__init.sql` from the Supabase SQL editor.
4. Start the app locally: `npm run dev`
5. Deploy on Vercel and set the two env vars in the dashboard.

After deploy:
- Visit `/auth` and sign up.
- In Supabase SQL Editor, make your user admin:
  ```sql
  update user_profile
     set role = 'admin'
   where user_id = (select id from auth.users where email = 'YOUR_EMAIL');
  ```
- The migration creates the `proofs` storage bucket with public read access so uploaded images resolve. If you provision a bucket manually instead, be sure to mark it public and mirror the storage policies from the migration.
- Create client/property/schedule rows (via DB for now), go to `/ops/generate`, then `/staff/today` to test uploads.
