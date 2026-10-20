"""Builds every table (results/tables.md), the summary (results/summary.json) and the SVG figures of the review.

Standard library only. Codex's frozen rows (classic runs, elite pairs, rest pairs) are read from CODEX_PKG
(default: ../deadmines-sector-one-balance-v11, i.e. after the Codex branch is merged).
"""
import gzip, json, os, random, statistics as st, sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'results' / 'raw'
FIG = ROOT / 'figures'
FIG.mkdir(exist_ok=True)
CODEX = Path(os.environ.get('CODEX_PKG', ROOT.parent / 'deadmines-sector-one-balance-v11'))
sys.path.insert(0, str(Path(__file__).parent))
from svg import grouped_bars, NEUTRAL, SERIES  # noqa: E402

E = ['old-mines-raider', 'old-mines-digger', 'old-mines-watchman', 'old-mines-overseer', 'old-mines-johnson', 'old-mines-rhahk-zor']
NAME = {'old-mines-raider': 'Налётчик', 'old-mines-digger': 'Забойщик', 'old-mines-watchman': 'Дозорный', 'old-mines-overseer': 'Надсмотрщик', 'old-mines-johnson': 'Джонсон', 'old-mines-rhahk-zor': "Рак'Зор"}
mean = lambda xs: st.mean(xs) if xs else float('nan')
summary, md = {}, ['# Таблицы независимого ревью Sector I v1.1', '', 'Все строки построены `scripts/analyze.py` из `results/raw/*` и пакета Codex. Числа в процентах — доля боёв/походов; HP-экв. — HP + λ·ходы оракула (λ = 3).', '']


def rows(name):
    with gzip.open(RAW / name, 'rt', encoding='utf-8') as f:
        return [json.loads(line) for line in f]


def codex_rows(name):
    with gzip.open(CODEX / 'results' / name, 'rt', encoding='utf-8') as f:
        return [json.loads(line) for line in f]


def table(head, body):
    return ['| ' + ' | '.join(head) + ' |', '|' + '---|' * len(head)] + ['| ' + ' | '.join(str(c) for c in r) + ' |' for r in body] + ['']


def boot(xs, n=2000, seed=20261020):
    r = random.Random(seed)
    ms = sorted(mean(r.choices(xs, k=len(xs))) for _ in range(n))
    return ms[int(.025 * n)], ms[int(.975 * n)]


def wilson(k, n, z=1.96):
    p = k / n; d = 1 + z * z / n; c = p + z * z / (2 * n); h = z * ((p * (1 - p) + z * z / (4 * n)) / n) ** .5
    return 100 * (c - h) / d, 100 * (c + h) / d


f1 = lambda x: f'{x:.1f}'
f2 = lambda x: f'{x:.2f}'

# ---------- 0. reproduction of Codex ----------
ver = json.loads((ROOT / 'results' / 'verify.json').read_text(encoding='utf-8'))
repro = {k: ver[k] for k in ver if k != 'battles'}
if CODEX.exists():
    theirs = {(r['variant'], r['encounter'], r['strategy']): r for r in json.loads((CODEX / 'results' / 'main-classic-V0-V1-V2-300.json').read_text(encoding='utf-8')) if r['kind'] == 'battle'}
    match = sum(1 for k, x in ver['battles'].items() if (lambda t: t and abs(t['turns'] - x['turns']) < 2e-3 and abs(t['lossW'] - x['lossW']) < 2e-3 and abs(t['lossM'] - x['lossM']) < 2e-3 and abs(t['winPct'] - x['win']) < 1e-9)(theirs.get(({'PA': 'V2'}.get(k.split()[0], k.split()[0]), k.split()[1], k.split()[2]))))
    repro['isolatedCellsMatched'] = f'{match}/{len(ver["battles"])}'
for v in ['V0', 'PA', 'V1']:
    path = RAW / f'routes-{v}-aggressive-1000042-300.jsonl.gz'
    if path.exists():
        g = rows(path.name)
        repro[f'holdout mixed aggressive {v}'] = 100 * mean([r['result'] == 'sector-complete' for r in g])
