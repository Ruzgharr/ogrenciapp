// Bugun ekrani: gunluk ozet, kronometre / pomodoro, rutin ve bugunun kayitlari.
//
// Kronometre karti ekranin altina sabitlenmistir (sticky): uygulamayi acinca
// baslatmak icin tek dokunus yeterli olsun.

import { el, icon, iconFilled, replaceChildren } from './dom.js';
import { ring, horizontalBars, emptyBox } from './charts.js';
import { sessionItem, questionItem, examItem } from './records.js';
import { openSessionSheet, openQuestionSheet, openExamSheet } from './sheets/records.js';
import { openSubjectPicker } from './sheets/subjects.js';
import * as store from '../store.js';
import * as timer from '../timer.js';
import * as notify from '../platform/notify.js';
import * as haptics from '../platform/haptics.js';
import * as snack from './snack.js';
import { todayKey, formatDayLong, relativeDayLabel } from '../core/dates.js';
import { formatMinutes, formatClock, formatPercent } from '../core/format.js';
import {
  onDay,
  totalMinutes,
  minutesBySubject,
  activeDayKeys,
  currentStreak,
} from '../core/stats.js';
import { targetProgress } from '../core/scoring.js';
import { dailyGoal } from '../goal.js';
import { shareSummaryCanvas } from './export.js';

let container = null;
let tickId = null;
let refs = {};

export function render(root) {
  container = root;
  rebuild();
}

export function onEnter() {
  startTicking();
}

export function onLeave() {
  stopTicking();
}

function rebuild() {
  if (!container) return;
  const key = todayKey();
  refs = {};
  
  const leftCol = el('div', { class: 'dashboard-col' }, buildGoalCard(key), buildHabits(key));
  const rightCol = el('div', { class: 'dashboard-col' }, buildQuickActions(), buildRecords(key));
  const grid = el('div', { class: 'dashboard-grid' }, leftCol, rightCol);

  replaceChildren(
    container,
    buildHeader(key),
    grid,
    buildTimerDock(),
  );
  startTicking();
}

// ---------------------------------------------------------------- baslik

function buildHeader(key) {
  const streak = currentStreak(activeDayKeys(store.sessions()), key);
  
  const rightSide = el('div', { style: 'display: flex; gap: 8px; align-items: center; margin-bottom: 4px;' });
  
  if (streak > 0) {
    rightSide.appendChild(
      el('span', { class: 'pill pill-warn nowrap' }, icon('flame', 14), el('span', { text: `${streak} gün` }))
    );
  }

  rightSide.appendChild(
    el('button', {
      class: 'btn btn-icon btn-ghost',
      type: 'button',
      'aria-label': 'Özeti Paylaş',
      on: { click: shareSummary }
    }, icon('share', 19))
  );

  const head = el(
    'div',
    { class: 'screen-head' },
    el(
      'div',
      { class: 'screen-head-text' },
      el('p', { class: 'eyebrow', text: relativeDayLabel(key, todayKey()) }),
      el('h1', { text: formatDayLong(key) }),
      store.settings().targetUniversity ? el('p', { class: 'text-sm text-muted', style: { marginTop: '4px', fontStyle: 'italic', color: 'var(--brand)' }, text: `🎯 Hedef: ${store.settings().targetUniversity}` }) : null
    ),
    rightSide
  );
  return head;
}

