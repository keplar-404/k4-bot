# K4 next phase: plan

Status (2026-11-19): F, E, A done and tested; next B, then C (R2 ready), then D. See "Progress" and "Open issues" at the end.

Sources read: eve bundled docs (security model, tools, human in the loop, memory, use-eve-agent, sessions), Cua Driver skill 0.54.0, Browser Use harness skill 1.0.6, E2B docs (pre-signed file URLs, restrict public access, auto-resume), websockify 0.12.0 source (`JWTTokenApi`), Cloudflare R2 pricing and presigned-URL docs, OpenRouter image/video/audio docs and model list, Neon pricing, OWASP Top 10 for LLM apps.

## Ground rules (apply to every phase)

1. **Every connection has an owner and an end.** No module-level pools that grow; every cache has a size cap and a time limit; every `setInterval`/socket is closed in a `finally` or on close.
2. **Every external call has a timeout and a retry budget** (E2B, OpenRouter, R2, Neon). Retries only on retryable errors, with backoff, at most 3.
3. **Every user-triggered cost is metered** (rate limit + daily quota) before the call, not after.
4. **Untrusted text stays data.** Web pages, files, tool output, memory, app windows: never instructions (eve security model; OWASP LLM01).
5. **Docs-first, current APIs only.** No legacy SDK calls; every new API is checked against the installed version's docs or types.

---

## Phase F: speed and cost of what exists

| # | Feature | Edge cases | Solution |
|---|---|---|---|
| F1 | Cache the Neon Auth token in the browser | token expires mid-request; sign-out in another tab; two calls at once | keep `{token, exp}` in memory; reuse until 60 s before `exp`; one in-flight refresh shared by concurrent callers; clear on sign-out; on a 401 from our API, drop the cache and retry once |
| F2 | Rate limiter stops writing to Neon on reads | multiple backend instances (in-memory counters split); abuse of reads | reads: in-memory per-instance sliding window (cheap, bounded LRU of users); writes and expensive routes (create chat, computer, uploads, generation): keep the Neon counter, which is shared by all instances |
| F3 | Skip the chat re-check when checked recently | chat deleted on another device; new turns from another device | remember `checkedAt` per chat in IndexedDB; skip the backend call if < 5 min; a send or a 404 from eve forces a re-check; deletion from this browser drops the cache entry immediately |
| F4 | Draw the last 50 messages, older on scroll up | eve needs the full event prefix (docs: "ordered prefix of the same session's stream"); scroll position jumps when older messages are added; a running turn | eve keeps the full events (from IndexedDB, free); only the *rendering* is windowed: show the last 50 messages, add 50 more when the user reaches the top, keeping the scroll anchored; never window the running turn |
| F5 | First open on a new device: last 50 at once | events must be a prefix for eve | new `GET /api/chats/:id/transcript?last=50` (text only, small) renders immediately as read-only; the full events load in the background; the composer is enabled when they arrive |
| F6 | Trim computer tool output in `agent_event` | the model already saw the full output; old chats keep large rows | extend `withoutPageText` to cap `computer_*` stdout/stderr (2 KB each) in the stored copy only |
| F7 | Dev-only double fetch | React Strict Mode runs effects twice in development | dedupe in-flight `GET /api/chats/:id` per id (one shared promise), which also covers fast double clicks in production |

## Phase E: live view, direct E2B → browser

| # | Feature | Edge cases | Solution |
|---|---|---|---|
| E1 | Vercel only issues a key; the stream goes E2B → browser | E2B accepts its traffic token only as a header (docs), so the port must be public; every other port would then be public too | computer created with `allowPublicTraffic: true`; inside the computer, an `iptables` INPUT rule drops everything arriving from E2B's proxy except the noVNC port (6080) and envd (49983, which has its own token), so Chrome CDP (9222+), raw VNC (5900+) and any server an agent starts stay unreachable. Keep loopback, established/related, and 169.254.169.254 open, as E2B's firewall doc requires |
| E2 | Signed, short key checked inside the computer | key leaked from logs or history; replay; clock skew | websockify `--token-plugin JWTTokenApi`: the backend signs a JWT (HS256, per-computer secret stored in `user_computer`, never sent to the browser) with `{host: "localhost", port: 5900+N, exp: now+60s}`; the token only opens a connection, so expiry after connect doesn't drop the stream; secret rotates when the computer is recreated |
| E3 | One websockify for all agent screens | different agents' screens | the JWT's `port` chooses the screen; the backend only signs ports of this user's own computer |
| E4 | Reconnects | Vercel/E2B drop long connections; token expired by then | the panel listens for noVNC's disconnect event, fetches a fresh token, and reconnects; exponential backoff 1 s → 30 s; stops when the panel closes or the tab is hidden |
| E5 | Pause and auto-resume | public traffic auto-resumes a paused computer (E2B docs) | panel drops the stream before Stop (already); the stream URL is never kept after the panel closes; random scanners can't reach it (sandbox id is random, and without a valid JWT websockify refuses) |
| E6 | Logs | Hono `logger()` prints every path | token travels in the query string, and the logger is replaced by one that prints the path without the query; the backend relay and its tickets are deleted |

