# Chat "My data": the profile and what the chat makes, stored in pgvector for RAG

Date: 2026-10-11 · Status: built · Branch: `feat/chat-my-data`

## Context and goal

Today a CV coach chat lives only in its browser tab: a new chat starts from nothing, and the only way
to carry a profile over is the "Save profile" JSON file. The goal: keep the visitor's data in the local
Postgres, keyed by their **email**, and use it in later chats, with retrieval (RAG) over everything
saved, so the coach can recall the profile and past applications ("reuse the accessibility paragraph
from my Brightpath letter").

**Decisions (agreed):**

| Question | Decision |
|---|---|
| Embeddings | A **local model** inside the API: `@huggingface/transformers` with `Xenova/all-MiniLM-L6-v2` (384 dimensions). No key, no cost, nothing leaves the machine. The model (~25 MB) is downloaded once to a cache folder |
| Access | **Local only, off by default.** `MY_DATA=on` turns it on; the API refuses to start with it on when `NODE_ENV=production`. With it on, anyone using that instance can load any stored email: that is acceptable for one person's own machine, and the reason it can't be on in production |
| What is stored | The **profile** (every saved version; the newest is current) plus **tailored CVs and cover letters**, each chunked and embedded |
| When | Only on an explicit **Save to my data** click on a card. Nothing is stored automatically |

**The key is the email**, lowercased and trimmed: from the profile's `basics.email` when saving, and
from the conversation when recalling (the newest profile's email, else the newest email address the
visitor typed in a message).

**Out of scope:** job ads as their own documents (a tailored CV or letter keeps its job title and
employer); deleting or listing saved data in the UI (a GraphQL `deleteMyData` mutation exists for it);
anything for production (email verification or sign-in would be needed first, see Risks).

## Where things live

The API owns Postgres (migrations, models), so storage, chunk embedding and search live in a new API
module, `my-data`. The web owns the block schemas (`apps/web/src/lib/chat`), so it turns a block into
**chunks of text** and sends them; the API stores and embeds them without knowing the block formats.

```
browser ──POST /api/my-data──▶ Next server ──saveMyData (GraphQL)──▶ API ──▶ Postgres + pgvector
browser ──POST /api/chat────▶ Next server ──myData + searchMyData──▶ API      (context for the model)
```

## Database (migration `2026.10.11T00.00.00.create-my-data.ts`)

- `CREATE EXTENSION IF NOT EXISTS vector`. Docker image: `postgres:17-alpine` → `pgvector/pgvector:pg17`
  (same major version: the existing volume keeps working).
- `my_data_documents`: `id` uuid v7, `email` (lowercase), `kind` (`profile` | `tailored_cv` |
  `cover_letter`), `title` (e.g. "Senior Engineer · Brightpath"), `content` jsonb (the block as shown),
  `createdAt`. Index `(email, kind, createdAt)`.
- `my_data_chunks`: `id` uuid v7, `documentId` → documents (`ON DELETE CASCADE`), `email` (copied, so
  search filters without a join), `text` (≤ 2,000 characters), `embedding vector(384)`, `createdAt`.
  HNSW index on `embedding vector_cosine_ops`; index on `email`.
- Profiles are versions: saving one adds a document; `myData` returns the newest. Search covers every
  chunk of the newest profile and of every tailored CV and letter (older profile versions are skipped).

## API (`apps/api/src/my-data`)

All three operations are `@Public()` (there is no account), exist only when `MY_DATA=on` (otherwise
`FORBIDDEN` with "My data is off"), and use the default rate limit.

| Operation | What |
|---|---|
| `saveMyData(email, kind, title, content: String!, chunks: [String!]!)` | Validates (email, kind, title ≤ 200, content JSON ≤ 64 KB, 1–80 chunks of ≤ 2,000 characters), embeds the chunks, and stores the document and chunks in one transaction. Returns `{ id, kind, title, createdAt }` |
| `myData(email)` | The newest profile's content (`String`, JSON), and a list of the saved tailored CVs and letters (`id, kind, title, createdAt`). `null` when nothing is stored |
| `searchMyData(email, query, limit = 6)` | Embeds the query (≤ 2,000 characters) and returns the closest chunks (cosine distance, at most 20) with their document's kind, title and date |
| `deleteMyData(email)` | Deletes everything stored for the email. Returns how many documents went |

- **Embedder:** an `Embedder` provider. The real one loads the pipeline lazily (first use), normalises
  vectors, and runs batches. `EMBEDDINGS=fake` swaps in a deterministic hash-based embedder for tests
  (unit, e2e and smoke), so tests never download a model.
- **Startup check:** `MY_DATA=on` with `NODE_ENV=production` → refuse to start, with the reason.
- **Logs:** `my_data.saved` (kind, chunk count; no email, no content). GraphQL variables are never
  logged already.

## Web

- **Chunking** (`apps/web/src/lib/chat/my-data-chunks.ts`, pure): a profile → one chunk for the basics
  and summary, one per role (title, employer, dates, bullets, skills), one per project, one for
  education, one for skills, certificates and languages. A tailored CV → the merged CV's chunks, each
  prefixed "Tailored for {job}:". A cover letter → one chunk per paragraph, prefixed "Cover letter for
  {job}:".
- **Route `POST /api/my-data`** (Next server): `{ kind, block, profile? }`, JSON ≤ 256 KB. Validates the
  block with its schema (and for a tailored CV, `tailorCv` against the profile: blocking flags are
  refused, as for the PDF), takes the email from the profile, builds the title and chunks, calls
  `saveMyData`. 404 when `MY_DATA` is off; errors as codes (`NO_EMAIL`, `HAS_BLOCKING_FLAGS`,
  `UNAVAILABLE`, …) turned into words on the page.
- **Cards:** **Save to my data** next to the PDF buttons on the profile, tailored CV and cover letter
  cards, only when `MY_DATA` is on (the page passes the flag). States as for the PDF buttons:
  "Saving…", "Saved to my data (jane@example.com)", or what went wrong ("Your profile has no email:
  add it, e.g. 'my email is …'").
- **Recall in the chat** (`handleChat`, when `MY_DATA` is on): find the email (newest profile in the
  conversation, else the newest email address in the visitor's messages). If there is one, ask the API
  for `myData` and `searchMyData` (query: the latest message, up to 2,000 characters) in parallel, with a 3-second budget. Add to the system prompt:
  - the saved profile, when the conversation has no profile yet, as "The visitor's saved profile
    (jane@example.com), in the profile format";
  - the retrieved chunks, as "From the visitor's saved data (most relevant first)", each with its
    kind, title and date.
  If the API is down or slow, the chat carries on without them (logged).
- **Persona rules** (career): when the visitor gives their email and a saved profile is provided, write
  one sentence and the profile block unchanged (as for a restored profile file). Use the saved data
  only as the visitor's own facts and past wording; the never-invent rules apply to it as to the CV.
  Never reveal saved data for an email the visitor hasn't given in this conversation.

## Risks

- **Email is not proof of identity.** Anyone who can reach an instance with `MY_DATA=on` can load or
  delete any stored email's data. Hence local only, off by default, and refused in production. Before
  any deployment: email verification (one-time code) or sign-in.
- **Personal data at rest** in the dev database, unencrypted; `deleteMyData` removes it.
- **Model download** on first use needs internet once; the first save or search takes a few seconds
  more.

## Testing

- **API unit:** input validation; the fake embedder is deterministic and normalised; the production
  startup refusal.
- **API e2e** (real Postgres with pgvector, fake embedder): save → `myData` returns the newest profile;
  search returns the closest chunk first and only that email's chunks; versions; delete cascades to
  chunks; off → `FORBIDDEN`; validation errors; the docs contract (auth and errors on each operation).
- **API smoke:** the operations over HTTP with `MY_DATA=on`.
- **Web unit:** chunking for each block; email detection; the `/api/my-data` handler (codes, blocking
  flags, off → 404); `handleChat` adds the saved profile and chunks, and carries on when the API fails.
- **Stories:** the Save to my data button's states.
- **e2e** (`MY_DATA=on`, fake embedder): profile → Save to my data → "Saved"; a new chat, "my email is
  jane@example.com" → the mock model receives the saved profile in its system prompt (the mock echoes a
  marker when it sees it) and the reply shows it.
- **Manual:** the real model: save a profile, a tailored CV and a letter; in a new chat give the email
  and ask "what did I say about accessibility in my Brightpath letter?".

## Definition of done

`pnpm lint && pnpm lint:style && pnpm typecheck`, all unit, story, API e2e, smoke and web e2e tests,
and the manual check above. README: a "My data" section with the setup (`MY_DATA=on`, the Docker
image change, the first-run model download) and the risks.
