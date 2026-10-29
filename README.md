# telegram-apis

An Express + TypeScript HTTP service that wraps the **Telegram Bot API**: inbound webhook, webhook
management, text and media sends, and media download. Built so additional channels (WhatsApp, LINE,
Viber, …) drop in later as self-contained folders without touching anything that already works.

Standalone — no Avaya, middleware or live-chat coupling.

---

## Layout

Each concern is its own file. Nothing is bundled into one module.

```
src/
├─ server.ts                      boot: ensure dirs → validate config → listen
├─ app.ts                         express assembly (helmet, cors, /health, /uploads, /api)
├─ config/index.ts                server-wide config + shared env parsing helpers
├─ routes/index.ts                mounts every REGISTERED channel at /api/<name>
├─ core/                          channel-agnostic foundation
│  ├─ events.ts                   ★ NormalizedInbound — the cross-channel inbound contract
│  ├─ ChannelRegistry.ts          ★ ChannelModule — what a channel must expose
│  ├─ BaseChannelService.ts       shared axios plumbing + transport-error translation
│  ├─ errors.ts                   AppError / ValidationError / UpstreamError
│  └─ response.ts                 the { success, data } / { success, error } envelope
├─ middlewares/                   asyncHandler, validate (zod), upload (multer), errorHandler,
│                                 requestLogger
├─ utils/                         logger (structured JSON), media (uploads dir, mime, safe names)
└─ channels/
   ├─ index.ts                    ★ the one place channels are registered
   └─ telegram/
      ├─ index.ts                 exports the ChannelModule
      ├─ telegram.config.ts       every TELEGRAM_* env var, read nowhere else
      ├─ telegram.routes.ts       URL → controller
      ├─ telegram.controller.ts   HTTP in/out only; no Bot API knowledge
      ├─ telegram.service.ts      the Bot API client (the only file that knows the wire format)
      ├─ telegram.mapper.ts       native ⇄ normalized, both directions
      ├─ telegram.webhook.ts      inbound handling (currently: echo)
      ├─ telegram.middleware.ts   secret-token verification
      ├─ telegram.validation.ts   zod request schemas
      └─ telegram.types.ts        Bot API types + service input types
```

Layer rule: **controller** touches HTTP only, **service** touches the provider only, **mapper**
translates between them. A controller never builds a Bot API payload; a service never reads `req`.

---

## Setup

```bash
cd telegram-apis
npm install
cp .env.example .env        # already done; fill in TELEGRAM_BOT_TOKEN
npm run dev                 # ts-node-dev, reloads on change
```

Build and run compiled:

```bash
npm run build && npm start
npm run typecheck           # tsc --noEmit
```

Required to boot: `TELEGRAM_BOT_TOKEN` (from @BotFather). Startup fails loudly and names any
missing var. Set `TELEGRAM_ENABLED=false` to boot with the channel unmounted.

### Pointing Telegram at a local server

Telegram only delivers to a public HTTPS URL, so for local work expose the port first:

```bash
ngrok http 6600
# then set PUBLIC_BASE_URL=https://<id>.ngrok-free.app in .env, restart, and:
curl -X POST http://localhost:6600/api/telegram/webhook/set -H 'content-type: application/json' -d '{}'
```

With no `url` in the body, `/webhook/set` registers `TELEGRAM_WEBHOOK_URL`, falling back to
`PUBLIC_BASE_URL` + `/api/telegram/webhook`.

---

## Endpoints

All responses are enveloped: `{"success":true,"data":…}` or
`{"success":false,"error":{"code","message","details?}}`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness + mounted channels |
| GET | `/api/channels` | what is mounted and whether it is configured |
| GET | `/api/telegram/me` | `getMe` — verifies the token |
| POST | `/api/telegram/webhook` | **inbound updates from Telegram** |
| POST | `/api/telegram/webhook/:botId` | same; reserved for multi-bot later |
| POST | `/api/telegram/webhook/set` | `setWebhook`, then returns the resulting info |
| POST | `/api/telegram/webhook/delete` | `deleteWebhook` |
| GET | `/api/telegram/webhook/info` | `getWebhookInfo` |
| POST | `/api/telegram/messages/text` | send text |
| POST | `/api/telegram/messages/photo` | send photo |
| POST | `/api/telegram/messages/document` | send document |
| POST | `/api/telegram/messages/video` | send video |
| POST | `/api/telegram/messages/audio` | send audio |
| POST | `/api/telegram/messages/voice` | send voice note (OGG/OPUS) |
| GET | `/api/telegram/files/:fileId` | file metadata + Telegram-hosted URL |
| POST | `/api/telegram/files/:fileId/download` | copy the file into `storage/uploads` |
| GET | `/uploads/<name>` | serves downloaded media |

### Inbound webhook

