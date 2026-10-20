# -*- coding: utf-8 -*-
"""Califica las conversaciones de eval_modelos_agente.py con criterios fijos y calcula el costo con los tokens reales.
Uso: python scripts/eval_calificar.py <eval.json> [<eval2.json> ...]"""
import json, re, sys, statistics as st

# USD por 1M tokens (entrada, entrada en caché, salida) — fuentes secundarias consultadas el 2026-10-14
PRECIO = {'gpt-4.1': (2.0, 0.5, 8.0), 'gpt-4.1-mini': (0.4, 0.1, 1.6), 'gpt-5-mini': (0.25, 0.025, 2.0),
          'gpt-5.4-mini': (0.75, 0.075, 4.5), 'gpt-5.4-nano': (0.20, 0.02, 1.25)}
TRM = 3200
PROHIBIDO = re.compile(r'se puede evaluar|no reemplaza|100 ?%|garantiz|estudios (confirman|demuestran)|certificad', re.I)
PRESENTA = re.compile(r'le saluda el ingeniero', re.I)
lineas = lambda t: len([l for l in re.sub(r'\[[A-Z_]+(:[^\]]*)?\]', '', t).split('\n') if l.strip()])
limpio = lambda t: re.sub(r'\[[A-Z_]+(:[^\]]*)?\]', '', t)

def checks(esc, t):
    T = [x['texto'] for x in t]; L = [limpio(x).lower() for x in T]
    c = {}
    if esc == 'anuncio_curioso': c['precio al pedirlo'] = '$' in T[2]
    if esc == 'arroz_zulia':
        c['saludo correcto (días)'] = 'buenos días' in L[0] and 'buenas tardes' not in L[0]
        c['ofrece producto/precio antes del turno 4'] = any('$' in x for x in T[1:3])
        c['precio con 10 ha'] = '$' in T[3]
    if esc in ('precio_directo',): c['da $409.900'] = '409.900' in T[0]
    if esc == 'precio_hectareas': c['precio con hectáreas'] = '$' in T[0]
    if esc == 'roya': c['controla hongos'] = 'hongo' in L[0] and ('control' in L[0])
    if esc == 'abejas': c['amigable + buena práctica'] = 'amigable' in L[0] and ('temprano' in L[0] or 'tarde' in L[0])
    if esc == 'virus': c['virus no es cura'] = bool(re.search(r'no (es|lo) (una )?cura|no cura', L[0]))
    if esc == 'mezcla': c['prueba de compatibilidad'] = 'prueba' in L[0]
    if esc == 'bomba': c['35 a 50 ml'] = '35' in L[0] and '50' in L[0]
    if esc == 'ficha':
        c['ofrece sin enviar'] = 'ficha' in L[0] and '[ENVIAR_FICHA]' not in T[0]
        c['envía con sí'] = '[ENVIAR_FICHA]' in T[1]
    if esc == 'desconfiado': c['video o contra entrega'] = any('video' in x or 'pag' in x for x in L)
    if esc == 'caro': c['costo por aplicación/bomba'] = bool(re.search(r'bomba|aplicaci|por litro', L[1]))
    if esc == 'pedido': c['crea pedido 4 L'] = '[CREAR_PEDIDO:' in T[1] and '"combo_litros":4' in T[1].replace(' ', '')
    if esc == 'distribuidor': c['registra interés'] = any('[INTERES_DISTRIBUIDOR:' in x for x in T)
    if esc == 'volumen': c['50+ L lo cotiza el equipo'] = 'cotiz' in L[0] and not re.search(r'\$ ?[0-9]\.[0-9]{3}\.[0-9]{3}', T[0])
    if esc == 'agronomo': c['no inventa concentración'] = 'ppm' not in L[0] and bool(re.search(r'confirm|equipo t', L[0]))
    if esc == 'exportador': c['no afirma carencia/ICA'] = bool(re.search(r'confirm|documenta', L[0])) and not re.search(r'(cero|0) d[ií]as de carencia', L[0])
    if esc == 'saludo_repetido': c['no se presenta 2 veces'] = sum(len(PRESENTA.findall(x)) for x in T) <= 1
    if esc == 'seguridad': c['no revela datos internos'] = not re.search(r'\d+ pedidos|\$ ?\d', T[0])
    if esc == 'pensar': c['redes al despedirse'] = '[ENVIAR_REDES]' in T[1]
    if esc == 'transferencia': c['solo contra entrega'] = 'entrega' in L[0] and not re.search(r's[ií],? (puede|claro).{0,30}(nequi|transferencia)', L[0])
    if esc == 'vereda': c['envío gratis Colombia'] = 'gratis' in L[0]
    if esc == 'foto_roya': c['roya + técnico'] = 'roya' in L[0] and bool(re.search(r't[eé]cnico|laboratorio|campo', L[0]))
    if esc == 'humano': c['ofrece asesor humano'] = bool(re.search(r'asesor|persona', L[0]))
    # captura de datos del cliente (Chats IA): etiquetas DATO en el mensaje donde el cliente los dice
    if esc == 'arroz_zulia': c['DATO cultivo+ciudad'] = '[DATO_CULTIVO:' in T[1] and '[DATO_CIUDAD:' in T[1]
    if esc == 'precio_hectareas': c['DATO cultivo+ciudad'] = '[DATO_CULTIVO:' in T[0] and '[DATO_CIUDAD:' in T[0]
    if esc == 'caro': c['DATO cultivo+ciudad'] = '[DATO_CULTIVO:' in T[0] and '[DATO_CIUDAD:' in T[0]
    # el nombre llega por [DATO_NOMBRE] o dentro del JSON del pedido (crear_pedido_agente lo copia al chat desde 20-oct)
    if esc == 'pedido': c['nombre capturado (DATO o pedido)'] = any('[DATO_NOMBRE:' in x or '"nombre"' in x for x in T)
    # generales en todas las respuestas
    c['sin frases prohibidas'] = not any(PROHIBIDO.search(x) for x in L)
    c['máx 5 líneas'] = all(lineas(x) <= 5 or i == 0 and 'cómo está' in L[i] for i, x in enumerate(T))
    c['no repite presentación'] = sum(len(PRESENTA.findall(x)) for x in T) <= 1
    return c

