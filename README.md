# DownSort

Watches your Downloads folder. When a new file lands, it asks a free LLM
(via Groq) which of your existing project folders it belongs in, then
shows a Windows toast notification with **Accept**/**Reject** buttons before
moving anything. Nothing is moved without your confirmation.

## Setup

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Set your Groq API key as a **persistent** environment variable (not
   just `$env:...` in the current shell — that won't be visible to the
   background task at logon):

   ```powershell
   setx GROQ_API_KEY "your-key-here"
   ```

   Close and reopen your terminal afterwards so it picks up the new value.
   Get a free key at https://console.groq.com/keys — no balance or card
   required.

3. Copy the config template and fill it in:

   ```powershell
   cp config.example.json config.json
   ```

   - `downloadsPath`: your Windows Downloads folder.
   - `targets`: a list of `{ "name": "...", "path": "..." }` — the project
     folders (e.g. a Next.js project's `docs` folder) you want files sorted
     into. Add as many as you like.
   - `groq.models` (optional): a list of model names to try in order —
     defaults to a handful of Groq's free models. If a model 404s
     (deprecated/renamed) or gets rate-limited, DownSort automatically moves
     on to the next one in the list. If they all fail, check
     https://console.groq.com/docs/models for what's currently available.

4. (Optional) Sweep files already sitting in Downloads:

   ```powershell
   npm run once
   ```

5. Register it to run automatically in the background at every login
   (no console window, no need to start it manually):

   ```powershell
   .\scripts\register-task.ps1
   ```

   To stop/remove it later:

   ```powershell
   .\scripts\unregister-task.ps1
   ```

## How it works

1. `chokidar` watches the Downloads folder for new files.
2. Once a file finishes writing (size stable for a couple of checks),
   DownSort scans your configured target folders to build a list of
   existing subfolders.
3. The filename + folder list is sent to the LLM, which picks the best
   existing folder (or says no confident match — nothing happens in that
   case).
4. A Windows toast pops up: `filename.pdf → ProjectA/docs/clients/acme`.
   Click **Accept** to move it, **Reject** to leave it in Downloads.
5. Every decision is logged to `data/history.jsonl`, and already-handled
   files are remembered in `data/seen.json` so you're never asked twice
   about the same file.

## Notes

- The LLM only ever picks from folders that already exist — it never
  invents new ones.
- Partial/incomplete downloads (`.crdownload`, `.tmp`, `.part`, `.download`)
  are ignored automatically; add more extensions to `ignoredExtensions` in
  `config.json` if needed.
- To only process specific file types (e.g. while testing, or to stay well
  under a free API rate limit), set `allowedExtensions` in `config.json`,
  e.g. `"allowedExtensions": [".md"]` — everything else is left untouched.
  Leave it unset to process every file type (except `ignoredExtensions`).
- Logs from the background process go to `data/run.log`.
