// ================================================
// KING OF FREIGHT AI - MOBILE APP (CLOUD VERSION)
// ================================================

// Configuration - UPDATE THIS AFTER DEPLOYMENT
const config = {
  serverUrl: window.location.origin, // Automatically uses current domain
  reconnectDelay: 3000,
  refreshInterval: 30000, // 30 seconds
  apiKey: 'kof-mobile-2024-secure-key' // Must match server API_KEY
};

// State
let isConnected = false;
let socket = null;
let installPrompt = null;
let currentTab = 'monitor';
let messageFilter = 'all';
let carriers = [];
let messages = [];
let activityLog = [];

// ================================================
// INITIALIZATION
// ================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 King of Freight AI Mobile - Starting...');

  // Setup event listeners
  setupTabNavigation();
  setupMessageFilters();
  setupRefreshButton();
  setupSearch();
  setupInstallPrompt();

  // Connect to server
  connectToServer();

  // Setup periodic refresh
  setInterval(() => {
    if (isConnected) {
      refreshData();
    }
  }, config.refreshInterval);

  // Hide loading overlay after init
  setTimeout(() => {
    document.getElementById('loadingOverlay').style.display = 'none';
  }, 1000);
});

// ================================================
// SERVER CONNECTION
// ================================================

async function connectToServer() {
  console.log('📡 Connecting to server...');
  updateConnectionStatus('connecting');

  try {
    // Try to fetch initial data
    const response = await fetch(`${config.serverUrl}/api/status`);

    if (!response.ok) {
      throw new Error('Server not reachable');
    }

    const data = await response.json();
    console.log('✅ Connected to server');
    console.log('📊 Server status:', data);

    isConnected = true;
    updateConnectionStatus('online');

    // Load initial data
    await loadAllData();

    // Setup WebSocket for real-time updates
    setupWebSocket();

  } catch (error) {
    console.error('❌ Connection failed:', error);
    updateConnectionStatus('offline');
    showErrorModal('Unable to connect to server. Please check your internet connection.');

    // Retry connection
    setTimeout(connectToServer, config.reconnectDelay);
  }
}

