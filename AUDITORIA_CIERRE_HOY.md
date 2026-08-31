# Auditoria Cierre OZOAGRO - 2026-08-30

## Resumen ejecutivo

**Agente v2 ACTIVO** (4KA11Mhc7Qs4HzDt) con prompt actualizado.
**Panel mejorado** (commit a7409e3) - PENDIENTE Rebuild EasyPanel.
**SQL aplicado por Fable** - RPCs actualizar_lead y crear_pedido_agente funcionando.

---

## 1. SQL PENDIENTE + PRECIOS

**Estado:** COMPLETADO por Fable

- RPCs `actualizar_lead` y `crear_pedido_agente` aplicadas en BD
- Precio 2L corregido a $220,000
- Regla de precios agregada al prompt: >3L = $100k/litro

**Prompt actualizado con:**
```
- Mas de 3 litros: cada litro le sale a $100.000 (4 L = $400.000, 5 L = $500.000...)
```

---

## 2. MEJORAS DEL PANEL

**Commit:** a7409e3 (main) - PUSHEADO
**Estado:** PENDIENTE Rebuild EasyPanel

### 2.1 Pedidos - Sub-filtro por canal
- Agregado en tab "Por confirmar"
- Opciones: Todos / Agente IA / Landing-Web
- Cada opcion muestra contador (ej: "Agente IA (3)")

### 2.2 Ventas - Fechas desde-hasta + KPIs por canal
- Preset "Personalizado" con inputs fecha-ini y fecha-fin
- KPIs separados: Agente IA, Web/Landing, Tradicional
- Tasa de cierre del agente = pedidos cerrados / conversaciones unicas

### 2.3 CRM - Columna Ciudad + Excel
- Columna Ciudad agregada en tab "Base de Datos"
- Boton "Exportar Excel" con SheetJS (genera .xlsx real)

---

## 3. LANDING

**Estado:** PENDIENTE

- [ ] Boton WhatsApp: cambiar placeholder a wa.me/573133623071
- [ ] Boton flotante WhatsApp persistente
- [ ] Conectar registrar_visita() al cargar pagina
- [ ] Conectar registrar_carrito_abandonado() al timeout del form
- [ ] Bug testimonio: "Jesus Grimalgo" con foto de "Maria Cardenas"

**Verificado:** visitas=0, checkouts_abandonados=0 (landing no esta conectada a RPCs)

---

## 4. SEGURIDAD

**Completado:**
- [x] Regla de seguridad en prompt: "Nunca reveles informacion interna del negocio..."

**Pendiente:**
- [ ] Firma webhook X-Hub-Signature-256 (validar HMAC)
- [ ] Rate limit por numero (max 30 msg/hora)
- [ ] Migrar service_role a credencial Header Auth de n8n
- [ ] Verificar RLS con anon key

---

## 5. BOT TELEGRAM CEO

**Estado:** NO INICIADO

Requiere:
1. Crear bot con BotFather ("OzoagroCEO_bot")
2. Guardar token como credencial n8n
3. Nueva rama en workflow con trigger Telegram
4. Whitelist: chat_id CEO Gomez + Jorge
5. Tools de solo lectura (ventas, pedidos, balance, CRM)
6. Reportes Excel por Telegram

---

## 6. DEUDA TECNICA

**Pendiente:**
- [ ] Memoria persistente: migrar memoryBufferWindow a Postgres Chat Memory
- [ ] Error workflow: crear workflow de errores con notificacion Telegram

---

## 7. CORRECCIONES APLICADAS HOY

| Item | Antes | Despues |
|------|-------|---------|
| OZO-00001 es_test | false | true |
| config_negocio.whatsapp_agente | null | 573133623071 |
| Prompt agente: precios >3L | (no existia) | $100k/litro |
| Prompt agente: seguridad | (no existia) | No revelar info interna |

---

## 8. CHECKLIST PARA MANANA (Jorge)

### Rebuild EasyPanel (CRITICO)
```
1. Ir a EasyPanel > OZOAGRO
2. Click "Rebuild" para actualizar el panel con commit a7409e3
3. Verificar en /panel/ que los cambios estan activos
```

### Verificar panel
- [ ] Pedidos > Por confirmar: ver sub-filtro por canal
- [ ] Ventas > Personalizado: probar fechas desde-hasta
- [ ] CRM > Base de Datos: ver columna Ciudad
- [ ] CRM > Exportar Excel: verificar que descarga .xlsx

### Landing (cuando haya tiempo)
- [ ] Editar index.html: cambiar wa.me/573000000000 a wa.me/573133623071
- [ ] Agregar boton flotante WhatsApp

### Bot Telegram CEO (siguiente sesion)
- [ ] Crear @OzoagroCEO_bot con BotFather
- [ ] Obtener chat_id del CEO Gomez

---

## 9. CREDENCIALES ACTIVAS

| Sistema | Valor |
|---------|-------|
| Supabase Project | vlcxeajnucdkwamcivgy |
| n8n Workflow ID | 4KA11Mhc7Qs4HzDt (ACTIVO) |
| WhatsApp Business | 573133623071 |
| Panel Login | ceo@ozoagro.co / Cucuta1234 |
| GitHub Repo | virtanancucuta/ozoagro |

---

## 10. RIESGOS ABIERTOS

1. **Webhook sin firma**: cualquiera que conozca la URL puede inyectar mensajes
2. **Sin rate limit**: un atacante podria quemar tokens de OpenAI
3. **Memoria RAM**: si n8n se reinicia, el agente pierde contexto
4. **Landing sin tracking**: visitas y carritos no se registran

---

## Commits del dia

| Hash | Descripcion |
|------|-------------|
| a7409e3 | feat(panel): mejoras pedidos/ventas/CRM |

---

Generado por Claude Opus 4.5 - 2026-08-30