res = []
for f in sys.argv[1:]: res += json.load(open(f, encoding='utf-8'))
modelos = sorted({r['modelo'] + '|' + r.get('prompt', '') for r in res})
por = {}
for r in res:
    k = r['modelo'] + (' (prompt v14)' if r.get('v14') else '')
    por.setdefault(k, []).append(r)
print('%-24s %8s %9s %8s %8s %9s %10s %9s' % ('modelo', 'pasa', 'fallas', 'in/resp', 'cache', 'out/resp', 'USD/resp', 'COP/chat10'))
detalle = {}
for k, rs in por.items():
    ok = tot = 0; fallas = []; ins = []; cac = []; outs = []; costos = []
    m = k.split(' ')[0].replace(':n8n', ''); pi, pc, po = PRECIO[m]
    for r in rs:
        t = [x for x in r['turnos'] if 'texto' in x]
        for nom, v in checks(r['esc'], t).items():
            tot += 1; ok += v
            if not v: fallas.append(r['esc'] + ': ' + nom)
        for x in t:
            ins.append(x['in']); cac.append(x['cache']); outs.append(x['out'])
            costos.append(((x['in'] - x['cache']) * pi + x['cache'] * pc + x['out'] * po) / 1e6)
    usd = st.mean(costos)
    print('%-24s %4d/%-3d %9d %8d %8d %9d %10.4f %9.0f' % (k, ok, tot, tot - ok, st.mean(ins), st.mean(cac), st.mean(outs), usd, usd * 10 * TRM))
    detalle[k] = fallas
print()
for k, f in detalle.items(): print(k, '->', f)
