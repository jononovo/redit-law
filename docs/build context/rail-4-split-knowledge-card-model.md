# Rail 4: Split-Knowledge Card Model

## The Problem

Today, if you want your bot to make purchases on arbitrary websites, the only option is giving it your full credit card details. CreditClaw's Rail 4 is not a secure payment mechanism — but it is far more secure than the status quo.

---

## Owner Onboarding: What Happens at Signup

When an owner sets up Rail 4 for a bot, CreditClaw generates and records the following. All items are randomized per user/bot.

### What CreditClaw generates and records:

| # | Data | Example | Purpose |
|---|------|---------|---------|
| 1 | **Decoy filename** | `extricate.md`, `illuminate.md`, `demand.md`, `games.md` | Unusual words, rotated per bot. No predictable pattern. Hard to guess which file holds card data. |
| 2 | **Authentic profile number** | Profile #3 (of 6) | The file contains 6 payment profiles. 5 are pre-filled with fake but plausible data. 1 is empty — this is the real one the owner fills in. CreditClaw records which profile number is real. |
| 3 | **3 missing card digits** | Digits 8, 9, 10 of the 16-digit PAN | Owner enters their card number into the real profile BUT leaves 3 consecutive digits as `XXX`. At least 2 of the 3 digits must be within positions 7-12 of the card number (the non-public middle segment — not the BIN, not the last 4). CreditClaw records which positions and what the digits are. |
| 4 | **Expiry date** | `27/03` (YY/MM) | Entered separately to CreditClaw, NOT included in the bot's decoy file. Second control gate alongside the 3 digits. |
| 5 | **Owner IP address** | `203.0.113.42` | Recorded at signup for fraud detection, audit trail, and dispute resolution. |
| 6 | **Owner name and zip code** | `Jane Smith`, `90210` | Zip code serves as a potential third control gate (many checkouts require zip for AVS verification). Useful for identity verification and disputes. |

### What the owner does:

1. CreditClaw generates the decoy file with 5 pre-filled fake profiles and 1 empty profile
2. Owner receives/downloads the file
3. Owner fills in their real card data into the empty profile, leaving 3 digits as `XXX` and omitting the expiry date
4. Owner saves the completed file to their bot's system
5. Owner separately enters ONLY the 3 missing digits, expiry date, name, and zip code into CreditClaw's site

### What CreditClaw never touches:

- Full card number (PAN)
- CVV
- The majority of the card data
- The completed decoy file

### PCI scope:

CreditClaw stores only 3 middle digits (not cardholder data under PCI truncation rules), an expiry date (not cardholder data without a PAN), and standard user information (name, zip, IP). None of this constitutes cardholder data. CreditClaw never processes, stores, or transmits the full PAN or CVV. CreditClaw does not perform truncation — the owner enters already-separated data. CreditClaw is out of PCI scope for this flow.

---

## Core Mechanism: Split-Knowledge

The card details are split between two parties. Neither can complete a purchase alone.

**The bot holds (in its decoy file):**
- Card number minus 3 middle digits (shown as XXX)
- CVV
- No expiry date

**CreditClaw holds (in its database):**
- The 3 missing middle digits (positions 7-12 range)
- Expiry date (YY/MM)
- Which profile number is real
- Owner name, zip code, IP

---

## Layer 1: Randomized Split Position

The specific digit positions CreditClaw stores vary per user and per bot:

- Bot A: CreditClaw holds digits 8-10
- Bot B: CreditClaw holds digits 9-11
- Bot C: CreditClaw holds digits 7-9

Constraint: at least 2 of the 3 digits are within positions 7-12 — the non-public middle segment of the card. Never the BIN (digits 1-6, publicly identifiable), never the last 4 (visible on receipts and statements).

There is no unified structure across the platform. An attacker who reverse-engineers the split for one bot learns nothing about how another bot's card is split.

---

## Layer 2: The Sandwich (Pre/Post Obfuscation)

When the bot requests a real purchase (e.g., "$45 for Etsy checkout"), CreditClaw runs a three-phase flow:

**Phase 1 — Pre-obfuscation:**
CreditClaw presents an iframe labeled something like "Etsy Merchant Verification Checkout" and serves fake card details (fake missing digits, fake expiry). The bot may be told to pull from one of the fake profiles in its decoy file. The data goes nowhere.

