# SendClaw Skill File Implementation Guide

This document explains how the SendClaw skill file system works, how bots register and communicate, and how the backend is structured. It is intended for developers or agents implementing support for this skill file in their own systems.

---

## What Is a Skill File?

A skill file is a markdown document (`skill.md`) that teaches an AI agent how to use an external service. When an agent loads the skill file, it learns the full API -- how to register, authenticate, send email, and check for messages. There is also a companion `heartbeat.md` file that provides a lightweight polling routine.

| File | URL | Purpose |
|------|-----|---------|
| `skill.md` | `https://sendclaw.com/skill.md` | Full API reference and registration instructions |
| `heartbeat.md` | `https://sendclaw.com/heartbeat.md` | Polling routine for checking new messages |

---

## How the Skill File Is Served

Skill files are static markdown files stored per-tenant in `client/public/tenants/{tenantId}/`:

```
client/public/tenants/
  sendclaw/
    skill.md
    heartbeat.md
    config.json
    images/
  5ducks/
    skill.md
    config.json
    images/
```

The server determines which tenant to serve based on the request hostname. This routing lives in `server/tenants/index.ts`:

- Requests from `sendclaw.com` → tenant `sendclaw`
- Requests from `fiveducks.ai` → tenant `5ducks`
- Default → `5ducks`

The routes in `server/tenants/routes.ts` serve the files:

- `GET /skill.md` → reads `client/public/tenants/{tenant}/skill.md` and returns it as `text/markdown`
- `GET /heartbeat.md` → same pattern for the heartbeat file

This means `curl https://sendclaw.com/skill.md` returns the SendClaw skill file, and each tenant can have its own version.

---

## The Bot Registration Flow

### Step 1: Agent Reads the Skill File

The agent (or its human) fetches the skill file:

```bash
curl -s https://sendclaw.com/skill.md
```

The skill file instructs the agent to call the registration endpoint.

### Step 2: Agent Registers via API

```http
POST /api/bots/register
Content-Type: application/json

{
  "name": "MyAssistant",
  "handle": "myassistant",
  "senderName": "My Friendly Assistant"
}
```

**What happens on the backend** (in `server/sendclaw/routes.ts`):

1. **Input validation** -- The request body is validated against `insertBotSchema` (Zod).
2. **Atomic rate limiting** -- The entire registration runs inside a database transaction with a per-IP advisory lock (`pg_advisory_xact_lock`). This prevents race conditions where concurrent requests from the same IP could bypass rate limits.
   - **Cooldown**: 5 minutes between registrations from the same IP
   - **Daily limit**: 5 registrations per IP per 24 hours
3. **Handle uniqueness check** -- Queries the `handles` table to ensure the address isn't taken.
4. **Bot creation** -- Inserts into the `bots` table with a generated API key (`sk_` + 48 hex chars) and claim token (e.g., `reef-X4B2`).
5. **Handle reservation** -- Inserts into the `handles` table, linking the address to the bot.
6. **Security event logging** -- Every outcome (success, rate limit hit, validation error, duplicate handle) is logged to the `security_events` table.

**Response:**

```json
{
  "botId": "uuid",
  "email": "myassistant@sendclaw.com",
  "apiKey": "sk_abc123...",
  "claimToken": "reef-X4B2",
  "important": "Save your API key! Give claimToken to your human if they want dashboard access."
}
```

The agent must save the `apiKey` immediately -- it cannot be retrieved later.

### Step 3: Agent Sends a Test Email

The skill file instructs the agent to send a test email to its human after setup:

```http
POST /api/mail/send
Authorization: Bearer sk_abc123...

{
  "to": "human@example.com",
  "subject": "SendClaw is ready!",
  "body": "I now have my own email at myassistant@sendclaw.com"
}
```

### Step 4: Human Claims the Bot (Optional)

The human can claim ownership of the bot for dashboard access:

```http
POST /api/bots/claim
Content-Type: application/json
Cookie: (authenticated session)

{
  "claimToken": "reef-X4B2"
}
```

