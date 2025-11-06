# UK Parent Guide — Bristol (Static Site)

This is a lightweight static website for **UK Parent Guide — Bristol**.
It loads events from a **Google Sheets** document that you publish as **CSV**. No server needed.
Works on GitHub Pages, Netlify, Vercel, or any static host.

## Quick start
1) **Publish your Google Sheet to the web as CSV**
   - Open your sheet → *File* → *Share* → *Publish to web*.
   - Choose the specific tab that contains events.
   - Choose **Comma-separated values (.csv)**.
   - Copy the CSV URL. It looks like:
     `https://docs.google.com/spreadsheets/d/<SHEET_ID>/pub?gid=<TAB_GID>&single=true&output=csv`

   Alternative JSON endpoint (also works):  
   `https://docs.google.com/spreadsheets/d/<SHEET_ID>/gviz/tq?tqx=out:csv&gid=<TAB_GID>`

2) **Configure the site to use your CSV link**
   - Edit `config.json` and set:
     ```json
     {
       "eventsCsvUrl": "PASTE_YOUR_PUBLISHED_CSV_URL_HERE",
       "city": "Bristol, United Kingdom",
       "brandName": "UK Parent Guide — Bristol"
     }
     ```

3) **CSV column headers expected**
   These are case-insensitive. Extra columns are ignored.
   - `Title`
   - `Start Date`  (e.g., 2025-11-15 or 15/11/2025)
   - `Start Time`  (e.g., 10:00, 10:00 AM — optional)
   - `End Date`    (optional; defaults to Start Date)
   - `End Time`    (optional)
   - `Cost`        (optional; free text)
   - `Address`     (optional)
   - `Postcode`    (optional)
   - `Website`     (optional; event URL)
   - `Image`       (optional; direct image URL)
   - `Description` (optional; short text)
   - `Category`    (optional; e.g., "Free", "Under 5s", "Outdoors")

4) **Develop locally**
   - Open `index.html` in your browser. Or run a local server:
     ```bash
     python -m http.server 8080
     ```

5) **Deploy**
   - Push to a GitHub repo.
   - Enable GitHub Pages: Settings → Pages → Source: `main` branch → root.
   - Your site will be available at `https://<username>.github.io/<repo>/`.

## Notes on CORS
Google's **published CSV** endpoints normally include permissive CORS, so the site can fetch them directly.
If your domain host blocks it or you need a fallback, use a small proxy (Netlify Function/Vercel) later.

## License
Unlicensed sample for internal use.