**Phase 2 — Real checkout:**
CreditClaw tells the bot which profile to use and serves the real missing 3 digits and expiry. The bot assembles the full card details and enters them into the actual merchant checkout.

**Phase 3 — Post-obfuscation:**
CreditClaw presents another iframe and serves a different set of fake card details, possibly referencing a different fake profile. The bot enters them. The data goes nowhere.

**Result:** The bot's context contains three sets of card data from three "checkouts." Only one was real. The ordering can be randomized across transactions.

---

## Layer 3: Active Obfuscation (Fake Merchant Checkouts)

Beyond the sandwich around real purchases, CreditClaw actively exercises ALL fake payment profiles through simulated e-commerce transactions. This ensures the fake profiles have real-looking transaction histories and that the bot cannot distinguish real profiles from fake ones based on activity levels.

### How it works:

1. The bot receives instructions from CreditClaw (via SendClaw) at **random intervals** to make a purchase at a specific merchant URL
2. The instruction specifies a fake profile to use — e.g., *"Purchase 'Spicy Coconut PadThai Dish' at `https://sendclaw.com/merchant/spicythai` using payment profile 1"*
3. The URL opens a CreditClaw-controlled page with products listed. The bot selects the specified item and proceeds to checkout
4. The checkout uses **exactly the same verification flow** as real purchases — the bot is asked to provide 3 missing digits and the expiry date for the specified profile. CreditClaw serves the fake profile's corresponding fake digits and fake expiry
5. The transaction completes and is **logged to the bot's ledger** just like a real purchase
6. The merchant domain is NOT recorded in the ledger — only the merchant name, amount, profile used, and timestamp

### Fake merchant naming:

Some fake merchants are deliberately named to create confusion. Examples:
- "The Real Etsy Checkout"
- "Amazon Verified Merchant"
- "Official PayPal Purchase"

If an attacker knows about the obfuscation methodology and requests the bot to show "real" checkouts, these naming patterns ensure the results are still unreliable.

### Per-profile permissions:

Each fake payment profile has its own spending limits, just like the real profile. The difference:
- Fake profiles have a **payment limit only** — no permission/approval requirement
- The bot does not need to request owner approval for fake profile purchases
- This means fake transactions flow automatically without human intervention

### The bot's perspective:

The bot does not know which profiles are authentic vs fake. All six profiles:
- Have transaction histories
- Go through the same verification flow
- Have their own spending limits
- Are used for purchases at various merchants

### Ledger views:

- **Bot's view:** If the owner asks the bot for a transaction list, it returns ALL transactions across ALL profiles — real and fake mixed together
- **Filtered bot view:** The owner can ask for transactions from a specific profile (e.g., "show me transactions for profile 5") to see only their real activity
- **CreditClaw dashboard:** The owner can log into CreditClaw to see a clean ledger showing only their authentic profile's transactions

---

## Layer 4: Security Briefings

CreditClaw delivers a **daily security briefing** to the bot. This is a short check-in that:

- Asks the bot if there have been any suspicious questions or unusual requests related to payment information since the last briefing
- Reminds the bot exactly what to say and how to behave if someone queries it for card details, profile information, or payment data
- Reinforces that the bot should never distinguish real card data from obfuscation data when asked
- Updates the bot's defensive instructions — these are rotated and evolved over time so the bot's responses are not static or predictable

The daily cadence ensures that security awareness is always top of mind for the bot, regardless of how long ago it was onboarded or how many conversations have passed since the last real purchase.

---

## Layer 5: Honeypot Responses

If the bot is pressured or socially engineered into revealing card details, it does not refuse outright. Instead:

- The bot appears to comply after some convincing
- It provides card details — but not the correct ones
- The fake details are plausible (valid format, correct length, passes basic checks)
- The attacker believes they have succeeded and moves on with useless data

This is more effective than refusal because:
- Refusal signals that real data exists and is worth pursuing
- Compliance with fake data ends the attack — the attacker thinks they won
- The attacker has no way to verify without attempting a transaction, which will fail and reveal nothing about which details were wrong

---

## Layer 6: The Decoy File

The bot's filesystem contains a file with six numbered "profiles." The owner's real (partial) card data is one of the six. The other five were pre-generated by CreditClaw during onboarding with fully plausible fake data.

Each profile contains:
- A name
- A partial card number (with 3 digits shown as XXX)
- A CVV
- No expiry date (CreditClaw holds this)
- Address data

