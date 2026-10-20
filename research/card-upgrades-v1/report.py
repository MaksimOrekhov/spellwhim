"""Rebuild the Markdown report, paired statistics and optional SVG charts from retained samples.
Standard-library analysis: python3 research/card-upgrades-v1/report.py
Charts require reportlab (available in the bundled Codex Python); no package changes to the game.
"""
import collections
import gzip
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'docs/data/card-upgrades-v1'
manifest = json.loads((DATA / 'manifest.json').read_text())
rows = [row for name in ['classic', 'planner'] for row in json.loads((DATA / f'{name}.json').read_text())['rows']]
routes = json.loads((DATA / 'routes.json').read_text())['rows']
metrics = ['winRate', 'turns', 'lostW', 'lostM', 'available', 'spent', 'seenUpgrades', 'upgradedPlays', 'excessArmor', 'leftArmor', 'bleedNow', 'bleedTicks', 'bleedApplied', 'vulnerability', 'blocked', 'missingDefense', 'missingAttack', 'missingBleed', 'decisionTurns', 'openingPlayable', 'openingDefense', 'openingKinds', 'openingSequenceEntropy', 'fiveManaTurns', 'plannerPlans', 'plannerTruncated', 'plannerNodes']
def aggregate(config, strategy, subset='holdout'):
    group = [row for row in rows if row['config'] == config and row['strategy'] == strategy and row['range'] == subset]
    n = sum(row['n'] for row in group)
    result = {key: sum(row[key] * row['n'] for row in group) / n for key in metrics}
    hist = collections.Counter()
    for row in group:
        hist.update({int(k): v for k, v in row['turnHistogram'].items()})
    values = sorted(hist.elements())
    result.update(n=n, wins=sum(row['wins'] for row in group), median=values[len(values)//2], p90=values[min(len(values)-1, int(len(values)*.9))])
    return result

# Pair equal seeds, first averaging across all nine fixed enemies. The independent unit is the seed,
# not nine correlated battle rows. CI = mean paired difference ±1.96 * sample-SE (descriptive, no multiplicity correction).
seed_metrics = collections.defaultdict(lambda: collections.defaultdict(float))
card_plays = collections.defaultdict(collections.Counter)
for part in ['classic', 'planner']:
    with gzip.open(DATA / f'{part}.jsonl.gz', 'rt') as stream:
        for line in stream:
            row = json.loads(line)
            key = (row['range'], row['strategy'], row['config'], row['seed'])
            acc = seed_metrics[key]
            for metric in ['turns', 'lostW', 'lostM', 'spent', 'available', 'upgradedPlays']:
                acc[metric] += row[metric]
            acc['winRate'] += row['result'] == 'victory'
            acc['n'] += 1
            if row['range'] == 'holdout':
                card_plays[(row['strategy'], row['config'])].update(row['cardPlays'])
for acc in seed_metrics.values():
    n = acc.pop('n')
    for metric in list(acc):
        acc[metric] /= n

def paired(before, after, strategy, metric, subset='holdout'):
    differences = []
    for (range_id, bot, config, seed), acc in seed_metrics.items():
        if range_id == subset and bot == strategy and config == before:
            other = seed_metrics.get((subset, strategy, after, seed))
            if other is not None:
                differences.append(other[metric] - acc[metric])
    n = len(differences)
    mean = sum(differences) / n
    se = math.sqrt(sum((value-mean)**2 for value in differences)/(n-1)/n)
    return {'nSeeds': n, 'mean': mean, 'ci95': [mean-1.96*se, mean+1.96*se]}

pairs = [(a, b) for a, b in [('A', 'B'), ('A', 'C'), ('B', 'D'), ('C', 'E'), ('E', 'F'), ('A', 'F'), ('A', '16-8'), ('A', '14-8'), ('14-8', '14-7'), ('A', '18-8+2'), ('14-8', '14-8+2'), ('16-8', '16-8+2')]]
paired_rows = [{'before': a, 'after': b, 'strategy': strategy, 'metric': metric, **paired(a, b, strategy, metric)} for a, b in pairs for strategy in ['aggressive', 'balanced', 'defensive', 'planner'] for metric in ['turns', 'lostW', 'lostM', 'winRate']]
(DATA / 'paired.json').write_text(json.dumps({'method': 'Paired seed-cluster mean difference; 95% normal CI; all nine fixed enemies per seed; no adjustment for multiple contrasts', 'rows': paired_rows}, ensure_ascii=False, indent=2)+'\n')
(DATA / 'aggregates.json').write_text(json.dumps({'rows': [{'config': config['id'], 'strategy': bot, **aggregate(config['id'], bot)} for config in manifest['configs'] for bot in ['aggressive', 'balanced', 'defensive', 'planner']]}, ensure_ascii=False, indent=2)+'\n')

lines = []
def add(text=''): lines.append(text)
def table(headers, data):
    add()
    add('| ' + ' | '.join(headers) + ' |')
    add('|' + '|'.join(['---']*len(headers)) + '|')
    for row in data: add('| ' + ' | '.join(str(v) for v in row) + ' |')
    add()
def f(value): return f'{value:.2f}'
def percent(value): return f'{value*100:.1f}%'
bots = ['aggressive', 'balanced', 'defensive', 'planner']
add('# Card Upgrades & Power Curve v1 — исследование')
add('\n20.10.2026. Улучшения реализованы; старт игры остаётся **18/8**. Все 23 числа совпадают с PROTOTYPE §5.2. [Технический отчёт](card-upgrades-v1-report.md).')
add('\n## Вывод и границы решения\n')
add('Улучшения дают измеримый, но умеренный прирост. При том же составе 2 улучшения (B→D) сокращают бой примерно на 3%, 4 улучшения (C→E) — на 3–4%. Это **не достигает ориентира E03 ≥15% темпа**. Защитные улучшения заметнее по HP: у готовой armor-сборки balanced уменьшение потерь около 16%, тоже ниже ориентира 20%. Простое добавление восьми обычных карт C почти не улучшает balanced относительно A. Система развития работает, но проблему выраженной кривой силы этот бюджет целиком не решает.')
add('\nОбмен лечения на улучшение имеет настоящую цену. На safe-маршруте holdout balanced теряет 3.2 п.п. побед (90.2→87.0%) при фиксированной политике развиваться, если оба героя имеют ≥65% HP. Это не доказывает вред улучшений: меняются и сила, и упущенное лечение, и последующий публичный маршрут. Порог 65% не настраивался на holdout и не является рекомендацией игроку.')
add('\n**Рекомендация по старту:** C14/8 — основной кандидат следующего человеческого/маршрутного теста; C16/8 сохранить как более широкий контроль. C14/7 уступает C14/8 при строго одинаковом составе. Сейчас не переводить игру с 18/8 автоматически: C14/8 быстрее, но balanced теряет немного больше HP Джайны, planner-shortlist имеет лишь 16+16 seed, а полные маршруты со сравнением компактных стартов и новой ценой привала ещё не проверены. 18/8 остаётся текущим производственным контролем.')
add('\n## Протокол\n')
add(f"Основная выборка **410000–410299**, независимая holdout **510000–510299**, три неизменённых бота aggressive/balanced/defensive, public-информация. По **300+300 seed на каждого из девяти противников v10** и каждую конфигурацию. Planner: A–F **60+60**, старт/архетипы **16+16 (screening)**. Его профиль/лимиты прежние: beam 30, 900 узлов, depth 12. Полные походы: **500+500** на классическую пару route/rest policy, planner **30+30 screening** только safe. Итого **372 600** классических и **11 376** planner-боёв, **8 120** настоящих походов. Все исходы включены; таймаутов 0.")
add('\nИзолированные бои начинаются с полным HP 25/18, без предметов; одни и те же seed, враги, экономика B и составы внутри пар B/D, C/E. Все правила — createBattle/playCard/endTurn и канонический resolver. В реальных походах HP переносится, награды берутся из настоящих seeded-предложений, предметы выдаются по прежнему artifact-first рангу в два личных слота. Safe/mixed читают только публичные категории карты. Здоровье и враги не изменены.')
add('\nЧисло ходов и доступная/потраченная мана включают победный ход. «Увидено» — число разных улучшенных копий, попавших в руку за бой; «сыграно» — число их розыгрышей, включая повторные. Лишняя защита — броня сверх реального входящего удара при её списании; броня на завершении боя дана отдельно. Недостаток защиты/атаки/Кровотечения измеряется на старте хода по доступной руке и текущей мане, без знания скрытого размера подготовки. Не является оценкой всех возможных линий после добора.')
add('\n95% CI ниже рассчитаны по **парным seed**: сначала усреднение девяти фиксированных врагов внутри seed, затем разность и normal SE между seed. Враги не считаются независимыми повторениями. CI описательные, без поправки на множественные сравнения. Wilson-интервалы отдельных групп сохранены в JSON; агрегированный saturated win rate не доказывает одинаковую силу.')
add(f"\nКонтракт исследования: rules `{manifest['rules']}`, каталог `{manifest['catalogue']}`, SHA256 исходников/настроек `{manifest['sourceSha256']}`; базовый Git SHA `{manifest['baseRevision']}`. Полный список хешируемых файлов, точные копии/уровни, seeds, профиль и настройки — [manifest](../data/card-upgrades-v1/manifest.json).")
add('\n## Составы A–F\n')
table(['ID', 'Колода', 'Улучшения'], [
 ['A', 'Текущий старт 18', '0'], ['B', 'A + rend, thunderbolt, bastion, arcane-mark (22)', '0'], ['C', 'B + ice-echo, wound-clamp, reaping-blow, frost-seal (26)', '0'],
 ['D', 'Точно B', 'первая frostbolt и первая sword-strike'], ['E', 'Точно C', 'первая frostbolt, sword-strike, arcane-insight, bastion'], ['F', 'E минус вторая fireball, shield-bash, guard, parry (22)', 'те же четыре'],
])
add('D/E — заранее подготовленная потенциальная сила, F — гипотеза сервисов удаления. В текущем игровом маршруте удаления нет; четыре улучшения за три возможных привала недоступны. Восемь приобретений C/E тоже превышают максимум шести карточных наград до финала, а привалы/предметы уменьшают этот бюджет. Ни один из этих пакетов не объявляется типичной реальной сборкой. «Слабые» удалённые копии — выбранное прореживание, а не доказательство слабости каждого определения во всех ситуациях. F не изолирует эффект удаления от изменения частот защиты.')
add('\n## Эффективность и ресурсы\n')
table(['Бот / пакет', 'Победы main / holdout', 'Ходы H (med/p90)', 'HP потери W / M H', 'Мана spent / available H', 'Увидено / сыграно ↑ H'], [
 [f'{bot} / {config}', percent(aggregate(config,bot,'main')['winRate'])+' / '+percent(aggregate(config,bot)['winRate']), f"{f(aggregate(config,bot)['turns'])} ({aggregate(config,bot)['median']}/{aggregate(config,bot)['p90']})", f(aggregate(config,bot)['lostW'])+' / '+f(aggregate(config,bot)['lostM']), f(aggregate(config,bot)['spent'])+' / '+f(aggregate(config,bot)['available']), f(aggregate(config,bot)['seenUpgrades'])+' / '+f(aggregate(config,bot)['upgradedPlays'])] for bot in bots for config in 'ABCDEF'
])
add('H = holdout. Во многих full-HP клетках победы близки к 100%; информативнее темп, раздельное HP и походы. Удаление E→F повышает доступ к улучшенным копиям, но balanced теряет больше HP Вариана: усиление плотности атак не бесплатно для его защиты.')
add('\n### Парные изменения, holdout\n')
table(['Пара', 'Бот', 'Δ ходов [95% CI]', 'Δ HP W [CI]', 'Δ HP M [CI]'], [[a+'→'+b, bot]+[f"{f(v['mean'])} [{f(v['ci95'][0])}; {f(v['ci95'][1])}]" for v in [paired(a,b,bot,key) for key in ['turns','lostW','lostM']]] for a,b in [('A','B'),('A','C'),('B','D'),('C','E'),('E','F')] for bot in ['balanced','defensive','planner']])
add('Δ = после − до; отрицательные ходы/потери лучше. CI planner относится к 60 парным seed в A–F; небольшой эффект по HP может пересекать ноль.')
add('\n### Тактические показатели, holdout\n')
table(['Бот / пакет', 'Лишняя / оставшаяся броня', 'Кровь сейчас / на ходе врага', 'Уязвимость: расходов/бой', 'Нет защиты / атаки / источника Крови (% ходов)', 'Блок. добор'], [[bot+' / '+config, f(v['excessArmor'])+' / '+f(v['leftArmor']), f(v['bleedNow'])+' / '+f(v['bleedTicks']), f(v['vulnerability']), ' / '.join(percent(v[k]/v['decisionTurns']) for k in ['missingDefense','missingAttack','missingBleed']), f(v['blocked'])] for bot in ['balanced','defensive'] for config in 'ABCDEF' for v in [aggregate(config,bot)]])
add('\n## Подготовленные архетипы\n')
add('К старту добавлены восемь конкретных карт, у пары +0/+4 состав одинаков. armor: bastion, ice-ward, stance-strike, interpose, thunderbolt, frostbolt, parry, arcane-insight; bleeding: rend×2, ice-echo, wound-clamp, reaping-blow, boil-blood, blood-resonance, frost-seal; vulnerability: frostbolt, arcane-mark, shield-bash, quick-cut, sword-strike, thunderbolt, crushing-swing, arcane-insight; attack: quick-cut, thunderbolt, rend, sword-strike, fireball, stance-strike, ice-echo, crushing-swing; defense: bastion, interpose, ice-ward, parry, covering-counter, wound-clamp, arcane-insight, frost-seal. Первые копии четырёх первых различных предпочтений улучшаются; точные ID — manifest.')
table(['Архетип / бот', 'Ходы +0→+4', 'Потери W+M +0→+4', 'Ускорение / снижение потерь', 'Победы +0→+4'], [[arch+' / '+bot, f(a['turns'])+'→'+f(b['turns']), f(a['lostW']+a['lostM'])+'→'+f(b['lostW']+b['lostM']), percent(1-b['turns']/a['turns'])+' / '+percent(1-(b['lostW']+b['lostM'])/(a['lostW']+a['lostM'])), percent(a['winRate'])+'→'+percent(b['winRate'])] for arch in ['armor','bleeding','vulnerability','attack','defense'] for bot in bots for a,b in [(aggregate(arch+'+0',bot),aggregate(arch+'+4',bot))]])
add('На классических ботах сильнее всего темп выигрывает attack (до 4.6%), а защиту — armor (balanced около 16%). При aggressive улучшенная defense-сборка становится медленнее: прежняя эвристика может чаще выбирать усиленные защитные карты. Это взаимодействие бота и каталога, а не доказательство универсального нерфа улучшения. Planner не настраивался под эти архетипы и остаётся ограниченным поиском.')
add('\nНи одно улучшение не показало доказанного универсального автопика. Отдельного причинного 23×card marginal sweep и человеческого pick-rate здесь нет, поэтому ранжировать все улучшения по популярности розыгрышей некорректно. +1 к rend сознательно сохраняет будущие 6 урона Кровотечения; усиление 3→4 дало бы ещё 4 и здесь не применялось. +1 к Ледяной стреле сохраняет сильные +3 Уязвимости/+2 брони, а броня после тика теряется на lethal. Возможные слабые места следующего опыта — улучшения +1 прямого урона в широкой колоде и 9 брони Перехвата при отсутствии большого удара; кандидаты на полезную защитную поддержку — Предвидение/Метка. Это гипотезы, не основание без нового опыта менять числа GDD.')
add('\n## Реальные походы: доступность и цена привала\n')
add('heal всегда лечит самого раненого по доле HP, develop улучшает при обоих ≥65% HP, иначе лечит. Приоритет улучшений заранее задан; обычные предложения и ранги прежние. Нет выдачи идеального архетипа, четырёх улучшений или удаления. Маршрут может измениться после отказа от лечения; это полный эффект политики, не чистая оценка силы карты.')
table(['Бот / путь / привал', 'Победы main / H', 'Улучшений H', '≥2 улучшений H', 'Розыгрышей ↑ H', 'Итоговый HP W / M H', 'Размер H'], [[r['strategy']+' / '+r['policy']+' / '+r['restPolicy'], percent(next(x for x in routes if x['range']=='main' and all(x[k]==r[k] for k in ['strategy','policy','restPolicy']))['winRate'])+' / '+percent(r['winRate']), f(r['upgrades']), percent(r['twoUpgrades']), f(r['upgradedPlays']), f(25-r['lostW'])+' / '+f(18-r['lostM']), f(r['finalSize'])] for r in routes if r['range']=='holdout'])
add('На safe defensive до двух улучшений доходят 72.2% holdout-походов develop, среднее 1.95, а mixed defensive — лишь 3.2%, среднее 0.21. В mixed меньше привалов и выше цена отказа от лечения. Четыре улучшения не получены ни в одном походе. E не является доступным текущим обещанием прогрессии; будущим секторам нужны отдельные услуги развития, как и предусмотрено GDD. Новые комнаты в этой задаче не добавлялись.')
add('\n## Повторная проверка старта\n')
add('C14: sword-strike×2, fireball×1, guard×2, parry×1, shield-bash×1, interpose×1, frostbolt×2, arcane-insight×1, ice-ward×2, thunderbolt×1. C16 = C14 + parry + arcane-insight. Текущий A18 — по две девяти стартовых определений, без thunderbolt. Поэтому A18↔C14/C16 меняет **состав**, а не один размер. C14/8↔C14/7 имеет строго одинаковые 14 карт. +2 у всех — первая frostbolt и первая sword-strike; ноль и два улучшения анализируются отдельно.')
table(['Бот / старт', 'Ходы H', 'HP W / M H', 'Разных доступных версий в начальной руке H', 'Защитных копий H', 'Энтропия первой последовательности (бит) H', 'Увидено / сыграно ↑ H'], [[bot+' / '+config, f(v['turns']), f(v['lostW'])+' / '+f(v['lostM']), f(v['openingKinds']), f(v['openingDefense']), f(v['openingSequenceEntropy']), f(v['seenUpgrades'])+' / '+f(v['upgradedPlays'])] for bot in bots for config in ['A','16-8','14-8','14-7','18-8+2','16-8+2','14-8+2','14-7+2'] for v in [aggregate(config,bot)]])
add('Энтропия — среднее по девяти врагам на 300 seed (planner 16); она описывает вариативность бота и не доказывает субъективную глубину. Размер руки 8 при компактной колоде чаще показывает разнообразные определения, хотя удержание и раннее повторение ядра могут сделать дальнейшие ходы похожими. Тест с 7 картами одновременно уменьшает доступный выбор и доступ к улучшениям. C14/8 лучше поддерживает плотность будущих улучшений; C16/8 сохраняет дополнительные Парирование/Предвидение и разумен как альтернативный контроль безопасности/разнообразия.')
add('\nДля окончательного выбора: сравнить C14/8, C16/8 и текущий 18/8 в полных походах с фиксированной и адаптивной политикой привала; затем 12–20 человеческих участников с повторными попытками. Отдельно измерить ощущение повторяемости руки и ущерб Джайны. Не компенсировать компактность ослаблением врагов.')
add('\n## Воспроизведение и ограничения\n')
add('```sh\nnode research/card-upgrades-v1/run.mjs --phase classic\nnode research/card-upgrades-v1/run.mjs --phase planner\nnode research/card-upgrades-v1/run.mjs --phase routes\npython3 research/card-upgrades-v1/report.py\n```')
add('\nФазы можно запускать последовательно; manifest одинаков для всех. `--smoke` пишет только в `/tmp/spellwhim-power-smoke`. Сжатые JSONL хранят каждый бой/поход, seed, исход, метрики, первую последовательность и розыгрыши по версии карты; у походов — промежуточные колоды и исходы всех встреч. [Агрегаты](../data/card-upgrades-v1/aggregates.json), [парные CI](../data/card-upgrades-v1/paired.json), [classics](../data/card-upgrades-v1/classic.json), [planner](../data/card-upgrades-v1/planner.json), [routes](../data/card-upgrades-v1/routes.json). Исторические результаты не заменялись.')
add('\nОграничения: нынешние девять фиксированных врагов/короткая карта, одинаковые full-HP условия не равны новым длинным секторам; два классических профиля безопасности и один атакующий — ограниченные эвристики; planner не достиг node cap ни в одном из 67 755 планов отдельных боёв, но ограничен beam/depth и одной выборкой неизвестного порядка, поэтому не является оптимальным игроком. Предметы/привалы взаимодействуют с развитием; отдельный парный no-artifact контроль здесь только в изолированных боях. Нет gold, новых наград, удаления в настоящем маршруте, человеческих сессий или измерения «ощущения» роста. Числа описывают выбранные пакеты, не все возможные драфты.')
# Standard chart library, optional in plain-system Python.
try:
    from reportlab.graphics.shapes import Drawing, String
    from reportlab.graphics.charts.barcharts import VerticalBarChart
    from reportlab.graphics import renderSVG
    from reportlab.lib import colors
    drawing = Drawing(960, 350)
    for offset, metric, title in [(0, 'turns', 'Mean player turns'), (480, 'health', 'Mean HP lost (both heroes)')]:
        chart = VerticalBarChart()
        chart.x = offset + 45; chart.y = 65; chart.width = 400; chart.height = 225
        chart.categoryAxis.categoryNames = list('ABCDEF')
        chart.data = [[(lambda v: v['lostW']+v['lostM'] if metric=='health' else v['turns'])(aggregate(config,bot)) for config in 'ABCDEF'] for bot in ['aggressive','balanced','defensive']]
        chart.valueAxis.valueMin = 0
        chart.bars[0].fillColor = colors.HexColor('#a74e35'); chart.bars[1].fillColor = colors.HexColor('#3569a7'); chart.bars[2].fillColor = colors.HexColor('#488251')
        drawing.add(chart); drawing.add(String(offset+45, 320, title+' — holdout', fontSize=15))
    drawing.add(String(50, 20, 'Red: aggressive    Blue: balanced    Green: defensive | fixed nine enemies, 300 seeds each', fontSize=12))
    renderSVG.drawToFile(drawing, str(DATA/'power-curve.svg'))
    add('\n![Темп и потери HP на holdout](../data/card-upgrades-v1/power-curve.svg)')
except ImportError:
    pass
(ROOT / 'docs/design/card-upgrades-power-curve-v1.md').write_text('\n'.join(lines)+'\n')
print('Report rebuilt; paired contrasts:', len(paired_rows))