async function shareSummary() {
  snack.toast('Günün özeti hazırlanıyor...');
  await new Promise(r => setTimeout(r, 50));
  
  const dataUrl = await shareSummaryCanvas();
  if (!dataUrl) {
    snack.toast('Paylaşım hazırlanırken hata oluştu.');
    return;
  }
  
  // Onizleme Modali Olustur
  const overlay = el('div', { class: 'preview-modal' });
  const img = el('img', { src: dataUrl });
  
  const actions = el('div', { class: 'preview-actions' });
  
  const btnCancel = el('button', {
    class: 'btn',
    text: 'Vazgeç',
    on: { click: () => document.body.removeChild(overlay) }
  });
  
  const btnDownload = el('button', {
    class: 'btn btn-primary',
    text: 'İndir',
    on: { click: () => {
      const link = document.createElement('a');
      link.download = `YKS-Ozet-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
      document.body.removeChild(overlay);
      snack.toast('Özet indirildi!');
    }}
  });
  
  actions.appendChild(btnCancel);
  actions.appendChild(btnDownload);
  overlay.appendChild(img);
  overlay.appendChild(actions);
  document.body.appendChild(overlay);
}

// ---------------------------------------------------------------- gunluk hedef

function buildGoalCard(key) {
  const sessions = onDay(store.sessions(), key);
  const minutes = totalMinutes(sessions);
  const goal = dailyGoal();
  const progress = targetProgress(minutes, goal);
  const done = goal > 0 && minutes >= goal;

  const card = el('div', { class: 'card' });
  card.appendChild(
    el(
      'div',
      { class: 'ring-wrap' },
      ring({
        ratio: progress.clamped,
        main: goal > 0 ? formatPercent(progress.clamped) : formatMinutes(minutes),
        sub: goal > 0 ? 'hedef' : 'bugün',
        done,
      }),
      el(
        'div',
        { class: 'grow' },
        el('p', { class: 'stat-value', style: { fontSize: '1.5rem' }, text: formatMinutes(minutes) }),
        el('p', {
          class: 'small muted',
          text: goal > 0 ? `Günlük hedef ${formatMinutes(goal)}` : 'Günlük hedef ayarlanmadı',
        }),
        el('p', {
          class: `small ${done ? 'ok-text' : 'faint'}`,
          text: goal <= 0
            ? 'Ayarlardan hedef belirleyebilirsin.'
            : done
              ? 'Hedefi tamamladın.'
              : `${formatMinutes(Math.max(0, goal - minutes))} kaldı`,
        }),
      ),
    ),
  );

  const bySubject = minutesBySubject(sessions);
  if (bySubject.length > 0) {
    card.appendChild(el('div', { class: 'divider' }));
    card.appendChild(
      horizontalBars({
        rows: bySubject.map((row) => ({
          label: store.subjectName(row.subjectId),
          value: row.minutes,
          color: store.subjectColor(row.subjectId),
        })),
        formatValue: formatMinutes,
      }),
    );
  }

  return card;
}

// ---------------------------------------------------------------- hizli islemler

function buildQuickActions() {
  const row = el('div', { class: 'chip-row' });
  const actions = [
    { label: 'Süre ekle', iconName: 'clock', onClick: () => openSessionSheet({ defaultSubjectId: lastSubjectId() }) },
    { label: 'Soru kaydı', iconName: 'note', onClick: () => openQuestionSheet({ defaultSubjectId: lastSubjectId() }) },
    { label: 'Deneme ekle', iconName: 'chart', onClick: () => openExamSheet({}) },
  ];
  for (const action of actions) {
    row.appendChild(
      el(
        'button',
        { class: 'chip', type: 'button', on: { click: action.onClick } },
        icon(action.iconName, 16),
        el('span', { text: action.label }),
      ),
    );
  }
  return row;
}

// ---------------------------------------------------------------- rutin

function buildHabits(key) {
  const habits = store.habits();
  if (habits.length === 0) return null;
  const logs = store.habitLogs();
  const doneCount = habits.filter((habit) =>
    logs.some((log) => log.habitId === habit.id && log.date === key && log.done),
  ).length;

  const card = el('div', { class: 'card' });
  card.appendChild(
    el(
      'div',
      { class: 'card-head' },
      el('span', { class: 'card-title', text: 'Günlük rutin' }),
      el('span', {
        class: `pill${doneCount === habits.length ? ' pill-success' : ''}`,
        text: `${doneCount}/${habits.length}`,
      }),
    ),
  );

  for (const habit of habits) {
    const log = logs.find((row) => row.habitId === habit.id && row.date === key);
    const isDone = Boolean(log?.done);
    const check = el('span', { class: 'item-check' }, icon('check', 15));
    const row = el(
      'button',
      {
        class: `habit-row${isDone ? ' is-done' : ''}`,
        type: 'button',
        style: { width: '100%' },
        on: {
          click: () => {
            toggleHabit(habit, key, log);
          },
        },
      },
      check,
      el('span', { class: 'habit-name', style: { textAlign: 'left' }, text: habit.name }),
    );
    // Tamamlanmis gorunum icin .is-done sinifi .item ile ayni davransin diye:
    if (isDone) {
      check.style.background = 'var(--success)';
      check.style.borderColor = 'var(--success)';
      check.style.color = '#062018';
    }
    card.appendChild(row);
  }

  return card;
}

function toggleHabit(habit, key, existing) {
  haptics.success();
  if (existing) store.update('habitLogs', existing.id, { done: !existing.done });
  else store.add('habitLogs', { habitId: habit.id, date: key, done: true });
}

// ---------------------------------------------------------------- bugunun kayitlari

function buildRecords(key) {
  const sessions = onDay(store.sessions(), key).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const questions = onDay(store.questions(), key).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const exams = onDay(store.exams(), key);

  const section = el('div', { class: 'section' });
  section.appendChild(
    el('div', { class: 'section-head' }, el('h2', { text: 'Bugünün kayıtları' })),
  );

  const total = sessions.length + questions.length + exams.length;
  if (total === 0) {
    section.appendChild(
      emptyBox('Henüz kayıt yok', 'Kronometreyi başlat veya alttaki kısayollardan süre/soru ekle.'),
    );
    return section;
  }

  const list = el('ul', { class: 'list' });
  for (const exam of exams) list.appendChild(examItem(exam, { onChanged: rebuild }));
  for (const session of sessions) list.appendChild(sessionItem(session, { onChanged: rebuild }));
  for (const log of questions) list.appendChild(questionItem(log, { onChanged: rebuild }));
  section.appendChild(list);
  section.appendChild(
    el('p', { class: 'note', text: 'Bir kaydı düzenlemek veya silmek için üzerine uzun bas. Sola kaydırmak da siler.' }),
  );
  return section;
}

// ---------------------------------------------------------------- kronometre

function lastSubjectId() {
  const stored = store.getMeta('lastSubjectId');
  if (stored && store.subject(stored)) return stored;
  return store.subjects()[0]?.id || null;
}

function selectedMode() {
  return store.getMeta('timerMode') === timer.MODE_POMODORO ? timer.MODE_POMODORO : timer.MODE_STOPWATCH;
}

function buildTimerDock() {
  const dock = el('div', { class: 'timer-dock' });
  const active = timer.getActive();
  dock.appendChild(active ? buildActiveTimer() : buildIdleTimer());
  if (active) {
    setTimeout(() => {
      dock.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  }
  return dock;
}

function buildModeSwitch(disabled = false) {
  const mode = selectedMode();
  const row = el('div', { class: 'timer-mode' });
  const options = [
    { value: timer.MODE_STOPWATCH, label: 'Kronometre' },
    { value: timer.MODE_POMODORO, label: 'Pomodoro' },
  ];
  for (const option of options) {
    row.appendChild(
      el('button', {
        class: mode === option.value ? 'is-active' : '',
        type: 'button',
        text: option.label,
        disabled,
        on: {
          click: () => {
            store.setMeta('timerMode', option.value);
          },
        },
      }),
    );
  }
  return row;
}

function buildSubjectChip(subjectId, { onChange } = {}) {
  const subject = store.subject(subjectId);
  const dot = el('span', { class: 'dot' });
  dot.style.background = subject?.color || 'var(--text-faint)';
  return el(
    'button',
    {
      class: 'timer-subject',
      type: 'button',
      on: {
        click: () =>
          openSubjectPicker({
            selectedId: subjectId,
            onPick: (id) => onChange?.(id),
          }),
      },
    },
    dot,
    el('span', { text: subject?.name || 'Ders seç' }),
    icon('chevronDown', 15),
  );
}

function buildIdleTimer() {
  const subjectId = lastSubjectId();
  const subject = store.subject(subjectId);
  const mode = selectedMode();
  const pomodoro = store.settings()?.pomodoro || {};

  const card = el('div', { class: 'timer-card' });
  card.appendChild(
    el(
      'div',
      { class: 'timer-top' },
      buildSubjectChip(subjectId, {
        onChange: (id) => {
          store.setMeta('lastSubjectId', id);
        },
      }),
      buildModeSwitch(),
    ),
  );

  if (mode === timer.MODE_POMODORO) {
    card.appendChild(
      el('p', {
        class: 'timer-meta',
        text: `${pomodoro.workMinutes} dakika çalışma · ${pomodoro.breakMinutes} dakika mola`,
      }),
    );
  }

  card.appendChild(
    el(
      'button',
      {
        class: 'start-btn',
        type: 'button',
        on: { click: () => startTimer(mode) },
      },
      iconFilled('play', 22),
      el('span', { text: subject ? `Başlat · ${subject.name}` : 'Ders seç ve başlat' }),
    ),
  );

  return card;
}

async function startTimer(mode) {
  const subjectId = lastSubjectId();
  if (!subjectId) {
    openSubjectPicker({
      onPick: (id) => {
        store.setMeta('lastSubjectId', id);
        startTimer(mode);
      },
    });
    return;
  }

  // Bildirim izni tam dogru anda istenir: pomodoro ilk kez baslatildiginda.
  if (mode === timer.MODE_POMODORO && notify.permission() === 'default') {
    store.updateSettings({ notificationsAsked: true });
    const result = await notify.ensurePermission();
    if (result === 'denied') {
      snack.toast('Bildirim izni verilmedi. Pomodoro çalışır ama uyarı gelmez.', { duration: 4200 });
    }
  }

  timer.start({ subjectId, mode });
}

function buildActiveTimer() {
  const view = timer.display();
  if (!view) return buildIdleTimer();

  const isBreak = view.phase === timer.PHASE_BREAK;
  const isPomodoro = view.mode === timer.MODE_POMODORO;

  const card = el('div', {
    class: `timer-card${view.running ? ' is-running' : ''}${isBreak ? ' is-break' : ''}`,
  });

  card.appendChild(
      el(
        'div',
        { class: 'timer-top' },
        buildSubjectChip(view.subjectId, { onChange: (id) => timer.changeSubject(id) }),
        el(
          'div',
          { style: 'display:flex; gap:6px;' },
          el(
            'button',
            {
              class: 'btn btn-icon btn-ghost',
              type: 'button',
              'aria-label': 'Odak Modu',
              on: { click: () => {
                const app = document.getElementById('app');
                const isFocus = app.classList.toggle('is-focus-mode');
                if (isFocus) {
                  const bg = store.settings().focusBgBase64;
                  if (bg) {
                    const dock = app.querySelector('.timer-dock');
                    if (dock) {
                      dock.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url("${bg}")`;
                      dock.style.backgroundSize = 'cover';
                      dock.style.backgroundPosition = 'center';
                    }
                  }
                } else {
                  const dock = app.querySelector('.timer-dock');
                  if (dock) {
                    dock.style.backgroundImage = '';
                    dock.style.backgroundSize = '';
                    dock.style.backgroundPosition = '';
                  }
                }
              } },
            },
            icon('maximize', 19),
          ),
          el(
            'button',
            {
              class: 'btn btn-icon btn-ghost',
              type: 'button',
              'aria-label': 'Kaydetmeden iptal et',
              on: { click: cancelTimer },
            },
            icon('x', 19),
          )
        ),
      ),
  );

  const clock = el('div', {
    class: `timer-clock${isBreak ? ' is-break' : ''}`,
    text: formatClock(isPomodoro ? view.remainingMs : view.elapsedMs),
  });
  refs.clock = clock;
  card.appendChild(clock);

  const meta = el('div', { class: 'timer-meta' });
  refs.meta = meta;
  meta.textContent = buildMetaText(view);
  card.appendChild(meta);

  if (isPomodoro) {
    const bar = el('i');
    bar.style.width = `${(view.progress * 100).toFixed(1)}%`;
    refs.bar = bar;
    card.appendChild(el('div', { class: `timer-phase-bar${isBreak ? ' is-break' : ''}` }, bar));
  }

  if (view.suspicious) {
    card.appendChild(
      el('p', {
        class: 'note-warn',
        text: 'Kronometre 12 saatten uzun süredir açık. Unuttuysan bitirip süreyi elle düzeltebilirsin.',
      }),
    );
  }

  if (view.timer.missedWhileAway) {
    card.appendChild(
      el('p', {
        class: 'note-warn',
        text: 'Bu tur uygulama kapalıyken doldu. Ne kadar ara verdiğini bilemediğim için sayacı kendiliğinden ilerletmedim.',
      }),
    );
  }

  const buttons = el('div', { class: 'btn-row' });

  if (view.awaitingContinue) {
    buttons.appendChild(
      el(
        'button',
        { class: 'btn btn-primary btn-lg', type: 'button', on: { click: () => timer.continueNext() } },
        iconFilled('play', 20),
        el('span', { text: isBreak ? 'Molayı başlat' : 'Çalışmaya devam' }),
      ),
    );
  } else {
    buttons.appendChild(
      el(
        'button',
        {
          class: 'btn btn-lg',
          type: 'button',
          on: { click: () => timer.toggle() },
        },
        view.running ? icon('pause', 20) : iconFilled('play', 20),
        el('span', { text: view.running ? 'Duraklat' : 'Devam et' }),
      ),
    );
  }

  if (isBreak) {
    buttons.appendChild(
      el(
        'button',
        { class: 'btn btn-lg btn-ghost', type: 'button', on: { click: () => timer.skipBreak() } },
        icon('skip', 19),
        el('span', { text: 'Molayı atla' }),
      ),
    );
  }

  buttons.appendChild(
    el(
      'button',
      { class: 'btn btn-lg btn-success', type: 'button', on: { click: finishTimer } },
      icon('check', 20),
      el('span', { text: 'Bitir' }),
    ),
  );

  card.appendChild(buttons);
  return card;
}