summary['reproduction'] = repro
md += ['## 0. Воспроизведение Codex', ''] + [f'- `{k}`: {v}' for k, v in repro.items()] + ['']

# ---------- 1. isolated battles per policy ----------
md += ['## 1. Изолированные бои: политики (старт 18/8, 25/18 HP, seeds 42…341; planner 42…141)', '']
iso = {}
for v in ['V0', 'PA', 'V1', 'V3']:
    R = rows(f'bots-{v}-base-42-300.jsonl.gz') + (rows(f'bots-{v}-base-42-100-planner.jsonl.gz') if v in ('V0', 'PA') else [])
    for e in E:
        for p in ['aggressive', 'aggressive-fill', 'tempo', 'balanced', 'defensive', 'planner']:
            g = [r for r in R if r['encounter'] == e and r['policy'] == p]
            if not g:
                continue
            iso[(v, e, p)] = dict(n=len(g), win=100 * mean([r['result'] == 'victory' for r in g]), T=mean([r['turns'] for r in g]),
                                  W=mean([r['lossW'] for r in g]), M=mean([r['lossM'] for r in g]),
                                  mana=100 * sum(r['manaSpent'] for r in g) / sum(r['manaAvailable'] for r in g),
                                  idle=mean([r['unusedManaWithDamage'] for r in g]),
                                  defShare=100 * sum(r['defenseMana'] for r in g) / max(1, sum(r['manaSpent'] for r in g)))
for v in ['V0', 'PA']:
    body = []
    for e in E:
        for p in ['aggressive', 'aggressive-fill', 'tempo', 'balanced', 'defensive', 'planner']:
            s = iso[(v, e, p)]
            body.append([NAME[e], p, s['n'], f1(s['win']), f2(s['T']), f'{s["W"]:.2f} / {s["M"]:.2f}', f1(s['mana']), f2(s['idle']), f1(s['defShare'])])
    md += [f'### {v}', ''] + table(['Враг', 'Политика', 'N', 'Победы %', 'Ходы', 'Потери В / М', 'Мана исп. %', 'Простой маны при доступном уроне', 'Доля маны на защиту %'], body)
summary['isolated'] = {f'{v}|{e}|{p}': s for (v, e, p), s in iso.items()}

# ---------- 2. mana contest by turn ----------
md += ['## 2. Конкуренция за ману по ходам (PA, Джонсон + Рак\'Зор)', '', 'Урон в руке — суммарная стоимость карт, которые сейчас нанесли бы урон. «Спорный ход» — их стоимость больше доступной маны.', '']
R = rows('bots-PA-base-42-300.jsonl.gz')
contest = {}
body = []
for p in ['aggressive', 'balanced', 'defensive']:
    for t in range(1, 7):
        cs = [c for r in R if r['policy'] == p and r['encounter'] in ('old-mines-johnson', 'old-mines-rhahk-zor') for c in r['contest'] if c['turn'] == t]
        s = dict(n=len(cs), mana=mean([c['mana'] for c in cs]), dmgHand=mean([c['dmgManaStart'] for c in cs]), contested=100 * mean([c['contested'] for c in cs]),
                 dmg=mean([c['dmgMana'] for c in cs]), defense=mean([c['defMana'] for c in cs]))
        contest[(p, t)] = s
        body.append([p, t, s['n'], f1(s['mana']), f2(s['dmgHand']), f'{s["contested"]:.0f}', f2(s['dmg']), f2(s['defense'])])
md += table(['Политика', 'Ход', 'N', 'Мана', 'Урон в руке (мана)', 'Спорных %', 'Потрачено на урон', 'На защиту'], body)
summary['contest'] = {f'{p}|{t}': s for (p, t), s in contest.items()}
x = [contest[('balanced', t)] for t in range(1, 7)]
grouped_bars(FIG / 'mana-vs-damage-cards.svg', 'Мана хода и урон в руке (PA, balanced, Джонсон + Рак\'Зор)', [f'Ход {t}' for t in range(1, 7)],
             ['Доступная мана', 'Стоимость карт урона в руке', 'Потрачено на защиту'],
             [[s['mana'] for s in x], [s['dmgHand'] for s in x], [s['defense'] for s in x]], colors=[NEUTRAL, SERIES[0], SERIES[1]],
             note='С 3-го хода урона в руке меньше, чем маны: излишек уходит в броню без потери темпа.', fmt='{:.1f}')