## Phase A: the computer

| # | Feature | Edge cases | Solution |
|---|---|---|---|
| A1 | Agents can read each other's files | an agent deletes another's work; secrets in a home | homes become group-readable (`750`, group `k4`), writable only by the owner; `~/Shared` stays group-writable; the user's own `/home/user` stays readable by agents too |
| A2 | Same logins and settings in every agent's apps | Chrome locks its profile per running process (Chromium `SingletonLock`); two agents signing in at once; corrupting a profile copied while in use | one main profile per app in `/var/lib/k4/profiles/<app>`; at app start the agent's profile is refreshed from the main one (Chrome: Cookies, Login Data, Local State, Preferences, bookmarks; copied with SQLite's backup, never a raw copy of a database in use); after each browser tool call the agent's cookies are merged back (newest wins per cookie) under a file lock; other apps: config folders copied at start where the app keeps no lock (LibreOffice, GIMP) |
| A3 | Faster Cua | each call does ~6 round trips today | keep one connected `Sandbox` per user in the agent process (LRU of 50, idle-closed after 60 s), skip the stream/agent checks if they passed < 60 s ago, pass small arguments inline instead of uploading files; measure before/after |
| A4 | Simple tools for free models | free models get raw driver JSON wrong | add `app_open`, `app_read`, `app_click`, `app_type` (Cua) and `browser_open`, `browser_read`, `browser_click`, `browser_type` (harness); each runs its steps in one batched call (`run_steps`) and returns a short, plain result; the raw tools stay for hard cases |
| A5 | Parallel calls on one machine | two calls on the same harness daemon fight over one tab; two Cua calls typing at once | browser: each parallel call gets its own harness daemon name and tab on the agent's Chrome; Cua: element actions (background, by element) run in parallel; foreground/keyboard actions take a per-screen lock (`flock`) so they queue; the UI already shows parallel tool rows |
| A6 | `look()` screenshot, only when needed | eve re-sends a file URL on every later turn (docs); R2 not set up yet | Cua saves the screenshot on the computer, scaled to 1280 px, JPEG ~80 KB; uploaded once to R2 (C1); the model gets a presigned GET URL valid for 7 days via `toolOutputPart.fileUrl`; model without vision: the tool says so instead of failing |

## Phase B: human help

| # | Feature | Edge cases | Solution |
|---|---|---|---|
| B1 | "I need you" card (captcha, sign-in, 2FA, payment) | user never answers; user answers on another device; agent asks repeatedly | `need_human` workflow tool with `ctx.ask` (like `connect_app`): card with the reason and **Done** / **Cancel**; the Computer panel opens on that agent's screen with Take control on; the ask expires after 15 min (agent says it stopped waiting); at most 3 asks per turn |

## Phase C: files

| # | Feature | Edge cases | Solution |
|---|---|---|---|
| C1 | R2 storage | no POST policy on R2 presigned URLs (docs), so the bucket can't cap size; quota abuse; key guessing | backend validates `{name, type, size}` (allowlisted MIME types, size ≤ 100 MB, per-user total ≤ 2 GB), signs a PUT with `ContentLength` and `ContentType` in the signature, 5-min expiry; key `u/<userId>/c/<chatId>/<uuid>`; after upload, `HEAD` confirms the size and type, otherwise the object is deleted; a `file` row records owner, chat, key, size |
| C2 | `share_file(path)` | huge or secret files; path outside the agent's area | the backend signs the PUT; the computer uploads with `curl` straight to R2 (no bytes through our servers); only paths under the agent's home, `~/Shared` or `/tmp`; size cap as C1; the chat shows a download card |
| C3 | Upload into the computer | computer paused; big file; duplicate names | the chat's upload button gets an E2B pre-signed upload URL (60 s) for the agent's `~/Uploads/`; the browser uploads straight into the computer; the file stays on the computer, paused or not; size cap 100 MB; name sanitized, made unique |
| C4 | Download links | links shared or leaked | download card fetches a fresh presigned GET (5 min) from the backend each click, after the owner check |
| C5 | Files live with their chat | chat deleted; R2 delete fails | chat delete also deletes its R2 objects (batched `DeleteObjects`, then rows), retried by a cleanup on the next delete; no auto-expiry |

## Phase D: content and media tools (OpenRouter + the computer)

Researched 2026-11-19 against OpenRouter's docs and model list. One API key (OpenRouter) for every AI model; anything that is plain file work (cut, convert, download, extract audio) runs free on the user's computer with ffmpeg / yt-dlp.

| # | Tool | What it does | How (endpoint / tool) | Example models (Nov 2026) |
|---|---|---|---|---|
| D1 | `image_generate` | text → image | `POST /api/v1/images` | `recraft/recraft-v4.1-flash-v2:free`, `bytedance-seed/seedream-5-5`, `google/gemini-3.1-flash-image` |
| D2 | `image_edit` | image (+ text) → image (edit, combine, restyle) | `POST /api/v1/images` with reference images | `seedream-5-5`, `microsoft/mai-image-2.7` |
| D3 | `image_read` | image → text (OCR, describe, extract tables) | vision chat model | `google/gemma-4-31b-it:free`, `nvidia/nemotron-3.5-super-vl:free` |
| D4 | `video_generate` | text or image → video | async `POST /api/v1/videos` → poll → content | `minimax/hailuo-3-max`, `alibaba/wan-3.0`, `x-ai/grok-imagine-video-1.5-lite` |
| D5 | `video_edit` | video (+ text) → video (video-to-video) | `POST /api/v1/videos` with input video | `black-forest-labs/flux-video-edit`, `bytedance/seedance-2.5-flash`, `alibaba/wan-3.0` |
| D6 | `avatar_video` | script (+ photo) → talking-person video | `POST /api/v1/videos` | `heygen/heygen-avatar-6` |
| D7 | `video_read` | video → summary, text, answers, timestamps (YouTube links directly) | Responses API `input_video` (URL or base64) | `google/gemini-omni-1.2-flash`, `google/gemini-4-*`, `qwen/qwen4-max` |
| D8 | `speech_generate` | text → voice (TTS, voiceover) | `POST /api/v1/audio/speech` (OpenAI-compatible) | `heygen/heygen-voice-1-turbo:free`, `mistralai/voxtral-mini-tts-3-0`, `elevenlabs/eleven-v4` |
| D9 | `transcribe` | voice/audio → text (also the audio of a video) | `POST /api/v1/audio/transcriptions` | `mistralai/voxtral-mini-transcribe-3-0`, `elevenlabs/scribe-v2`, `nvidia/nemotron-3.5-transcribe` |
| D10 | `music_generate` | text (+ image) → music | chat completions with audio output (streamed) | `google/lyria-3-pro-preview`, `google/lyria-3-clip-preview` |
| D11 | `audio_read` | audio → answers/summary (not just transcript) | chat with audio input | `google/gemini-4-*`, `meta/muse-ember` |
| D12 | `document_read` | PDF / doc → text, tables, summary | OpenRouter file input, or `pdftotext` on the computer (free) | any text model |
| D13 | `media_from_link` | download a video/audio from a link (YouTube, X, etc.) to the computer | `yt-dlp` on the computer (added to the template) | free; only content the user may download (site terms, copyright) |
| D14 | `media_convert` | cut, merge, resize, extract audio/frames, subtitles | `ffmpeg` on the computer | free |
| D15 | Documents: slides, docs, spreadsheets, PDF, charts | made on the computer | LibreOffice, Python | free |

Chains the agent can build from these: link → `media_from_link` → `transcribe` / `video_read` → summary; video → `media_convert` (extract audio) → `transcribe`; script → `speech_generate` + `image_generate` → `media_convert` → narrated slideshow video.

Rules for all of them:
1. **Model allowlist** per tool in `@repo/shared/models` (models change monthly; the list is the one place to edit).
2. **Free first**: each tool defaults to a free model when one exists; paid models only when the user picks one or asks for quality.
3. **Quotas checked before the call** (per user per day, Neon counter): images 20, videos 3, music 10, speech 30 minutes, transcription 60 minutes, video reading 30 minutes.
4. **Ask mode asks before every paid generation**; Plan mode blocks generation.
5. **Big bytes never enter the model's context**: results stream to R2 (or stay on the computer for D13/D14); the model gets a short description and a link.
6. **Inputs from the user's files**: sent by presigned URL when the provider accepts URLs, otherwise base64 within size caps (video 100 MB, audio 25 MB, image 10 MB).
7. **Long jobs** (video, music) run as eve workflow tools: submit, then poll with sleeps that don't hold a function open; cancel when the user cancels the turn.
8. **Untrusted output**: text read from images, videos, audio, PDFs and links is data, never instructions (prompt injection through media is a known attack).

---|---|---|---|
| D1 | `image_generate` / `image_edit` | `POST /api/v1/images` (b64 result), reference images for edits | big base64 in memory → stream to R2 immediately; never into the model's context (it gets a link + a short description) |
| D2 | `video_generate` | async `POST /api/v1/videos` → poll → download (eve workflow tool, polling with sleeps that don't hold a function open) | jobs taking minutes; user cancels; job fails → refund nothing, report clearly |
| D3 | `music_generate` | Lyria via chat completions audio output (streamed) | long clips; streaming assembly → R2 |
| D4 | `speech` (voiceover) | gpt-audio(-mini) audio output | voice/format allowlist |
| D5 | `transcribe` | audio input to a speech-capable model | file size/length cap |
| D6 | Documents: slides, docs, spreadsheets, PDF, charts | made on the computer (LibreOffice, Python) then `share_file` | no API cost |

All generation tools: model allowlist in `@repo/shared/models`; per-user daily quotas (count and estimated cost) checked before the call; Ask mode asks before paid generations; Plan mode blocks them; results saved to R2 under the chat (C1) with a card in the chat.

---

## Security checklist (whole app)

| Area | Risk | Measure |
|---|---|---|
| Prompt injection (OWASP LLM01) | a web page, file, app window or email tells the agent to do something | instructions say tool output and page/app text are data; side-effecting tools (send, buy, delete, share, generate paid) need approval in Ask mode; `need_human` for credentials; agents never receive our API keys (they stay in the app runtime) |
| Excessive agency (LLM06) | agent shares or deletes files, spends money | narrow tools with server-side checks (path allowlist, size caps, quotas); no tool can read env vars or other users' data |
| Sensitive data disclosure (LLM02) | secrets in tool output | computer commands run as the agent user without access to our env; outputs capped; stored copies trimmed |
| Unbounded consumption (LLM10) | runaway loops, huge generations | existing session token budget; per-user rate limits per tool family; daily generation quotas; tool timeouts |
| Auth | token reuse, body-supplied identity | identity only from the verified Neon Auth JWT (already); owner check on every chat/file/computer route; JWT secret per computer for the stream |
| SQL injection | user strings in queries | Drizzle parameterized queries only; no raw SQL with interpolation (one `sql` template in rate-limit uses parameters) |
| Filter bypass | path traversal in `share_file`, MIME spoofing, zip bombs | resolve real paths on the computer and check prefixes; signed `ContentType`; post-upload `HEAD`; no server-side unzip |
| R2 abuse | unlimited uploads | per-file cap signed into the URL, per-user total quota, rate limit on upload-URL creation |
| Rate limits | API/Neon/R2/OpenRouter overload | in-memory for reads; Neon counters for writes; per-tool limits in the agent; per-user daily caps on generation and R2 bytes |
| Logs | tokens in URLs | logger prints paths without query strings; no tokens in paths |
| Headers | clickjacking, MIME sniffing | already: frame-ancestors none on web, nosniff; stream page framed only by the web origin |

## Needed from the user

1. ~~R2 credentials~~ done 2026-11-19 (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` in both .env files). Add the production web origin to the bucket's CORS at deploy time.
2. Daily caps OK as listed in Phase D rule 3 (user approved the rest).


---

## Progress (2026-11-19)

### Done and tested
- **Computer (before this plan):** one E2B desktop per user (`k4-desktop`: Ubuntu 22.04 + XFCE, Chrome, LibreOffice, GIMP, Cua Driver 0.54.0, Browser Use harness 1.0.6); one Linux user + screen per chat's agent (`k4-agent.sh`, max 4 running, LRU slot reuse); Stop/Start button (pause/resume); tools `computer_shell`, `computer_browser`, `computer_app`; skills `browser-use`, `cua-driver`.
- **F (speed/cost):** token cached in the browser (no `/api/auth/token` per call; 401 → refresh once); reads rate-limited in memory (no Neon write per GET), writes in Neon; one chat check per 5 min, shared (switching 2 chats 4× = 2 requests, was 12); last 50 messages drawn, older on scroll up (position kept); stored computer output capped. F5 deferred.
- **E (live view):** stream goes E2B → browser directly. Backend signs a 15-min JWT for one screen; websockify `JWTTokenApi` checks it; `iptables` in the computer leaves only 6080 and 49983 open. Tested: valid token streams, no/forged/expired refused, 9222+/5900+ unreachable. Relay deleted.
- **A (computer):** A1 homes readable by all agents (750, group `k4`), writable only by owner; A2 shared logins (cookie jar in `/home/shared/.k4`, merged before/after every browser call, works across running Chromes); A3 warm runner (~0.7 s per call; commands run as the agent with `cwd` = its home); A4 simple tools `browser` and `app` (multi-click list); A5 parallel browser slots (4 per agent). Free router: browser task 28 s / 3 steps; calculator 44 s / 5 steps / 20K tokens (was 144 s / 24 steps / 179K).
- **Other:** Neon Object Storage removed (route, `file` table, package, env vars); R2 set up (bucket `k4-bot`, CORS localhost:3000, size-locked uploads verified); Ask mode gates `browser` and `app` too.

### Left
- **B:** "I need you" card (captcha / sign-in / 2FA) with Take control on, Done / Cancel, 15-min expiry, max 3 per turn.
- **C:** R2 helper; `share_file`; upload into the computer (E2B pre-signed URL); download card; files deleted with their chat; A6 `look()` screenshots via R2.
- **D:** the 15 content/media tools (table above), quotas, allowlists.
- **F5:** instant text-only first open on a new device (needs eve's transcript reader on the backend).
- Chrome saved passwords and other apps' settings are not shared between agents (only cookies are).
- Production: add the deployed web origin to the R2 CORS rule; E2B Pro for real users.

## Open issues (reported by the user 2026-11-19)

### 1. New chat's Computer panel shows another screen instead of the new agent's
**Checked:** the backend is fine: on the user's computer each chat got its own Linux user and display (`afbf07344f0 :1`, `adf29e09527 :2`, `acd55a2de1d :3`), each matching a different chat's eve session.
**Likely cause (frontend, `apps/web/src/components/computer-panel.tsx`):** the panel asks for the agent's screen the moment the agent's first computer tool starts (`busy` turns true), but the agent's desktop is created *inside* that tool call (`k4-agent`, several seconds). The backend's `agentDisplay` (peek) then finds no desktop and returns the user's own screen (`desktop: "yours"`). `busy` stays true for the rest of the turn, so the panel never asks again and stays on the wrong screen. A stale iframe from the previous chat can also stay visible until the first fetch returns, because the old `view` isn't cleared when `session` changes.
**Fix:**
1. Clear `view` (and close the stream) whenever `session` changes, so a new chat never shows the previous chat's screen.
2. While `busy` and the answer is `desktop: "yours"` for a session that has one, poll `GET /api/me/computer?session=` every 2 s (max 30 s) until it says `agent`; stop when the panel closes.
3. Better: have the computer tools report the display in their result, or emit `call.progress` with `{ display }`, and let the panel switch on that event instead of polling.
4. Test: two new chats in a row, each using `app`; the panel must show `:N` of the current chat, never the previous one.

### 2. Parallel desktop-app (Cua) calls in one agent don't work properly
**Cause (confirmed by reading the code):** the `app` tool keeps one state file per agent (`~/.k4-app.json`: window + snapshot). Two parallel `app` calls overwrite each other's snapshot, so element numbers point into the wrong snapshot or window. Cua's own skill also says "keep one controller for a shared desktop": parallel keyboard/focus actions on one screen interfere.
**Fix:**
1. Serialize `app` (and `computer_app`) calls per agent with a lock (`flock` on `/tmp/k4-app-$USER.lock`, held by a short-lived process, not by a daemon), so parallel calls queue instead of colliding; browser calls stay parallel.
2. Key the state file by window (`~/.k4-app/<pid>-<window_id>.json`) so a call on window B never invalidates numbers from window A.
3. Say in the tool description and instructions that desktop-app steps run one at a time per agent; for truly parallel desktop work use subagents (each gets its own Linux user and screen).
4. Test: two parallel `app` calls in one chat on two different apps; both must finish with correct results.