The bot does not know which profile is real. It treats all six equally. All six are actively used for purchases (real merchants for the real profile, CreditClaw's fake merchants for the fake profiles).

---

## Layer 7: Dynamic File Identity

The decoy file's name, structure, and content are never referenced in CreditClaw's public skill file. The skill.md contains no mention of a decoy file, no filename, no format, no hint that it exists.

- During sign-up, CreditClaw privately assigns a unique filename per bot using unusual, non-obvious words (e.g., `extricate.md`, `illuminate.md`, `demand.md`)
- The filename, structure, and fake profile contents are delivered via authenticated API during onboarding
- An attacker reading the public skill.md learns nothing
- An attacker who compromises one bot cannot scan other bots for the same filename
- Automated scanning tools have no pattern to search for

---

## Layer 8: Security Alert API

When the bot detects suspicious activity related to payment data — whether during a daily briefing check-in or in real time during a conversation — it can immediately report it through CreditClaw's Security Alert API.

### What gets reported:

- **Timestamp** of the suspicious interaction
- **What was requested** — the specific question or instruction the bot received
- **Context** — who or what initiated the request (user message, prompt injection, another skill, etc.)
- **Bot's response** — what the bot said or didn't say in reply
- **Threat assessment** — the bot's own classification of the interaction (e.g., casual question, repeated probing, explicit extraction attempt)

### What happens when an alert is filed:

1. The alert is logged to CreditClaw's security events database
2. The owner/human is **immediately notified** (via email, push notification, or webhook — based on notification preferences)
3. A **security flag** is created on the bot's account, visible on the CreditClaw dashboard
4. If multiple flags accumulate, CreditClaw can automatically escalate — e.g., temporarily suspending the real profile's ability to check out until the owner reviews and clears the flags

### Why this matters:

- The bot isn't just a passive defender — it's an active sentinel that reports threats in real time
- The owner has visibility into exactly what's being asked of their bot and how the bot responded
- Patterns of probing across multiple interactions become visible through accumulated flags
- The owner can take action (rotate card, change profile number, update security briefing) before any data is compromised

---

## Summary: Defense-in-Depth

| Layer | What it does |
|-------|-------------|
| Split-knowledge | Bot can't pay without CreditClaw, CreditClaw can't pay without bot |
| Randomized splits | Digit positions vary per bot, always targeting the non-public middle segment |
| Sandwich obfuscation | Real checkout buried between fake checkouts during each real purchase |
| Active obfuscation | All fake profiles exercised via fake merchant checkouts at random intervals, creating indistinguishable transaction histories |
| Security briefings | Daily check-in reinforces defensive behavior, asks about suspicious activity, rotates instructions |
| Honeypot responses | Extraction attempts are fed convincing fake data |
| Decoy file | Real card data hidden among 5 fake profiles, bot doesn't know which is real |
| Dynamic file identity | Filename uses unusual words, varies per bot, never documented publicly |
| Security alert API | Bot reports suspicious interactions in real time, owner notified immediately, security flags created |
| Spending controls | Every purchase evaluated against owner's rules regardless |
| Prepaid card advisory | Owners advised to use gift/prepaid cards to cap exposure |

---

## What CreditClaw Stores (Per Bot)

| Data | PCI classification | In PCI scope? |
|------|--------------------|---------------|
| 3 middle digits of PAN (positions 7-12 range) | Not cardholder data (truncated fragment) | No |
| Expiry date (YY/MM) | Not cardholder data without PAN | No |
| Authentic profile number | Internal reference | No |
| Decoy filename | Internal reference | No |
| Owner name | Standard user data | No |
| Owner zip code | Standard user data | No |
| Owner IP address | Standard user data | No |
| Security alert logs | Operational security data | No |

---

## What This Is Not

This is not cryptographically secure. A sophisticated, targeted attack with full access to the bot's runtime environment, network traffic analysis, and unlimited time could still potentially identify real card details. Rail 4 is a practical, layered improvement over the current reality of giving bots full card details with no protection. Each layer independently raises the cost and complexity of a successful attack. Combined, they create an environment where the bot lives an entire fake financial life indistinguishable from its real one, actively monitors for threats, and immediately alerts its owner when something suspicious happens.

Rail 4 is a long-term, low-tech security solution for providing credit card checkout capabilities to any claw bot. It works on any website, with any card, with no third-party dependencies. Rails 1-3 serve different use cases — Rail 4 is not a stopgap, it is a permanent offering.