# ---------- 3. oracle frontier and decisions ----------
md += ['## 3. Оракул: фронтир «скорость ↔ HP» и качество решений (seeds 42…241)', '', 'λ — сколько HP оракул готов заплатить за ход быстрее. Решение = начало хода.', '']
front, dec = {}, {}
for v in ['V0', 'V1', 'PA', 'V3']:
    for L in ['0.5', '3', '40']:
        R = rows(f'frontier-{v}-L{L}-d18-balanced-42-200.jsonl.gz')
        for e in E:
            g = [r for r in R if r['encounter'] == e]
            front[(v, L, e)] = dict(T=mean([r['turns'] for r in g]), W=mean([r['lossW'] for r in g]), M=mean([r['lossM'] for r in g]), win=100 * mean([r['result'] == 'victory' for r in g]))
            if L == '3':
                ds = [d for r in g for d in r['decisions'] if not d['replan']]
                early = [d for d in ds if d['turn'] <= 2]
                dec[(v, e)] = dict(n=len(ds), greedy2=100 * mean([d['regretGreedy'] >= 2 for d in ds]), greedy2early=100 * mean([d['regretGreedy'] >= 2 for d in early]),
                                   greedyMean=mean([d['regretGreedy'] for d in ds]), tradeoff=100 * mean([d['tradeoffHP'] >= 2 and d['tradeoffTurns'] >= 1 for d in ds]),
                                   order=100 * mean([d['orderSpread'] >= 1 for d in ds]), armor=100 * mean([d['bestDefense'] for d in ds]))
body = [[NAME[e], v] + [f'{front[(v, L, e)]["T"]:.2f} / {front[(v, L, e)]["W"] + front[(v, L, e)]["M"]:.2f}' for L in ['0.5', '3', '40']] for e in E for v in ['V0', 'V1', 'PA', 'V3']]
md += table(['Враг', 'Модель', 'λ=0,5: ходы / HP', 'λ=3', 'λ=40'], body)
body = [[NAME[e], v, dec[(v, e)]['n'], f'{dec[(v, e)]["greedy2early"]:.0f}', f'{dec[(v, e)]["greedy2"]:.0f}', f2(dec[(v, e)]['greedyMean']), f'{dec[(v, e)]["tradeoff"]:.0f}', f'{dec[(v, e)]["order"]:.0f}', f'{dec[(v, e)]["armor"]:.0f}'] for e in E for v in ['V0', 'V1', 'PA']]
md += ['Метрики решений (λ = 3): «жадный» ход — максимум урона сейчас, затем брони; «компромисс» — самый быстрый выигрыш стоит ≥ 2 HP по сравнению с более медленной линией, которая на ≥ 1 ход дольше; «порядок» — та же комбинация карт в худшем порядке хуже на ≥ 1 HP-экв.', '']
md += table(['Враг', 'Модель', 'Решений', 'Жадный ход ошибочен (≥2) на ходах 1–2 %', 'Все ходы %', 'Средняя цена жадного хода', 'Компромисс %', 'Порядок важен %', 'В лучшем ходе есть броня %'], body)
summary['frontier'] = {f'{v}|{L}|{e}': s for (v, L, e), s in front.items()}
summary['decisions'] = {f'{v}|{e}': s for (v, e), s in dec.items()}
grouped_bars(FIG / 'greedy-regret-early.svg', 'Ходы 1–2, где «просто бить» ошибочно (≥2 HP-экв.), оракул λ=3', [NAME[e] for e in E], ['V0', 'V1', 'PA'],
             [[dec[(v, e)]['greedy2early'] for e in E] for v in ['V0', 'V1', 'PA']], unit='%', vmax=100, fmt='{:.0f}',
             note='Чем выше, тем чаще правильный ход требует прочитать намерение врага.')

