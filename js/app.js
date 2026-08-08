// Uygulama girisi: veri yukleme, tema, sekme yonlendirme, service worker kaydi.

console.info('%c YKS Takip ', 'background: #38bdf8; color: #000; font-weight: bold; padding: 4px; border-radius: 4px;');
console.info('%c Crafted with passion by LevioraLabs ', 'background: #14181f; color: #e8ecf4; font-style: italic; padding: 4px;');

import * as store from './store.js';
import * as timer from './timer.js';
import * as badge from './platform/badge.js';
import * as notify from './platform/notify.js';
import * as snack from './ui/snack.js';
import { applyTheme } from './theme.js';
import { batched } from './util.js';
import { pendingTaskCount } from './core/stats.js';
import * as todayScreen from './ui/today.js';
import * as statsScreen from './ui/stats.js';
import * as tasksScreen from './ui/tasks.js';
import * as settingsScreen from './ui/settings.js';

const SCREENS = {
  today: { module: todayScreen, selector: '#screen-today' },
  stats: { module: statsScreen, selector: '#screen-stats' },
  tasks: { module: tasksScreen, selector: '#screen-tasks' },
  settings: { module: settingsScreen, selector: '#screen-settings' },
};

/** Ana ekran kisayollarindan gelen ?ekran= parametresi. */
const TAB_ALIASES = {
  bugun: 'today',
  istatistik: 'stats',
  gorevler: 'tasks',
  ayarlar: 'settings',
};

let activeTab = 'today';
const dirty = new Set();

function initialTab() {
  try {
    const value = new URLSearchParams(location.search).get('ekran');
    if (value && TAB_ALIASES[value]) return TAB_ALIASES[value];
  } catch {
    /* yoksay */
  }
  return 'today';
}

async function boot() {
  // Tema kayitli ayardan once uygulanamaz; ilk boyama karanlik temayla yapilir.
  applyTheme('dark');

  try {
    await store.init();
  } catch (error) {
    showFatal(error?.userMessage || 'Veriler açılamadı.');
    return;
  }

  applyTheme(store.settings().theme || 'dark');

  store.onError((message) => snack.error(message));
  store.subscribe(onStoreChange);

  setupTabs();
  const startTab = initialTab();
  if (startTab !== 'today') {
    activeTab = startTab;
    for (const [key, screen] of Object.entries(SCREENS)) {
      document.querySelector(screen.selector).hidden = key !== startTab;
    }
    for (const button of document.querySelectorAll('.tab')) {
      const isActive = button.dataset.tab === startTab;
      button.classList.toggle('is-active', isActive);
      if (!isActive) button.removeAttribute('aria-current');
      else button.setAttribute('aria-current', 'page');
    }
  }
  renderScreen(activeTab);
  SCREENS[activeTab].module.onEnter?.();

  timer.startWatchdog();
  syncBadges();
  registerServiceWorker();
  attachLifecycle();

  document.getElementById('app').hidden = false;
  const bootScreen = document.getElementById('boot');
  bootScreen.classList.add('is-hidden');
  setTimeout(() => bootScreen.remove(), 260);
}

// ---------------------------------------------------------------- sekmeler

function setupTabs() {
  const tabbar = document.getElementById('tabbar');
  for (const button of tabbar.querySelectorAll('.tab')) {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
  }
}

function switchTab(name) {
  if (!SCREENS[name] || name === activeTab) return;
  const previous = activeTab;
  activeTab = name;

  SCREENS[previous].module.onLeave?.();

  for (const [key, screen] of Object.entries(SCREENS)) {
    const node = document.querySelector(screen.selector);
    node.hidden = key !== name;
  }

  for (const button of document.querySelectorAll('.tab')) {
    const isActive = button.dataset.tab === name;
    button.classList.toggle('is-active', isActive);
    if (isActive) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }

  if (dirty.has(name) || !SCREENS[name].mounted) renderScreen(name);

  const node = document.querySelector(SCREENS[name].selector);
  node.scrollTop = 0;
  node.classList.remove('is-entering');
  // Sinif yeniden eklenince animasyon tekrar calisir.
  void node.offsetWidth;
  node.classList.add('is-entering');

  SCREENS[name].module.onEnter?.();
}

function renderScreen(name) {
  const screen = SCREENS[name];
  const node = document.querySelector(screen.selector);
  screen.module.render(node);
  screen.mounted = true;
  dirty.delete(name);
}

// ---------------------------------------------------------------- durum degisimi

const onStoreChange = batched(() => {
  for (const name of Object.keys(SCREENS)) {
    if (name === activeTab) renderScreen(name);
    else if (SCREENS[name].mounted) dirty.add(name);
  }
  syncBadges();
});

function syncBadges() {
  const count = pendingTaskCount(store.tasks());
  const tabBadge = document.getElementById('tab-badge');
  if (tabBadge) {
    tabBadge.textContent = String(count);
    tabBadge.hidden = count === 0;
  }
  badge.set(count);
}

// ---------------------------------------------------------------- yasam dongusu

function attachLifecycle() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // Gun degismis olabilir: ekrani tazele ve suresi gecmis mezar taslarini temizle.
      store.purgeExpired();
      renderScreen(activeTab);
    } else {
      store.flush();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('Yakalanmayan hata:', event.reason);
  });

  // Gece yarisini gecince "Bugun" ekrani kendini tazelesin.
  let lastDayCheck = new Date().getDate();
  setInterval(() => {
    const day = new Date().getDate();
    if (day !== lastDayCheck) {
      lastDayCheck = day;
      renderScreen(activeTab);
    }
  }, 60000);

  timer.onPhaseEnd(() => {
    renderScreen(activeTab);
  });
}

function showFatal(message) {
  const bootScreen = document.getElementById('boot');
  if (bootScreen) bootScreen.remove();
  const fatal = document.getElementById('fatal');
  document.getElementById('fatal-message').textContent = message;
  fatal.hidden = false;
  document.getElementById('fatal-retry').addEventListener('click', () => location.reload());
}

// ---------------------------------------------------------------- service worker

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // Yerel dosya olarak (file://) acildiysa service worker calismaz, sessizce gec.
  if (location.protocol === 'file:') return;

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  navigator.serviceWorker
    .register('./sw.js')
    .then((registration) => {
      notify.setRegistration(registration);

      const offerUpdate = (worker) => {
        if (!worker) return;
        snack.updateReady(() => {
          // Bekleyen surumu devreye al; controllerchange sayfayi yeniler.
          worker.postMessage({ type: 'SKIP_WAITING' });
        });
      };

      if (registration.waiting && navigator.serviceWorker.controller) offerUpdate(registration.waiting);

      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            offerUpdate(registration.waiting || installing);
          }
        });
      });
    })
    .catch((err) => console.debug('Service worker kaydedilemedi:', err?.message || err));
}

boot().catch((err) => {
  showFatal(err?.userMessage || err?.message || String(err));
});
