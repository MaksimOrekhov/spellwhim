"""Rebuild paired statistics, tables and shareable plots from frozen engine rows.

Requires matplotlib (report tooling only, not a game dependency).
"""
from pathlib import Path
from collections import defaultdict, Counter
import gzip
import json
import math
import statistics
import hashlib
import os
import tempfile
os.environ.setdefault('MPLCONFIGDIR', str(Path(tempfile.gettempdir()) / 'spellwhim-balance-chart-cache'))
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / 'results'
PLOTS = ROOT / 'plots'
PLOTS.mkdir(exist_ok=True)
STRATEGIES = ['aggressive', 'balanced', 'defensive', 'planner']
VARIANTS = ['V0', 'V1', 'V2', 'V3']
COLORS = {'V0': '#667085', 'V1': '#d48831', 'V2': '#19856b', 'V3': '#7661a6'}
rng = np.random.default_rng(20261020)

def read(name):
    return json.loads((RESULTS / name).read_text(encoding='utf-8'))

def raw(name):
    with gzip.open(RESULTS / name, 'rt', encoding='utf-8') as stream:
        for line in stream:
            yield json.loads(line)

def win(row):
    return row['result'] in ('victory', 'sector-complete')

def paired(values):
    x = np.array(values, dtype=float)
    if len(x) == 0:
        return {'n': 0}
    samples = rng.choice(x, size=(3000, len(x)), replace=True).mean(axis=1)
    return {'n': len(x), 'mean': float(x.mean()), 'ci95': [float(q) for q in np.quantile(samples, [.025, .975])]}

def wilson(wins, n):
    p, z = wins / n, 1.96
    center = (p + z*z/(2*n)) / (1+z*z/n)
    delta = z * math.sqrt(p*(1-p)/n+z*z/(4*n*n)) / (1+z*z/n)
    return [100*(center-delta), 100*(center+delta)]

def table(headers, rows):
    return '\n'.join(['| ' + ' | '.join(headers) + ' |', '| ' + ' | '.join(['---']*len(headers)) + ' |'] + ['| ' + ' | '.join(map(str, row)) + ' |' for row in rows])

summaries = {}
routes = {}
fight_rows = {}
for split in ['main', 'holdout']:
    names = [f'{split}-classic-V0-V1-V2-300', f'{split}-classic-V3-300'] if split == 'main' else ['holdout-classic-V0-V1-V2-V3-300']
    names += [f'{split}-planner-V0-V1-V2-60', f'{split}-planner-V3-60'] if split == 'main' else ['holdout-planner-V0-V1-V2-V3-60']
    summaries[split] = [r for name in names for r in read(name + '.json')]
    route_groups = defaultdict(dict)
    battles = defaultdict(list)
    for name in names:
        for row in raw(name + '.jsonl.gz'):
            if row['kind'] == 'route':
                route_groups[(row['variant'], row['policy'], row['strategy'])][row['seed']] = row
            else:
                battles[(row['variant'], row['encounter'], row['strategy'])].append(row)
    routes[split] = route_groups
    fight_rows[split] = battles

paired_results = []
for split in routes:
    for policy in ['safe', 'mixed', 'risky']:
        for strategy in STRATEGIES:
            control = routes[split][('V0', policy, strategy)]
            for variant in ['V1', 'V2', 'V3']:
                candidate = routes[split][(variant, policy, strategy)]
                assert set(control) == set(candidate)
                rows = [(control[seed], candidate[seed]) for seed in sorted(control)]
                paired_results.append({'split': split, 'variant': variant, 'policy': policy, 'strategy': strategy,
                    'partyHPDelta': paired([b['endW']+b['endM']-a['endW']-a['endM'] for a,b in rows]),
                    'winDeltaPP': paired([100*(int(win(b))-int(win(a))) for a,b in rows]),
                    'winsLost': sum(win(a) and not win(b) for a,b in rows), 'winsGained': sum(not win(a) and win(b) for a,b in rows),
                    'candidateWilson95': wilson(sum(win(b) for a,b in rows), len(rows))})

