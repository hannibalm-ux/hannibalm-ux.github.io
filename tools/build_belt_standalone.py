# Builds belt_standalone.html: The Belt with its scripts, styles and Three.js inlined, so it runs by double-clicking the file
# (browsers refuse ES module imports from file://, so the modules are wrapped into plain functions).
# Usage: python3 tools/build_belt_standalone.py
import os, re
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..') + os.sep
rd = lambda p: open(root + p, encoding='utf-8').read()

def wrap_module(name, src):
    names = re.findall(r'^export (?:const|let|function|class) ([A-Za-z_$][\w$]*)', src, re.M)
    def imp_all(m): return 'const %s = __m[%r];' % (m.group(1), re.sub(r'.*/([\w.-]+?)(?:\.module\.min)?\.js$', r'\1', m.group(2)).replace('three', 'three'))
    src = re.sub(r"^import \* as (\w+) from '([^']+)';", imp_all, src, flags=re.M)
    def imp_named(m):
        mod = re.sub(r'.*/([\w.-]+?)\.js$', r'\1', m.group(2)); return 'const {%s} = __m[%r];' % (m.group(1), mod)
    src = re.sub(r"^import \{([^}]+)\} from '([^']+)';", imp_named, src, flags=re.M)
    src = re.sub(r'^export (?=const|let|function|class)', '', src, flags=re.M)
    assert not re.search(r'^export |^import ', src, re.M), name
    return '__m[%r] = (function(){\n"use strict";\n%s\nreturn {%s};\n})();\n' % (name, src, ','.join(names))

# Three.js: turn the trailing `export{A as B,...}` into a returned object
three = rd('vendor/three.module.min.js')
i = three.rindex('export{'); exp = three[i + 7:three.rindex('}')]
pairs = []
for part in exp.split(','):
    a, _, b = part.partition(' as '); pairs.append('%s:%s' % (b or a, a))
three_js = '__m["three"] = (function(){\n"use strict";\n%s\nreturn {%s};\n})();\n' % (three[:i], ','.join(pairs))

mods = ['sim', 'ai', 'views', 'render', 'main']
code = 'var __m = {};\n' + three_js + ''.join(wrap_module(m, rd('belt/%s.js' % m)) for m in mods)
assert '</script>' not in code
html = rd('belt/index.html')
html = html.replace('<link rel="stylesheet" href="belt.css">', '<style>\n' + rd('belt/belt.css') + '\n</style>')
html = html.replace('<script type="module" src="main.js"></script>', '<script>\n' + code + '</script>')
assert 'src="main.js"' not in html and 'belt.css' not in html
open(root + 'belt_standalone.html', 'w', encoding='utf-8').write(html)
print('belt_standalone.html', len(html))