function setupWebSocket() {
  // Use wss:// for HTTPS sites, ws:// for HTTP
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  console.log('🔌 Connecting WebSocket to:', wsUrl);

  try {
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('🔌 WebSocket connected');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleRealtimeUpdate(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    socket.onclose = () => {
      console.log('🔌 WebSocket disconnected - reconnecting...');
      setTimeout(setupWebSocket, config.reconnectDelay);
    };

  } catch (error) {
    console.error('WebSocket setup failed:', error);
    setTimeout(setupWebSocket, config.reconnectDelay);
  }
}

function handleRealtimeUpdate(data) {
  console.log('⚡ Real-time update:', data.type);

  switch (data.type) {
    case 'INITIAL_DATA':
      // Server sent initial data on connection
      if (data.data) {
        updateStats(data.data.stats);
        messages = data.data.messages || [];
        carriers = data.data.carriers || [];
        activityLog = data.data.activity || [];
        renderMessages();
        renderCarriers();
        renderActivity();

        // Check for critical events
        if (data.data.criticalEvents && data.data.criticalEvents.length > 0) {
          const unacked = data.data.criticalEvents.find(e => !e.acknowledged);
          if (unacked) showCriticalAlert(unacked);
        }
      }
      break;

    case 'NEW_MESSAGE':
      addMessage(data.message);
      break;

    case 'NEW_CARRIER':
      addCarrier(data.carrier);
      break;

    case 'ACTIVITY':
      addActivity(data.activity);
      break;

    case 'CRITICAL_EVENT':
      showCriticalAlert(data.event);
      break;

    case 'STATS_UPDATE':
      updateStats(data.stats);
      break;

    case 'SYSTEM_STATUS':
      updateSystemStatus(data.status);
      break;

    case 'SERVER_SHUTDOWN':
      showErrorModal('Server is shutting down. Reconnecting...');
      setTimeout(connectToServer, config.reconnectDelay);
      break;
  }
}

// ================================================
// DATA LOADING
// ================================================

async function loadAllData() {
  console.log('📥 Loading all data...');

  try {
    // Load stats
    const statsResponse = await fetch(`${config.serverUrl}/api/stats`);
    const stats = await statsResponse.json();
    updateStats(stats);

    // Load messages
    const messagesResponse = await fetch(`${config.serverUrl}/api/messages`);
    const messagesData = await messagesResponse.json();
    messages = messagesData.messages || [];
    renderMessages();

    // Load carriers
    const carriersResponse = await fetch(`${config.serverUrl}/api/carriers`);
    const carriersData = await carriersResponse.json();
    carriers = carriersData.carriers || [];
    renderCarriers();

    // Load activity
    const activityResponse = await fetch(`${config.serverUrl}/api/activity`);
    const activityData = await activityResponse.json();
    activityLog = activityData.activity || [];
    renderActivity();

    // Check for critical events
    const eventsResponse = await fetch(`${config.serverUrl}/api/critical-events`);
    const eventsData = await eventsResponse.json();
    if (eventsData.events && eventsData.events.length > 0) {
      showCriticalAlert(eventsData.events[0]);
    }

    // Load system status
    const statusResponse = await fetch(`${config.serverUrl}/api/system-status`);
    const statusData = await statusResponse.json();
    updateSystemStatus(statusData);

    console.log('✅ Data loaded successfully');

  } catch (error) {
    console.error('❌ Failed to load data:', error);
  }
}

async function refreshData() {
  console.log('🔄 Refreshing data...');
  const fab = document.getElementById('refreshBtn');
  fab.classList.add('loading');

  await loadAllData();

  fab.classList.remove('loading');
}

// ================================================
// UI UPDATES
// ================================================

function updateConnectionStatus(status) {
  const statusEl = document.getElementById('connectionStatus');
  statusEl.classList.remove('online', 'offline', 'connecting');
  statusEl.classList.add(status);

  const statusText = statusEl.querySelector('.status-text');
  switch (status) {
    case 'online':
      statusText.textContent = 'Connected';
      break;
    case 'offline':
      statusText.textContent = 'Offline';
      break;
    case 'connecting':
      statusText.textContent = 'Connecting...';
      break;
  }
}

function updateSystemStatus(status) {
  if (!status) return;

  const currentStatus = document.getElementById('currentStatus');
  if (!currentStatus) return;

  const statusIcon = currentStatus.querySelector('.status-icon');
  const statusText = currentStatus.querySelector('.status-text');

  if (status.extensionConnected) {
    statusIcon.textContent = '✓';
    statusIcon.style.background = 'rgba(16, 185, 129, 0.2)';
    statusText.textContent = 'Extension Connected';
    statusText.style.color = '#10b981';
  } else {
    statusIcon.textContent = '⚠️';
    statusIcon.style.background = 'rgba(245, 158, 11, 0.2)';
    statusText.textContent = 'Extension Offline';
    statusText.style.color = '#f59e0b';
  }
}

function updateStats(stats) {
  document.getElementById('statSent').textContent = stats.sent || 0;
  document.getElementById('statReplies').textContent = stats.replies || 0;
  document.getElementById('statAI').textContent = stats.aiHandled || 0;
}

function showCriticalAlert(event) {
  const alert = document.getElementById('criticalAlert');
  const message = document.getElementById('alertMessage');
  const time = document.getElementById('alertTime');

  message.textContent = event.message || `${event.type} detected: "${event.keyword}"`;
  time.textContent = new Date(event.timestamp).toLocaleString();

  alert.style.display = 'flex';

  // Setup acknowledge button
  document.getElementById('ackAlertBtn').onclick = () => {
    acknowledgeAlert(event.id);
    alert.style.display = 'none';
  };

  // Play notification sound if available
  try {
    const audio = new Audio('data:audio/wav;base64,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');
    audio.play().catch(() => {});
  } catch (e) {}
}

async function acknowledgeAlert(eventId) {
  try {
    await fetch(`${config.serverUrl}/api/acknowledge-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId })
    });
    console.log('✓ Alert acknowledged');
  } catch (error) {
    console.error('Failed to acknowledge:', error);
  }
}

// [Rest of the functions remain the same - renderActivity, renderMessages, renderCarriers, etc.]
// Copy from app.js lines 180-450

function renderActivity() {
  const feed = document.getElementById('activityFeed');

  if (activityLog.length === 0) {
    feed.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💤</div>
        <p>No recent activity</p>
      </div>
    `;
    return;
  }

  feed.innerHTML = activityLog.slice(0, 10).map(activity => `
    <div class="activity-item ${activity.type}">
      <div class="activity-header">
        <div class="activity-title">${activity.title}</div>
        <div class="activity-time">${formatTime(activity.timestamp)}</div>
      </div>
      <div class="activity-text">${activity.text}</div>
    </div>
  `).join('');
}

function renderMessages() {
  const list = document.getElementById('messagesList');

  let filtered = messages;
  if (messageFilter !== 'all') {
    filtered = messages.filter(m => m.direction === messageFilter);
  }

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>No messages yet</p>
      </div>
    `;
    return;
  }

  list.innerHTML = filtered.map(msg => `
    <div class="message-card">
      <div class="message-header">
        <div class="message-from">${msg.carrier?.company || 'Unknown'}</div>
        <div class="message-time">${formatTime(msg.timestamp)}</div>
      </div>
      <div class="message-preview">${msg.content}</div>
      <span class="message-badge ${msg.direction}">${msg.direction}</span>
    </div>
  `).join('');

  const unreadCount = messages.filter(m => m.unread).length;
  const badge = document.getElementById('unreadBadge');
  if (unreadCount > 0) {
    badge.textContent = unreadCount;
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }
}

function renderCarriers() {
  const list = document.getElementById('carriersList');

  if (carriers.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🚚</div>
        <p>No carriers extracted yet</p>
      </div>
    `;
    return;
  }

  list.innerHTML = carriers.map((carrier, index) => `
    <div class="carrier-card">
      <div class="carrier-card-header">
        <div class="carrier-company">🚛 ${carrier.company}</div>
        <div class="carrier-badge">#${index + 1}</div>
      </div>
      <div class="carrier-details">
        📦 Order: ${carrier.orderNo || 'N/A'}<br>
        📞 ${carrier.phone || 'N/A'}<br>
        📍 ${carrier.pickupCity || 'N/A'} → ${carrier.deliveryCity || 'N/A'}
      </div>
    </div>
  `).join('');
}

function setupTabNavigation() {
  const tabs = document.querySelectorAll('.tab-btn');
  const panes = document.querySelectorAll('.tab-pane');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;

      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      panes.forEach(p => p.classList.remove('active'));
      document.getElementById(`tab-${targetTab}`).classList.add('active');

      currentTab = targetTab;
    });
  });
}

