#!/usr/bin/env python3
"""Bundle www/ into one self-contained HTML file that works when opened directly (file://)."""
import re, base64, pathlib
root = pathlib.Path(__file__).resolve().parent.parent / 'www'
html = (root / 'index.html').read_text()
css = (root / 'css/style.css').read_text()
def strip(js):
    js = re.sub(r"^import .*?;\n", "", js, flags=re.M)
    return re.sub(r"^export ", "", js, flags=re.M)
js = "\n".join(strip((root / f'js/{n}.js').read_text()) for n in ['calib', 'credits', 'scapes', 'engine', 'app'])
icon = 'data:image/svg+xml;base64,' + base64.b64encode((root / 'icons/icon.svg').read_bytes()).decode()
html = html.replace('<link rel="stylesheet" href="css/style.css">', f'<style>{css}</style>')
html = re.sub(r'<link rel="(manifest|apple-touch-icon)"[^>]*>\n\s*', '', html)
html = html.replace('icons/icon.svg', icon)
html = html.replace('  <script src="js/vendor/capacitor.js"></script>\n', '')
html = html.replace('<script type="module" src="js/app.js"></script>', f'<script type="module">\n{js}\n</script>')
out = root.parent / 'dist' / 'driftwave-offline.html'
out.parent.mkdir(exist_ok=True); out.write_text(html)
print('wrote', out, len(html), 'bytes')