# ---------- 4. same hand ----------
md += ['## 4. Одинаковая стартовая рука: меняет ли модель правильный первый ход', '', 'K = 3 детерминизации на линию, λ = 3. «Цена старого плана» — HP-экв., потерянные, если против новой модели сыграть лучший ход V0.', '']
same = {}
body = []
for label, f in [('V0→PA main', 'samehand-V0-PA-42-200-K3-L3.json'), ('V0→PA holdout', 'samehand-V0-PA-1000042-200-K3-L3.json'), ('V0→V1 main', 'samehand-V0-V1-42-200-K3-L3.json')]:
    R = json.load(open(RAW / f, encoding='utf-8'))
    for e in E:
        g = [r for r in R if r['encounter'] == e]
        reg = [r['regretOfAinB'] for r in g if r['regretOfAinB'] is not None]
        s = dict(n=len(g), diff=100 * mean([not r['same'] for r in g]), regret=mean(reg), ge2=100 * mean([x >= 2 for x in reg]), ge4=100 * mean([x >= 4 for x in reg]),
                 armorA=mean([sum(r['armorA']) for r in g]), armorB=mean([sum(r['armorB']) for r in g]), dmgA=mean([r['dmgA'] for r in g]), dmgB=mean([r['dmgB'] for r in g]))
        same[(label, e)] = s
        body.append([label, NAME[e], s['n'], f'{s["diff"]:.0f}', f2(s['regret']), f'{s["ge2"]:.0f}', f'{s["ge4"]:.0f}', f'{s["dmgA"]:.1f} → {s["dmgB"]:.1f}', f'{s["armorA"]:.1f} → {s["armorB"]:.1f}'])
md += table(['Сравнение', 'Враг', 'Рук', 'Лучший ход другой %', 'Цена старого плана', '≥2 %', '≥4 %', 'Урон лучшего хода', 'Броня лучшего хода'], body)
summary['sameHand'] = {f'{l}|{e}': s for (l, e), s in same.items()}
grouped_bars(FIG / 'same-hand-regret.svg', 'Старый (V0) первый ход против новой модели стоит ≥2 HP-экв.', [NAME[e] for e in E], ['V1 (main)', 'PA (main)', 'PA (holdout)'],
             [[same[(l, e)]['ge2'] for e in E] for l in ['V0→V1 main', 'V0→PA main', 'V0→PA holdout']], unit='%', vmax=100, fmt='{:.0f}',
             colors=[SERIES[1], SERIES[0], SERIES[2]], note='Одинаковая рука из 8 карт; доля раздач, где привычный ход V0 стал ошибкой.')

# ---------- 5. full runs ----------
md += ['## 5. Полные походы (mixed/safe/risky, старт 18/8)', '', 'Строки Codex — из его JSONL; tempo/oracle/aggressive-fill — этот пакет через тот же route-харнесс. Интервал — Wilson 95%.', '']
runs = {}
won = lambda r: r['result'] == 'sector-complete'
for split, start in [('main', 42), ('holdout', 1000042)]:
    names = [f'{split}-classic-V0-V1-V2-300.jsonl.gz'] + ([f'{split}-classic-V3-300.jsonl.gz'] if split == 'main' else []) if split == 'main' else ['holdout-classic-V0-V1-V2-V3-300.jsonl.gz']
    if CODEX.exists():
        for n in names:
            for r in codex_rows(n):
                if r['kind'] == 'route':
                    runs.setdefault((split, {'V2': 'PA'}.get(r['variant'], r['variant']), r['strategy'], r['policy']), []).append(r)
    for v in ['V0', 'PA', 'V1', 'V3']:
        for p in ['tempo', 'oracle3', 'oracle12', 'aggressive-fill']:
            path = RAW / f'routes-{v}-{p}-{start}-300.jsonl.gz'
            if path.exists():
                for r in rows(path.name):
                    runs.setdefault((split, v, p, r['route']), []).append(r)
