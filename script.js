const loginBtn = document.getElementById('loginBtn');
const loadingState = document.getElementById('loadingState');
const dashboardContent = document.getElementById('dashboardContent');
const channelAvatar = document.getElementById('channelAvatar');
const channelName = document.getElementById('channelName');
const subscriberCount = document.getElementById('subscriberCount');
const viewsSummary = document.getElementById('viewsSummary');
const viewsCard = document.getElementById('viewsCard');
const hoursCard = document.getElementById('hoursCard');
const subscribersCard = document.getElementById('subscribersCard');
const monetizationList = document.getElementById('monetizationList');
const revenueProgress = document.getElementById('revenueProgress');
const topVideosList = document.getElementById('topVideosList');
const assistantMessages = document.getElementById('assistantMessages');
const assistantForm = document.getElementById('assistantForm');
const assistantInput = document.getElementById('assistantInput');
const rangeSelect = document.getElementById('rangeSelect');
const chartRangeLabel = document.getElementById('chartRangeLabel');
const videoTabBtn = document.getElementById('videoTabBtn');
const shortsTabBtn = document.getElementById('shortsTabBtn');

let chartInstance = null;
let currentDashboard = null;
let activeTopTab = 'videos';

loginBtn.addEventListener('click', () => {
  window.location.href = '/auth/google';
});

function setLoading(loading) {
  loadingState.classList.toggle('hidden', !loading);
  dashboardContent.classList.toggle('hidden', loading);
}

function formatNumber(value) {
  return new Intl.NumberFormat('de-DE').format(value || 0);
}

function formatHours(value) {
  return `${(value / 60).toFixed(1)}h`;
}

