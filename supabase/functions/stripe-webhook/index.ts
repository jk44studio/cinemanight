// Stripe webhook → record the order and send the ticket confirmation (Resend).
// Secrets: STRIPE_WEBHOOK_SECRET, RESEND_API_KEY. Provided by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const PAYMENT_LINK = "plink_1UYGWpHLgKnvBOOEvfCu4zMO";
const UNIT_CENTS = 1200;
const FROM = "JK44 Cinema Night <tickets@jk44films.com>";
const OWNER = "jk44studio@gmail.com";
const SITE = "https://cinemanight.jk44films.com";
const MAPS = "https://www.google.com/maps/search/?api=1&query=Cine+Super+8+Palacio+de+la+Prensa+Gran+V%C3%ADa+46+28013+Madrid";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

// ---- Stripe signature (Stripe-Signature: t=...,v1=...) ----
async function verify(raw: string, header: string | null, secret: string): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2)));
  const t = Number(parts.t);
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > 600) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${raw}`));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => s.length === hex.length && [...s].every((c, i) => c === hex[i]));
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const euros = (cents: number) => (cents / 100).toLocaleString("es-ES", { minimumFractionDigits: cents % 100 ? 2 : 0 }) + " €";

type Order = { session_id: string; name: string | null; email: string; quantity: number; amount_cents: number };

function buyerEmail(o: Order) {
  const first = (o.name || "").trim().split(/\s+/)[0] || "";
  const ref = o.session_id.slice(-8).toUpperCase();
  const qty = `${o.quantity} entrada${o.quantity === 1 ? "" : "s"}`;
  const row = (k: string, v: string) =>
    `<tr><td style="padding:6px 0;color:#a39686;font:13px/1.4 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;width:120px;vertical-align:top">${k}</td><td style="padding:6px 0;color:#f3ead9;font:16px/1.4 Arial,sans-serif">${v}</td></tr>`;
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#0e0c0b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0e0c0b"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#181513;border:2px solid #f0391f;border-radius:6px">
<tr><td><img src="${SITE}/assets/og-share.jpg" width="560" alt="JK44 Cinema Night Madrid" style="display:block;width:100%;height:auto;border-radius:4px 4px 0 0"></td></tr>
<tr><td style="padding:28px 28px 8px">
<p style="margin:0 0 6px;color:#e3ad3c;font:12px/1.4 'Courier New',monospace;letter-spacing:.14em;text-transform:uppercase">Entrada confirmada · Ticket confirmed</p>
<h1 style="margin:0 0 12px;color:#f3ead9;font:900 30px/1.1 Arial Black,Arial,sans-serif;text-transform:uppercase">${first ? `¡Nos vemos, ${esc(first)}!` : "¡Nos vemos en el cine!"}</h1>
<p style="margin:0 0 18px;color:#f3ead9;font:16px/1.5 Arial,sans-serif">Tienes <b>${qty}</b> para <b>JK44 Cinema Night Madrid</b>. Guarda este email: en la puerta solo necesitamos tu nombre.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #2e2824;border-bottom:1px solid #2e2824;margin:0 0 18px">
${row("Cuándo", "Jueves 3 de diciembre de 2026 · 19:00")}
${row("Dónde", `Súper 8 Cinema · Palacio de la Prensa<br>Gran Vía, 46 · 28013 Madrid<br><a href="${MAPS}" style="color:#e3ad3c">Abrir en Maps ↗</a>`)}
${row("Entradas", `${qty} · ${euros(o.amount_cents)}`)}
${row("A nombre de", esc(o.name || o.email))}
${row("Pedido", ref)}
</table>
<p style="margin:0 0 4px;color:#f3ead9;font:900 17px/1.3 Arial Black,Arial,sans-serif;text-transform:uppercase">Tres películas. Pizza. Cerveza. Cookies.</p>
<p style="margin:0 0 18px;color:#e3ad3c;font:12px/1.4 'Courier New',monospace;letter-spacing:.1em;text-transform:uppercase">Todo incluido con tu entrada</p>
<p style="margin:0 0 22px;color:#a39686;font:15px/1.5 Arial,sans-serif">Monozukuri · Glacier Surfing · BEDI (estreno mundial)</p>
<a href="${SITE}/tickets/" style="display:inline-block;background:#f0391f;color:#f3ead9;text-decoration:none;font:800 15px/1 Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;padding:14px 20px;border-radius:3px">Ver el evento</a>
</td></tr>
<tr><td style="padding:22px 28px 26px;color:#a39686;font:13px/1.5 Arial,sans-serif">
<p style="margin:0 0 8px"><i>EN · You have ${o.quantity} ticket${o.quantity === 1 ? "" : "s"} for JK44 Cinema Night Madrid, Thursday 3 December 2026 at 19:00, Súper 8 Cinema, Gran Vía 46. Films, pizza, beer and cookies included. Just give your name at the door.</i></p>
<p style="margin:0">¿Dudas? Responde a este email. · Producido por <a href="https://jk44films.com" style="color:#f0391f;text-decoration:none"><b>JK44</b></a></p>
</td></tr></table></td></tr></table></body></html>`;
  const text = `¡Entrada confirmada!\n\nTienes ${qty} para JK44 Cinema Night Madrid.\nJueves 3 de diciembre de 2026 · 19:00\nSúper 8 Cinema · Gran Vía, 46 · 28013 Madrid\nTotal: ${euros(o.amount_cents)} · Pedido ${ref}\n\nTres películas, pizza, cerveza y cookies: todo incluido.\nEn la puerta solo necesitamos tu nombre.\n\n${SITE}/tickets/`;
  return { subject: `Tu entrada para JK44 Cinema Night Madrid · 3 dic · ${qty}`, html, text };
}

