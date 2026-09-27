# Builds pixel_town_standalone.html: the game with the civ/ scripts and Three.js inlined, runnable from a single file.
# Usage: python3 tools/build_standalone.py
import re
import os
root=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')+os.sep
src=open(root+'pixel_town.html').read()
three=open(root+'vendor/three.module.min.js').read()
assert '</script>' not in three
# inline the civilization-mode scripts in place, so the file works on its own
def inline(m):
    js=open(root+m.group(1)).read(); assert '</script>' not in js, m.group(1)
    return '<script>/* '+m.group(1)+' */\n'+js+'\n</script>'
src, n = re.subn(r'<script src="(civ/[a-z_0-9]+\.js)"></script>', inline, src)
assert n==11, n
i=src.rindex('</body>')
out=src[:i]+'<script type="text/plain" id="three-src">'+three+'</script>\n'+src[i:]
open(root+'pixel_town_standalone.html','w').write(out); print(len(out), n)