function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return '0m 0s';
  const totalSeconds = Math.max(0, Math.round(seconds));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}m ${secs}s`;
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function addAssistantMessage(text, role = 'assistant') {
  const message = document.createElement('div');
  message.className = `rounded-2xl px-3 py-2 text-sm ${role === 'user' ? 'bg-studio-accent/20 text-white ml-auto' : 'bg-[#1b1b1b] text-gray-200'}`;
  message.textContent = text;
  assistantMessages.appendChild(message);
  assistantMessages.scrollTop = assistantMessages.scrollHeight;
}

function renderMonetization(items) {
  monetizationList.innerHTML = '';
  items.forEach((item) => {
    const percent = Math.min(100, Math.round((item.current / item.target) * 100));
    const row = document.createElement('div');
    row.className = 'rounded-2xl border border-studio-border bg-[#101010] p-3';
    row.innerHTML = `
      <div class="mb-2 flex items-center justify-between">
        <div>
          <p class="font-medium">${item.label}</p>
          <p class="text-sm text-studio-muted">${item.currentDisplay} / ${item.targetDisplay}</p>
        </div>
        <span class="text-sm text-studio-accent">${percent}%</span>
      </div>
      <div class="h-2 rounded-full bg-studio-border">
        <div class="h-2 rounded-full bg-studio-accent" style="width:${percent}%"></div>
      </div>
    `;
    monetizationList.appendChild(row);
  });
}

function renderRevenueProgress(items) {
  revenueProgress.innerHTML = '';
  items.forEach((item) => {
    const percent = Math.min(100, Math.round((item.current / item.target) * 100));
    const block = document.createElement('div');
    block.className = 'rounded-2xl border border-studio-border bg-[#1a1a1a] p-4';
    block.innerHTML = `
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="font-semibold">${item.title}</p>
          <p class="text-sm text-studio-muted mt-1">${item.description}</p>
        </div>
        <span class="text-sm text-studio-accent">${percent}%</span>
      </div>
      <div class="mt-3 h-2 overflow-hidden rounded-full bg-studio-border">
        <div class="h-2 rounded-full bg-studio-accent" style="width:${percent}%"></div>
      </div>
    `;
    revenueProgress.appendChild(block);
  });
}

function renderTopItems(videos) {
  topVideosList.innerHTML = '';
  if (!videos || videos.length === 0) {
    topVideosList.innerHTML = '<div class="rounded-2xl border border-studio-border bg-[#101010] p-4 text-sm text-studio-muted">Keine Inhalte für diesen Zeitraum verfügbar.</div>';
    return;
  }

  videos.forEach((video) => {
    const item = document.createElement('div');
    item.className = 'group relative overflow-hidden rounded-2xl border border-studio-border bg-[#101010] p-3 transition hover:border-studio-accent/60 hover:bg-[#161616]';
    item.innerHTML = `
      <div class="flex items-center gap-3">
        <img src="${video.thumbnail}" alt="${video.title}" class="h-16 w-28 rounded-lg object-cover" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-base font-semibold text-white">${video.title}</p>
          <p class="text-sm text-studio-muted mt-1">${formatNumber(video.views)} Aufrufe • ${formatDuration(video.averageViewDuration)}</p>
        </div>
      </div>
      <div class="pointer-events-none absolute inset-x-3 bottom-3 hidden rounded-2xl bg-[#111111]/95 p-3 text-sm text-studio-muted group-hover:block">
        <p>Veröffentlicht: ${formatDate(video.publishedAt)}</p>
        <p>Durchschnittliche Wiedergabedauer: ${formatDuration(video.averageViewDuration)}</p>
      </div>
    `;
    topVideosList.appendChild(item);
  });
}

function renderChart(labels, values) {
  if (chartInstance) chartInstance.destroy();
  const ctx = document.getElementById('viewsChart');
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Aufrufe',
        data: values,
        borderColor: '#ff4d4f',
        backgroundColor: 'rgba(255,77,79,0.2)',
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: '#ff4d4f'
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: '#8f8f8f' },
          grid: { color: 'rgba(255,255,255,0.07)' }
        },
        x: {
          ticks: { color: '#8f8f8f' },
          grid: { display: false }
        }
      },
      plugins: {
        legend: { labels: { color: '#ffffff' } },
        tooltip: {
          callbacks: {
            label: (context) => `${formatNumber(context.parsed.y)} Aufrufe`
          }
        }
      }
    }
  });
}

async function loadDashboard(range = 28) {
  setLoading(true);
  try {
    const res = await fetch(`/api/dashboard?range=${range}`);
    if (!res.ok) throw new Error('Nicht authentifiziert');
    const data = await res.json();
    currentDashboard = data;
    chartRangeLabel.textContent = `Letzte ${data.rangeDays} Tage`;
    channelAvatar.src = data.channel.avatar;
    channelName.textContent = data.channel.name;
    subscriberCount.textContent = `${formatNumber(data.channel.subscribers)} Abonnenten`;
    viewsSummary.textContent = formatNumber(data.summary.views);
    viewsCard.textContent = formatNumber(data.summary.views);
    hoursCard.textContent = formatHours(data.summary.watchHours);
    subscribersCard.textContent = formatNumber(data.summary.subscribersGained);
    renderMonetization(data.monetization);
    renderRevenueProgress(data.revenueProgress);
    renderChart(data.timeline.labels, data.timeline.values);
    toggleTopTab(activeTopTab, false);
    addAssistantMessage(`Willkommen zurück. Ich habe deine letzten Daten für ${data.channel.name} geladen.`, 'assistant');
    setLoading(false);
  } catch (error) {
    setLoading(false);
    addAssistantMessage(error.message || 'Bitte melde dich an, um das Dashboard zu sehen.', 'assistant');
  }
}

function toggleTopTab(tab, updateButtons = true) {
  activeTopTab = tab;
  if (!currentDashboard) return;
  if (updateButtons) {
    videoTabBtn.classList.toggle('bg-studio-accent', tab === 'videos');
    videoTabBtn.classList.toggle('text-white', tab === 'videos');
    videoTabBtn.classList.toggle('bg-[#101010]', tab !== 'videos');
    shortsTabBtn.classList.toggle('bg-studio-accent', tab === 'shorts');
    shortsTabBtn.classList.toggle('text-white', tab === 'shorts');
    shortsTabBtn.classList.toggle('bg-[#101010]', tab !== 'shorts');
  }
  renderTopItems(tab === 'videos' ? currentDashboard.topVideos : currentDashboard.topShorts);
}

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/status');
    if (!res.ok) throw new Error('Not authenticated');
    const data = await res.json();
    if (data.authenticated) {
      await loadDashboard(Number(rangeSelect.value));
    } else {
      setLoading(false);
      addAssistantMessage('Melde dich mit Google an, um dein Dashboard zu sehen.', 'assistant');
    }
  } catch (error) {
    setLoading(false);
    addAssistantMessage(error.message || 'Bitte melde dich an, um das Dashboard zu sehen.', 'assistant');
  }
}

rangeSelect.addEventListener('change', async () => {
  await loadDashboard(Number(rangeSelect.value));
});

videoTabBtn.addEventListener('click', () => toggleTopTab('videos'));
shortsTabBtn.addEventListener('click', () => toggleTopTab('shorts'));

assistantForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const prompt = assistantInput.value.trim();
  if (!prompt) return;
  addAssistantMessage(prompt, 'user');
  assistantInput.value = '';
  try {
    const response = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: prompt })
    });
    const data = await response.json();
    addAssistantMessage(data.reply || 'Ich konnte keine Antwort generieren.', 'assistant');
  } catch (error) {
    addAssistantMessage('Der Assistent konnte gerade nicht antworten.', 'assistant');
  }
});

window.addEventListener('DOMContentLoaded', checkAuth);
