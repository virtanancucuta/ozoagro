"""Genera el index.html de la RAIZ (GitHub Pages) a partir de landing/index.html apuntando a landing/... sin duplicar recursos.
Uso: python scripts/build_root.py   (correr antes de cada commit que toque landing/)"""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
s = (root / 'landing' / 'index.html').read_text(encoding='utf-8')
IMG = re.compile(r'\.(png|jpg|jpeg|webp|svg|ico|mp4|css|js|json)(\?.*)?$', re.I)
def rw(m):
    attr, q, url = m.group(1), m.group(2), m.group(3)
    if re.match(r'^(https?:|//|#|mailto:|tel:|data:|javascript:)', url) or url.startswith('landing/'):
        return m.group(0)
    if attr == 'content' and not IMG.search(url):
        return m.group(0)
    return f'{attr}={q}landing/{url}{q}'
s = re.sub(r'\b(src|href|poster|data-image|data-video|content)=(["\'])([^"\']+)\2', rw, s)
s = s.replace('<!doctype html>', '<!doctype html>\n<!-- GENERADO por scripts/build_root.py desde landing/index.html. NO editar a mano. -->', 1)
(root / 'index.html').write_text(s, encoding='utf-8')
print('index.html raiz generado:', len(s), 'bytes; refs landing/:', s.count('landing/'))