body, runsum = [], {}
for (split, v, p, route), g in sorted(runs.items()):
    k = sum(map(won, g)); lo, hi = wilson(k, len(g))
    s = dict(n=len(g), win=100 * k / len(g), lo=lo, hi=hi, W=mean([r['endW'] for r in g]), M=mean([r['endM'] for r in g]),
             heal=100 * mean(['heal' in r['restChoices'] for r in g]), deaths=dict(Counter(r['battles'][-1]['encounter'][10:] for r in g if not won(r))))
    runsum[f'{split}|{v}|{p}|{route}'] = s
    if route == 'mixed' or p in ('tempo', 'oracle3'):
        body.append([split, v, p, route, s['n'], f'{s["win"]:.1f} [{lo:.1f}; {hi:.1f}]', f'{s["W"]:.2f} / {s["M"]:.2f}', f'{s["heal"]:.0f}', ', '.join(f'{a} {b}' for a, b in sorted(s['deaths'].items(), key=lambda x: -x[1]))])
md += table(['Выборка', 'Модель', 'Политика', 'Маршрут', 'N', 'Победы % [95%]', 'Итог HP В / М', 'Лечились %', 'Поражения'], body)
summary['runs'] = runsum
pol = ['aggressive', 'aggressive-fill', 'tempo', 'oracle3', 'balanced', 'defensive']
lab = ['aggressive', 'aggr.-fill', 'tempo', 'оракул', 'balanced', 'defensive']
if all(f'main|PA|{p}|mixed' in runsum for p in pol):
    grouped_bars(FIG / 'win-rates-policies.svg', 'Победы в секторе, маршрут mixed, main', lab, ['V0', 'PA'],
                 [[runsum[f'main|{v}|{p}|mixed']['win'] for p in pol] for v in ['V0', 'PA']], unit='%', vmax=100, fmt='{:.0f}',
                 note='70% контрольного aggressive — свойство бота: разумная атака (tempo) проходит ~99%.')
    grouped_bars(FIG / 'end-hp-policies.svg', 'Итоговое HP отряда (В + М из 43), mixed, PA, main', lab, ['Вариан', 'Джайна'],
                 [[runsum[f'main|PA|{p}|mixed']['W'] for p in pol], [runsum[f'main|PA|{p}|mixed']['M'] for p in pol]], colors=[SERIES[0], SERIES[1]], fmt='{:.1f}')

# ---------- 6. elite ----------
md += ['## 6. Элита: одинаковая развилка, полный хвост похода', '']
if CODEX.exists():
    body = []
    for split in ['main', 'holdout']:
        R = codex_rows(f'{split}-elite-V0-V1-V2-300.jsonl.gz')
        for v in ['V0', 'V2']:
            for s in ['aggressive', 'balanced', 'defensive']:
                g = [r for r in R if r['variant'] == v and r['strategy'] == s and r['loadout'] == 'none' and not r.get('prefixDefeat')]
                B = lambda r, k: r['branches'][k]
                hp = lambda x: x['endW'] + x['endM']
                cost = [hp(B(r, 'normal-safe')) - hp(B(r, 'normal-elite')) for r in g]
                wE = 100 * mean([won(B(r, 'normal-elite')) for r in g]); wS = 100 * mean([won(B(r, 'normal-safe')) for r in g])
                body.append([split, {'V2': 'PA'}.get(v, v), s, len(g), f2(mean(cost)), f'{wE:.1f} / {wS:.1f}', f'{wE - wS:+.1f}'])
    md += ['### Пересчёт данных Codex: цена в HP и отдельно разница побед', ''] + table(['Выборка', 'Модель', 'Бот', 'Пар', 'Цена пути HP (Codex)', 'Победы элита / обход %', 'Δ побед п.п.'], body)
