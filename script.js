// Owl list taken from the original README/python implementation
const owls = [
  "Barn Owl",
  "Flammulated Owl",
  "Western Screech Owl",
  "Whiskered Screech Owl",
  "Eastern Screech Owl",
  "Snowy Owl",
  "Great Horned Owl",
  "Spotted Owl",
  "Barred Owl",
  "Great Gray Owl",
  "Northern Hawk Owl",
  "Ferruginous Pygmy Owl",
  "Northern Pygmy Owl",
  "Elf Owl",
  "Burrowing Owl",
  "Boreal Owl",
  "Northern Saw-whet Owl",
  "Long-eared Owl",
  "Short-eared Owl"
];

const btn1 = document.getElementById('btn1');
const btn2 = document.getElementById('btn2');
const progressEl = document.getElementById('progress');
const skipMsg = document.getElementById('skipMsg');
const doneSection = document.getElementById('done');
const rankingEl = document.getElementById('ranking');
const restartBtn = document.getElementById('restart');

// Build pairs (unique unordered)
let pairs = [];
for (let i = 0; i < owls.length; i++) {
  for (let j = i + 1; j < owls.length; j++) {
    pairs.push([i, j]);
  }
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}
shuffle(pairs);

// Simple rating system (increment/decrement) to approximate strength
let ratings = new Array(owls.length).fill(0);
let winners = []; // pairs of [winnerIndex, loserIndex]
let idx = 0;

const testBtn = document.getElementById('testBtn');
const computeStatsBtn = document.getElementById('computeStats');
const statMsg = document.getElementById('statMsg');
const resetProgressBtn = document.getElementById('resetProgress');

// Persist/load state
function saveState() {
  localStorage.setItem('owl_pairs', JSON.stringify(pairs));
  localStorage.setItem('owl_ratings', JSON.stringify(ratings));
  localStorage.setItem('owl_winners', JSON.stringify(winners));
  localStorage.setItem('owl_index', String(idx));
}

function loadState() {
  try {
    const p = JSON.parse(localStorage.getItem('owl_pairs') || 'null');
    if (p && Array.isArray(p) && p.length === pairs.length) pairs = p;
    const r = JSON.parse(localStorage.getItem('owl_ratings') || 'null');
    if (r && Array.isArray(r) && r.length === owls.length) ratings = r;
    const w = JSON.parse(localStorage.getItem('owl_winners') || 'null');
    if (w && Array.isArray(w)) winners = w;
    const i = parseInt(localStorage.getItem('owl_index') || '0', 10);
    if (!Number.isNaN(i)) idx = i;
  } catch (e) {
    console.warn('Failed to load state', e);
  }
}

loadState();

// helpers for image file name and loading
function sanitizedName(name) {
  return name.replace(/[\s-]+/g, '_').toLowerCase();
}

function trySetImage(imgEl, base, exts, idxExt = 0) {
  if (idxExt >= exts.length) {
    if (imgEl && imgEl.parentNode) imgEl.remove();
    return;
  }
  const ext = exts[idxExt];
  imgEl.src = `photos/${base}${ext}`;
  imgEl.onload = () => {};
  imgEl.onerror = () => trySetImage(imgEl, base, exts, idxExt + 1);
}

function updateProgress() {
  progressEl.textContent = `Progress: ${Math.min(idx, pairs.length)} / ${pairs.length}`;
}

function showResults() {
  document.getElementById('pair').hidden = true;
  doneSection.hidden = false;
  // create ranking by rating
  const ranked = owls.map((name, i) => ({ name, rating: ratings[i] }));
  ranked.sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
  rankingEl.innerHTML = '';
  for (const item of ranked) {
    const li = document.createElement('li');
    // try to show thumbnail
    const img = document.createElement('img');
    img.className = 'ranking-thumb';
    img.alt = item.name;
    trySetImage(img, sanitizedName(item.name), ['.jpg', '.jpeg', '.png', '.webp']);
    li.appendChild(img);
    const text = document.createTextNode(`${item.name} (${item.rating})`);
    li.appendChild(text);
    rankingEl.appendChild(li);
  }
}

// Build pair counts and win counts from `winners` array
function buildCounts(winnersArr, n) {
  const n_ij = Array.from({ length: n }, () => new Array(n).fill(0));
  const w_ij = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const [win, lose] of winnersArr) {
    w_ij[win][lose] += 1;
    n_ij[win][lose] += 1;
    n_ij[lose][win] += 1;
  }
  return { n_ij, w_ij };
}

// Bradley-Terry via MM algorithm (Hunter 2004)
function computeBradleyTerry(winnersArr, n, opts = {}) {
  const maxIter = opts.maxIter || 10000;
  const tol = opts.tol || 1e-6;
  const { n_ij, w_ij } = buildCounts(winnersArr, n);
  const w_i = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      w_i[i] += w_ij[i][j];
    }
  }
  // initialize strengths
  let s = new Array(n).fill(1.0);
  for (let iter = 0; iter < maxIter; iter++) {
    const s_new = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let denom = 0;
      for (let j = 0; j < n; j++) {
        if (n_ij[i][j] > 0) {
          denom += n_ij[i][j] / (s[i] + s[j]);
        }
      }
      // avoid division by zero
      s_new[i] = denom > 0 ? w_i[i] / denom : s[i];
    }
    // normalize to mean=1 to avoid scale identifiability
    const mean = s_new.reduce((a, b) => a + b, 0) / n;
    for (let i = 0; i < n; i++) s_new[i] = s_new[i] / mean;
    // check convergence
    let diff = 0;
    for (let i = 0; i < n; i++) diff = Math.max(diff, Math.abs(s_new[i] - s[i]));
    s = s_new;
    if (diff < tol) break;
  }
  return s;
}

