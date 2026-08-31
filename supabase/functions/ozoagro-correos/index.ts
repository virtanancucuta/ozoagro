// OZOAGRO — correos transaccionales de pedidos vía Resend
// Disparada por el trigger trg_pedidos_correos (pg_net) con header x-correos-secret.
// tipos: nuevo_pedido (cliente + aviso interno al CEO) | despachado (cliente, con guía)
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const COP = (n: number) => "$" + Math.round(Number(n || 0)).toLocaleString("es-CO");
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

function layout(titulo: string, cuerpo: string, pie: string) {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#F0FDF4;font-family:Arial,Helvetica,sans-serif;color:#14532D">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F0FDF4;padding:24px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #BBF7D0">
    <tr><td style="background:#15803D;padding:20px 28px;color:#fff;font-size:22px;font-weight:bold"><span style="color:#FCD34D">OZO</span>AGRO</td></tr>
    <tr><td style="padding:28px">
      <h1 style="margin:0 0 12px;font-size:22px;color:#14532D">${titulo}</h1>
      ${cuerpo}
    </td></tr>
    <tr><td style="padding:16px 28px;background:#F0FDF4;color:#3f6b4f;font-size:12px;line-height:1.5">${pie}</td></tr>
  </table></td></tr></table></body></html>`;
}

function tablaItems(items: any[], subtotal: number) {
  const filas = items.map((i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #E5F3E8">${esc(i.producto?.nombre || "OZOAGRO")} × ${i.cantidad}</td><td align="right" style="padding:8px 0;border-bottom:1px solid #E5F3E8">${COP(i.precio_unitario * i.cantidad)}</td></tr>`).join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:15px;margin:16px 0">${filas}
    <tr><td style="padding:8px 0">Envío a toda Colombia</td><td align="right" style="padding:8px 0;color:#15803D;font-weight:bold">GRATIS</td></tr>
    <tr><td style="padding:10px 0;font-weight:bold;font-size:17px">Total</td><td align="right" style="padding:10px 0;font-weight:bold;font-size:17px;color:#15803D">${COP(subtotal)}</td></tr></table>`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // 1) Autenticación por secreto compartido
  const { data: sec } = await sb.from("app_secretos").select("clave, valor").in("clave", ["CORREOS_SECRET", "RESEND_API_KEY"]);
  const secretos = Object.fromEntries((sec || []).map((r: any) => [r.clave, r.valor]));
  if (!secretos.CORREOS_SECRET || req.headers.get("x-correos-secret") !== secretos.CORREOS_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: "no autorizado" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  if (!secretos.RESEND_API_KEY) return json({ ok: false, error: "sin RESEND_API_KEY" }, 500);

  const { pedido_id, tipo } = await req.json().catch(() => ({}));
  if (!pedido_id || !["nuevo_pedido", "despachado"].includes(tipo)) return json({ ok: false, error: "payload inválido" }, 400);

  // 2) Datos
  const { data: p, error } = await sb.from("pedidos")
    .select("id, codigo_publico, canal, estado, subtotal, ciudad_envio, direccion_envio, guia, transportadora, fecha_despachado, created_at, cliente:clientes(nombre, email, telefono, tipo, ciudad, departamento), items:pedido_items(cantidad, precio_unitario, litros, producto:productos(nombre))")
    .eq("id", pedido_id).single();
  if (error || !p) return json({ ok: false, error: "pedido no encontrado" }, 404);
  const { data: cfg } = await sb.from("config_negocio").select("nombre, email_remitente, email_ceo, whatsapp_agente, correos_activos").limit(1).single();
  if (cfg && cfg.correos_activos === false) return json({ ok: true, omitido: "correos desactivados" });

  const from = cfg?.email_remitente || "OZOAGRO <onboarding@resend.dev>";
  const cliente: any = p.cliente || {};
  const items: any[] = p.items || [];
  const nombre = (cliente.nombre || "").split(" ")[0] || "amigo";
  const esDistribuidor = cliente.tipo === "distribuidor";
  const wa = cfg?.whatsapp_agente ? `https://wa.me/${String(cfg.whatsapp_agente).replace(/\D/g, "")}` : "https://ozoagro.co";
  const pie = `OZOAGRO Colombia · <a href="https://ozoagro.co" style="color:#15803D">ozoagro.co</a> · Bioinsecticida y biofungicida ecológico a base de ozono.<br>¿Dudas? Escríbenos por WhatsApp: <a href="${wa}" style="color:#15803D">${esc(cfg?.whatsapp_agente || "")}</a>`;

  const envios: { to: string; subject: string; html: string; tipo: string }[] = [];

  if (tipo === "nuevo_pedido") {
    if (cliente.email) {
      const pago = esDistribuidor
        ? `<p style="font-size:15px;line-height:1.6">Nuestro equipo te confirmará el despacho y las condiciones acordadas.</p>`
        : `<p style="font-size:15px;line-height:1.6"><strong>No pagas nada ahora.</strong> Uno de nuestros asesores te llamará para confirmar el pedido y luego lo despachamos por transportadora. <strong>El envío es gratis</strong> y pagas en efectivo cuando lo recibas en tu casa o finca.</p>`;
      envios.push({
        tipo: "nuevo_pedido", to: cliente.email,
        subject: `Recibimos tu pedido ${p.codigo_publico} — OZOAGRO`,
        html: layout(`¡Gracias, ${esc(nombre)}! Recibimos tu pedido`,
          `<p style="font-size:15px;line-height:1.6">Tu pedido <strong>${esc(p.codigo_publico)}</strong> quedó registrado.</p>
           ${tablaItems(items, p.subtotal)}
           <p style="font-size:14px;color:#3f6b4f;margin:0 0 8px"><strong>Entrega:</strong> ${esc(p.direccion_envio || "")}${p.ciudad_envio ? ", " + esc(p.ciudad_envio) : ""}${cliente.departamento ? ", " + esc(cliente.departamento) : ""}</p>
           ${pago}
           <p style="margin:24px 0 0"><a href="${wa}" style="display:inline-block;background:#15803D;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold">Hablar con un asesor por WhatsApp</a></p>`, pie),
      });
    }
    if (cfg?.email_ceo) {
      envios.push({
        tipo: "interno_nuevo_pedido", to: cfg.email_ceo,
        subject: `Nuevo pedido ${p.codigo_publico} · ${esc(cliente.nombre || "Sin nombre")} · ${COP(p.subtotal)} (${p.canal})`,
        html: layout(`Nuevo pedido por confirmar: ${esc(p.codigo_publico)}`,
          `<p style="font-size:15px;line-height:1.7"><strong>Cliente:</strong> ${esc(cliente.nombre || "-")} (${esc(cliente.tipo || "generico")})<br>
           <strong>Teléfono:</strong> <a href="https://wa.me/${String(cliente.telefono || "").replace(/\D/g, "").replace(/^(3\d{9})$/, "57$1")}" style="color:#15803D">${esc(cliente.telefono || "-")}</a><br>
           <strong>Ciudad:</strong> ${esc(p.ciudad_envio || cliente.ciudad || "-")}${cliente.departamento ? ", " + esc(cliente.departamento) : ""}<br>
           <strong>Dirección:</strong> ${esc(p.direccion_envio || "-")}<br>
           <strong>Canal:</strong> ${esc(p.canal)} · <strong>Correo cliente:</strong> ${esc(cliente.email || "no dejó")}</p>
           ${tablaItems(items, p.subtotal)}
           <p style="margin:20px 0 0"><a href="https://ozoagro.co/panel/" style="display:inline-block;background:#15803D;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold">Confirmar en el panel</a></p>`,
          "Aviso interno del panel OZOAGRO."),
      });
    }
  } else if (tipo === "despachado") {
    if (cliente.email) {
      const pago = esDistribuidor ? "" : `<p style="font-size:15px;line-height:1.6">Recuerda: <strong>el envío es gratis</strong> y pagas en efectivo al recibirlo.</p>`;
      envios.push({
        tipo: "despachado", to: cliente.email,
        subject: `Tu pedido ${p.codigo_publico} va en camino — guía ${p.guia}`,
        html: layout(`${esc(nombre)}, tu OZOAGRO ya salió`,
          `<p style="font-size:15px;line-height:1.6">Despachamos tu pedido <strong>${esc(p.codigo_publico)}</strong> por <strong>${esc(p.transportadora || "transportadora")}</strong>.</p>
           <p style="font-size:18px;margin:16px 0;padding:14px 18px;background:#F0FDF4;border:1px dashed #15803D;border-radius:12px"><strong>Guía:</strong> ${esc(p.guia)}</p>
           <p style="font-size:15px;line-height:1.6">Llega en 2 a 5 días hábiles a: ${esc(p.direccion_envio || "")}${p.ciudad_envio ? ", " + esc(p.ciudad_envio) : ""}.</p>
           ${tablaItems(items, p.subtotal)}
           ${pago}
           <p style="font-size:14px;line-height:1.6;color:#3f6b4f">Dosis: 5 ml por litro de agua. Aplica cada 7 días en lluvias y cada 15 en época seca. Puedes cosechar el mismo día de la aplicación.</p>`, pie),
      });
    }
  }

  if (envios.length === 0) {
    await sb.from("correos_enviados").insert({ pedido_id, tipo, estado: "omitido", error: "cliente sin correo" });
    return json({ ok: true, omitido: "cliente sin correo" });
  }

  // 3) Enviar y registrar
  const resultados: any[] = [];
  for (const e of envios) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretos.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [e.to], subject: e.subject, html: e.html }),
    });
    const body = await r.json().catch(() => ({}));
    const ok = r.ok && body?.id;
    await sb.from("correos_enviados").insert({
      pedido_id, tipo: e.tipo, destinatario: e.to, asunto: e.subject,
      estado: ok ? "enviado" : "error", resend_id: ok ? body.id : null,
      error: ok ? null : `${r.status}: ${body?.message || JSON.stringify(body)}`.slice(0, 500),
    });
    resultados.push({ tipo: e.tipo, to: e.to, ok, id: body?.id, error: ok ? undefined : body?.message });
  }
  return json({ ok: true, resultados });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