**What happens:**
- Requires the human to be logged in (session auth)
- Looks up the bot by `claimToken`
- Sets `userId` on the bot, nullifies the `claimToken`, sets `claimedAt`
- Links any reserved handle the user has to this bot

After claiming, the human can see the bot's inbox, sent messages, and settings on the dashboard at `https://sendclaw.com/dashboard`.

---

## How Email Communication Works

### Sending (Outbound)

**Endpoint:** `POST /api/mail/send`
**Auth:** `Authorization: Bearer {apiKey}`

The backend:
1. Authenticates the bot via API key (middleware: `apiKeyAuth` + `loadBotFromApiKey`)
2. Checks the bot's security status (suspended/under_review bots cannot send)
3. Calculates the daily sending limit based on karma:
   - Base: 3/day (unverified) or 5/day (verified)
   - Karma bonus: +3/day per week of good behavior
   - Maximum: 25/day
   - Flagged bots: capped at 2/day
4. Sends via SendGrid
5. Stores the message in the `messages` table with `direction: 'outbound'`
6. Increments the `quota_usage` counter

### Receiving (Inbound)

**Webhook:** `POST /api/webhook/inbound`

SendGrid's Inbound Parse forwards incoming emails to this webhook. The backend:
1. Parses the sender, recipient, subject, and body
2. Extracts the handle from the recipient address (e.g., `mybot` from `mybot@sendclaw.com`)
3. Looks up the handle in the `handles` table
4. Stores the message in the `messages` table with `direction: 'inbound'`

### Checking for Messages (Heartbeat)

The `heartbeat.md` file provides a simple polling routine:

1. `GET /api/mail/check` → returns `{ unreadCount, quota }`
2. If `unreadCount > 0`, fetch with `GET /api/mail/messages?unread=true&limit=5`
3. Process and reply as needed
4. If `quota.remaining < 2`, notify the human

Suggested polling interval: every 1 hour.

### Reading Messages

**Endpoint:** `GET /api/mail/messages`
**Auth:** `Authorization: Bearer {apiKey}`

Supports filtering and search:
- `?unread=true` -- Only unread inbound (auto-marks as read)
- `?direction=inbound|outbound` -- Filter by direction
- `?q=from:boss@co.com subject:invoice` -- Search queries
- `?cursor=msg_id` -- Pagination

---

## Database Schema

### Core Tables

**`bots`** -- Registered bots

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `userId` | Integer (nullable) | Set when a human claims the bot |
| `address` | Text (unique) | Full email, e.g., `mybot@sendclaw.com` |
| `name` | Text | Bot display name |
| `senderName` | Text | Name shown in email "From" field |
| `apiKey` | Text (unique) | Authentication token (`sk_...`) |
| `claimToken` | Text (unique, nullable) | One-time token for human claiming |
| `claimedAt` | Timestamp (nullable) | When the human claimed the bot |
| `verified` | Boolean | Whether the bot is verified |
| `status` | Text | `normal`, `flagged`, `under_review`, or `suspended` |
| `flagCount` | Integer | Number of security flags accumulated |
| `registrationIp` | Text | IP that registered the bot |
| `createdAt` | Timestamp | Registration time |

**`handles`** -- Email address reservations

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `address` | Text (unique) | Handle name (e.g., `mybot`, not the full email) |
| `userId` | Integer (nullable) | Owner user |
| `botId` | UUID (nullable) | Linked bot |
| `senderName` | Text (nullable) | Display name |
| `reservedAt` | Timestamp | When reserved |

**`messages`** -- All emails (inbound and outbound)

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `botId` | UUID | Which bot this message belongs to |
| `direction` | Text | `inbound` or `outbound` |
| `fromAddress` | Text | Sender email |
| `toAddress` | Text | Recipient email |
| `subject` | Text | Subject line |
| `bodyText` | Text | Plain text body |
| `bodyHtml` | Text | HTML body (inbound only) |
| `threadId` | Text | Conversation thread grouping |
| `messageId` | Text | Email Message-ID header |
| `inReplyTo` | Text | Parent message for threading |
| `isRead` | Boolean | Read status |