elite_intervals = []
for split in ['main', 'holdout']:
    groups = defaultdict(list)
    for row in raw(f'{split}-elite-V0-V1-V2-300.jsonl.gz'):
        if row.get('prefixDefeat'):
            continue
        groups[(row['variant'], row['strategy'], row['loadout'])].append(row)
    for (variant, strategy, loadout), rows in groups.items():
        hp = lambda r: r['endW'] + r['endM']
        elite_intervals.append({'split': split, 'variant': variant, 'strategy': strategy, 'loadout': loadout,
            'routeCost': paired([hp(r['branches']['normal-safe'])-hp(r['branches']['normal-elite']) for r in rows]),
            'directLoss': paired([r['branches']['normal-elite']['battles'][0]['lossW']+r['branches']['normal-elite']['battles'][0]['lossM'] for r in rows])})

usage = []
for split in routes:
    for (variant, policy, strategy), group in routes[split].items():
        rows = list(group.values())
        total = lambda key: statistics.mean(sum(b[key] for b in r['battles']) for r in rows)
        deaths = Counter(next((b['encounter'] for b in r['battles'] if b['result']=='defeat'), 'none') for r in rows)
        usage.append({'split': split, 'variant': variant, 'policy': policy, 'strategy': strategy,
            'playsPerRun': total('plays'), 'manaAvailablePerRun': total('manaAvailable'), 'manaSpentPerRun': total('manaSpent'),
            'upgradedPlaysPerRun': total('upgradedPlays'), 'acquiredPlaysPerRun': total('acquiredPlays'),
            'runsPlayingUpgradePct': 100*statistics.mean(any(b['upgradedPlays'] for b in r['battles']) for r in rows),
            'runsPlayingAcquisitionPct': 100*statistics.mean(any(b['acquiredPlays'] for b in r['battles']) for r in rows),
            'deathsByEncounter': dict(deaths), 'warriorDeaths': sum(r['endW']==0 for r in rows), 'mageDeaths': sum(r['endM']==0 for r in rows)})
