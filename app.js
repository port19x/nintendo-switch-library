export const PAGE_SIZE = 15;
export function applyFilters(games, state) {
  const query = state.query.trim().toLocaleLowerCase();
  const filtered = games.filter(g => (!query || g.title.toLocaleLowerCase().includes(query)) &&
    (state.party === 'all' || g.party === state.party) &&
    (state.length === 'all' || (g.hours != null && g.hours <= Number(state.length))) &&
    (!Number(state.score) || (g.score != null && g.score >= Number(state.score))));
  return filtered.sort((a,b) => state.sort === 'title' ? a.title.localeCompare(b.title) :
    state.sort === 'hours' ? (a.hours ?? Infinity) - (b.hours ?? Infinity) :
    (b[state.sort] ?? -1) - (a[state.sort] ?? -1));
}

const $ = id => document.getElementById(id);
let allGames = [], page = 1;
const controls = ['search','party','length','score','sort'];
const state = () => ({query:$('search').value, party:$('party').value, length:$('length').value, score:$('score').value, sort:$('sort').value});
const value = (v, suffix='') => v == null ? '<span class="muted">Not rated</span>' : `${v}${suffix}`;
function render() {
  const games = applyFilters(allGames, state()), pages = Math.max(1, Math.ceil(games.length/PAGE_SIZE)); page=Math.min(page,pages);
  const shown=games.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  $('games').innerHTML=shown.map(g=>`<tr><td>${escapeHtml(g.title)}</td><td><span class="pill">${g.party==='first'?'First party':'Third party'}</span></td><td><a href="${g.metacriticUrl}" target="_blank" class="score ${g.score>=80?'high':''}">${value(g.score)}</a></td><td><a href="${g.hltbUrl}" target="_blank">${value(g.hours,' hrs')}</a></td><td>${g.density==null?value(null):`<span class="density">${g.density}<i style="--bar:${Math.min(g.density*3,100)}%"></i></span>`}</td><td><a class="borrow" href="${g.libraryUrl}" target="_blank">View copy ↗</a></td></tr>`).join('');
  $('resultCount').textContent=`Showing ${games.length} game${games.length===1?'':'s'}`;$('pages').textContent=`Page ${page} of ${pages}`;
  $('prev').disabled=page===1;$('next').disabled=page===pages;$('empty').hidden=games.length>0;
}
function escapeHtml(text){const e=document.createElement('div');e.textContent=text;return e.innerHTML}
async function init(){
  try {const response=await fetch('games.json');if(!response.ok)throw Error(response.status);const data=await response.json();allGames=data.games;
    $('gameCount').textContent=allGames.length;$('ratedCount').textContent=allGames.filter(g=>g.score!=null).length;
    $('bestDensity').textContent=Math.max(...allGames.map(g=>g.density||0)).toFixed(1);$('updated').textContent=`Catalogue updated ${new Date(data.generatedAt).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}`;render();
  } catch {$('games').innerHTML='<tr><td colspan="6">The catalogue could not be loaded. Please refresh the page.</td></tr>'}
}
if (typeof document !== 'undefined') {
  controls.forEach(id=>$(id).addEventListener(id==='search'?'input':'change',()=>{page=1;render()}));
  $('reset').addEventListener('click',()=>{controls.forEach(id=>$(id).value=id==='party'||id==='length'?'all':id==='sort'?'density':'');$('score').value='0';page=1;render()});
  $('prev').addEventListener('click',()=>{page--;render();scrollTo(0,document.querySelector('.catalogue')?.offsetTop||0)});
  $('next').addEventListener('click',()=>{page++;render()});
  init();
}
