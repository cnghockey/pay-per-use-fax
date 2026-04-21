# pay-per-use-fax

**Send a fax with Bitcoin Lightning. Pay per fax, not per month. No contract, no telecom account, no signup.**

> Alternative to eFax, Phaxio, Documo, SRFax, and HelloFax — without the subscription, contract, or monthly minimums. MCP-native for agent frameworks.

A compound **fax API** that bundles PDF fetch (or local PDF generation from typed text), optional cover page, page counting, and global fax delivery into one HTTP endpoint. Useful when a bank, notary, hospital, or government office still only accepts fax — and you'd rather not rent a fax machine, a phone line, or a monthly subscription. Built on Sats4AI's L402 payment protocol.

Search terms: *fax api, send fax api, online fax api, fax by api, pay per fax, fax no signup, send fax from pdf, send fax without phone line, ai fax api, l402 fax, mcp fax tool, phaxio alternative, documo alternative, efax alternative, srfax alternative*.

---

## What makes it different

- **Pay per fax, not per month.** 500 sats covers up to 10 pages, +50 sats per additional page, up to 350 pages. No monthly fee if you don't send one this month.
- **Two input modes.** `mode: "pdf"` fetches a public HTTPS URL returning `application/pdf`. `mode: "text"` accepts typed text and formats it into a PDF for you. Optional `cover_text` adds a cover page (mode=pdf only, +1 page).
- **Global delivery.** E.164 destination numbers worldwide. No regional plan to pick.
- **Automatic page count verification.** The server counts pages after download — overpayment is not refunded, but underpayment returns an error plus an LNURL-withdraw link for a full refund of what you paid.
- **MCP-native.** Agent frameworks call the `send-fax` tool directly — the Lightning payment challenge is negotiated inside the protocol. No wallet integration, no L402 boilerplate.

---

## Quickstart

### Via MCP (agent-native — payment handled inline)

```
{
  "mcpServers": {
    "sats4ai": {
      "command": "npx",
      "args": ["-y", "sats4ai-mcp"]
    }
  }
}
```

Your agent discovers the `send-fax` tool and invokes it directly.

### Via HTTP (any language, any Lightning wallet)

```bash
# Step 1: POST without auth → receive 402 + Lightning invoice
curl -i -X POST https://sats4ai.com/api/l402/send-fax \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+14155552671",
    "mode": "pdf",
    "pdf_url": "https://example.com/signed-contract.pdf",
    "cover_text": "Re: Loan application — please see attached signed agreement.",
    "pages": 3
  }'

# Response:
#   HTTP/1.1 402 Payment Required
#   WWW-Authenticate: L402 macaroon="<b64>", invoice="lnbc..."

# Step 2: Pay the invoice with any Lightning wallet → you get a preimage

# Step 3: Retry with Authorization header
curl -X POST https://sats4ai.com/api/l402/send-fax \
  -H "Authorization: L402 <macaroon>:<preimage>" \
  -H "Content-Type: application/json" \
  -d '{ ...same body... }'

# Response:
#   { "status": "sent", "fax_id": "...", "pages": 3, "paid_pages": 10, "amount_sats": 500 }
```

See [examples/](examples/) for runnable scripts in curl, Python, and TypeScript.

---

## How it works

```
┌──────────┐   1. POST recipient + PDF URL   ┌─────────────┐
│  Client  │ ──────────────────────────────> │   Sats4AI   │
│          │                                 │   send-fax  │
│          │ <────── 402 + invoice ────────  │   endpoint  │
└──────────┘                                 └─────────────┘
      │
      │ 2. Pay via Lightning wallet
      │
      ▼
┌──────────┐   3. POST + L402 auth            Fetch PDF from URL
│  Client  │ ──────────────────────────────> (or generate from text)
│          │                                      │
│          │                                  Count pages
│          │                                      │
│          │                                  Add cover if requested
│          │                                      │
│          │                                  Send via fax infrastructure
│          │                                      │
│          │ <────── { status, fax_id, pages } ──
└──────────┘
```

---

## Pricing