async function send(to: string, subject: string, html: string, text: string, replyTo?: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}

async function deliver(o: Order, row: { email_sent_at: string | null; owner_notified_at: string | null }) {
  if (!row.email_sent_at) {
    const m = buyerEmail(o);
    await send(o.email, m.subject, m.html, m.text, OWNER);
    await db.from("ticket_orders").update({ email_sent_at: new Date().toISOString() }).eq("session_id", o.session_id);
  }
  if (!row.owner_notified_at) {
    const { data } = await db.from("ticket_orders").select("quantity");
    const sold = (data || []).reduce((n, r) => n + (r.quantity || 0), 0);
    const subject = `Nueva venta: ${o.quantity} entrada${o.quantity === 1 ? "" : "s"} · ${o.name || o.email}`;
    const text = `${o.name || "(sin nombre)"} <${o.email}> ha comprado ${o.quantity} entrada(s) por ${euros(o.amount_cents)}.\nPedido ${o.session_id}\n\nTotal vendido por Stripe hasta ahora: ${sold} entradas.`;
    await send(OWNER, subject, `<pre style="font:14px/1.5 Arial,sans-serif">${esc(text)}</pre>`, text);
    await db.from("ticket_orders").update({ owner_notified_at: new Date().toISOString() }).eq("session_id", o.session_id);
  }
}

// One-off resend for orders recorded before this function existed: header x-backfill must match app_config.backfill_token
async function backfill(token: string) {
  const { data: cfg } = await db.from("app_config").select("value").eq("key", "backfill_token").maybeSingle();
  if (!cfg?.value || cfg.value !== token) return new Response("forbidden", { status: 403 });
  const { data: pending } = await db.from("ticket_orders").select("*").or("email_sent_at.is.null,owner_notified_at.is.null");
  const results: string[] = [];
  for (const o of pending || []) {
    try { await deliver(o, o); results.push(`sent ${o.session_id.slice(-8)}`); }
    catch (e) { results.push(`failed ${o.session_id.slice(-8)}: ${e}`); }
  }
  return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const bf = req.headers.get("x-backfill");
  if (bf) return backfill(bf);
  const raw = await req.text();
  if (!(await verify(raw, req.headers.get("stripe-signature"), Deno.env.get("STRIPE_WEBHOOK_SECRET") || ""))) {
    return new Response("bad signature", { status: 400 });
  }
  const event = JSON.parse(raw);
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) return new Response("ignored");
  const s = event.data.object;
  if (s.payment_link !== PAYMENT_LINK || s.payment_status !== "paid") return new Response("ignored");
  const email = s.customer_details?.email;
  if (!email) return new Response("no email", { status: 200 });
  const order: Order = {
    session_id: s.id,
    name: s.collected_information?.individual_name || s.customer_details?.name || null,
    email,
    quantity: Math.max(1, Math.round((s.amount_total || UNIT_CENTS) / UNIT_CENTS)),
    amount_cents: s.amount_total || 0,
  };
  await db.from("ticket_orders").upsert({ ...order, paid_at: new Date((s.created || Date.now() / 1000) * 1000).toISOString() }, { onConflict: "session_id", ignoreDuplicates: true });
  const { data: row } = await db.from("ticket_orders").select("email_sent_at, owner_notified_at").eq("session_id", order.session_id).single();
  try {
    await deliver(order, row || { email_sent_at: null, owner_notified_at: null });
  } catch (e) {
    console.error(e);
    return new Response("email failed", { status: 500 });   // Stripe retries automatically
  }
  return new Response("sent");
});
