// Istatistik ekrani. Butun grafikler elle uretilmis SVG (js/ui/charts.js).

import { el, icon, replaceChildren } from './dom.js';
import { barChart, lineChart, horizontalBars, heatmap, emptyBox } from './charts.js';
import { examItem, questionItem } from './records.js';
import { openExamSheet } from './sheets/records.js';
import * as store from '../store.js';
import {
  todayKey,
  lastNDays,
  addDays,
  startOfWeek,
  startOfMonth,
  formatDayShort,
  weekdayShort,
  formatDayLong,
} from '../core/dates.js';
import { formatMinutes, formatNet, formatPercent } from '../core/format.js';
import {
  inRange,
  minutesByDay,
  minutesBySubject,
  totalMinutes,
  activeDayKeys,
  currentStreak,
  longestStreak,
  rangeSummary,
  questionTotals,
  questionTotalsBySubject,
  questionTotalsByTopic,
  examSeries,
  examTotalSeries,
  habitHeatmap,
} from '../core/stats.js';
import { dailyGoal } from '../goal.js';

let container = null;
let rangeDays = 7;
let examSubjectId = null; // null => toplam net
let topicSubjectId = null; // null => tum dersler

export function render(root) {
  container = root;
  rebuild();
}

export function onEnter() {}
export function onLeave() {}

function rebuild() {
  if (!container) return;
  const key = todayKey();
  replaceChildren(
    container,
    buildHeader(),
    buildRangeCard(key),
    buildTotalsCard(key),
    buildQuestionCard(),
    buildExamCard(),
    buildTopicCard(),
    buildHabitCard(key),
  );
}

function buildHeader() {
  return el(
    'div',
    { class: 'screen-head' },
    el('div', {}, el('p', { class: 'eyebrow', text: 'Genel görünüm' }), el('h1', { text: 'İstatistik' })),
  );
}

// ---------------------------------------------------------------- sure grafigi

function buildRangeCard(key) {
  const keys = lastNDays(rangeDays, key);
  const sessions = inRange(store.sessions(), keys[0], key);
  const daily = minutesByDay(sessions, keys);
  const summary = rangeSummary(store.sessions(), keys[0], key);
  const goal = dailyGoal();

  const seg = el('div', { class: 'seg' });
  for (const option of [7, 30]) {
    seg.appendChild(
      el('button', {
        class: rangeDays === option ? 'is-active' : '',
        type: 'button',
        text: `${option} gün`,
        on: {
          click: () => {
            rangeDays = option;
            rebuild();
          },
        },
      }),
    );
  }

  const card = el('div', { class: 'card' });
  card.appendChild(
    el(
      'div',
      { class: 'card-head' },
      el('span', { class: 'card-title', text: 'Günlük çalışma süresi' }),
      seg,
    ),
  );

  card.appendChild(
    barChart({
      items: daily.map((row) => ({
        label: `${formatDayShort(row.date)} ${weekdayShort(row.date)}`,
        shortLabel: rangeDays <= 7 ? weekdayShort(row.date) : formatDayShort(row.date),
        value: row.minutes,
      })),
      goal,
      formatValue: formatMinutes,
      unitStep: 30,
      height: 124,
    }),
  );

  card.appendChild(
    el(
      'div',
      { class: 'grid-3', style: { marginTop: '4px' } },
      statBox(formatMinutes(summary.minutes), 'Toplam'),
      statBox(formatMinutes(summary.averagePerDay), 'Günlük ortalama'),
      statBox(`${summary.days}/${summary.spanDays}`, 'Çalışılan gün'),
    ),
  );

  const bySubject = minutesBySubject(sessions);
  if (bySubject.length > 0) {
    card.appendChild(el('div', { class: 'divider' }));
    card.appendChild(el('p', { class: 'card-title', text: 'Ders bazlı dağılım' }));
    const total = totalMinutes(sessions);
    card.appendChild(
      horizontalBars({
        rows: bySubject.map((row) => ({
          label: store.subjectName(row.subjectId),
          value: row.minutes,
          color: store.subjectColor(row.subjectId),
          hint: total > 0 ? formatPercent(row.minutes / total) : null,
        })),
        formatValue: formatMinutes,
      }),
    );
  }

  return card;
}

function statBox(value, label) {
  return el('div', { class: 'stat' }, el('span', { class: 'stat-value', text: value }), el('span', { class: 'stat-label', text: label }));
}

// ---------------------------------------------------------------- toplamlar

function buildTotalsCard(key) {
  const sessions = store.sessions();
  const weekStart = startOfWeek(key);
  const monthStart = startOfMonth(key);
  const week = totalMinutes(inRange(sessions, weekStart, key));
  const month = totalMinutes(inRange(sessions, monthStart, key));
  const days = activeDayKeys(sessions);
  const streak = currentStreak(days, key);
  const best = longestStreak(days);
  const allTime = totalMinutes(sessions);

  const card = el('div', { class: 'card' });
  card.appendChild(el('p', { class: 'card-title', text: 'Toplam' }));
  card.appendChild(
    el(
      'div',
      { class: 'grid-2' },
      statBox(formatMinutes(week), 'Bu hafta'),
      statBox(formatMinutes(month), 'Bu ay'),
      statBox(`${streak} gün`, 'Güncel seri'),
      statBox(`${best} gün`, 'En uzun seri'),
    ),
  );
  card.appendChild(
    el('p', {
      class: 'note',
      text: `Tüm zamanlar: ${formatMinutes(allTime)} · ${days.length} gün çalışıldı`,
    }),
  );
  return card;
}