body, elite = [], {}
for v in ['V0', 'PA']:
    for p in ['balanced', 'defensive', 'tempo', 'oracle3']:
        for start in [42, 1000042]:
            path = RAW / f'elite-{v}-{p}-{start}-300.jsonl.gz'
            if not path.exists():
                continue
            R = rows(path.name)
            for cond in ['natural', 'hurt60', 'hurt40']:
                g = [r for r in R if r.get('cond') == cond]
                hp = lambda x: x['endW'] + x['endM']
                cost = [hp(r['safe']) - hp(r['elite']) for r in g]
                lo, hi = boot(cost)
                wE = 100 * mean([won(r['elite']) for r in g]); wS = 100 * mean([won(r['safe']) for r in g])
                s = dict(n=len(g), direct=mean([r['elite']['battles'][0]['lossW'] + r['elite']['battles'][0]['lossM'] for r in g]), cost=mean(cost), lo=lo, hi=hi, winE=wE, winS=wS, better=100 * mean([c < 0 for c in cost]))
                elite[(v, p, start, cond)] = s
                body.append([v, p, 'main' if start == 42 else 'holdout', cond, s['n'], f2(s['direct']), f'{s["cost"]:.2f} [{lo:.2f}; {hi:.2f}]', f'{wE:.1f} / {wS:.1f}', f'{wE - wS:+.1f}', f'{s["better"]:.0f}'])
md += ['### Собственный опыт: вход с полным, ~60% и ~40% HP (cap 15/11 и 10/7)', ''] + table(['Модель', 'Политика', 'Выборка', 'Вход', 'Пар', 'Потеря в бою', 'Цена пути HP [95%]', 'Победы элита / обход %', 'Δ п.п.', 'Элита лучше %'], body)
summary['elite'] = {f'{v}|{p}|{s}|{c}': x for (v, p, s, c), x in elite.items()}
conds = ['natural', 'hurt60', 'hurt40']
if all(('PA', p, 42, c) in elite for p in ['balanced', 'tempo'] for c in conds):
    grouped_bars(FIG / 'elite-win-delta.svg', 'Элита против обхода: потеря побед (п.п.), PA, main', ['Полное HP', '≈60% HP', '≈40% HP'], ['balanced', 'tempo', 'defensive'],
                 [[elite[('PA', p, 42, c)]['winS'] - elite[('PA', p, 42, c)]['winE'] for c in conds] for p in ['balanced', 'tempo', 'defensive']],
                 unit=' п.п.', fmt='{:.1f}', vmax=10, colors=[SERIES[0], SERIES[1], SERIES[2]], note='При полном HP элита почти не угрожает поражением; с раненым отрядом риск становится реальным.')

# ---------- 7. boss ----------
md += ["## 7. Рак'Зор: реальный вход перед боссом (маршрут mixed/balanced), развитая колода и та же точка со стартовой колодой", '',
       'Порог — половина maxHP. «Без II фазы» — убит до исполнения любого действия II фазы. «Удар II фазы» — исполнен хотя бы один удар II фазы. «М11/подготовленный» — подготовленный удар II фазы дошёл до исполнения.', '']
sys.path.insert(0, str(Path(__file__).parent))
from bossstats import stats as bstats  # noqa: E402
boss, body = {}, []
variants = [('V0', 'V0'), ('PA', 'PA'), ('V3', 'V3 (Codex)'), ('Z1', 'Z1: П(М11) первой'), ('Z2', 'Z2: HP 76'), ('Z3', 'Z3: HP 76 + П(М11) первой'), ('Z4', 'Z4: З2 ↔ В8'), ('Z6', 'Z6: П(О7, гл. М) вместо П(М11)'), ('Z7', 'Z7: Z6 + HP 76')]
for v, label in variants:
    for start in [42, 1000042]:
        path = RAW / f'boss-{v}-balanced-{start}-300.jsonl.gz'
        if not path.exists():
            continue
        R = [r for r in rows(path.name) if r.get('reached')]
        for dk in ['developed', 'starter']:
            for p in ['aggressive', 'tempo', 'balanced', 'defensive', 'oracle3']:
                g = [r for r in R if r['deckKind'] == dk and r['policy'] == p]
                if not g:
                    continue
                s = bstats(g)
                boss[(v, start, dk, p)] = s
                body.append([label, 'main' if start == 42 else 'holdout', 'развитая' if dk == 'developed' else 'стартовая', p, s['n'], f'{s["win"]:.1f}', f2(s['T']), f2(s['phaseTurn']), f'{s["noP2"]:.0f}', f'{s["p2hit"]:.0f}', f'{s["m11"]:.0f}', f2(s['p2acts']), f'{s["lossW"]:.1f} / {s["lossM"]:.1f}', f'{s["p2W"]:.1f} / {s["p2M"]:.1f}'])
