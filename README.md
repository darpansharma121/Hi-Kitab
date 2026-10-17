# Hi-Kitab

Hi-Kitab is a mobile-friendly digital register for a brick factory. It includes daily cash entries, worker attendance and wages, payments, vehicle loading, customer debt, brick stock, monthly totals, editing, CSV export, printing, and SMS summaries. Data is saved in the browser by default; authenticated Supabase sync is optional.

## Run locally

Requirements: Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
```

Run a production build with `npm run build`; run lint checks with `npm run lint`.

## Supabase setup

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the project SQL editor.
3. Copy `.env.example` to `.env.local` and fill in the project URL and publishable key. A legacy anon JWT is also accepted.
4. In Supabase Auth, configure email sign-in and the local/deployed redirect URLs.
5. Restart the Vite server, then open the account/settings control and request an email sign-in link.

Row-level security restricts records to the authenticated Supabase user. Until configured and signed in, records are stored in that browser's local storage and do not sync between devices. For deployment, set the same two `VITE_` environment variables in the hosting provider and add its URL to Supabase Auth redirect URLs. Only the public publishable/anon key belongs in this browser app. Never put a Supabase secret or service-role key in a `VITE_` variable, GitHub, or frontend code. See [SECURITY.md](SECURITY.md).

## Git and GitHub

This directory is already initialized as a local Git repository. To publish it, create an empty GitHub repository, then run these commands with its HTTPS URL:

```sh
git add .
git commit -m "Build Hi-Kitab factory register"
git branch -M main
git remote add origin https://github.com/OWNER/REPOSITORY.git
git push -u origin main
```

Replace `OWNER/REPOSITORY` with the repository you created. Subsequent releases can be published with `git add .`, `git commit -m "Describe changes"`, and `git push`. Configure the hosting provider to deploy from `main` for repeatable publishing.

## Current browser capabilities

Voice dictation uses the Web Speech API and offers English (India) and Hindi (India); browser and device support varies. The Read action speaks a short financial summary in the selected language. SMS opens the device's SMS composer with an English summary; automatic bulk SMS requires a separately configured SMS provider and backend.