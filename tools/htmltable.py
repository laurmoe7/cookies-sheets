"""Minimal HTML table parser that understands rowspan/colspan headers."""
from html.parser import HTMLParser
import html as htmllib
import re


class _TableParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.head_rows, self.body_rows = [], []
        self._in_head = False
        self._row = None
        self._cell = None
        self.caption = ''
        self._in_caption = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'thead':
            self._in_head = True
        elif tag == 'caption':
            self._in_caption = True
        elif tag == 'tr':
            self._row = []
        elif tag in ('td', 'th') and self._row is not None:
            self._cell = {'text': '', 'rowspan': int(a.get('rowspan') or 1),
                          'colspan': int(a.get('colspan') or 1), 'th': tag == 'th'}
        elif tag == 'br' and self._cell is not None:
            self._cell['text'] += ' '

    def handle_endtag(self, tag):
        if tag == 'thead':
            self._in_head = False
        elif tag == 'caption':
            self._in_caption = False
        elif tag in ('td', 'th') and self._cell is not None:
            self._cell['text'] = re.sub(r'\s+', ' ', self._cell['text']).strip()
            self._row.append(self._cell)
            self._cell = None
        elif tag == 'tr' and self._row is not None:
            is_head = self._in_head or (self._row and all(c['th'] for c in self._row) and not self.body_rows)
            (self.head_rows if is_head else self.body_rows).append(self._row)
            self._row = None

    def handle_data(self, data):
        if self._cell is not None:
            self._cell['text'] += data
        elif self._in_caption:
            self.caption += data


def _grid(rows):
    """Expand row/colspans into a rectangular grid of strings."""
    grid, pending = [], {}
    for r, row in enumerate(rows):
        out, col = [], 0
        cells = list(row)
        while cells or (r, col) in pending:
            if (r, col) in pending:
                out.append(pending.pop((r, col)))
                col += 1
                continue
            cell = cells.pop(0)
            for i in range(cell['colspan']):
                out.append(cell['text'])
                for k in range(1, cell['rowspan']):
                    pending[(r + k, col)] = cell['text']
                col += 1
        grid.append(out)
    return grid


def parse_table(table_html):
    p = _TableParser()
    p.feed(table_html)
    head = _grid(p.head_rows)
    ncols = max([len(r) for r in head] + [len(r) for r in _grid(p.body_rows)] + [0])
    headers = []
    for c in range(ncols):
        parts = []
        for r in head:
            if c < len(r) and r[c] and (not parts or parts[-1] != r[c]):
                parts.append(r[c])
        headers.append(' / '.join(parts))
    return {'caption': p.caption.strip(), 'headers': headers, 'rows': _grid(p.body_rows)}
