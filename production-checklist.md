# Production readiness checklist

## Implemented and structurally tested

- [x] Original bilingual Word template is used as the output master.
- [x] Contract, customer, dates, service contact, conclusion and signatures are mapped.
- [x] One to four equipment units are generated; additional units clone the CH1 logsheet.
- [x] CH1/CH2 and CH3 source table differences are retained for the first three units.
- [x] Two-column Word template reading behavior is handled; additional readings are grouped in the second value column.
- [x] Quarterly and annual checklist items use the original bilingual wording and dynamic checked/unchecked states.
- [x] Sample-site photos are removed from the source photo section before new photos are inserted; the company logo is preserved.
- [x] Supabase email sign-in/sign-up, user-owned report drafts and private photo storage are wired into the frontend.
- [x] Supabase RLS and private Storage policies are included in the SQL setup.
- [x] Python generator tests pass for checklist output, one/four equipment, and photo replacement.
- [x] Generated DOCX converted to PDF with LibreOffice for structural review; a four-equipment test produced eight A4 pages.

## Required before production use

- [ ] Run `npm install` and `npm run build` in the frontend with network access; review TypeScript/Next.js build output.
- [ ] Confirm layout and content in Microsoft Word (LibreOffice conversion is not a substitute for Word acceptance).
- [ ] Test on actual customer reports with long names, long comments, more photos and real model configurations.
- [ ] Confirm all technical reference ranges for each chiller model with the service engineering team.
- [ ] Add server-side Supabase JWT verification to the generation endpoint, plus rate limiting and request-size enforcement at the hosting layer.
- [ ] Add team/organization roles, report sharing and approval workflow if multiple engineers/managers need shared access.
- [ ] Add generated DOCX private storage, report history/versioning, audit log and report-number sequence.
- [ ] Configure production SMTP and Supabase Auth Site URL / Redirect URLs.
- [ ] Restrict CORS to the exact production and approved preview frontend origins.
- [ ] Obtain engineering acceptance of the generated report before operational issue.
