# -*- coding: utf-8 -*-
"""Prueba de ENTREGA REAL (no modo test): simula mensajes del numero de Jorge al numero de OZOAGRO y el agente
responde DE VERDAD por WhatsApp. Solo sirve si Jorge escribio al 315 136 5525 en las ultimas 24 h (ventana de Meta).
Despues revisa en las ejecuciones los estados que manda Meta (sent / delivered / read / failed).
Uso: SUPABASE_PAT_OZOAGRO=... python scripts/test_entrega_real.py"""
import json, sys, time, io, urllib.request
import test_agente_andres as t
WEBHOOK = t.WEBHOOK
JORGE = '573172625415'; OZO_PID = '1436278792892245'

def enviar(texto):
    ts = int(time.time())
    body = {"object": "whatsapp_business_account", "entry": [{"id": "1617597820046858", "changes": [{"value": {
        "messaging_product": "whatsapp", "metadata": {"display_phone_number": "573151365525", "phone_number_id": OZO_PID},
        "contacts": [{"profile": {"name": "jorge"}, "wa_id": JORGE}],
        "messages": [{"from": JORGE, "id": f"wamid.AUDITORIA_{ts}_{abs(hash(texto)) % 100000}", "timestamp": str(ts), "type": "text", "text": {"body": texto}}]
    }, "field": "messages"}]}]}
    req = urllib.request.Request(WEBHOOK, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(req) as r: return r.status

def asistentes():
    return t.sql(f"select m.contenido from wa_mensajes m join wa_conversaciones c on c.id=m.conversacion_id where c.telefono='{JORGE}' and m.rol='assistant' order by m.created_at, m.id")

for texto in ['Hola, ¿qué composición tiene el producto OZOAGRO?', 'Sí, mándemela por favor', 'Gracias, lo voy a pensar']:
    antes = len(asistentes()); enviar(texto); t0 = time.time(); nuevos = []
    while time.time() - t0 < 120:
        time.sleep(4)
        if len(asistentes()) > antes:
            time.sleep(10); nuevos = [r['contenido'] for r in asistentes()[antes:]]; break
    print(f"\n👤 {texto}")
    for i, n in enumerate(nuevos): print(('🤖 ' if i == 0 else '➕ ') + n[:200])
    if not nuevos: print('⏰ sin respuesta')
print('\n--- metadata:', json.dumps(t.sql(f"select metadata from wa_conversaciones where telefono='{JORGE}'"), ensure_ascii=False))
