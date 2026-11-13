#!/usr/bin/env bash
#
# pay-per-use-fax — bash / curl example
#
# Requires:
#   - curl, jq
#   - any Lightning wallet that can pay a bolt11 and return a preimage
#
# Usage:
#   PHONE="+14155550123" PDF_URL="https://example.com/contract.pdf" PAGES=3 ./curl.sh

set -euo pipefail

ENDPOINT="${ENDPOINT:-https://sats4ai.com/api/l402/send-fax}"
PHONE="${PHONE:?set PHONE in E.164 format, e.g. +14155550123}"
MODE="${MODE:-pdf}"
PDF_URL="${PDF_URL:-}"
TEXT="${TEXT:-}"
COVER_TEXT="${COVER_TEXT:-}"
PAGES="${PAGES:?set PAGES to expected page count (1-350)}"

if [[ "$MODE" == "pdf" && -z "$PDF_URL" ]]; then
  echo "set PDF_URL when MODE=pdf" >&2; exit 1
fi
if [[ "$MODE" == "text" && -z "$TEXT" ]]; then
  echo "set TEXT when MODE=text" >&2; exit 1
fi

BODY=$(jq -n \
  --arg phone_number "$PHONE" \
  --arg mode "$MODE" \
  --arg pdf_url "$PDF_URL" \
  --arg text "$TEXT" \
  --arg cover_text "$COVER_TEXT" \
  --argjson pages "$PAGES" \
  '{phone_number:$phone_number, mode:$mode, pages:$pages}
   + (if $pdf_url    == "" then {} else {pdf_url:$pdf_url}    end)
   + (if $text       == "" then {} else {text:$text}          end)
   + (if $cover_text == "" then {} else {cover_text:$cover_text} end)')

echo "→ Step 1: requesting invoice"
HEADERS=$(curl -si -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "$BODY" | tr -d '\r')

WWW_AUTH=$(echo "$HEADERS" | awk 'tolower($1)=="www-authenticate:" {sub(/^[^:]+:[ ]*/,""); print; exit}')
MACAROON=$(echo "$WWW_AUTH" | sed -n 's/.*macaroon="\([^"]*\)".*/\1/p')
INVOICE=$(echo "$WWW_AUTH"  | sed -n 's/.*invoice="\([^"]*\)".*/\1/p')

if [[ -z "$MACAROON" || -z "$INVOICE" ]]; then
  echo "  ✗ Did not receive a 402 challenge. Response headers:" >&2
  echo "$HEADERS" >&2
  exit 1
fi

echo "  ✓ Got invoice"
echo ""
echo "→ Step 2: pay this invoice with your Lightning wallet, then paste the preimage"
echo ""
echo "$INVOICE"
echo ""
read -rp "preimage (hex): " PREIMAGE

echo "→ Step 3: sending fax"
RESPONSE=$(curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: L402 ${MACAROON}:${PREIMAGE}" \
  -d "$BODY")

echo "$RESPONSE" | jq .

STATUS=$(echo "$RESPONSE" | jq -r '.status // empty')
if [[ "$STATUS" == "sent" || "$STATUS" == "queued" ]]; then
  echo ""
  echo "✓ Fax submitted. fax_id: $(echo "$RESPONSE" | jq -r '.fax_id')"
else
  REFUND=$(echo "$RESPONSE" | jq -r '.refund.lnurl_withdraw // empty')
  if [[ -n "$REFUND" ]]; then
    echo ""
    echo "✗ Delivery failed. Claim refund at: $REFUND"
  fi
fi