function showStatResults(scores) {
  document.getElementById('pair').hidden = true;
  doneSection.hidden = false;
  const ranked = owls.map((name, i) => ({ name, rating: ratings[i], score: scores ? scores[i] : null }));
  ranked.sort((a, b) => (scores ? b.score - a.score : b.rating - a.rating) || a.name.localeCompare(b.name));
  rankingEl.innerHTML = '';
  for (const item of ranked) {
    const li = document.createElement('li');
    const img = document.createElement('img');
    img.className = 'ranking-thumb';
    img.alt = item.name;
    trySetImage(img, sanitizedName(item.name), ['.jpg', '.jpeg', '.png', '.webp']);
    li.appendChild(img);
    if (item.score != null) {
      //li.appendChild(document.createTextNode(`${item.name} — BT score: ${item.score.toFixed(3)} (simple: ${item.rating})`));
      li.appendChild(document.createTextNode(`${item.name}`));
    } else {
      //li.appendChild(document.createTextNode(`${item.name} (${item.rating})`));
      li.appendChild(document.createTextNode(`${item.name}`));
    }
    rankingEl.appendChild(li);
  }
}

computeStatsBtn && computeStatsBtn.addEventListener('click', () => {
  const scores = computeBradleyTerry(winners, owls.length);
  statMsg.textContent = 'Computed Bradley–Terry scores.';
  showStatResults(scores);
});

// Test button: generate a random set of pairwise results so the BT implementation can be tested quickly
testBtn && testBtn.addEventListener('click', () => {
  // generate 1-5 matches per pair with random winners
  const sim = [];
  for (let i = 0; i < owls.length; i++) {
    for (let j = i + 1; j < owls.length; j++) {
      const matches = 1 + Math.floor(Math.random() * 5);
      for (let m = 0; m < matches; m++) {
        // introduce mild true-skill signal so ranking is not pure noise
        const p = 0.5 + (Math.random() - 0.5) * 0.2; // small random bias
        if (Math.random() < p) sim.push([i, j]); else sim.push([j, i]);
      }
    }
  }
  // replace winners with simulated data for testing (do not persist)
  winners = sim;
  statMsg.textContent = `Generated ${winners.length} simulated matches.`;
  const scores = computeBradleyTerry(winners, owls.length);
  showStatResults(scores);
});

function showPair() {
  updateProgress();
  skipMsg.textContent = '';
  if (idx >= pairs.length) {
    saveState();
    showResults();
    return;
  }

  const [a, b] = pairs[idx];
  // skip if ratings very different (heuristic similar to original)
  if (Math.abs(ratings[a] - ratings[b]) > 5) {
    const winner = ratings[a] > ratings[b] ? a : b;
    const loser = winner === a ? b : a;
    // register the skip as a vote for the winner (update simple ratings and record the match)
    ratings[winner] += 1;
    ratings[loser] -= 1;
    winners.push([winner, loser]);
    skipMsg.textContent = `Skipping ${owls[a]} vs. ${owls[b]} — winner: ${owls[winner]}`;
    idx++;
    saveState();
    setTimeout(showPair, 700);
    return;
  }

  // try common extensions until one loads; uses global helpers

  // populate button with optional image and label
  function populateButton(btn, name, prefix) {
    btn.disabled = true; // temporarily disable while updating
    btn.innerHTML = '';
    const base = sanitizedName(name);
    const img = document.createElement('img');
    img.className = 'owl-thumb';
    img.alt = name;
    // start trying extensions
    trySetImage(img, base, ['.jpg', '.jpeg', '.png', '.webp']);
    btn.appendChild(img);
    const lbl = document.createElement('div');
    lbl.textContent = `${prefix} ${name}`;
    btn.appendChild(lbl);
    btn.disabled = false;
  }

  populateButton(btn1, owls[a], '(1)');
  populateButton(btn2, owls[b], '(2)');
}

function handleChoice(choice) {
  if (idx >= pairs.length) return;
  const [a, b] = pairs[idx];
  const winner = choice === 1 ? a : b;
  const loser = choice === 1 ? b : a;
  ratings[winner] += 1;
  ratings[loser] -= 1;
  winners.push([winner, loser]);
  idx++;
  saveState();
  showPair();
}

btn1.addEventListener('click', () => handleChoice(1));
btn2.addEventListener('click', () => handleChoice(2));

document.addEventListener('keydown', (e) => {
  if (doneSection.hidden === false) return;
  if (e.key === '1') btn1.click();
  if (e.key === '2') btn2.click();
});

restartBtn.addEventListener('click', () => {
  localStorage.removeItem('owl_pairs');
  localStorage.removeItem('owl_ratings');
  localStorage.removeItem('owl_winners');
  localStorage.removeItem('owl_index');
  location.reload();
});

resetProgressBtn && resetProgressBtn.addEventListener('click', () => {
  if (!confirm('Reset progress? This will clear stored ratings and recorded matches. Continue?')) return;
  // clear storage
  localStorage.removeItem('owl_ratings');
  localStorage.removeItem('owl_winners');
  localStorage.removeItem('owl_index');
  localStorage.removeItem('owl_pairs');
  // reset in-memory state
  ratings = new Array(owls.length).fill(0);
  winners = [];
  idx = 0;
  // reshuffle pairs and save new order
  shuffle(pairs);
  saveState();
  // reset UI
  doneSection.hidden = true;
  document.getElementById('pair').hidden = false;
  rankingEl.innerHTML = '';
  skipMsg.textContent = '';
  statMsg.textContent = 'Progress reset.';
  showPair();
});

// initial render
showPair();