- **Base: 500 sats** for up to 10 pages.
- **Overage: +50 sats** per additional page, up to 350 pages total.
- **Cover page: +1 page** (mode=pdf only).
- **Failure refund:** if the destination can't receive or the PDF is invalid post-payment, the error response includes a `refund.lnurl_withdraw` link for a full refund.

See [/api/estimate-cost](https://sats4ai.com/api/estimate-cost) to price a send before paying.

---

## Compare

| | pay-per-use-fax (Sats4AI) | Typical fax API platform |
|---|---|---|
| Signup | None | Yes, often with org verification |
| Pricing | Per fax (500 sats + overage). No monthly minimum. | Monthly subscription + per-fax on top |
| Credential | Lightning preimage | API key you have to rotate and protect |
| Global coverage | E.164 worldwide | Region-dependent plans |
| Auditability of spend | Every payment is a Lightning tx you own | Dashboard invoices |
| MCP-native | Yes | No (you integrate manually) |

---

## Real use cases

- **Send a signed contract to a bank that only accepts fax.** One-off, no reason to rent a fax line for months.
- **Agent-driven paperwork workflow.** Autonomous agents producing legal, medical, or real-estate paper trails on demand.
- **Notarization / government filings.** Offices that still require fax inbound — one 500-sat call does the job.
- **Backup channel for critical paperwork.** When email delivery is rejected, fax is still legally recognized.

---

## Request reference

| Field | Required | Example |
|---|---|---|
| `phone_number` | yes | `"+14155552671"` (destination fax, E.164) |
| `mode` | yes | `"pdf"` or `"text"` |
| `pdf_url` | if `mode=pdf` | `"https://example.com/signed-contract.pdf"` |
| `text` | if `mode=text` | `"Dear sir/madam, ..."` |
| `cover_text` | no | `"Re: Loan application — please see attached signed agreement."` (mode=pdf only, +1 page) |
| `pages` | yes | `3` (expected page count, 1–350) |

Full JSON Schema: [sats4ai.com/api/openapi.json](https://sats4ai.com/api/openapi.json) (tag: `send-fax`).

---

## Related

- [`fax-to-email`](https://github.com/cnghockey/fax-to-email) — Receive a fax to your inbox (inbound pair).
- [`ai-caller`](https://github.com/cnghockey/ai-caller) — AI voice agent API, pay per call with Lightning.
- [`book-to-audiobook`](https://github.com/cnghockey/book-to-audiobook) — Turn any book into an audiobook in 600+ languages.
- [`sats4ai-mcp`](https://github.com/cnghockey/sats4ai-mcp-server) — MCP server bundling all 35+ Sats4AI services.
- [`sats4ai-l402-examples`](https://github.com/cnghockey/sats4ai-l402-examples) — Full L402 examples across every service.

## Links

- **Sats4AI homepage** — https://sats4ai.com
- **Developer docs** — https://sats4ai.com/docs
- **OpenAPI spec** — https://sats4ai.com/api/openapi.json

## License

MIT — see [LICENSE](LICENSE).

<details>
<summary>Repository setup (for maintainers)</summary>

```bash
gh repo create cnghockey/pay-per-use-fax --public --source=. \
  --description "Pay-per-fax API — send a fax from a PDF URL or typed text, pay with Bitcoin Lightning. No contract, no monthly fee, no telecom account. MCP-native. Alternative to eFax, Phaxio, Documo, SRFax." \
  --homepage "https://sats4ai.com" \
  --push

gh repo edit cnghockey/pay-per-use-fax \
  --add-topic fax \
  --add-topic fax-api \
  --add-topic send-fax \
  --add-topic online-fax \
  --add-topic fax-service \
  --add-topic pdf-to-fax \
  --add-topic pay-per-use \
  --add-topic no-signup \
  --add-topic mcp \
  --add-topic model-context-protocol \
  --add-topic l402 \
  --add-topic lightning-network \
  --add-topic bitcoin \
  --add-topic api \
  --add-topic telecom \
  --add-topic efax-alternative \
  --add-topic phaxio-alternative \
  --add-topic documo-alternative \
  --add-topic srfax-alternative
```

</details>
