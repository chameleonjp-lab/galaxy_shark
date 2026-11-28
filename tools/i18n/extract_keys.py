"""翻訳が必要な日本語の文章（見出し）を index.html から集めて、tools/i18n/keys.json に書き出す。

- プログラムの中の日本語の文字列（日本語だけで使う単位などは除く）
- 画面の部品のうち、文章の切れ目ごとの日本語と、data-i18n-html を付けた要素の中身
使い方: python3 tools/i18n/extract_keys.py
"""
import json, re, sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
src = (ROOT / 'index.html').read_text(encoding='utf-8')
JP = re.compile(r'[぀-ヿ㐀-鿿]')
# 日本語表示のときにしか使わない文字列（数の単位など）は翻訳しない
JA_ONLY = {'穣', '秭', '垓', '京', '兆', '億', '万', '円', '0 円',
           # 日本語のロゴの部品（ほかの言語では「GALAXY SHARK」に差し替える）と、開発用の表示
           'ギャラクシー', 'シャーク', '次ステージ/成長テスト (L)', '成長+ (L)'}

keys = []
def add(k):
    k = k.strip()
    if k and JP.search(k) and k not in JA_ONLY and k not in keys:
        keys.append(k)

# ---- プログラム（本体のスクリプト）
start = src.index("<script>\n(() => {")
code = src[start:]
code = re.sub(r'(?m)^\s*//.*$', '', code)           # 行コメント
code = re.sub(r'/\*.*?\*/', '', code, flags=re.S)    # 範囲コメント
for m in re.finditer(r"'((?:[^'\\\n]|\\.)*)'", code):
    lit = m.group(1).replace("\\'", "'")
    if '${' in lit: continue
    add(lit)
for m in re.finditer(r"`((?:[^`\\]|\\.)*)`", code):
    lit = m.group(1)
    if '${' in lit: continue
    add(lit)
# ボス名は「（ボス）」を外した形でも使う
for m in re.finditer(r"nameJa:'([^']*)（ボス）'", src):
    add(m.group(1))
    JA_ONLY.add(m.group(0)[8:-1])  # 「（ボス）」付きの名前は画面に出さない
# 起動前のエラー表示
for m in re.finditer(r"__showFatal\('([^']*)'\)", src):
    add(m.group(1))

# ---- 画面の部品（HTML）
body = src[src.index('<body'):src.index('<script>\n  window.__showFatal')]
class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []; self.capture = None; self.buf = ''; self.depth = 0
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for at in ('title', 'aria-label'):
            if a.get(at): add(a[at])
        if self.capture is not None:
            self.buf += self.get_starttag_text(); 
            if tag not in ('br', 'img', 'input'): self.depth += 1
            return
        if 'data-i18n-html' in a:
            self.capture = tag; self.buf = ''; self.depth = 1
        self.stack.append(tag)
    def handle_startendtag(self, tag, attrs):
        if self.capture is not None: self.buf += self.get_starttag_text()
    def handle_endtag(self, tag):
        if self.capture is not None:
            self.depth -= 1
            if self.depth == 0:
                add(self.buf); self.capture = None; self.buf = ''
            else:
                self.buf += f'</{tag}>'
            return
        if self.stack: self.stack.pop()
    def handle_data(self, data):
        if self.capture is not None: self.buf += data; return
        if self.stack and self.stack[-1] in ('script', 'style', 'option'): return
        add(data)
P().feed(body)

keys = [k for k in keys if k not in JA_ONLY]
out = ROOT / 'tools' / 'i18n' / 'keys.json'
out.write_text(json.dumps(keys, ensure_ascii=False, indent=1), encoding='utf-8')
print(len(keys), 'keys,', sum(len(k) for k in keys), 'chars ->', out)