md += table(['Вариант', 'Выборка', 'Колода', 'Политика', 'N', 'Победы %', 'Ходы', 'Переход на ходу', 'Без II фазы %', 'Удар II фазы %', 'Подгот. удар II дошёл %', 'Действий II', 'Потери В / М', 'Из них во II фазе'], body)
summary['boss'] = {f'{v}|{s}|{d}|{p}': x for (v, s, d, p), x in boss.items()}
shown = [v for v, _ in variants if (v, 42, 'developed', 'oracle3') in boss and v in ('V0', 'PA', 'V3', 'Z2', 'Z6', 'Z7')]
grouped_bars(FIG / 'boss-phase-two.svg', "Рак'Зор, развитая колода: бои без единого действия II фазы", shown, ['balanced', 'defensive', 'оракул'],
             [[boss[(v, 42, 'developed', p)]['noP2'] for v in shown] for p in ['balanced', 'defensive', 'oracle3']], unit='%', vmax=60, fmt='{:.0f}',
             colors=[SERIES[0], SERIES[2], SERIES[1]], note='Оракул откладывает переход и пробивает II фазу залпом; HP 76 и групповой удар это сокращают.')

# ---------- 8. heroes ----------
md += ['## 8. Давление на двух героев (изолированные бои, все шесть врагов)', '']
body, heroes = [], {}
for v in ['V0', 'PA']:
    R = rows(f'bots-{v}-base-42-300.jsonl.gz')
    for p in ['aggressive', 'tempo', 'balanced', 'defensive']:
        g = [r for r in R if r['policy'] == p]
        n = len(g)
        absb = [sum(r['armorAbsorbed'][i] for r in g) / n for i in (0, 1)]
        loss = [mean([r['lossW'] for r in g]), mean([r['lossM'] for r in g])]
        hits = [sum(r['hitsTaken'][i] for r in g) / n for i in (0, 1)]
        src = Counter()
        for r in g:
            for c, (w, m) in r['armorByCard'].items():
                src[c] += m
        tot = sum(src.values()) or 1
        heroes[(v, p)] = dict(hitsW=hits[0], hitsM=hits[1], rawW=absb[0] + loss[0], rawM=absb[1] + loss[1], lossW=loss[0], lossM=loss[1], jainaArmor={k: 100 * x / tot for k, x in src.most_common(5)})
        body.append([v, p, f'{hits[0]:.2f} / {hits[1]:.2f}', f'{absb[0] + loss[0]:.1f} / {absb[1] + loss[1]:.1f}', f'{loss[0]:.2f} / {loss[1]:.2f}', ', '.join(f'{k} {x:.0f}%' for k, x in heroes[(v, p)]['jainaArmor'].items())])
md += table(['Модель', 'Политика', 'Ударов по В / М за бой', 'Входящий урон В / М', 'Потеря HP В / М', 'Источники брони Джайны'], body)
body = []
for v in ['V0', 'PA']:
    R = rows(f'bots-{v}-hurt-42-300.jsonl.gz')
    for p in ['aggressive', 'tempo', 'balanced', 'defensive']:
        g = [r for r in R if r['policy'] == p]
        dead = [r for r in g if r['result'] == 'defeat']
        body.append([v, p, len(g), f'{100 - 100 * len(dead) / len(g):.1f}', sum(r['endW'] <= 0 for r in dead), sum(r['endM'] <= 0 for r in dead)])