Verified against `X-Telegram-Bot-Api-Secret-Token` when `TELEGRAM_WEBHOOK_SECRET_TOKEN` is set
(skipped when it is not, since Telegram then sends no header). The update is normalized into a
`NormalizedInbound` and, while `TELEGRAM_ECHO_INBOUND=true`, echoed back to the sender — text as
text, media re-sent by `file_id` so no bytes move.

It **always answers 200**, even when processing fails, because Telegram retries any non-2xx
indefinitely. The outcome is in the body:

```json
{ "success": true, "data": { "received": true, "handled": true, "eventId": "telegram:update:42" } }
```

To replace the echo with real behaviour, edit the `echo()` function in
[telegram.webhook.ts](src/channels/telegram/telegram.webhook.ts) — it reads only from
`NormalizedInbound`, so whatever replaces it works for every channel added later.

### Sending text

```bash
curl -X POST http://localhost:6600/api/telegram/messages/text \
  -H 'content-type: application/json' \
  -d '{"chatId":"123456789","text":"hello","parseMode":"HTML"}'
```

Optional: `parseMode`, `disableWebPagePreview`, `disableNotification`, `protectContent`,
`replyToMessageId`, `replyMarkup` (a Telegram keyboard object).

### Sending media — three interchangeable sources

Every `/messages/<kind>` route accepts exactly one of:

```bash
# 1. multipart upload from disk  (field name: "file")
curl -X POST http://localhost:6600/api/telegram/messages/photo \
  -F chatId=123456789 -F caption=hi -F file=@./cat.png

# 2. a public URL Telegram fetches itself
curl -X POST http://localhost:6600/api/telegram/messages/document \
  -H 'content-type: application/json' \
  -d '{"chatId":"123456789","url":"https://example.com/report.pdf","fileName":"report.pdf"}'

# 3. a file_id Telegram already holds — a free re-send, no upload
curl -X POST http://localhost:6600/api/telegram/messages/photo \
  -H 'content-type: application/json' \
  -d '{"chatId":"123456789","fileId":"AgACAgQAAxkBAAI..."}'
```

Supplying none, or more than one, is a 400. Uploads are capped by `MAX_UPLOAD_MB` (default 50, which
is also the Bot API's own send limit) and are streamed straight through — an outbound send never
touches disk. `durationSeconds` applies to video, audio and voice.

### Receiving media

An inbound update carries a `file_id`, not bytes. Resolve or fetch it:

```bash
curl http://localhost:6600/api/telegram/files/<fileId>                  # metadata + Telegram URL
curl -X POST http://localhost:6600/api/telegram/files/<fileId>/download # → storage/uploads
```

Download returns a URL served by **this** service:

```json
{ "success": true,
  "data": { "fileName": "1730…-a1b2c3d4-file_0.jpg", "size": 51234,
            "mimeType": "image/jpeg", "url": "http://localhost:6600/uploads/1730…-file_0.jpg" } }
```

Prefer this over the `telegramUrl` from `/files/:fileId` when the URL leaves your infrastructure:
Telegram's own file URL **embeds the bot token**.

---

## Adding a channel

The point of the layout. To add WhatsApp:

1. `cp -r src/channels/telegram src/channels/whatsapp`, then rename the files and the identifiers
   inside them. Rewrite `*.service.ts` against the new provider API and `*.mapper.ts` to produce
   `NormalizedInbound`.
2. Export a `ChannelModule` from `src/channels/whatsapp/index.ts`.
3. Add **one line** to [src/channels/index.ts](src/channels/index.ts):
   `channelRegistry.register(whatsappChannel);`
4. Add the new `WHATSAPP_*` vars to `.env.example`.

Nothing else changes. `routes/index.ts` mounts it at `/api/whatsapp`, `server.ts` validates its env
vars at boot, and `/api/channels` lists it. The Telegram folder is never touched, so it cannot
break.

Adding a *method* to Telegram is equally contained: a service method, a zod schema, a controller
handler, a route line.

---

## Notes

- **No persistence.** Nothing is stored except downloaded media on disk. Add a store later behind
  its own module; no existing file assumes statelessness.
- **Single bot.** One token, from env. `/webhook/:botId` is already routed and ignored, so multi-bot
  means resolving a token per `botId` in the service — no URL changes.
- **Webhook only.** No long polling; `getUpdates` is not wired.
- **Bot API error mapping.** A Telegram `error_code` describes *our* call, so 400/403/429 pass
  through while everything else (notably 401 — a bad token) surfaces as `502 UPSTREAM_ERROR`. A
  caller never sees a 401 that implies *their* request was unauthorized.
- `POST /messages/*` returns **201**; `/files/:fileId/download` returns **201**.
- Logs are single-line JSON on stdout with a `scope` per module; `LOG_LEVEL` is
  `error|warn|info|debug`.
- **Verification status:** every endpoint has been exercised against `api.telegram.org` and all
  local wiring (routing, secret check, normalization, validation, multipart assembly, error
  translation) is confirmed working. The round trip past Bot API authentication has not been run —
  that needs a real `TELEGRAM_BOT_TOKEN`.
