/* app.js - main logic for SalahTracker (cleaned & fixed) */

const STORAGE_KEY = 'salahTracker_v1'; // versioned key to avoid conflicts
const PRAYERS = [
  { key: 'fajr', name: 'Fajr', arabic: 'الفجر', icon: '🌅', time: 'Dawn' },
  { key: 'dhuhr', name: 'Dhuhr', arabic: 'الظهر', icon: '☀️', time: 'Noon' },
  { key: 'asr', name: 'Asr', arabic: 'العصر', icon: '🌇', time: 'Afternoon' },
  { key: 'maghrib', name: 'Maghrib', arabic: 'المغرب', icon: '🌅', time: 'Sunset' },
  { key: 'isha', name: 'Isha', arabic: 'العشاء', icon: '🌙', time: 'Night' }
];

const PRAYER_STATUS = [
  { value: 'congregation', label: 'Congregation', icon: '🕌', color: '#10b981' },
  { value: 'individual', label: 'Individual', icon: '🤲', color: '#f59e0b' },
  { value: 'qada', label: 'Make-up', icon: '⏰', color: '#ef4444' },
  { value: '', label: 'Missed', icon: '❌', color: '#6b7280' }
];

/* ---------- Helpers: storage & dates ---------- */
function loadData() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch (e) { return {}; }
}
function saveData(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

function formatKeyLocal(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function dateKeyToDate(key) { // key = 'YYYY-MM-DD'
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function daysBetween(a, b) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((a - b) / msPerDay);
}
function today() { const d = new Date(); d.setHours(0,0,0,0); return d; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); x.setHours(0,0,0,0); return x; }

/* Score (3 = jamaat, 2 = individual, 1 = qada) */
function dayScore(entry) {
  if (!entry) return 0;
  let score = 0;
  PRAYERS.forEach(p => {
    const s = entry[p.key];
    if (s === 'congregation') score += 3;
    else if (s === 'individual') score += 2;
    else if (s === 'qada') score += 1;
  });
  return score;
}

/* Normalize imported data: map prayer names to lowercase keys */
function normalizeImportedData(obj) {
  const normalized = {};
  Object.keys(obj).forEach(date => {
    normalized[date] = normalized[date] || {};
    const entry = obj[date] || {};
    Object.keys(entry).forEach(k => {
      const low = k.toLowerCase();
      // if value is boolean convert into expected status (true => individual)
      let val = entry[k];
      if (typeof val === 'boolean') val = val ? 'individual' : '';
      normalized[date][low] = val;
    });
  });
  return normalized;
}

/* Expose helpers for charts.js */
window.loadData = loadData;
window.saveData = saveData;
window.formatKey = formatKeyLocal;
window.today = today;
window.addDays = addDays;
window.dayScore = dayScore;

/* ---------- UI elements ---------- */
const dateSelectMain = document.getElementById('dateSelectMain');
const prayerList = document.getElementById('prayerList');
const progressRing = document.getElementById('progressRing');
const progressPercent = document.getElementById('progressPercent');
const totalPrayersEl = document.getElementById('totalPrayers');
const streakCountEl = document.getElementById('streakCount');

function populateDateSelect() {
  if (!dateSelectMain) return;
  dateSelectMain.innerHTML = '';
  const base = today();
  for (let i = 0; i < 15; i++) {
    const d = addDays(base, -i);
    const opt = document.createElement('option');
    opt.value = formatKeyLocal(d);
    let label = formatKeyLocal(d);
    if (i === 0) label += ' (Today)';
    else if (i === 1) label += ' (Yesterday)';
    else if (i === 2) label += ' (2 days ago)';
    opt.textContent = label;
    dateSelectMain.appendChild(opt);
  }
}

function renderTrackerForm(selectedKey) {
  if (!prayerList) return;
  prayerList.innerHTML = '';
  const data = loadData();
  const entry = data[selectedKey] || {};

  PRAYERS.forEach(prayer => {
    const row = document.createElement('div');
    row.className = 'prayer-row';

    const label = document.createElement('div');
    label.className = 'prayer-label';
    label.innerHTML = `
      <span class="prayer-icon">${prayer.icon}</span>
      <div>
        <div class="prayer-name">${prayer.name} <span class="prayer-arabic">${prayer.arabic}</span></div>
        <div class="prayer-time">${prayer.time} Prayer</div>
      </div>`;

    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'prayer-options';

    PRAYER_STATUS.forEach(status => {
      const option = document.createElement('div');
      option.className = 'option';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = prayer.key;
      input.value = status.value;
      input.id = `${prayer.key}_${status.value || 'missed'}`;

      if (entry[prayer.key] === status.value) input.checked = true;

      // Editable only for today + previous 2 days
      const diff = daysBetween(today(), dateKeyToDate(selectedKey)); // 0 today, 1 yesterday
      const editable = diff >= 0 && diff <= 2;
      input.disabled = !editable;

      const optionLabel = document.createElement('label');
      optionLabel.className = 'option-label';
      optionLabel.htmlFor = input.id;
      optionLabel.innerHTML = `<span class="option-icon">${status.icon}</span><span>${status.label}</span>`;

      option.appendChild(input);
      option.appendChild(optionLabel);
      optionsDiv.appendChild(option);
    });

    row.appendChild(label);
    row.appendChild(optionsDiv);
    prayerList.appendChild(row);
  });
}

/* ---------- Progress, Heatmap, Streak ---------- */
function calculateStreak() {
  const data = loadData();
  let streak = 0;
  const base = today();
  for (let i = 0; i < 365; i++) {
    const key = formatKeyLocal(addDays(base, -i));
    const entry = data[key];
    if (!entry) break;
    let complete = true;
    PRAYERS.forEach(p => {
      if (!entry[p.key] || entry[p.key] === '') complete = false;
    });
    if (complete) streak++;
    else break;
  }
  return streak;
}

function updateProgressDisplay() {
  const data = loadData();
  let totalPrayers = 0, possiblePrayers = 0;
  for (let i = 0; i < 15; i++) {
    const key = formatKeyLocal(addDays(today(), -i));
    const entry = data[key];
    possiblePrayers += PRAYERS.length;
    if (entry) {
      PRAYERS.forEach(p => { if (entry[p.key] && entry[p.key] !== '') totalPrayers++; });
    }
  }
  const percentage = possiblePrayers > 0 ? Math.round((totalPrayers / possiblePrayers) * 100) : 0;
  const streak = calculateStreak();
  if (progressRing) progressRing.style.background = `conic-gradient(var(--success) ${percentage * 3.6}deg, rgba(255,255,255,0.02) 0deg)`;
  if (progressPercent) progressPercent.textContent = `${percentage}%`;
  if (totalPrayersEl) totalPrayersEl.textContent = totalPrayers;
  if (streakCountEl) streakCountEl.textContent = streak;
}

function renderHeatmapPreview() {
  const container = document.getElementById('heatmapPreview');
  if (!container) return;
  container.innerHTML = '';
  const data = loadData();
  const base = today();
  for (let i = 14; i >= 0; i--) {
    const d = addDays(base, -i);
    const key = formatKeyLocal(d);
    const cell = document.createElement('div');
    cell.className = 'cell';
    const score = dayScore(data[key]);
    const maxScore = PRAYERS.length * 3;
    if (score >= maxScore * 0.8) cell.classList.add('c3');
    else if (score >= maxScore * 0.5) cell.classList.add('c2');
    else if (score > 0) cell.classList.add('c1');
    else cell.classList.add('c0');
    cell.title = `${key} - Score: ${score}/${maxScore}`;
    cell.textContent = d.getDate();
    cell.addEventListener('click', () => {
      if (dateSelectMain) {
        dateSelectMain.value = key;
        renderTrackerForm(key);
        dateSelectMain.scrollIntoView({behavior:'smooth'});
      }
    });
    container.appendChild(cell);
  }
}

/* ---------- Data Manager helpers & import/export ---------- */
window.appHelpers = {
  loadData, saveData, formatKey: formatKeyLocal,
  renderDataTable: function(){}, exportJson: function(){}, exportCsv: function(){}, importFile: function(){}, addToday: function(){}, renderManagerOverview: function(){}
};

window.appHelpers.renderDataTable = function() {
  const tbody = document.querySelector('#dataTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const data = loadData();
  const dates = Object.keys(data).sort((a,b)=>b.localeCompare(a));
  if (!dates.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="no-data">No prayer data yet. Start tracking to see your progress!</td></tr>';
    return;
  }
  dates.forEach(date => {
    const tr = document.createElement('tr');
    tr.className = 'data-row';
    const dateCell = document.createElement('td'); dateCell.className='date-cell'; dateCell.textContent = date; tr.appendChild(dateCell);
    PRAYERS.forEach(prayer => {
      const td = document.createElement('td');
      const select = document.createElement('select');
      select.className = 'status-select';
      select.dataset.date = date; select.dataset.prayer = prayer.key;
      PRAYER_STATUS.forEach(status => {
        const opt = document.createElement('option');
        opt.value = status.value;
        opt.textContent = status.value === '' ? 'Not Prayed' : status.label;
        select.appendChild(opt);
      });
      select.value = (data[date] && data[date][prayer.key]) || '';
      select.addEventListener('change', (e) => {
        const dateKey = e.target.dataset.date;
        const prayerKey = e.target.dataset.prayer;
        const value = e.target.value;
        const cur = loadData();
        cur[dateKey] = cur[dateKey] || {};
        cur[dateKey][prayerKey] = value;
        saveData(cur);
        refreshAll();
      });
      td.appendChild(select); tr.appendChild(td);
    });
    const scoreCell = document.createElement('td'); scoreCell.textContent = dayScore(data[date]); tr.appendChild(scoreCell);
    tbody.appendChild(tr);
  });
};

window.appHelpers.exportJson = function() {
  const data = loadData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `salah-tracker-${formatKeyLocal(today())}.json`; a.click(); URL.revokeObjectURL(url);
};

window.appHelpers.exportCsv = function() {
  const data = loadData();
  let csv = 'Date,Fajr,Dhuhr,Asr,Maghrib,Isha,DailyScore\n';
  const dates = Object.keys(data).sort((a,b)=>b.localeCompare(a));
  dates.forEach(date => {
    const entry = data[date] || {};
    const row = [
      date,
      entry.fajr || '',
      entry.dhuhr || '',
      entry.asr || '',
      entry.maghrib || '',
      entry.isha || '',
      dayScore(entry)
    ];
    csv += row.join(',') + '\n';
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `salah-tracker-${formatKeyLocal(today())}.csv`; a.click(); URL.revokeObjectURL(url);
};

window.appHelpers.importFile = function(ev) {
  const file = ev.target.files ? ev.target.files[0] : null;
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const importedRaw = JSON.parse(e.target.result);
      const imported = normalizeImportedData(importedRaw);
      const cur = loadData();
      // Detect conflicts
      const conflicts = Object.keys(imported).filter(k => cur[k]);
      if (conflicts.length) {
        if (!confirm(`Imported file contains ${conflicts.length} date(s) that already exist. Imported entries will overwrite existing ones. Proceed?`)) return;
      }
      const merged = { ...cur, ...imported };
      saveData(merged);
      refreshAll();
      alert(`Imported ${Object.keys(imported).length} entries.`);
    } catch(err) {
      alert('Invalid JSON file. Please check the format.');
    }
  };
  reader.readAsText(file);
};

window.appHelpers.addToday = function() {
  const key = formatKeyLocal(today());
  const data = loadData();
  if (!data[key]) {
    data[key] = {};
    PRAYERS.forEach(p => data[key][p.key] = '');
    saveData(data);
    window.appHelpers.renderDataTable();
    refreshAll();
  }
};

window.appHelpers.renderManagerOverview = function() {
  if (typeof renderDashboard === 'function') renderDashboard();
};

/* ---------- Initialization & Events ---------- */
document.addEventListener('DOMContentLoaded', () => {
  // Theme toggle
  const themeToggle = document.getElementById('themeToggle');
  const app = document.getElementById('app');
  if (themeToggle && app) {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    app.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    themeToggle.addEventListener('click', () => {
      const currentTheme = app.getAttribute('data-theme') || 'dark';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      app.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      updateThemeIcon(newTheme);
    });
  }

  // Populate date selector and render
  populateDateSelect();
  if (dateSelectMain) {
    dateSelectMain.value = formatKeyLocal(today());
    renderTrackerForm(dateSelectMain.value);
    dateSelectMain.addEventListener('change', () => renderTrackerForm(dateSelectMain.value));
  }

  // Save button
  const saveBtn = document.getElementById('saveMain');
  if (saveBtn) saveBtn.addEventListener('click', () => {
    const key = dateSelectMain.value;
    const data = loadData();
    data[key] = data[key] || {};
    PRAYERS.forEach(prayer => {
      const selectedInput = document.querySelector(`input[name="${prayer.key}"]:checked`);
      data[key][prayer.key] = selectedInput ? selectedInput.value : '';
    });
    saveData(data);
    refreshAll();
    // feedback
    const original = saveBtn.innerHTML;
    saveBtn.innerHTML = '<span class="btn-icon">✅</span> Saved!';
    setTimeout(()=> saveBtn.innerHTML = original, 1400);
  });

  // Clear date
  const clearBtn = document.getElementById('clearDate');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    if (!confirm('Are you sure you want to clear all prayers for this date?')) return;
    const key = dateSelectMain.value;
    const data = loadData();
    delete data[key];
    saveData(data);
    renderTrackerForm(key);
    refreshAll();
  });

  // Mark all jamaat
  const markAllBtn = document.getElementById('markAllJamaat');
  if (markAllBtn) markAllBtn.addEventListener('click', () => {
    PRAYERS.forEach(prayer => {
      const el = document.querySelector(`input[name="${prayer.key}"][value="congregation"]`);
      if (el && !el.disabled) el.checked = true;
    });
  });

  // initial render
  refreshAll();
});

function refreshAll() {
  if (dateSelectMain && dateSelectMain.value) renderTrackerForm(dateSelectMain.value);
  renderHeatmapPreview();
  updateProgressDisplay();
  if (typeof renderDashboard === 'function') renderDashboard();
  if (document.querySelector('#dataTable tbody')) window.appHelpers.renderDataTable();
}

function updateThemeIcon(theme) {
  const themeIcon = document.querySelector('.theme-icon');
  if (themeIcon) themeIcon.textContent = theme === 'light' ? '🌙' : '🌙';
}
