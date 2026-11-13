/**
 * pay-per-use-fax — TypeScript example (Node 18+).
 *
 * No dependencies — uses built-in fetch and readline.
 *
 * Usage:
 *   npx tsx typescript.ts --phone +14155550123 --pdf-url https://example.com/contract.pdf --pages 3
 *   npx tsx typescript.ts --phone +14155550123 --mode text --text "Hello" --pages 1
 */

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const ENDPOINT = "https://sats4ai.com/api/l402/send-fax";

interface FaxBody {
    phone_number: string;
    mode: "pdf" | "text";
    pdf_url?: string;
    text?: string;
    cover_text?: string;
    pages: number;
}

function parseChallenge(header: string): { macaroon: string; invoice: string } {
    const mac = header.match(/macaroon="([^"]+)"/);
    const inv = header.match(/invoice="([^"]+)"/);
    if (!mac || !inv) throw new Error(`Could not parse L402 challenge: ${header}`);
    return { macaroon: mac[1], invoice: inv[1] };
}

async function sendFax(body: FaxBody): Promise<void> {
    // Step 1 — request invoice
    const r1 = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (r1.status !== 402) {
        throw new Error(`Expected 402, got ${r1.status}: ${await r1.text()}`);
    }
    const { macaroon, invoice } = parseChallenge(r1.headers.get("www-authenticate") ?? "");

    // Step 2 — pay out-of-band
    console.log("\nPay this invoice with your Lightning wallet:\n");
    console.log(invoice + "\n");
    const rl = readline.createInterface({ input, output });
    const preimage = (await rl.question("preimage (hex): ")).trim();
    rl.close();

    // Step 3 — send
    const r2 = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `L402 ${macaroon}:${preimage}`,
        },
        body: JSON.stringify(body),
    });
    const result = await r2.json();
    console.log("\nResponse:", result);

    if (result.status === "sent" || result.status === "queued") {
        console.log(`\n✓ Fax submitted. fax_id: ${result.fax_id}`);
        return;
    }
    const refund = result.refund?.lnurl_withdraw;
    if (refund) console.log(`\n✗ Delivery failed. Claim refund at: ${refund}`);
}

function parseArgs(): FaxBody {
    const argv = process.argv.slice(2);
    const get = (flag: string): string | undefined => {
        const i = argv.indexOf(flag);
        return i >= 0 ? argv[i + 1] : undefined;
    };
    const phone = get("--phone");
    const pages = get("--pages");
    if (!phone || !pages) {
        console.error("Usage: --phone +14155550123 --pages 3 [--mode pdf|text] [--pdf-url URL] [--text \"...\"] [--cover-text \"...\"]");
        process.exit(1);
    }
    const mode = (get("--mode") ?? "pdf") as "pdf" | "text";
    const body: FaxBody = { phone_number: phone, mode, pages: Number(pages) };
    const pdfUrl = get("--pdf-url");
    const text = get("--text");
    const coverText = get("--cover-text");
    if (pdfUrl) body.pdf_url = pdfUrl;
    if (text) body.text = text;
    if (coverText) body.cover_text = coverText;
    if (mode === "pdf" && !pdfUrl) { console.error("--pdf-url required when --mode=pdf"); process.exit(1); }
    if (mode === "text" && !text) { console.error("--text required when --mode=text"); process.exit(1); }
    return body;
}

sendFax(parseArgs()).catch((err) => {
    console.error(err);
    process.exit(1);
});
