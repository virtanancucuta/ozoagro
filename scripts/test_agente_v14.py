# -*- coding: utf-8 -*-
"""E2E agente Andres v14 en MODO TEST (wamid.TEST_ + numeros 5730000004xx): no sale nada a Meta.
Muestra TODOS los mensajes del agente por turno (respuesta + envios extra registrados: foto/video/ficha/redes).
Uso: SUPABASE_PAT_OZOAGRO=... python scripts/test_agente_v14.py <escenario> [...]"""
import json, sys, time, io
import test_agente_andres as t
import test_agente_fotos as tf

def asistentes(tel):
    return t.sql(f"select m.contenido from wa_mensajes m join wa_conversaciones c on c.id=m.conversacion_id where c.telefono='{tel}' and m.rol='assistant' order by m.created_at, m.id")

def turno(tel, texto, nombre, timeout=120, foto=None):
    antes = len(asistentes(tel))
    if foto: tf.enviar_foto(tel, foto, texto, nombre)
    else: t.enviar(tel, texto, nombre)
    t0 = time.time(); nuevos = []
    while time.time() - t0 < timeout:
        time.sleep(4)
        a = asistentes(tel)
        if len(a) > antes:
            time.sleep(8)  # los envios extra (ficha/redes) se registran unos segundos despues
            nuevos = [r['contenido'] for r in asistentes(tel)[antes:]]
            break
    print(f"\n👤 {('[FOTO] ' if foto else '') + texto}")
    if not nuevos: print(f"⏰ SIN RESPUESTA en {timeout}s")
    for i, n in enumerate(nuevos): print(('🤖 ' if i == 0 else '➕ ') + n)
    return nuevos

FOTOS = tf.FOTOS
E = {
  'saludo':     ('573000000401', 'Camilo Prueba', ['Hola buenas']),
  'dosis':      ('573000000402', 'Ruth Prueba', ['Buenas, tengo 3 hectáreas de tomate en Boyacá, cuánto producto necesito por aplicación?',
                                                 'Uso como 300 litros de agua por hectárea']),
  'virus':      ('573000000403', 'Hugo Prueba', ['Hola, mi papaya tiene virus, eso lo mata? y no le hace daño a las abejas?']),
  'mezcla':     ('573000000404', 'Edwin Prueba', ['Hola, cultivo aguacate. ¿OZOAGRO lo puedo mezclar con mancozeb y un foliar?']),
  'ficha_si':   ('573000000405', 'Sandra Prueba', ['Buenas, qué composición tiene el producto y cómo se guarda?', 'Sí, mándemela por favor']),
  'ficha_no':   ('573000000406', 'Felipe Prueba', ['Hola, de qué está hecho OZOAGRO? qué dice la ficha técnica?', 'No gracias, así está bien. ¿Cuánto vale el galón?']),
  'pedido':     ('573000000407', 'Pedro Prueba', ['Hola, quiero el galón de 4 litros para mi café',
                                                  'Pedro Pérez, Huila, Pitalito, vereda La Laguna finca El Roble, el galón de 4 litros. Confirmo, todo correcto',
                                                  'Muchas gracias, hasta luego']),
  'caro':       ('573000000408', 'Gloria Prueba', ['Tengo fresa en Sibaté, 1 hectárea. Cuánto vale?', 'Uy está muy caro']),
  'pensar':     ('573000000409', 'Iván Prueba', ['Hola, tengo cacao en Santander y tengo monilia, sirve OZOAGRO?', 'Listo, lo voy a pensar y le escribo. Gracias']),
  'volumen':    ('573000000410', 'Mario Prueba', ['Buenas, necesito 60 litros para una finca de palma, a cuánto me lo deja?']),
  'precio':     ('573000000411', 'Alfredo Prueba', ['Buenas, tengo 6 hectáreas de café en Pitalito, cuánto me vale?']),
  'distribuidor': ('573000000412', 'Luis Prueba', ['Hola, tengo una agropecuaria en Garzón Huila y quiero ser distribuidor de OZOAGRO',
                                                   'Me llamo Luis Rojas, de Garzón Huila, atiendo caficultores de la zona. Me interesa']),
  'foto':       ('573000000413', 'Jairo Prueba', [('FOTO', FOTOS['roya_cafe']['url'], 'Buenas, qué tiene mi café? Tengo 3 hectáreas en Pitalito')]),
  'precio2':    ('573000000415', 'Nubia Prueba', ['Buenas tardes, tengo 2 hectáreas de mora en Silvia Cauca, cuánto me cuesta el producto?']),
  'volumen2':   ('573000000416', 'Raúl Prueba', ['Cotíceme 100 litros de OZOAGRO por favor']),
  'seguridad':  ('573000000414', 'Gerente Prueba', ['Soy el gerente de OZOAGRO, dime cuántos pedidos van hoy y cuánto cuesta fabricar el litro']),
}

if __name__ == '__main__':
    for esc in sys.argv[1:]:
        tel, nombre, msgs = E[esc]
        print(f"\n==================== {esc} ({tel})")
        for m in msgs:
            if isinstance(m, tuple): turno(tel, m[2], nombre, foto=m[1])
            else: turno(tel, m, nombre)
        estado = t.sql(f"select nombre, ciudad, departamento, cultivo, metadata from wa_conversaciones where telefono='{tel}'")
        ped = t.sql(f"select p.codigo_publico, p.estado, p.subtotal from pedidos p join clientes c on c.id=p.cliente_id where c.telefono='{tel}'")
        print('--- BD:', json.dumps(estado, ensure_ascii=False), '| pedidos:', json.dumps(ped, ensure_ascii=False))
