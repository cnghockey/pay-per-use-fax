"""
pay-per-use-fax — Python example.

Requires:
    pip install requests

Usage:
    python python.py --phone +14155552671 --pdf-url https://example.com/contract.pdf --pages 3
    python python.py --phone +14155552671 --mode text --text "Hello, this is a fax" --pages 1
"""

from __future__ import annotations

import argparse
import re
import sys

import requests

ENDPOINT = "https://sats4ai.com/api/l402/send-fax"


def parse_challenge(www_authenticate: str) -> tuple[str, str]:
    mac = re.search(r'macaroon="([^"]+)"', www_authenticate)
    inv = re.search(r'invoice="([^"]+)"', www_authenticate)
    if not (mac and inv):
        raise RuntimeError(f"Could not parse L402 challenge: {www_authenticate!r}")
    return mac.group(1), inv.group(1)


def send_fax(body: dict) -> None:
    # Step 1 — request invoice
    r = requests.post(ENDPOINT, json=body)
    if r.status_code != 402:
        sys.exit(f"Expected 402, got {r.status_code}: {r.text}")
    macaroon, invoice = parse_challenge(r.headers["WWW-Authenticate"])

    # Step 2 — pay out-of-band
    print("\nPay this invoice with your Lightning wallet:\n")
    print(invoice + "\n")
    preimage = input("preimage (hex): ").strip()

    # Step 3 — send
    r = requests.post(
        ENDPOINT,
        json=body,
        headers={"Authorization": f"L402 {macaroon}:{preimage}"},
    )
    result = r.json()
    print("\nResponse:", result)

    status = result.get("status")
    if status in {"sent", "queued"}:
        print(f"\n✓ Fax submitted. fax_id: {result.get('fax_id')}")
        return

    refund = (result.get("refund") or {}).get("lnurl_withdraw")
    if refund:
        print(f"\n✗ Delivery failed. Claim refund at: {refund}")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--phone", required=True, help="Destination fax number in E.164")
    p.add_argument("--mode", choices=["pdf", "text"], default="pdf")
    p.add_argument("--pdf-url", default=None, help="Public HTTPS URL returning application/pdf (mode=pdf)")
    p.add_argument("--text", default=None, help="Typed message text (mode=text)")
    p.add_argument("--cover-text", default=None, help="Optional cover page (mode=pdf only, +1 page)")
    p.add_argument("--pages", type=int, required=True, help="Expected page count (1–350)")
    args = p.parse_args()

    if args.mode == "pdf" and not args.pdf_url:
        sys.exit("--pdf-url is required when --mode=pdf")
    if args.mode == "text" and not args.text:
        sys.exit("--text is required when --mode=text")

    body: dict = {
        "phone_number": args.phone,
        "mode": args.mode,
        "pages": args.pages,
    }
    if args.pdf_url:
        body["pdf_url"] = args.pdf_url
    if args.text:
        body["text"] = args.text
    if args.cover_text:
        body["cover_text"] = args.cover_text

    send_fax(body)


if __name__ == "__main__":
    main()
