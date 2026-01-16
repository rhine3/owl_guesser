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
const rankingHeader = document.getElementById('rankingHeader');
// ranking lists are created dynamically in the DOM when showing results
// const restartBtn = document.getElementById('restart');

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

// Rating system 1: simple +1/-1 per win/loss
let ratings = new Array(owls.length).fill(0);
// Rating system 2: use Bradley-Terry model on winner and loser pairs
let winners = []; // pairs of [winnerIndex, loserIndex]
let idx = 0;

const testBtn = document.getElementById('testBtn');
const currentRankingsBtn = document.getElementById('currentRankings');
const statMsg = document.getElementById('statMsg');
const resetProgressBtn = document.getElementById('resetProgress');

// Persist/load the user's ratings and the owls' scores
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

// Format BT scores using a small number of significant figures via toPrecision
function formatSignificant(x) {
  if (x == null || Number.isNaN(x)) return String(x);
  const absx = Math.abs(x);
  if (absx === 0) return '0';
  // choose sig figs: 1 for very small numbers, 2 otherwise
  const sig = absx < 0.01 ? 1 : 2;
  // use toPrecision and remove unnecessary plus in exponential form
  let s = Number(x).toPrecision(sig);
  // convert exponential like 1e-6 to decimal if possible and short
  // but keep JS default for extremely small numbers
  // try to parse and format to plain string if not exponential
  if (!s.includes('e')) return s;
  // for exponential, convert to Number and toString with enough decimals
  const n = Number(s);
  return n.toString();
}

// How many pairs has the user completed
function updateProgress() {
  progressEl.textContent = `Progress: ${Math.min(idx, pairs.length)} / ${pairs.length}`;
}

// Run when all pairs are done OR user selects intermediate results

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


// Render both rankings side-by-side
function showAllResults() {
  doneSection.hidden = false;
  // set header
  rankingHeader.textContent = 'Rankings';
  // prepare win-sum ranking
  const winsList = document.getElementById('ranking-wins');
  const btList = document.getElementById('ranking-bt');
  winsList.innerHTML = '';
  btList.innerHTML = '';

  const rankedWins = owls.map((name, i) => ({ name, rating: ratings[i] }));
  rankedWins.sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
  for (const item of rankedWins) {
    const li = document.createElement('li');
    const img = document.createElement('img');
    img.className = 'ranking-thumb';
    img.alt = item.name;
    trySetImage(img, sanitizedName(item.name), ['.jpg', '.jpeg', '.png', '.webp']);
    li.appendChild(img);
    const nameStrong = document.createElement('strong');
    nameStrong.textContent = item.name;
    li.appendChild(nameStrong);
    li.appendChild(document.createTextNode(` (${item.rating})`));
    winsList.appendChild(li);
  }

  // compute BT scores and render
  const scores = computeBradleyTerry(winners, owls.length);
  const rankedBT = owls.map((name, i) => ({ name, rating: ratings[i], score: scores ? scores[i] : null }));
  rankedBT.sort((a, b) => (scores ? b.score - a.score : b.rating - a.rating) || a.name.localeCompare(b.name));
  for (const item of rankedBT) {
    const li = document.createElement('li');
    const img = document.createElement('img');
    img.className = 'ranking-thumb';
    img.alt = item.name;
    trySetImage(img, sanitizedName(item.name), ['.jpg', '.jpeg', '.png', '.webp']);
    li.appendChild(img);
    const nameStrong = document.createElement('strong');
    nameStrong.textContent = item.name;
    li.appendChild(nameStrong);
    if (item.score != null) {
      const formatted = formatSignificant(item.score);
      li.appendChild(document.createTextNode(` (${formatted})`));
    }
    btList.appendChild(li);
  }
}

// Test button: generate exactly one simulated result per unique pair (171 matches for 19 owls)
testBtn && testBtn.addEventListener('click', () => {
  // simulate an underlying true-skill for each owl to bias results slightly
  const trueSkill = Array.from({ length: owls.length }, () => (Math.random() - 0.5) * 2);
  const sim = [];
  for (let i = 0; i < owls.length; i++) {
    for (let j = i + 1; j < owls.length; j++) {
      // logistic probability based on skill difference
      const diff = trueSkill[i] - trueSkill[j];
      const p = 1 / (1 + Math.exp(-diff));
      if (Math.random() < p) sim.push([i, j]); else sim.push([j, i]);
    }
  }
  // use simulated matches for testing (do not persist to localStorage)
  winners = sim;
  statMsg.textContent = `Generated ${winners.length} simulated pairwise matches.`;
  const scores = computeBradleyTerry(winners, owls.length);
  showAllResults();
});

function deactivateButtons() {
  btn1.disabled = true;
  btn2.disabled = true;
  btn1.style.display = 'none';
  btn2.style.display = 'none';
}
function activateButtons() {
  btn1.disabled = false;
  btn2.disabled = false;
  btn1.style.display = 'inline-block';
  btn2.style.display = 'inline-block';
}

// Show two owls to the user
function showPair() {
  updateProgress(); // Update # of completed pairs
  skipMsg.textContent = ''; 
  activateButtons();

  // Stop if done
  if (idx >= pairs.length) {
    saveState();
    showAllResults();
    return;
  }

  const [a, b] = pairs[idx];

  // Skip if ratings very different
  if (Math.abs(ratings[a] - ratings[b]) > 6) {
    const winner = ratings[a] > ratings[b] ? a : b;
    const loser = winner === a ? b : a;
    // Register the skip as a vote for the winner (update simple ratings and record the match)
    ratings[winner] += 1;
    ratings[loser] -= 1;
    winners.push([winner, loser]);
    skipMsg.textContent = `Skipping ${owls[a]} vs. ${owls[b]} (estimated winner: ${owls[winner]})`;
    idx++;
    saveState();

    // Hide the buttons temporarily
    deactivateButtons();

    // Show next pair after a short delay
    setTimeout(showPair, 1700);
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
  clearStatMsg();
  doneSection.hidden = true;
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
  if (e.key === '1') btn1.click();
  if (e.key === '2') btn2.click();
});

// restartBtn.addEventListener('click', () => {
//   localStorage.removeItem('owl_pairs');
//   localStorage.removeItem('owl_ratings');
//   localStorage.removeItem('owl_winners');
//   localStorage.removeItem('owl_index');
//   location.reload();
// });

resetProgressBtn && resetProgressBtn.addEventListener('click', () => {
  if (!confirm('Reset progress? This will delete the results of all matchups you have judged.')) return;
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
  const winsList = document.getElementById('ranking-wins');
  const btList = document.getElementById('ranking-bt');
  if (winsList) winsList.innerHTML = '';
  if (btList) btList.innerHTML = '';
  skipMsg.textContent = '';
  statMsg.textContent = 'Progress reset.';
  showPair();
});

// Current rankings button shows both columns
currentRankingsBtn && currentRankingsBtn.addEventListener('click', () => {
  statMsg.textContent = `Computed from ${winners.length} completed matchups so far.`;
  showAllResults();
});

function clearStatMsg() {
  statMsg.textContent = '';
}

// initial render
showPair();
