/* charts.js - Chart rendering for SalahTracker */

let chartDaily = null, chartPerPrayer = null, managerChart = null, monthlyChart = null;

Chart.defaults.font.family = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial';
Chart.defaults.font.size = 12;

function getThemeColors() {
  const root = getComputedStyle(document.documentElement);
  return {
    primary: (root.getPropertyValue('--accent') || '#7c3aed').trim(),
    success: (root.getPropertyValue('--success') || '#10b981').trim(),
    warning: (root.getPropertyValue('--warning') || '#f59e0b').trim(),
    danger: (root.getPropertyValue('--danger') || '#ef4444').trim(),
    background: (root.getPropertyValue('--card-bg') || '#0b1220').trim(),
    textSecondary: (root.getPropertyValue('--text-secondary') || '#9aa6b2').trim()
  };
}

function createGradient(ctx, color1, color2, vertical=false) {
  const g = ctx.createLinearGradient(0, vertical?ctx.canvas.height:0, vertical?0:ctx.canvas.width, vertical?0:ctx.canvas.height);
  g.addColorStop(0, color1);
  g.addColorStop(1, color2);
  return g;
}

function renderDashboard() {
  const data = loadData();
  const colors = getThemeColors();
  renderDailyChart(data, colors);
  renderPrayerChart(data, colors);
  if (document.getElementById('managerChart')) renderManagerChart(data, colors);
  if (document.getElementById('monthlyChart')) renderMonthlyChart(data, colors);
}

/* Daily chart - last 15 days */
function renderDailyChart(data, colors) {
  const canvas = document.getElementById('chartDaily');
  if (!canvas) return;
  const labels = [], dailyScores = [];
  const maxScore = PRAYERS.length * 3;
  for (let i = 14; i >= 0; i--) {
    const d = addDays(today(), -i);
    labels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    const key = formatKey(d);
    dailyScores.push(dayScore(data[key]));
  }
  if (chartDaily) chartDaily.destroy();
  const ctx = canvas.getContext('2d');
  chartDaily = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Daily Score', data: dailyScores, fill:true, backgroundColor:createGradient(ctx, colors.primary+'33', colors.primary+'08', true), borderColor: colors.primary, tension:0.35 }]},
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{min:0, max:maxScore, ticks:{color:colors.textSecondary}}, x:{ticks:{color:colors.textSecondary}} } }
  });
}

/* Prayer-wise chart for last 15 days */
function renderPrayerChart(data, colors) {
  const canvas = document.getElementById('chartPerPrayer');
  if (!canvas) return;
  const prayers = ['fajr','dhuhr','asr','maghrib','isha'];
  const labels = ['Fajr','Dhuhr','Asr','Maghrib','Isha'];
  const congregationData = [], individualData = [], qadaData = [];
  for (const prayer of prayers) {
    let c=0,i=0,q=0;
    for (let k=0;k<15;k++) {
      const key = formatKey(addDays(today(), -k));
      const entry = loadData()[key];
      if (entry && entry[prayer]) {
        if (entry[prayer]==='congregation') c++;
        else if (entry[prayer]==='individual') i++;
        else if (entry[prayer]==='qada') q++;
      }
    }
    congregationData.push(c); individualData.push(i); qadaData.push(q);
  }
  if (chartPerPrayer) chartPerPrayer.destroy();
  const ctx = canvas.getContext('2d');
  chartPerPrayer = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets:[
      { label:'Congregation', data:congregationData, backgroundColor: colors.success+'cc', borderColor: colors.success },
      { label:'Individual', data:individualData, backgroundColor: colors.warning+'cc', borderColor: colors.warning },
      { label:'Make-up', data:qadaData, backgroundColor: colors.danger+'cc', borderColor: colors.danger }
    ]},
    options: { responsive:true, maintainAspectRatio:false, scales:{ y:{beginAtZero:true, max:15, ticks:{color:colors.textSecondary}}, x:{ticks:{color:colors.textSecondary}} } }
  });
}

/* Manager chart (30 days) */
function renderManagerChart(data, colors) {
  const canvas = document.getElementById('managerChart');
  if (!canvas) return;
  const labels = [], scores = [];
  for (let i=29;i>=0;i--) {
    const d = addDays(today(), -i);
    labels.push(d.toLocaleDateString(undefined, { month:'short', day:'numeric' }));
    scores.push(dayScore(data[formatKey(d)]));
  }
  if (managerChart) managerChart.destroy();
  const ctx = canvas.getContext('2d');
  managerChart = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[{ label:'Daily Score', data:scores, backgroundColor: scores.map(s => s>=12?colors.success+'cc': s>=8?colors.warning+'cc': s>0?colors.danger+'cc': '#374151cc') }]},
    options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{beginAtZero:true, max:15, ticks:{color:colors.textSecondary}}, x:{ticks:{color:colors.textSecondary}} } }
  });
}

/* Monthly chart (by month percentages) */
function renderMonthlyChart(data, colors) {
  const canvas = document.getElementById('monthlyChart');
  if (!canvas) return;
  const monthly = {};
  Object.keys(data).sort().forEach(date => {
    const month = date.slice(0,7);
    if (!monthly[month]) monthly[month] = { total:0, congregation:0, individual:0, qada:0 };
    const entry = data[date];
    PRAYERS.forEach(p => {
      const s = entry[p.key];
      if (s && s!=='') {
        monthly[month].total++;
        if (s==='congregation') monthly[month].congregation++;
        else if (s==='individual') monthly[month].individual++;
        else if (s==='qada') monthly[month].qada++;
      }
    });
  });
  const months = Object.keys(monthly).slice(-12);
  const labels = months.map(m => new Date(m+'-01').toLocaleDateString(undefined, {month:'short', year:'numeric'}));
  const cong = months.map(m => monthly[m].total? Math.round(monthly[m].congregation / monthly[m].total * 100) : 0);
  const ind = months.map(m => monthly[m].total? Math.round(monthly[m].individual / monthly[m].total * 100) : 0);
  const q = months.map(m => monthly[m].total? Math.round(monthly[m].qada / monthly[m].total * 100) : 0);
  if (monthlyChart) monthlyChart.destroy();
  const ctx = canvas.getContext('2d');
  monthlyChart = new Chart(ctx, {
    type:'line',
    data:{ labels, datasets:[
      { label:'Congregation %', data: cong, borderColor: colors.success, backgroundColor: colors.success+'22', fill:false },
      { label:'Individual %', data: ind, borderColor: colors.warning, backgroundColor: colors.warning+'22', fill:false },
      { label:'Make-up %', data: q, borderColor: colors.danger, backgroundColor: colors.danger+'22', fill:false }
    ]},
    options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{beginAtZero:true, max:100, ticks:{color:colors.textSecondary}}, x:{ticks:{color:colors.textSecondary}} } }
  });
}
