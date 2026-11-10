# Mint — a calmer way to shop

**PayPal AI Hackathon submission** · Build What's Next with PayPal and AI

Mint is an AI shopping companion that turns a real-world need into a short, budget-aware plan. It explains its picks, lets the shopper edit the basket, keeps the budget visible, and completes checkout with PayPal.

## Why Mint

Most shopping experiences optimize for more products. Mint optimizes for a decision the shopper feels good about. It starts from intent and context, gives a small considered shortlist, explains the tradeoff, and never lets an add-on push the shopper over their own budget.

## Demo flow

1. Describe a goal, such as a quiet, lightweight setup for a daily commute.
2. Choose a comfortable budget.
3. Review Mint's shortlist and reasoning; add or remove items.
4. Watch the total, savings, and remaining budget update live.
5. Pay through PayPal Checkout in the sandbox.

## Run locally

Requires Node.js 20 or newer. The app uses Node's built-in server and has no npm dependencies.

1. Copy .env.example to .env.
2. Run node server.mjs from this folder.
3. Open http://localhost:4173.

### Turn on live AI recommendations

Add an OpenAI API key to .env and optionally set OPENAI_MODEL. Without a key, Mint runs in a clearly labeled demo mode using the same fixed catalog and budget guardrails; the app still works end-to-end.

### Turn on PayPal sandbox checkout

Create a sandbox REST app in the PayPal Developer Dashboard: https://developer.paypal.com/dashboard/applications/sandbox. Put the app's sandbox client ID and secret in .env:

    PAYPAL_CLIENT_ID=your-sandbox-client-id
    PAYPAL_CLIENT_SECRET=your-sandbox-client-secret
    PAYPAL_ENV=sandbox

Restart the server and use a PayPal sandbox buyer account to complete the test. The public client ID loads PayPal's JavaScript SDK; the server exchanges the secret for an OAuth token, creates a Checkout Orders v2 order using server-priced catalog items, and captures it after buyer approval. Secrets stay server-side.

## What is implemented

- AI: server-side natural-language planning using OpenAI Chat Completions with JSON output. The model can only select catalog IDs, and the server validates the result against the budget.
- PayPal: JavaScript SDK smart buttons, OAuth 2.0 access-token exchange, Orders v2 create, and Orders v2 capture in sandbox.
- Budget guardrails: client-side budget feedback and server-side order pricing from a fixed catalog.
- Demo resilience: transparent fallback mode when AI or PayPal credentials are not configured; demo mode never pretends a payment succeeded.
- Responsive experience with keyboard-accessible controls and live status announcements.

## Architecture

Browser → Node server → OpenAI API (optional)

Browser → PayPal JavaScript SDK → Node server → PayPal Orders v2 (sandbox)

The fixed sample catalog is local so the hackathon prototype runs without a merchant account or external product data. It is a prototype, not a production storefront or payment service.

## Hackathon submission copy

**Tagline:** Good choices. Zero guesswork.

**Short description:** Mint is an AI shopping companion that turns natural-language needs into a small, budget-safe buying plan, then lets shoppers pay through PayPal Checkout.

**Problem:** Shopping can turn a simple need into an overwhelming, upsell-heavy product hunt. People compare bundles and keep their own budget in mind while checkout nudges them to spend more.

**Solution:** Mint asks what the shopper is trying to do, creates a concise AI shortlist from a curated catalog, explains the recommendation, and keeps the budget visible as the shopper edits their plan. PayPal provides the trusted payment step.

**Use of AI:** OpenAI interprets the shopper's goal and selects two to three relevant products from a provided catalog. The server validates every returned product ID and filters the result against the shopper's budget.

**Use of PayPal:** PayPal's JavaScript SDK renders checkout buttons. The Node server authenticates with PayPal OAuth and creates and captures Orders v2 transactions using server-calculated prices in the sandbox.

## Two-minute demo video outline

- 0:00–0:15 — “I only want a good commute setup, but shopping makes me compare a hundred things.”
- 0:15–0:35 — Enter the commute prompt and set a $120 budget.
- 0:35–1:05 — Generate the AI plan; highlight the short rationale and selected products.
- 1:05–1:25 — Add or remove an item and show the remaining budget and savings update.
- 1:25–1:50 — Complete PayPal sandbox checkout with a sandbox buyer and show the completed order.
- 1:50–2:00 — Close on Mint's principle: “Helpful AI. Human decisions.”

## License

MIT. Catalog and prices are fictional demo data. Mint is a hackathon prototype and is not affiliated with PayPal.