**`quota_usage`** -- Daily send tracking

| Column | Type | Purpose |
|--------|------|---------|
| `botId` | UUID | Bot reference |
| `date` | Text | Date string (YYYY-MM-DD) |
| `emailsSent` | Integer | Count for the day |

### Security Tables

**`security_events`** -- Audit log for all registration activity

| Column | Type | Purpose |
|--------|------|---------|
| `id` | Serial | Primary key |
| `eventType` | Text | `rate_limit_hit`, `validation_error`, `duplicate_handle`, `registration_success`, `registration_error` |
| `ip` | Text | Client IP |
| `handle` | Text | Attempted handle |
| `botId` | UUID | Bot ID (for successful registrations) |
| `details` | JSONB | Additional context |

**`email_flags`** -- Security flags on individual messages

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `messageId` | UUID | Flagged message |
| `botId` | UUID | Bot that sent it |
| `suggestedStatus` | Text | `flagged`, `under_review`, or `suspended` |
| `reason` | Text | Why it was flagged |

---

## Security System

### Registration Rate Limiting

Registration uses database-level atomic locking to prevent race conditions:
- A per-IP advisory lock (`pg_advisory_xact_lock`) serializes concurrent requests from the same IP
- The rate limit check and bot insert happen within the same transaction
- 5-minute cooldown between registrations, 5 per IP per 24 hours

### Outbound Email Monitoring

An AI-powered security engine (using Anthropic Claude) runs daily reviews of all outbound emails:
- Scans for scams, phishing, crypto schemes, and suspicious content
- Flags escalate the bot's status: 2 flags → `flagged` (2/day limit), 3 flags → `under_review` (0/day limit)
- Daily reports are emailed to the admin

### Prohibited Activities

- Scams, phishing, or impersonation
- Cryptocurrency solicitation or financial fraud
- Large-scale cold outreach or spam
- Anything illegal or deceptive

---

## Frontend Integration

### Landing Page (`client/src/features/sendclaw-public/pages/Landing.tsx`)

The SendClaw homepage provides two setup paths:

**"I'm a Bot" tab:**
- **ClawHub method**: User sends the skill URL (`https://www.clawhub.ai/jononovo/sendclaw`) to their agent. The agent reads the skill, registers, and sends back a claim token.
- **Manual method**: Shows `curl -s https://sendclaw.com/skill.md` for agents that can execute commands directly.

**"I'm a Human" tab:**
- Information about claiming bots and accessing the dashboard.

### Dashboard (`client/src/features/sendclaw/`)

Authenticated section where humans can:
- View their claimed bots
- See sent and received emails
- Edit the bot's sender name
- Monitor email activity

---

## File Structure Summary

```
server/
  sendclaw/
    routes.ts            -- All API endpoints (register, send, receive, claim, etc.)
  tenants/
    index.ts             -- Hostname → tenant ID mapping
    routes.ts            -- Serves skill.md and heartbeat.md per tenant

client/
  public/tenants/
    sendclaw/
      skill.md           -- The skill file agents read
      heartbeat.md       -- Polling instructions
      config.json        -- Branding and theme config
    5ducks/
      skill.md           -- 5Ducks version of the skill file
  src/features/
    sendclaw/            -- Authenticated dashboard components
    sendclaw-public/     -- Public landing page

shared/
  schema.ts              -- All Drizzle ORM table definitions (bots, handles, messages, etc.)
```

---

## End-to-End Flow Summary

```
1. Agent fetches skill.md from sendclaw.com
2. Agent calls POST /api/bots/register → gets apiKey + claimToken
3. Agent sends test email to human via POST /api/mail/send
4. Agent tells human the claimToken
5. Human logs into sendclaw.com/dashboard
6. Human enters claimToken → POST /api/bots/claim → bot linked to user
7. Agent polls GET /api/mail/check periodically (heartbeat)
8. Agent reads and replies to emails autonomously
9. Security engine reviews outbound emails daily
10. Human monitors activity from dashboard
```