function buildMetaText(view) {
  const parts = [];
  if (view.mode === timer.MODE_POMODORO) {
    parts.push(view.phase === timer.PHASE_BREAK ? 'Mola' : 'Çalışma');
    parts.push(`${view.cycle}. tur`);
    if (view.studyMs > 0) parts.push(`toplam ${formatMinutes(Math.floor(view.studyMs / 60000))}`);
  } else {
    parts.push(view.running ? 'Çalışıyor' : 'Duraklatıldı');
    if (view.timer.sessionStartedAt) {
      const started = new Date(view.timer.sessionStartedAt);
      parts.push(`${String(started.getHours()).padStart(2, '0')}:${String(started.getMinutes()).padStart(2, '0')} başladı`);
    }
  }
  return parts.join(' · ');
}

function exitFocusMode() {
  const app = document.getElementById('app');
  if (!app) return;
  const dock = app.querySelector('.timer-dock');
  if (dock) {
    dock.style.backgroundImage = '';
    dock.style.backgroundSize = '';
    dock.style.backgroundPosition = '';
  }
  app.classList.remove('is-focus-mode');
}

async function finishTimer() {
  exitFocusMode();
  const result = await timer.finish();
  if (result.saved) {
    snack.success(`${formatMinutes(result.minutes)} kaydedildi`);
  } else {
    snack.toast('1 dakikadan kısa süre kaydedilmedi.');
  }
}

function cancelTimer() {
  exitFocusMode();
  const view = timer.display();
  const elapsedMinutes = view ? Math.round(view.elapsedMs / 60000) : 0;
  timer.cancel();
  if (elapsedMinutes >= 1) {
    snack.toast(`${formatMinutes(elapsedMinutes)} kaydedilmeden iptal edildi.`, { duration: 3600 });
  }
}

// ---------------------------------------------------------------- saniye guncellemesi

function startTicking() {
  stopTicking();
  if (!timer.getActive()) return;
  tickId = setInterval(updateClock, 250);
  updateClock();
}

function stopTicking() {
  if (tickId !== null) clearInterval(tickId);
  tickId = null;
}

function updateClock() {
  const view = timer.display();
  if (!view) {
    stopTicking();
    return;
  }
  if (refs.clock) {
    refs.clock.textContent = formatClock(
      view.mode === timer.MODE_POMODORO ? view.remainingMs : view.elapsedMs,
    );
  }
  if (refs.meta) refs.meta.textContent = buildMetaText(view);
  if (refs.bar) refs.bar.style.width = `${(view.progress * 100).toFixed(1)}%`;
}