function setupMessageFilters() {
  const filters = document.querySelectorAll('.filter-btn');

  filters.forEach(filter => {
    filter.addEventListener('click', () => {
      const filterType = filter.dataset.filter;

      filters.forEach(f => f.classList.remove('active'));
      filter.classList.add('active');

      messageFilter = filterType;
      renderMessages();
    });
  });
}

function setupRefreshButton() {
  document.getElementById('refreshBtn').addEventListener('click', refreshData);
}

function setupSearch() {
  const searchInput = document.getElementById('carrierSearch');

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();

    if (!query) {
      renderCarriers();
      return;
    }

    const filtered = carriers.filter(c =>
      c.company.toLowerCase().includes(query) ||
      c.orderNo?.toLowerCase().includes(query) ||
      c.phone?.includes(query)
    );

    const list = document.getElementById('carriersList');
    if (filtered.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <p>No carriers found</p>
        </div>
      `;
      return;
    }

    list.innerHTML = filtered.map((carrier, index) => `
      <div class="carrier-card">
        <div class="carrier-card-header">
          <div class="carrier-company">🚛 ${carrier.company}</div>
          <div class="carrier-badge">#${index + 1}</div>
        </div>
        <div class="carrier-details">
          📦 Order: ${carrier.orderNo || 'N/A'}<br>
          📞 ${carrier.phone || 'N/A'}<br>
          📍 ${carrier.pickupCity || 'N/A'} → ${carrier.deliveryCity || 'N/A'}
        </div>
      </div>
    `).join('');
  });
}

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    showInstallBanner();
  });

  document.getElementById('installBtn')?.addEventListener('click', async () => {
    if (!installPrompt) return;

    installPrompt.prompt();
    const result = await installPrompt.userChoice;

    if (result.outcome === 'accepted') {
      console.log('✅ App installed');
      hideInstallBanner();
    }

    installPrompt = null;
  });

  document.getElementById('dismissInstallBtn')?.addEventListener('click', () => {
    hideInstallBanner();
  });
}

function showInstallBanner() {
  document.getElementById('installBanner').style.display = 'block';
}

function hideInstallBanner() {
  document.getElementById('installBanner').style.display = 'none';
}

function formatTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

function showErrorModal(message) {
  const modal = document.getElementById('errorModal');
  const errorMessage = document.getElementById('errorMessage');

  errorMessage.textContent = message;
  modal.style.display = 'flex';

  document.getElementById('retryBtn').onclick = () => {
    modal.style.display = 'none';
    connectToServer();
  };
}

function addMessage(message) {
  messages.unshift(message);
  renderMessages();
}

function addCarrier(carrier) {
  carriers.push(carrier);
  renderCarriers();
}

function addActivity(activity) {
  activityLog.unshift(activity);
  renderActivity();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js')
    .then(reg => console.log('✅ Service Worker registered:', reg))
    .catch(err => console.error('❌ Service Worker registration failed:', err));
}

console.log('✅ App initialized (Cloud version)');