stats = {'bootstrapSeed': 20261020, 'bootstrapResamples': 3000, 'pairedRoutes': paired_results, 'pairedElite': elite_intervals, 'usage': usage}
(RESULTS / 'paired-statistics.json').write_text(json.dumps(stats, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

text = ['# Полные таблицы Sector I Balance v1.1', '', 'Все финальные HP включают проигрыши. В колонке перед боссом недошедшие имеют 0; число дошедших показано отдельно. Размеры main/holdout — 300; planner — 60. 100% в 300 наблюдениях не доказывает невозможность поражения (Wilson 95%: 98,74–100%).', '']
for split in ['main', 'holdout']:
    text += ['## ' + split, '', table(['Модель', 'Маршрут', 'Бот', 'Победы %', 'HP В / М', 'До босса n', 'HP перед боссом В / М¹', 'Ходы', 'Лечение % всех', 'Улучшение % всех', 'Элит/поход'], [
        [r['variant'], r['policy'], r['strategy'], f"{r['winPct']:.2f}", f"{r['endW']:.2f} / {r['endM']:.2f}", r['reachedBoss'], f"{r['preBossW']:.2f} / {r['preBossM']:.2f}", f"{r['turns']:.2f}", f"{r['healPct']:.2f}", f"{r['upgradeRestPct']:.2f}", f"{r['elites']:.3f}"] for r in summaries[split] if r['kind'] == 'route']), '', '¹ Zero-imputed checkpoint: ранние смерти включены; фактические HP дошедших — в `bossAmongArrivals` исходной сводки.', '']
    text += ['### Изолированные бои', '', table(['Модель', 'Враг', 'Бот', 'Победы %', 'Ходы', 'Потери В / М', 'Мана %', 'Действий фазы II'], [
        [r['variant'], r['encounter'].removeprefix('old-mines-'), r['strategy'], f"{r['winPct']:.2f}", f"{r['turns']:.2f}", f"{r['lossW']:.2f} / {r['lossM']:.2f}", f"{100*r['manaSpent']/r['manaAvailable']:.1f}", f"{r['phase2Actions']:.2f}"] for r in summaries[split] if r['kind'] == 'battle']), '']
    text += ['### Враги в реальных mixed-походах (условно на состоявшуюся встречу)', '', table(['Модель','Бот','Враг','Встреч n','Потери В / М','Ходы','Карты','Мана spent / available'], [
        [r['variant'],r['strategy'],enemy.removeprefix('old-mines-'),b['n'],f"{b['lossW']:.2f} / {b['lossM']:.2f}",f"{b['turns']:.2f}",f"{b['plays']:.2f}",f"{b['manaSpent']:.2f} / {b['manaAvailable']:.2f}"]
        for r in summaries[split] if r['kind']=='route' and r['policy']=='mixed' for enemy,b in r['byEnemy'].items()]), '']
    text += ['### Парные изменения относительно V0', '', table(['Модель', 'Маршрут', 'Бот', 'Δ HP отряда [95% CI]', 'Δ побед п.п. [95% CI]', 'Потеряно / добавлено побед'], [
        [r['variant'], r['policy'], r['strategy'], f"{r['partyHPDelta']['mean']:.2f} [{r['partyHPDelta']['ci95'][0]:.2f}; {r['partyHPDelta']['ci95'][1]:.2f}]", f"{r['winDeltaPP']['mean']:.2f} [{r['winDeltaPP']['ci95'][0]:.2f}; {r['winDeltaPP']['ci95'][1]:.2f}]", f"{r['winsLost']} / {r['winsGained']}"] for r in paired_results if r['split'] == split]), '']
    text += ['### Элита: одинаковый вход', '', table(['Модель', 'Бот', 'Предметы на входе', 'Пар', 'Прямая потеря HP', 'Цена маршрута', 'Цена без развития в развилке', 'Выгода награды элиты'], [
        [r['variant'], r['strategy'], r['loadout'], r['pairs'], f"{r['directLoss']:.2f}", f"{r['routeCostNormal']:.2f}", f"{r['routeCostNeutral']:.2f}", f"{r['eliteRewardValue']:.2f}"] for r in read(f'{split}-elite-V0-V1-V2-300.json')]), '']
    text += ['### Привал: парные вмешательства', '', table(['Модель', 'Маршрут', 'Бот', 'Дошли/300', 'Победы heal / upgrade / skip % всех', 'heal помогает / мешает vs skip', 'upgrade помогает / мешает vs skip'], [
        [r['variant'], r['policy'], r['strategy'], r['reached'], ' / '.join(f"{r['branches'][b]['winPct']:.2f}" for b in ['heal','upgrade','skip']), f"{r['branches']['heal']['helpsVsSkip']} / {r['branches']['heal']['hurtsVsSkip']}", f"{r['branches']['upgrade']['helpsVsSkip']} / {r['branches']['upgrade']['hurtsVsSkip']}"] for r in read(f'{split}-rest-V0-V1-V2-300.json')]), '']

(ROOT / 'tables.md').write_text('\n'.join(text).rstrip()+'\n', encoding='utf-8')

plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 10, 'axes.spines.top': False, 'axes.spines.right': False, 'figure.dpi': 130})

fig, axes = plt.subplots(1, 2, figsize=(11, 4), layout='constrained')
for i, hero in enumerate(['warrior', 'mage']):
    for variant in VARIANTS:
        r = next(r for r in summaries['holdout'] if r['kind']=='route' and r['variant']==variant and r['policy']=='mixed' and r['strategy']=='balanced')
        values = [25 if i == 0 else 18] + [point['warriorAll' if i==0 else 'mageAll'] for point in r['hpByLayer']]
        axes[i].plot(range(7), values, marker=None if variant == 'V3' else 'o', linestyle='--' if variant == 'V3' else '-', linewidth=3 if variant == 'V2' else 1.6, label=variant, color=COLORS[variant])
    axes[i].set(title=['Вариан', 'Джайна'][i], ylabel='Среднее HP (все 300 походов)', xticks=range(7), xticklabels=['Старт','Ряд 1','Ряд 2','Ряд 3','Ряд 4','Привал','Босс'], ylim=(0, 26 if i==0 else 19))
    axes[i].grid(alpha=.2); axes[i].legend(ncols=2)
