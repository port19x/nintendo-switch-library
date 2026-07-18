/* Pure client-side app — no build step required */
const state = {
  games: [],
  sort: 'title',
  dir: 1,
  page: 1,
  pageSize: 50,
};

const $ = (id) => document.getElementById(id);
const density = (g) =>
  g.metacriticScore != null && g.howlongtobeatHours > 0
    ? g.metacriticScore / g.howlongtobeatHours
    : null;

const scoreClass = (s) => (s >= 80 ? 'score-ok' : s >= 70 ? 'score-mid' : 'score-bad');

function filtersActive() {
  return (
    $('q').value.trim() ||
    $('party').value !== 'all' ||
    $('score').value !== '0' ||
    $('time').value !== 'all' ||
    $('density').value !== '0'
  );
}

function filtered() {
  const q = $('q').value.trim().toLowerCase();
  const party = $('party').value;
  const minScore = Number($('score').value);
  const time = $('time').value;
  const minDens = Number($('density').value);

  return state.games.filter((g) => {
    if (q && !g.title.toLowerCase().includes(q)) return false;
    if (party === 'first' && !g.firstParty) return false;
    if (party === 'third' && g.firstParty) return false;
    if (minScore && (g.metacriticScore == null || g.metacriticScore < minScore)) return false;
    if (time !== 'all') {
      if (g.howlongtobeatHours == null) return false;
      const h = g.howlongtobeatHours;
      if (time === 'short' && h >= 10) return false;
      if (time === 'mid' && (h < 10 || h > 25)) return false;
      if (time === 'long' && h <= 25) return false;
    }
    if (minDens) {
      const d = density(g);
      if (d == null || d < minDens) return false;
    }
    return true;
  });
}

function sorted(list) {
  const { sort, dir } = state;
  return [...list].sort((a, b) => {
    let av = sort === 'density' ? density(a) : a[sort];
    let bv = sort === 'density' ? density(b) : b[sort];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'string') return av.localeCompare(bv) * dir;
    if (typeof av === 'boolean') return (av === bv ? 0 : av ? -1 : 1) * dir;
    return (av - bv) * dir;
  });
}

function badge(score) {
  if (score == null) return '<span class="muted">-</span>';
  return `<span class="badge ${scoreClass(score)}">${score}</span>`;
}

function render() {
  const list = sorted(filtered());
  const total = list.length;
  const size = state.pageSize || total || 1;
  const pages = Math.max(1, Math.ceil(total / size));
  if (state.page > pages) state.page = pages;

  const start = state.pageSize ? (state.page - 1) * state.pageSize : 0;
  const pageItems = state.pageSize ? list.slice(start, start + state.pageSize) : list;

  $('count').textContent = filtersActive()
    ? `${total} / ${state.games.length}`
    : `${state.games.length} Spiele`;

  $('reset').hidden = !filtersActive();

  document.querySelectorAll('th[data-sort]').forEach((th) => {
    th.classList.toggle('sorted', th.dataset.sort === state.sort);
    th.textContent = th.textContent.replace(/ [↑↓]$/, '');
    if (th.dataset.sort === state.sort) th.textContent += state.dir > 0 ? ' ↑' : ' ↓';
  });

  if (!pageItems.length) {
    $('rows').innerHTML = `<tr><td colspan="6" class="empty">Keine Treffer</td></tr>`;
  } else {
    $('rows').innerHTML = pageItems
      .map((g) => {
        const d = density(g);
        const party = g.firstParty
          ? '<span class="badge party-first">First</span>'
          : '<span class="badge party-third">Third</span>';
        const mc =
          g.metacriticUrl && g.metacriticScore != null
            ? `<a class="badge ${scoreClass(g.metacriticScore)}" href="${g.metacriticUrl}" target="_blank" rel="noopener">${g.metacriticScore}</a>`
            : badge(g.metacriticScore);
        const hours =
          g.howlongtobeatHours != null
            ? `<a class="badge hours" href="${g.howlongtobeatUrl || '#'}" target="_blank" rel="noopener">${g.howlongtobeatHours} Std.</a>`
            : '<span class="muted">-</span>';
        const dens =
          d != null
            ? `<span class="badge density" title="${g.metacriticScore} ÷ ${g.howlongtobeatHours}">${d.toFixed(1)}</span>`
            : '<span class="muted">-</span>';
        const opac = g.opacDetailUrl
          ? `<a class="opac" href="${g.opacDetailUrl}" target="_blank" rel="noopener">OPAC ↗</a>`
          : '';
        return `<tr>
          <td>${escapeHtml(g.title)}</td>
          <td>${party}</td>
          <td>${mc}</td>
          <td>${hours}</td>
          <td>${dens}</td>
          <td style="text-align:right">${opac}</td>
        </tr>`;
      })
      .join('');
  }

  const from = total ? start + 1 : 0;
  const to = state.pageSize ? Math.min(start + state.pageSize, total) : total;
  $('range').textContent = `Zeige ${from}–${to} von ${total}`;
  $('page').textContent = `Seite ${state.page} / ${pages}`;
  $('prev').disabled = state.page <= 1;
  $('next').disabled = state.page >= pages || !state.pageSize;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function bind() {
  ['q', 'party', 'score', 'time', 'density'].forEach((id) => {
    $(id).addEventListener('input', () => {
      state.page = 1;
      render();
    });
  });

  $('reset').onclick = () => {
    $('q').value = '';
    $('party').value = 'all';
    $('score').value = '0';
    $('time').value = 'all';
    $('density').value = '0';
    state.page = 1;
    render();
  };

  $('pageSize').onchange = (e) => {
    state.pageSize = Number(e.target.value);
    state.page = 1;
    render();
  };
  $('prev').onclick = () => {
    state.page--;
    render();
  };
  $('next').onclick = () => {
    state.page++;
    render();
  };

  document.querySelectorAll('th[data-sort]').forEach((th) => {
    th.onclick = () => {
      const key = th.dataset.sort;
      if (state.sort === key) state.dir *= -1;
      else {
        state.sort = key;
        state.dir = key === 'title' || key === 'firstParty' ? 1 : -1;
      }
      render();
    };
  });
}

async function main() {
  bind();
  const res = await fetch('./games.json');
  state.games = await res.json();
  render();
}

main().catch((err) => {
  $('rows').innerHTML = `<tr><td colspan="6" class="empty">Fehler: ${escapeHtml(err.message)}</td></tr>`;
});
