// OZOAGRO — gestión de distribuidores (solo el CEO). Crea el usuario de Auth con service_role y la fila en distribuidores.
// acciones: crear | resetear_clave | activar | desactivar
// El usuario escribe "usuario" y "clave"; internamente el login es usuario@distribuidores.ozoagro.co
import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DOMINIO = "distribuidores.ozoagro.co";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const slugify = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
const digitos = (s: unknown) => String(s ?? "").replace(/\D/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "método no permitido" }, 405);
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ ok: false, error: "sin sesión" }, 401);

  // 1) ¿Quién llama? Solo el CEO (es_ceo() con el JWT del usuario)
  const userClient = createClient(URL, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: esCeo, error: eCeo } = await userClient.rpc("es_ceo");
  if (eCeo || esCeo !== true) return json({ ok: false, error: "solo el CEO puede gestionar distribuidores" }, 403);

  const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
  const body = await req.json().catch(() => ({}));
  const accion = String(body.accion || "");

  if (accion === "crear") {
    const nombre = String(body.nombre || "").trim();
    const usuario = String(body.usuario || "").trim().toLowerCase();
    const clave = String(body.clave || "");
    const slug = slugify(body.slug || nombre);
    if (nombre.length < 3) return json({ ok: false, error: "nombre muy corto" }, 400);
    if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) return json({ ok: false, error: "usuario inválido: 3 a 30 letras, números, punto, guion" }, 400);
    if (clave.length < 8) return json({ ok: false, error: "la clave debe tener al menos 8 caracteres" }, 400);
    if (!/^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])$/.test(slug)) return json({ ok: false, error: "slug inválido: 3 a 30 caracteres, minúsculas, números y guiones" }, 400);
    const { data: dup } = await admin.from("distribuidores").select("id, slug, usuario").or(`slug.eq.${slug},usuario.eq.${usuario}`).limit(1);
    if (dup && dup.length) return json({ ok: false, error: dup[0].slug === slug ? `el enlace /${slug} ya está en uso` : `el usuario ${usuario} ya existe` }, 409);
    const { data: reservado } = await admin.from("slugs_reservados").select("slug").eq("slug", slug).limit(1);
    if (reservado && reservado.length) return json({ ok: false, error: `el enlace /${slug} está reservado` }, 400);

    const email = `${usuario}@${DOMINIO}`;
    const { data: nuevo, error: eUser } = await admin.auth.admin.createUser({
      email, password: clave, email_confirm: true,
      user_metadata: { rol: "distribuidor", usuario, nombre },
    });
    if (eUser || !nuevo?.user) return json({ ok: false, error: "no se pudo crear el usuario: " + (eUser?.message || "") }, 400);

    const fila = {
      slug, nombre, usuario, auth_user_id: nuevo.user.id,
      cedula: String(body.cedula || "").trim() || null,
      ciudad: String(body.ciudad || "").trim() || null,
      departamento: String(body.departamento || "").trim() || null,
      telefono: digitos(body.telefono) || null,
      whatsapp: digitos(body.whatsapp) || digitos(body.telefono) || null,
      email: String(body.email || "").trim().toLowerCase() || null,
      notas: String(body.notas || "").trim() || null,
      es_test: body.es_test === true,
      activo: true,
    };
    if (fila.whatsapp && fila.whatsapp.length === 10 && fila.whatsapp.startsWith("3")) fila.whatsapp = "57" + fila.whatsapp;
    const { data: d, error: eIns } = await admin.from("distribuidores").insert(fila).select().single();
    if (eIns) {
      await admin.auth.admin.deleteUser(nuevo.user.id).catch(() => {});   // rollback del usuario
      return json({ ok: false, error: "no se pudo guardar el distribuidor: " + eIns.message }, 400);
    }
    return json({ ok: true, distribuidor: d, login: { usuario, email, landing: `https://ozoagro.co/${slug}` } });
  }

  // acciones sobre uno existente
  const id = String(body.id || "");
  if (!id) return json({ ok: false, error: "falta id" }, 400);
  const { data: dist } = await admin.from("distribuidores").select("id, auth_user_id, usuario, activo").eq("id", id).single();
  if (!dist) return json({ ok: false, error: "distribuidor no encontrado" }, 404);

  if (accion === "resetear_clave") {
    const clave = String(body.clave || "");
    if (clave.length < 8) return json({ ok: false, error: "la clave debe tener al menos 8 caracteres" }, 400);
    if (!dist.auth_user_id) return json({ ok: false, error: "el distribuidor no tiene usuario" }, 400);
    const { error } = await admin.auth.admin.updateUserById(dist.auth_user_id, { password: clave });
    if (error) return json({ ok: false, error: error.message }, 400);
    return json({ ok: true });
  }
  if (accion === "activar" || accion === "desactivar") {
    const activo = accion === "activar";
    if (dist.auth_user_id) {
      const { error } = await admin.auth.admin.updateUserById(dist.auth_user_id, { ban_duration: activo ? "none" : "876000h" });
      if (error) return json({ ok: false, error: error.message }, 400);
    }
    const { error: eUpd } = await admin.from("distribuidores").update({ activo, updated_at: new Date().toISOString() }).eq("id", id);
    if (eUpd) return json({ ok: false, error: eUpd.message }, 400);
    return json({ ok: true, activo });
  }
  return json({ ok: false, error: "acción desconocida" }, 400);
});