md += ['Вход 16/12 HP (изолированно, 6 врагов × 300):', ''] + table(['Модель', 'Политика', 'Боёв', 'Победы %', 'Гибель Вариана', 'Гибель Джайны'], body)
summary['heroes'] = {f'{v}|{p}': x for (v, p), x in heroes.items()}

# ---------- 9. rest (Codex rows) ----------
if CODEX.exists():
    md += ['## 9. Привал: лечение против улучшения в том же состоянии (данные Codex, mixed)', '']
    body = []
    for split in ['main', 'holdout']:
        R = codex_rows(f'{split}-rest-V0-V1-V2-300.jsonl.gz')
        for v in ['V0', 'V2']:
            for s in ['aggressive', 'balanced', 'defensive']:
                g = [r for r in R if r['variant'] == v and r['strategy'] == s and r['policy'] == 'mixed' and r['reachedRest']]
                for lo_, hi_, lab_ in [(0, .5, '<50%'), (.5, .65, '50–65%'), (.65, .85, '65–85%'), (.85, 1.01, '≥85%')]:
                    b = []
                    for r in g:
                        cp = [c for c in r['natural']['checkpoints'] if c['layer'] == 3]
                        if cp and lo_ <= min(cp[0]['hp'][0] / 25, cp[0]['hp'][1] / 18) < hi_:
                            b.append(r)
                    if len(b) < 5:
                        continue
                    hp = lambda x: x['endW'] + x['endM']
                    body.append([split, {'V2': 'PA'}.get(v, v), s, lab_, len(b), f'{mean([hp(r["branches"]["heal"]) - hp(r["branches"]["upgrade"]) for r in b]):+.2f}',
                                 f'{100 * mean([won(r["branches"]["heal"]) - won(r["branches"]["upgrade"]) for r in b]):+.1f}'])
    md += table(['Выборка', 'Модель', 'Бот', 'Мин. доля HP перед привалом', 'N', 'Итог HP: лечение − улучшение', 'Победы: лечение − улучшение, п.п.'], body)

# ---------- 10. defense efficiency ----------
md += ['## 10. Эффективность защиты (изолированные бои PA)', '']
body = []
R = rows('bots-PA-base-42-300.jsonl.gz')
for p in ['tempo', 'balanced', 'defensive']:
    for e in ['old-mines-overseer', 'old-mines-johnson', 'old-mines-rhahk-zor']:
        g = [r for r in R if r['policy'] == p and r['encounter'] == e]
        gr = mean([sum(r['armorGranted']) for r in g]); ab = mean([sum(r['armorAbsorbed']) for r in g]); wa = mean([sum(r['armorWasted']) for r in g]); left = mean([sum(r['armorLeft']) for r in g])
        dm = mean([r['defenseMana'] for r in g])
        disp = [c for r in g for c in r['contest'] if not c['killed']]
        dmana = sum(c['defMana'] for c in disp)
        displaced = 100 * sum(c['defMana'] for c in disp if c['defMana'] > 0 and c['leftDamage'] > 0) / max(1, dmana)
        body.append([p, NAME[e], f1(gr), f1(ab), f1(wa), f1(left), f2(dm), f2(ab / dm if dm else float('nan')), f'{displaced:.0f}', f2(mean([r['turns'] for r in g]))])
md += table(['Политика', 'Враг', 'Броня выдана', 'Поглотила', 'Сгорела при ударе', 'Осталась к концу', 'Мана защитных карт', 'Поглощено на 1 ману защиты*', 'Защита при уроне в руке %', 'Ходы'], body)
md += ['* В числителе есть и броня гибридных карт (Удар щитом), поэтому это верхняя оценка.', '']

(ROOT / 'results' / 'tables.md').write_text('\n'.join(md) + '\n', encoding='utf-8')
(ROOT / 'results' / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=1, default=float) + '\n', encoding='utf-8')
print('tables:', len(md), 'lines; figures:', sorted(p.name for p in FIG.iterdir()))