fig.suptitle('Holdout · mixed / balanced · здоровье двух героев')
fig.savefig(PLOTS / 'health-holdout.png'); plt.close(fig)

fig, axes = plt.subplots(1, 2, figsize=(12, 4), layout='constrained')
for ax, split in zip(axes, ['main', 'holdout']):
    for j, variant in enumerate(VARIANTS):
        values = [next(r['winPct'] for r in summaries[split] if r['kind']=='route' and r['variant']==variant and r['policy']==policy and r['strategy']=='aggressive') for policy in ['safe','mixed','risky']]
        ax.bar(np.arange(3)+(j-1.5)*.19, values, width=.18, color=COLORS[variant], label=variant)
    ax.set(title=split, xticks=range(3), xticklabels=['safe','mixed','risky'], ylabel='Прохождение сектора, % (aggressive)', ylim=(0,105))
    ax.grid(axis='y', alpha=.2); ax.legend(ncols=2)
fig.savefig(PLOTS / 'win-rates.png'); plt.close(fig)

enemies = ['raider','digger','watchman','overseer','johnson','rhahk-zor']
fig, ax = plt.subplots(figsize=(11, 4), layout='constrained')
for j, variant in enumerate(VARIANTS):
    values = [next(r['turns'] for r in summaries['holdout'] if r['kind']=='battle' and r['variant']==variant and r['encounter']=='old-mines-'+enemy and r['strategy']=='balanced') for enemy in enemies]
    ax.bar(np.arange(6)+(j-1.5)*.19, values, width=.18, color=COLORS[variant], label=variant)
ax.set(xticks=range(6), xticklabels=['Налётчик','Забойщик','Дозорный','Надсмотрщик','Джонсон',"Рак’Зор"], ylabel='Ходы до результата (все исходы)', title='Holdout · balanced · отдельные бои, 18/8, полное HP, без предметов')
ax.grid(axis='y', alpha=.2); ax.legend(ncols=4)
fig.savefig(PLOTS / 'battle-duration.png'); plt.close(fig)

fig, axes = plt.subplots(1, 2, figsize=(11, 4), layout='constrained')
for ax, split in zip(axes, ['main','holdout']):
    for j, variant in enumerate(['V0','V1','V2']):
        metrics = [next(r['routeCost'] for r in elite_intervals if r['split']==split and r['variant']==variant and r['strategy']==strategy and r['loadout']=='none') for strategy in STRATEGIES[:3]]
        ax.errorbar(np.arange(3)+(j-1)*.18, [r['mean'] for r in metrics], yerr=np.array([[r['mean']-r['ci95'][0],r['ci95'][1]-r['mean']] for r in metrics]).T, fmt='o', capsize=4, color=COLORS[variant], label=variant)
    ax.axhline(0,color='#aaaaaa',linewidth=1)
    ax.set(title=split, xticks=range(3), xticklabels=STRATEGIES[:3], ylabel='Цена элитного пути в итоговых HP', ylim=(-1.5,7))
    ax.legend(); ax.grid(alpha=.2)
fig.suptitle('Одинаковый вход · обычные награды · парный bootstrap 95% CI')
fig.savefig(PLOTS / 'elite-cost.png'); plt.close(fig)

inventory = []
for path in sorted(ROOT.rglob('*')):
    if path.is_file() and path.name != 'inventory.json' and '__pycache__' not in path.parts:
        data = path.read_bytes()
        normalization = 'utf8-lf' if path.suffix in {'.json','.md','.mjs','.py'} else 'binary'
        if normalization == 'utf8-lf':
            data = data.replace(b'\r\n', b'\n')
        inventory.append({'file': path.relative_to(ROOT).as_posix(), 'normalization': normalization, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
(ROOT / 'inventory.json').write_text(json.dumps(inventory, indent=2)+'\n', encoding='utf-8')
print('Rebuilt tables, paired statistics and 4 plots')
