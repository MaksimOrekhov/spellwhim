"""Dependency-free SVG bar charts for the review report (light surface, direct value labels, legend)."""
from html import escape

SURFACE, INK, INK2, GRID = '#fcfcfb', '#0b0b0b', '#52514e', '#e4e3df'
SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#6250d6']
NEUTRAL = '#8a8984'   # control (V0) is always the neutral gray, never a series hue


def grouped_bars(path, title, groups, series, values, unit='', colors=None, note='', vmax=None, fmt='{:.1f}'):
    """groups: category labels (x); series: legend names; values[s][g]."""
    colors = colors or [NEUTRAL] + SERIES
    W, left, right, top, bottom = 760, 56, 16, 64, 56
    H = 340
    pw, ph = W - left - right, H - top - bottom
    vmax = vmax or max(v for row in values for v in row if v is not None) * 1.15 or 1
    gw = pw / len(groups)
    bw = min(26, (gw - 14) / len(series))
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="system-ui,Segoe UI,sans-serif">',
           f'<rect width="{W}" height="{H}" fill="{SURFACE}"/>',
           f'<text x="{left}" y="22" font-size="15" font-weight="600" fill="{INK}">{escape(title)}</text>']
    if note:
        out.append(f'<text x="{left}" y="40" font-size="11.5" fill="{INK2}">{escape(note)}</text>')
    # legend
    lx = left
    for i, s in enumerate(series):
        out.append(f'<rect x="{lx}" y="48" width="10" height="10" rx="2" fill="{colors[i]}"/><text x="{lx + 14}" y="57" font-size="11.5" fill="{INK2}">{escape(s)}</text>')
        lx += 26 + 7.6 * len(s)
    for k in range(5):
        y = top + ph - ph * k / 4
        out.append(f'<line x1="{left}" x2="{W - right}" y1="{y:.1f}" y2="{y:.1f}" stroke="{GRID}" stroke-width="1"/>')
        out.append(f'<text x="{left - 6}" y="{y + 4:.1f}" font-size="10.5" fill="{INK2}" text-anchor="end">{vmax * k / 4:.0f}{escape(unit)}</text>')
    for g, name in enumerate(groups):
        x0 = left + g * gw + (gw - bw * len(series) - 2 * (len(series) - 1)) / 2
        for s in range(len(series)):
            v = values[s][g]
            if v is None:
                continue
            h = ph * max(0, v) / vmax
            x, y = x0 + s * (bw + 2), top + ph - h
            r = min(4, h / 2)
            out.append(f'<path d="M{x:.1f},{top + ph:.1f} V{y + r:.1f} Q{x:.1f},{y:.1f} {x + r:.1f},{y:.1f} H{x + bw - r:.1f} Q{x + bw:.1f},{y:.1f} {x + bw:.1f},{y + r:.1f} V{top + ph:.1f} Z" fill="{colors[s]}"><title>{escape(name)} · {escape(series[s])}: {fmt.format(v)}{escape(unit)}</title></path>')
            out.append(f'<text x="{x + bw / 2:.1f}" y="{y - 4:.1f}" font-size="9.5" fill="{INK2}" text-anchor="middle">{fmt.format(v)}</text>')
        out.append(f'<text x="{left + g * gw + gw / 2:.1f}" y="{top + ph + 18:.1f}" font-size="11" fill="{INK}" text-anchor="middle">{escape(name)}</text>')
    out.append(f'<line x1="{left}" x2="{W - right}" y1="{top + ph}" y2="{top + ph}" stroke="{INK2}" stroke-width="1"/>')
    out.append('</svg>')
    open(path, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
