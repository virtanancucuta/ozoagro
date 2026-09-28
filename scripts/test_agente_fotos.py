# -*- coding: utf-8 -*-
"""E2E fotos: manda al webhook (modo test) un mensaje tipo image con link publico y espera la respuesta del agente."""
import json, sys, time, io
import urllib.request
import test_agente_andres as t

def enviar_foto(tel, url, caption, nombre):
    ts = int(time.time())
    img = {"id": "FAKE_" + str(ts), "mime_type": "image/jpeg", "link": url}
    if caption: img["caption"] = caption
    body = {"object": "whatsapp_business_account", "entry": [{"id": "966616536082029", "changes": [{"value": {
        "messaging_product": "whatsapp", "metadata": {"display_phone_number": "573133623071", "phone_number_id": "1151148548077223"},
        "contacts": [{"profile": {"name": nombre}, "wa_id": tel}],
        "messages": [{"from": tel, "id": f"wamid.TEST_{tel}_{ts}", "timestamp": str(ts), "type": "image", "image": img}]
    }, "field": "messages"}]}]}
    req = urllib.request.Request(t.WEBHOOK, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(req) as r: return r.status

def turno_foto(tel, url, caption, nombre, timeout=120):
    antes = t.n_assistant(tel); enviar_foto(tel, url, caption, nombre); t0 = time.time()
    while time.time() - t0 < timeout:
        time.sleep(5)
        if t.n_assistant(tel) > antes:
            resp = t.ultima(tel)
            visto = t.sql(f"select m.contenido from wa_mensajes m join wa_conversaciones c on c.id=m.conversacion_id where c.telefono='{tel}' and m.rol='user' order by m.created_at desc limit 1")
            print(f"\n📷 [{caption or 'sin texto'}]\n👁  {visto[0]['contenido'] if visto else '?'}\n🤖 {resp}")
            return resp
    print(f"\n📷 [{caption}] ⏰ SIN RESPUESTA en {timeout}s"); return None

FOTOS = json.load(open(__file__.replace('test_agente_fotos.py', 'fotos_test_commons.json'), encoding='utf-8'))
CASOS = {
  'roya':   ('573000000201', 'Jairo Prueba',  FOTOS['roya_cafe']['url'],    'Buenas, qué tiene mi café? Tengo 3 hectáreas en Pitalito'),
  'tizon':  ('573000000202', 'Nelly Prueba',  FOTOS['tizon_tomate']['url'], 'mire mi tomate'),
  'mosca':  ('573000000203', 'Omar Prueba',   FOTOS['mosca_blanca']['url'], ''),
  'sano':   ('573000000204', 'Rosa Prueba',   FOTOS['cultivo_sano']['url'], 'así va mi cultivo, sirve ozoagro?'),
  'recibo': ('573000000205', 'Diego Prueba',  FOTOS['no_planta']['url'],    ''),
}
if __name__ == '__main__':
    for k in sys.argv[1:]:
        tel, nombre, url, cap = CASOS[k]
        turno_foto(tel, url, cap, nombre)
