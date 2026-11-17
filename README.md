# Student Attendance & Behaviour Tracker

A tiny offline app for recording daily attendance and a behaviour note per
student. It uses a real SQLite database running inside your browser — no
server, no internet connection needed once the page is open.

## 1. How the files are organised

```
index.html          <- page structure only
public/css/style.css<- appearance only
js/db-schema.js      <- ALL the SQL text, and nothing else (the "generator")
js/db.js             <- runs that SQL, saves your data so it survives closing the tab
js/app.js            <- buttons/forms/tables — the only file that touches the page
vendor/sql-wasm.*    <- the SQLite engine itself (a library called sql.js), bundled locally
```

If you want to see **what data is stored and how**, open `js/db-schema.js` —
every table and every query the app can run is written out there in plain
SQL, with a comment above each one.

If you want to see **how the app behaves**, that's `js/app.js`.

You should never need to touch `js/db.js` or `vendor/` — they're the
"plumbing" that makes the other two files work.

## 2. Running it

Because the SQLite engine loads a `.wasm` file, most browsers won't run it
directly from a double-clicked `index.html` (a `file://` link). You need a
very small local server — this is NOT hosting anything online, it just lets
your own browser talk to your own folder properly.

**Option A — Python (usually already installed):**
```
cd school-tracker
python3 -m http.server 8000
```
Then open **http://localhost:8000** in your browser.

**Option B — VS Code:**
Install the "Live Server" extension, right-click `index.html`, choose
**"Open with Live Server"**.

Either way, close the tab/stop the server when you're done — your data is
already saved (see below), nothing is lost.

## 3. Where your data actually lives

Every time you add a student, mark attendance, or add a behaviour note, the
app saves the whole database into **IndexedDB** — a small storage area every
browser has for exactly this purpose. It's tied to that browser, on that
computer. Closing the tab, or even restarting your computer, will not lose
your data. Clearing your browser's site data for `localhost` would.

## 4. Inspecting or editing the raw database file

Since you're new to databases, the easiest way to actually *look at* your
data outside the app is a free tool called **DB Browser for SQLite**
(https://sqlitebrowser.org — download the one for your OS).

Steps:
1. In the app, click **"Download .db file"** (section 4 of the page). This
   saves a normal file called `school-tracker.db` to your Downloads folder.
2. Open DB Browser for SQLite.
3. **File → Open Database** → pick `school-tracker.db`.
4. Click the **"Browse Data"** tab, choose a table (`students`,
   `attendance`, or `behavior_notes`) from the dropdown — it looks and
   behaves like a spreadsheet. You can edit cells directly if you want.
5. If you edit anything, click **Write Changes** (top toolbar) to save.

That downloaded file is a snapshot, though — it won't automatically sync
back into the app. Treat it as "export to inspect / export for my SIWES
submission", not as the live copy you edit day-to-day. Day-to-day editing
should happen through the app itself.

## 5. The three tables, in one sentence each

- **students** — one row per student (name, class, admission number).
- **attendance** — one row per student per day, marked Present/Absent/Late.
- **behavior_notes** — one row per student per day, with a rating and a
  free-text note.

`attendance` and `behavior_notes` both store a `student_id`, which is how
they "link" back to `students` — this is what lets the report in section 3
of the app pull attendance and behaviour together for the same student in
one row, even though they're stored separately.

## 6. Running the packaged Windows app (no install needed)

You don't need Node.js, a local server, or anything else to run the app on
Windows. Inside the `StudentTracker-win32-x64` folder, just double-click
`StudentTracker.exe`. It opens the same app you see in the browser, in its
own window. Your data is still saved on that computer (the same IndexedDB
storage described above, just inside the app's own hidden profile instead
of a browser profile) — closing and reopening the app keeps it.

Copy the *entire* `StudentTracker-win32-x64` folder when you move it
around (e.g. onto your CD) — the `.exe` depends on the other files sitting
next to it (`resources/`, `locales/`, etc.); it is not a single standalone
file.

## 7. Rebuilding the Windows app yourself

If you change any of the app files and want a fresh `.exe`:

```
npm install
npm run package-win
```

This regenerates `dist/StudentTracker-win32-x64/`. (`npm run package-linux`
and `npm run package-mac` do the same for other operating systems.)
