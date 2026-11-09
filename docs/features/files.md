# Files

All stored files live in the R2 bucket bound as `FILES` (`k4-bot-files`), with metadata in `chat_file`. Without the
binding, uploads and every file tool are off.

## Where files come from

| Source | How |
|---|---|
| Upload | Attach to a chat message, or the Files page (`POST /api/v1/files`, ≤ 25 MB) |
| Generated | `generate_image` (OpenRouter image model, `MAX_IMAGES_PER_DAY` per user) |
| Computer | A bot's `share_file` copies a file from its computer home |
| Deep research | Each `/deep-research` report is saved as a file |

A file outlives its bot and chat (those links become empty); it stays on the Files page until deleted. Storage per
user is capped (`MAX_STORAGE_MB_PER_USER`, 1 GB by default). Keys are `u/<userId>/<fileId>`.

## Reading documents (`modules/files/documents`)

`read_document` reads, page by page:

| Type | How |
|---|---|
| PDF | Text layer first; pages without text go to a vision model as pictures; if that is not possible, paid OCR (Mistral, `PDF_OCR`, `MAX_OCR_PAGES_PER_DAY` pages) |
| Office (docx, xlsx, pptx, odt, ods) | Converted to text |
| Text (txt, md, csv, json, html, xml, code) | As is |

Long documents come back in parts; the bot asks for the pages it needs.

## Where files are used

- Chat: attachments, images shown to vision models, generated images and reports.
- Workflows: **file inputs** of app actions (picked from the Files page and uploaded to the app when the block runs),
  and **knowledge files** for "Ask a bot" (up to 10; read with `read_knowledge`, no paid OCR).
- Computer: `copy_to_computer` and `share_file` move files between the store and a bot's home.

API: `GET /api/v1/files`, `GET /api/v1/files/:id`, `GET /api/v1/files/:id/content`, `POST /api/v1/files`,
`DELETE /api/v1/files/:id`.