// ---------------------------------------------------------------- soru istatistigi

function buildQuestionCard() {
  const logs = store.questions();
  const card = el('div', { class: 'card' });
  card.appendChild(
    el(
      'div',
      { class: 'card-head' },
      el('span', { class: 'card-title', text: 'Çözülen sorular' }),
    ),
  );

  if (logs.length === 0) {
    card.appendChild(emptyBox('Henüz soru kaydı yok', 'Bugün ekranındaki "Soru kaydı" kısayolundan ekleyebilirsin.'));
    return card;
  }

  const totals = questionTotals(logs, store.penalty());
  card.appendChild(
    el(
      'div',
      { class: 'grid-3' },
      statBox(String(totals.total), 'Soru'),
      statBox(formatNet(totals.net), 'Net'),
      statBox(totals.accuracy === null ? '-' : formatPercent(totals.accuracy), 'İsabet'),
    ),
  );

  const bySubject = questionTotalsBySubject(logs, store.penalty());
  card.appendChild(el('div', { class: 'divider' }));
  card.appendChild(
    horizontalBars({
      rows: bySubject.map((row) => ({
        label: store.subjectName(row.subjectId),
        value: row.total,
        color: store.subjectColor(row.subjectId),
        hint: `${formatNet(row.net)} net`,
      })),
      formatValue: (value) => `${value} soru`,
    }),
  );

  const recent = [...logs].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 5);
  const list = el('ul', { class: 'list', style: { marginTop: '10px' } });
  for (const log of recent) list.appendChild(questionItem(log, { onChanged: rebuild }));
  card.appendChild(el('p', { class: 'card-title', style: { marginTop: '10px' }, text: 'Son kayıtlar' }));
  card.appendChild(list);
  return card;
}

// ---------------------------------------------------------------- deneme gelisimi

function buildExamCard() {
  const exams = store.exams();
  const card = el('div', { class: 'card' });
  card.appendChild(el('div', { class: 'card-head' }, el('span', { class: 'card-title', text: 'Deneme netleri' })));

  if (exams.length === 0) {
    card.appendChild(
      emptyBox('Henüz deneme kaydı yok', 'İlk denemeni ekleyince buraya gelişim grafiği çizilir.'),
    );
    card.appendChild(
      el(
        'button',
        { class: 'btn btn-block', type: 'button', style: { marginTop: '10px' }, on: { click: () => openExamSheet({}) } },
        icon('plus', 18),
        el('span', { text: 'Deneme ekle' }),
      ),
    );
    return card;
  }

  // Ders secimi: toplam + her ders
  const chips = el('div', { class: 'chip-row' });
  const options = [{ id: null, name: 'Toplam', color: 'var(--accent)' }, ...store.subjects()];
  for (const option of options) {
    const dot = el('span', { class: 'dot' });
    dot.style.background = option.color;
    chips.appendChild(
      el(
        'button',
        {
          class: `chip${examSubjectId === option.id ? ' is-active' : ''}`,
          type: 'button',
          on: {
            click: () => {
              examSubjectId = option.id;
              rebuild();
            },
          },
        },
        dot,
        el('span', { text: option.name }),
      ),
    );
  }
  card.appendChild(chips);

  const penalty = store.penalty();
  let points = [];
  let target = 0;
  let color = 'var(--accent)';

  if (examSubjectId === null) {
    // Toplam net: TYT ve YDT ayri hesaplandigi icin en cok kaydi olan turu gosterir.
    const tytCount = exams.filter((exam) => exam.examType === 'TYT').length;
    const type = tytCount >= exams.length - tytCount ? 'TYT' : 'YDT';
    points = examTotalSeries(exams, type, penalty);
    target = store
      .subjects()
      .filter((subject) => subject.examType === type)
      .reduce((sum, subject) => sum + store.target(subject.id), 0);
    card.appendChild(el('p', { class: 'note', text: `${type} denemelerinin toplam neti` }));
  } else {
    points = examSeries(exams, examSubjectId, penalty);
    target = store.target(examSubjectId);
    color = store.subjectColor(examSubjectId);
  }

  card.appendChild(
    lineChart({
      points: points.map((point) => ({
        label: `${formatDayShort(point.date)} · ${point.name}`,
        shortLabel: formatDayShort(point.date),
        value: point.net,
      })),
      target,
      color,
      formatValue: formatNet,
    }),
  );

  if (points.length > 0) {
    const last = points[points.length - 1];
    const first = points[0];
    const diff = Math.round((last.net - first.net) * 100) / 100;
    card.appendChild(
      el(
        'div',
        { class: 'grid-3' },
        statBox(formatNet(last.net), 'Son deneme'),
        statBox(formatNet(target), 'Hedef'),
        statBox(`${diff >= 0 ? '+' : ''}${formatNet(diff)}`, 'İlk denemeye göre'),
      ),
    );
  }

  const recent = [...exams].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
  const list = el('ul', { class: 'list', style: { marginTop: '10px' } });
  for (const exam of recent) list.appendChild(examItem(exam, { onChanged: rebuild }));
  card.appendChild(el('p', { class: 'card-title', style: { marginTop: '10px' }, text: 'Son denemeler' }));
  card.appendChild(list);

  return card;
}

