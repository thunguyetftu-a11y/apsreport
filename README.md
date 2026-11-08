# Maintenance Report Generator

Online maintenance-report form based on the supplied bilingual ESTELLA Word template. The application supports account sign-in, saving/loading the latest draft in Supabase, multiple chillers, checklists, site photos and editable `.docx` generation.

## Project structure

- `frontend/` — Next.js 14 application (deploy this folder to Vercel).
- `backend/` — FastAPI service that fills the original Word template (deploy this folder to Render or another Python host).
- `database/schema.sql` — Supabase database, row-level security and private photo-storage setup.
- `backend/master_template.docx` — original uploaded Word template; keep this file in the backend deployment.

For step-by-step Vietnamese deployment instructions, see [`SETUP_VI.md`](SETUP_VI.md).

## 1. Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor → New query**.
3. Paste all contents of `database/schema.sql` and click **Run**.
4. Open **Project Settings → API** (or API Keys) and copy the Project URL and the publishable/anon key. Never use the `service_role` key in the browser or commit it to GitHub.
5. In **Authentication → Providers → Email**, enable Email. For first testing, you can disable email confirmation; before real use, configure SMTP and enable confirmation.
6. Authentication → URL Configuration: add the Vercel deployment URL to Site URL / Redirect URLs after the frontend is deployed.

The schema is designed to be re-runnable: policies are dropped before being recreated. Reports are protected by RLS and users can access only their own reports. Photos are stored in a private `report-photos` bucket under a folder named with the user's auth ID.

## 2. GitHub

1. Create a new private GitHub repository, for example `maintenance-report-generator`.
2. Upload/push the contents of this project folder (the folder containing this README; do not upload the ZIP as the only file).
3. Confirm that `frontend/`, `backend/`, `database/` and `README.md` appear at the repository root.
4. Do not commit `.env.local`, passwords, Supabase service-role keys or API secrets.

## 3. Deploy the backend

Use Render (Web Service) or another Python hosting service:

- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Environment variable `ALLOWED_ORIGINS`: your Vercel URL, e.g. `https://your-app.vercel.app`

After deployment, open `https://YOUR-BACKEND/health`. It should return JSON with `ok: true` and `template_exists: true`. If `template_exists` is false, ensure `master_template.docx` is committed and included in the backend deployment.

## 4. Deploy the frontend to Vercel

1. Import the GitHub repository in Vercel.
2. Set **Root Directory** to `frontend`.
3. Add these Environment Variables for Production (and Preview if needed):

```env
NEXT_PUBLIC_API_URL=https://YOUR-BACKEND.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

4. Deploy. Add the Vercel URL to Supabase Auth URL Configuration and set the backend's `ALLOWED_ORIGINS` to the same URL, then redeploy the backend if needed.

## 5. Run locally (Windows PowerShell)

Backend terminal:

```powershell
cd backend
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Frontend terminal:

```powershell
cd frontend
copy .env.example .env.local
# Edit .env.local with your Supabase URL/key and API URL
npm install
npm run dev
```

Open `http://localhost:3000`.

## Current functionality

- Email/password sign-up and sign-in via Supabase Auth.
- Save draft and load the latest saved report for the signed-in user.
- Private photo upload/download using Supabase Storage.
- Multiple chillers, quarterly/annual checklists, technical readings and editable Word output.
- Original template's first three logsheet layouts are retained (CH1/CH2 include Economizer; CH3 does not). For chillers beyond the third, the CH1 logsheet layout is cloned. Confirm the correct model-specific layout with the service engineering team.
- The source Word template has two reading columns. If the form contains more than two readings, extra readings are combined into the second Word column rather than creating more physical columns.

## Important limitations before operational release

- The generated DOCX has been structurally tested with the original template, including multiple equipment, reading values and checklist fields. It still needs visual approval in Microsoft Word, including page breaks, table widths, image sizing and print output.
- The backend generation endpoint is not yet protected by Supabase JWT verification or rate limiting. Keep the backend URL private during testing; before public production use, add API authentication, request-size limits and rate limiting.
- No approval/review workflow, team roles, audit trail, template editor or report-number sequence is implemented yet.
- Technical reference ranges in the form are transcribed from the supplied example and are not universal operating limits. Confirm ranges for each chiller model before using them for service decisions.
- The form includes customer/contact defaults from the supplied example. Review and replace them with your actual service-center details before issuing reports.
