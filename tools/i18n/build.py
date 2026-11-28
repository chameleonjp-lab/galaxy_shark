"""翻訳の表（tools/i18n/translations/*.json）から、言語ごとの翻訳ファイル（i18n/<言語>.js）を作る。

翻訳の表は、1行が [日本語の見出し, en, es, pt-BR, zh-Hans, fr, de, ko, ru, it, zh-Hant, id, tr, vi, th] の並び。
次のことを確かめ、問題があれば止まる。
- tools/i18n/keys.json のすべての見出しに、14言語ぶんの翻訳がある
- 表にあるのに、ゲームで使っていない見出しがない（古い見出しの消し忘れ）
- {0} などの差し込み記号と <br> の数が、日本語と同じ
使い方: python3 tools/i18n/extract_keys.py && python3 tools/i18n/build.py
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANGS = ['en', 'es', 'pt-BR', 'zh-Hans', 'fr', 'de', 'ko', 'ru', 'it', 'zh-Hant', 'id', 'tr', 'vi', 'th']

keys = json.loads((ROOT / 'tools/i18n/keys.json').read_text(encoding='utf-8'))
rows = {}
errors = []
for f in sorted((ROOT / 'tools/i18n/translations').glob('*.json')):
    for row in json.loads(f.read_text(encoding='utf-8')):
        if isinstance(row[0], int):  # 見出しを番号（keys.json の並び）で書いた行
            row[0] = keys[row[0]]
        if len(row) != 1 + len(LANGS):
            errors.append(f'{f.name}: 列の数が違います: {row[0][:40]} ({len(row)})')
            continue
        if row[0] in rows:
            errors.append(f'{f.name}: 見出しが重複しています: {row[0][:40]}')
        rows[row[0]] = row[1:]

def marks(text):
    return (sorted(re.findall(r'\{\d+\}', text)), text.count('<br>'))

for k in keys:
    if k not in rows:
        errors.append(f'翻訳がありません: {k[:60]}')
        continue
    for lang, tr in zip(LANGS, rows[k]):
        if not tr.strip():
            errors.append(f'{lang}: 空の翻訳: {k[:40]}')
        elif marks(tr) != marks(k):
            errors.append(f'{lang}: 差し込み記号か改行の数が違います: {k[:40]} → {tr[:40]}')
for k in rows:
    if k not in keys:
        errors.append(f'使っていない見出しです（表から消してください）: {k[:60]}')

if errors:
    print('\n'.join(errors))
    print(f'問題 {len(errors)} 件。翻訳ファイルは作りませんでした。')
    sys.exit(1)

out_dir = ROOT / 'i18n'
out_dir.mkdir(exist_ok=True)
# 日本語の中点「・」は、中国語・韓国語以外では見慣れないので「·」に置き換える
def fix_dot(lang, text):
    if lang in ('zh-Hans', 'zh-Hant', 'ko'):
        return text
    return re.sub(r'\s*・\s*', ' · ', text).strip() if text.strip() != '・' else '·'

for i, lang in enumerate(LANGS):
    pack = {k: fix_dot(lang, rows[k][i]) for k in keys}
    body = json.dumps(pack, ensure_ascii=False, separators=(',', ':'))
    (out_dir / f'{lang}.js').write_text(
        '// 自動生成（tools/i18n/build.py）。直接編集せず、tools/i18n/translations の表を直してください。\n'
        f'window.GS_I18N && (window.GS_I18N.pack = {body});\n', encoding='utf-8')
print(f'{len(keys)} 件の見出し × {len(LANGS)} 言語の翻訳ファイルを i18n/ に書き出しました。')