// ---------------------------------------------------------------- konu bazli

function buildTopicCard() {
  const allLogs = store.questions();
  if (allLogs.length === 0) return null;

  const card = el('div', { class: 'card' });
  card.appendChild(el('div', { class: 'card-head' }, el('span', { class: 'card-title', text: 'Konu bazlı' })));

  const chips = el('div', { class: 'chip-row' });
  const options = [{ id: null, name: 'Tümü', color: 'var(--text-faint)' }, ...store.subjects()];
  for (const option of options) {
    const dot = el('span', { class: 'dot' });
    dot.style.background = option.color;
    chips.appendChild(
      el(
        'button',
        {
          class: `chip${topicSubjectId === option.id ? ' is-active' : ''}`,
          type: 'button',
          on: {
            click: () => {
              topicSubjectId = option.id;
              rebuild();
            },
          },
        },
        dot,
        el('span', { text: option.name }),
      ),
    );
  }
  card.appendChild(chips);

  const logs = topicSubjectId ? allLogs.filter((log) => log.subjectId === topicSubjectId) : allLogs;
  const rows = questionTotalsByTopic(logs, store.penalty()).slice(0, 12);

  if (rows.length === 0) {
    card.appendChild(emptyBox('Bu derste soru kaydı yok'));
    return card;
  }

  card.appendChild(
    horizontalBars({
      rows: rows.map((row) => ({
        label: row.topic || 'Konu belirtilmedi',
        value: row.total,
        color: row.accuracy === null ? 'var(--text-faint)' : row.accuracy >= 0.8 ? 'var(--success)' : row.accuracy >= 0.6 ? 'var(--warn)' : 'var(--danger)',
        hint: row.accuracy === null ? null : `${formatPercent(row.accuracy)} isabet`,
      })),
      formatValue: (value) => `${value} soru`,
    }),
  );
  card.appendChild(
    el('p', { class: 'note', text: 'Renk isabet oranını gösterir: yeşil iyi, kırmızı tekrar gerektiriyor.' }),
  );

  // Notlarim: oturum notlari
  const notes = store
    .sessions()
    .filter((session) => session.note)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 6);
  if (notes.length > 0) {
    card.appendChild(el('div', { class: 'divider' }));
    card.appendChild(el('p', { class: 'card-title', text: 'Notlar' }));
    const list = el('div', { class: 'list' });
    for (const session of notes) {
      list.appendChild(
        el(
          'div',
          { class: 'card card-flat card-tight' },
          el('p', {
            class: 'tiny faint',
            text: `${formatDayShort(session.date)} · ${store.subjectName(session.subjectId)}`,
          }),
          el('p', { class: 'small', text: session.note }),
        ),
      );
    }
    card.appendChild(list);
  }

  return card;
}

// ---------------------------------------------------------------- rutin isi haritasi

function buildHabitCard(key) {
  const habits = store.habits();
  if (habits.length === 0) return null;
  const days = habitHeatmap(store.habitLogs(), habits.map((habit) => habit.id), key, 30);
  const completed = days.filter((day) => day.ratio >= 1).length;

  const card = el('div', { class: 'card' });
  card.appendChild(
    el(
      'div',
      { class: 'card-head' },
      el('span', { class: 'card-title', text: 'Rutin (son 30 gün)' }),
      el('span', { class: 'pill', text: `${completed} tam gün` }),
    ),
  );
  card.appendChild(
    heatmap({
      days,
      todayKey: key,
      labelFor: (day) => `${formatDayLong(day.date)}: ${day.done}/${day.total}`,
    }),
  );

  const legend = el(
    'div',
    { class: 'heat-legend', style: { marginTop: '8px' } },
    el('span', { text: 'Az' }),
  );
  for (const level of [0, 1, 2, 3, 4]) {
    legend.appendChild(
      el('i', { class: 'heat-cell', data: { level }, style: { width: '12px', height: '12px' } }),
    );
  }
  legend.appendChild(el('span', { text: 'Tam' }));
  card.appendChild(legend);
  card.appendChild(
    el('p', {
      class: 'note',
      text: `${formatDayShort(addDays(key, -29))} ile ${formatDayShort(key)} arası. Bir kareye dokunup bekleyince tarihi görünür.`,
    }),
  );
  return card;
}
