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
  where user_id = (select id from auth.users where email='YOUR_EMAIL');
  ```
- Create client/property/schedule (via DB for now), go to `/ops/generate`, then `/staff/today` to test uploads.

## Troubleshooting admin sign-in

If an account with the `admin` role stays stuck on the login screen, walk through these checks:

1. **Confirm the profile row exists** – In the Supabase table editor run:
   ```sql
   select user_id, role
   from user_profile
   where user_id = (select id from auth.users where email = 'YOUR_EMAIL');
   ```
   If no row is returned, insert one:
   ```sql
   insert into user_profile (user_id, role)
   values ((select id from auth.users where email = 'YOUR_EMAIL'), 'admin')
   on conflict (user_id) do update set role = excluded.role;
   ```
2. **Make sure the role is spelled `admin`** – Any other value (including uppercase or extra spaces) will be treated as missing and the middleware will redirect back to `/auth/login`.
3. **Verify the `get_my_role` function** – In Supabase SQL editor the RPC should read the `user_id` column:
   ```sql
   create or replace function get_my_role()
   returns text
   language sql
   security definer
   set search_path = public
   as $$
     select role
     from user_profile
     where user_id = auth.uid();
   $$;
   ```
   After saving the function, sign out and back in. The middleware relies on this RPC to resolve your admin session before redirecting you to `/admin`.
4. **Use the in-app debug page** – Sign in, then visit `/auth/debug` in the deployed app. It shows:
   - Which cookies are present (to verify Vercel domain + Supabase keys are working).
   - The role values from user metadata, the `get_my_role` RPC, and the `user_profile` table.
   - The normalized role the middleware will enforce. If this is empty, the cookie or role lookup is failing.
   Share or screenshot this page (redacting anything sensitive) to pinpoint whether the issue is Supabase data, middleware resolution, or missing environment variables.
