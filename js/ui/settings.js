// Ayarlar ekrani: hedefler, pomodoro, dersler, rutin, bildirimler, tema, yedekleme.

import { el, icon, replaceChildren } from './dom.js';
import { openSheet, openMenu, holdToConfirmButton } from './sheet.js';
import { stepper, quickPicks } from './stepper.js';
import { openSubjectEditor } from './sheets/subjects.js';
import { emptyBox } from './charts.js';
import * as store from '../store.js';
import * as db from '../db.js';
import * as snack from './snack.js';
import * as backup from '../backup.js';
import * as notify from '../platform/notify.js';
import * as badge from '../platform/badge.js';
import * as wakelock from '../platform/wakelock.js';
import * as haptics from '../platform/haptics.js';
import * as periodicSync from '../platform/periodicsync.js';
import { applyTheme } from '../theme.js';
import { formatMinutes, formatNet, formatCount } from '../core/format.js';
import { trimOrUndefined } from '../util.js';
import { summarizeBackup } from '../core/backup.js';

const APP_VERSION = '1.0.0';

let container = null;
let storageInfo = null;

export function render(root) {
  container = root;
  rebuild();
}

export function onEnter() {
  // Depolama bilgisini arkada oku, gelince tazele.
  db.storageEstimate().then((info) => {
    if (!info) return;
    storageInfo = info;
    rebuild();
  });
}

export function onLeave() {}

function rebuild() {
  if (!container) return;
  replaceChildren(
    container,
    buildHeader(),
    buildGoalSection(),
    buildPomodoroSection(),
    buildSubjectsSection(),
    buildHabitsSection(),
    buildNotificationSection(),
    buildDeviceSection(),
    buildThemeSection(),
    buildBackupSection(),
    buildDangerSection(),
    buildAboutSection(),
  );
}

function buildHeader() {
  return el(
    'div',
    { class: 'screen-head' },
    el('div', {}, el('p', { class: 'eyebrow', text: 'Her şey senin elinde' }), el('h1', { text: 'Ayarlar' })),
  );
}

function card(title, ...children) {
  return el(
    'div',
    { class: 'card' },
    title ? el('p', { class: 'card-title', style: { marginBottom: '10px' }, text: title }) : null,
    ...children,
  );
}

function settingRow({ title, description, control }) {
  return el(
    'div',
    { class: 'setting-row' },
    el(
      'div',
      { class: 'setting-text' },
      el('strong', { text: title }),
      description ? el('span', { text: description }) : null,
    ),
    control,
  );
}

function toggle(value, onChange) {
  const button = el('button', {
    class: `switch${value ? ' is-on' : ''}`,
    type: 'button',
    role: 'switch',
    'aria-checked': value ? 'true' : 'false',
  });
  button.addEventListener('click', () => {
    const next = !button.classList.contains('is-on');
    button.classList.toggle('is-on', next);
    button.setAttribute('aria-checked', next ? 'true' : 'false');
    haptics.success();
    onChange(next);
  });
  return button;
}

// ---------------------------------------------------------------- hedefler

function buildGoalSection() {
  const settings = store.settings();

  const goalControl = stepper({
    value: settings.dailyGoalMinutes,
    min: 0,
    max: 900,
    step: 15,
    unit: 'dakika',
    onChange: (value) => {
      store.updateSettings({ dailyGoalMinutes: value });
      picks.setActive(value);
    },
  });

  const picks = quickPicks({
    values: [120, 180, 240, 300, 360],
    active: settings.dailyGoalMinutes,
    format: (value) => formatMinutes(value),
    onPick: (value) => {
      goalControl.set(value);
      store.updateSettings({ dailyGoalMinutes: value });
    },
  });

  const penaltyControl = stepper({
    value: settings.netPenalty,
    min: 0,
    max: 10,
    step: 1,
    unit: 'yanlış 1 doğru',
    onChange: (value) => store.updateSettings({ netPenalty: value }),
  });

  const uniInput = el('input', {
    type: 'text',
    class: 'input',
    placeholder: 'Örn: ODTÜ Bilgisayar',
    value: settings.targetUniversity || '',
    style: { maxWidth: '160px', textAlign: 'right' }
  });
  uniInput.addEventListener('change', () => {
    store.updateSettings({ targetUniversity: uniInput.value.trim() });
    haptics.success();
  });

  return card(
    'Hedefler & Netler',
    settingRow({
      title: 'Hedef Üniversite / Bölüm',
      description: 'Sana ilham vermesi için ana ekranda durur',
      control: uniInput,
    }),
    settingRow({
      title: 'Günlük Çalışma Hedefi',
      description: 'Hedefe ulaşınca konfeti patlar.',
      control: el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' } }, goalControl.element, picks.element),
    }),
    settingRow({
      title: 'Net Hesaplama Kuralı',
      description: 'Denemelerde ve soru kayıtlarında (varsayılan: 4)',
      control: penaltyControl.element,
    }),
  );
}

// ---------------------------------------------------------------- pomodoro

function buildPomodoroSection() {
  const pomodoro = store.settings().pomodoro || {};

  const workControl = stepper({
    value: pomodoro.workMinutes,
    min: 5,
    max: 180,
    step: 5,
    unit: 'dk çalışma',
    onChange: (value) => savePomodoro({ workMinutes: value }),
  });

  const breakControl = stepper({
    value: pomodoro.breakMinutes,
    min: 1,
    max: 60,
    step: 1,
    unit: 'dk mola',
    onChange: (value) => savePomodoro({ breakMinutes: value }),
  });

  return card(
    'Pomodoro',
    el('div', { class: 'grid-2' }, workControl.element, breakControl.element),
    settingRow({
      title: 'Mola kendiliğinden başlasın',
      description: 'Çalışma süresi dolduğunda mola sayacı otomatik başlar.',
      control: toggle(pomodoro.autoStartBreak !== false, (value) => savePomodoro({ autoStartBreak: value })),
    }),
    settingRow({
      title: 'Moladan sonra çalışma otomatik başlasın',
      description: 'Kapalıysa mola bitince "devam et" dokunuşunu bekler.',
      control: toggle(pomodoro.autoStartWork === true, (value) => savePomodoro({ autoStartWork: value })),
    }),
  );
}

function savePomodoro(patch) {
  const current = store.settings().pomodoro || {};
  store.updateSettings({ pomodoro: { ...current, ...patch } });
}

// ---------------------------------------------------------------- dersler

function buildSubjectsSection() {
  const subjects = store.subjects();
  const list = el('div', { class: 'list' });

  if (subjects.length === 0) {
    list.appendChild(emptyBox('Ders yok', 'Aşağıdaki düğmeyle ders ekle.'));
  }

  for (const subject of subjects) {
    const dot = el('span', { class: 'dot' });
    dot.style.background = subject.color;
    list.appendChild(
      el(
        'button',
        {
          class: 'item',
          type: 'button',
          style: { width: '100%', textAlign: 'left' },
          on: { click: () => openSubjectEditor({ subject, onSaved: rebuild, onDeleted: rebuild }) },
        },
        dot,
        el(
          'div',
          { class: 'item-main' },
          el('span', { class: 'item-title', text: subject.name }),
          el(
            'div',
            { class: 'item-sub' },
            el('span', { text: subject.examType }),
            el('span', { text: `${subject.questionCount || '?'} soru` }),
            el('span', { text: `hedef ${formatNet(store.target(subject.id))} net` }),
          ),
        ),
        icon('chevronRight', 18),
      ),
    );
  }

  return card(
    'Dersler ve hedef netler',
    list,
    el(
      'button',
      {
        class: 'btn btn-block',
        type: 'button',
        style: { marginTop: '10px' },
        on: { click: () => openSubjectEditor({ onSaved: rebuild }) },
      },
      icon('plus', 18),
      el('span', { text: 'Yeni ders' }),
    ),
  );
}

// ---------------------------------------------------------------- rutin

function buildHabitsSection() {
  const habits = store.habits();
  const list = el('div', { class: 'list' });

  if (habits.length === 0) {
    list.appendChild(emptyBox('Rutin maddesi yok'));
  }

  habits.forEach((habit, index) => {
    const item = el(
      'button',
      {
        class: 'item',
        type: 'button',
        style: { width: '100%', textAlign: 'left' },
        on: {
          click: () =>
            openMenu(habit.name, [
              { label: 'Adını değiştir', iconName: 'edit', onSelect: () => openHabitEditor(habit) },
              index > 0 ? { label: 'Yukarı taşı', iconName: 'upload', onSelect: () => moveHabit(habit, -1) } : null,
              index < habits.length - 1
                ? { label: 'Aşağı taşı', iconName: 'download', onSelect: () => moveHabit(habit, 1) }
                : null,
              {
                label: 'Sil',
                iconName: 'trash',
                danger: true,
                onSelect: () => {
                  store.softDelete('habits', habit.id);
                  haptics.remove();
                  snack.undoBar(`${habit.name} silindi`, {
                    onUndo: () => {
                      store.restore('habits', habit.id);
                      rebuild();
                    },
                    onExpire: () => store.purge('habits', habit.id),
                  });
                  rebuild();
                },
              },
            ]),
        },
      },
      el('div', { class: 'item-main' }, el('span', { class: 'item-title', text: habit.name })),
      icon('more', 18),
    );
    list.appendChild(item);
  });

  return card(
    'Günlük rutin',
    list,
    el(
      'button',
      {
        class: 'btn btn-block',
        type: 'button',
        style: { marginTop: '10px' },
        on: { click: () => openHabitEditor(null) },
      },
      icon('plus', 18),
      el('span', { text: 'Yeni madde' }),
    ),
  );
}

function moveHabit(habit, direction) {
  const habits = store.habits();
  const index = habits.findIndex((item) => item.id === habit.id);
  const target = index + direction;
  if (target < 0 || target >= habits.length) return;
  const other = habits[target];
  store.update('habits', habit.id, { order: target });
  store.update('habits', other.id, { order: index });
  rebuild();
}

function openHabitEditor(habit) {
  const input = el('input', {
    class: 'input',
    type: 'text',
    value: habit?.name || '',
    placeholder: 'Örnek: 23:00\'te yattım',
    maxlength: '60',
  });
  const errorText = el('p', { class: 'field-error', hidden: true });

  const save = () => {
    const name = trimOrUndefined(input.value);
    if (!name) {
      errorText.textContent = 'Boş olamaz.';
      errorText.hidden = false;
      return;
    }
    if (habit) store.update('habits', habit.id, { name });
    else store.add('habits', { name, order: store.habits().length });
    haptics.success();
    sheet.close();
    rebuild();
  };

  const sheet = openSheet({
    title: habit ? 'Rutin maddesini düzenle' : 'Yeni rutin maddesi',
    autofocus: true,
    body: [el('div', { class: 'field' }, el('label', { class: 'field-label', text: 'Madde' }), input, errorText)],
    actions: [
      el('button', { class: 'btn btn-ghost', type: 'button', text: 'Vazgeç', on: { click: () => sheet.close() } }),
      el('button', { class: 'btn btn-primary', type: 'button', text: 'Kaydet', on: { click: save } }),
    ],
  });
}

// ---------------------------------------------------------------- bildirimler

function buildNotificationSection() {
  const permission = notify.permission();
  const statusText = {
    granted: 'İzin verildi. Uygulama açık veya arka plandayken bildirim gelir.',
    denied: 'İzin engellendi. Tarayıcı ayarlarından site izinlerinden açabilirsin.',
    default: 'Henüz izin istenmedi. Pomodoro\'yu ilk başlattığında sorulacak.',
    unsupported: 'Bu tarayıcı bildirimleri desteklemiyor.',
  }[permission];

  const children = [
    settingRow({
      title: 'Bildirim izni',
      description: statusText,
      control:
        permission === 'default'
          ? el('button', {
              class: 'btn',
              type: 'button',
              text: 'İzin ver',
              on: {
                click: async () => {
                  await notify.ensurePermission();
                  store.updateSettings({ notificationsAsked: true });
                  rebuild();
                },
              },
            })
          : el('span', {
              class: `pill ${permission === 'granted' ? 'pill-success' : permission === 'denied' ? 'pill-danger' : ''}`,
              text: permission === 'granted' ? 'Açık' : permission === 'denied' ? 'Kapalı' : '-',
            }),
    }),
  ];

  if (permission === 'granted') {
    children.push(
      settingRow({
        title: 'Deneme bildirimi gönder',
        description: 'Bildirimlerin gerçekten geldiğini görmek için.',
        control: el('button', {
          class: 'btn',
          type: 'button',
          text: 'Gönder',
          on: {
            click: async () => {
              const sent = await notify.show('YKS Takip', {
                body: 'Bildirimler çalışıyor. Pomodoro bitişlerinde böyle bir uyarı gelecek.',
                tag: 'deneme',
              });
              snack.toast(sent ? 'Bildirim gönderildi.' : 'Bildirim gönderilemedi.');
            },
          },
        }),
      }),
    );
  }

  children.push(el('div', { class: 'divider' }));
  children.push(
    el('p', {
      class: 'note-warn',
      text:
        'Uygulama tamamen kapalıyken belirli bir saatte bildirim göndermek web uygulamalarında ' +
        'güvenilir değil: gerekli tarayıcı özelliği (Notification Triggers) hiçbir tarayıcıya girmedi. ' +
        'Bu yüzden burada sahte bir zamanlayıcı yok. Kesin saatli hatırlatıcı için telefonun kendi alarm ' +
        'uygulamasını kullan.',
    }),
  );

  if (periodicSync.isSupported()) {
    const enabled = store.settings().periodicSyncEnabled === true;
    children.push(
      settingRow({
        title: 'Arka plan hatırlatıcısı (garanti değil)',
        description:
          'Tarayıcı uygun gördüğünde uygulamayı uyandırıp, o gün hiç çalışmadıysan hatırlatır. ' +
          'Saati kesin değildir, günlerce hiç çalışmayabilir.',
        control: toggle(enabled, async (value) => {
          if (value) {
            const result = await periodicSync.enable();
            store.updateSettings({ periodicSyncEnabled: result.ok });
            if (!result.ok) snack.toast(result.reason, { duration: 5200 });
            else snack.success('Kaydedildi. Tarayıcı uygun gördüğünde çalışacak.');
          } else {
            await periodicSync.disable();
            store.updateSettings({ periodicSyncEnabled: false });
          }
          rebuild();
        }),
      }),
    );
  }

  return card('Bildirimler', ...children);
}

// ---------------------------------------------------------------- cihaz

function buildDeviceSection() {
  const settings = store.settings();
  const features = [
    { label: 'Titreşim', supported: haptics.isSupported() },
    { label: 'Ekranı açık tutma', supported: wakelock.isSupported() },
    { label: 'Uygulama rozeti', supported: badge.isSupported() },
    { label: 'Bildirim', supported: notify.isSupported() },
    { label: 'Arka plan hatırlatıcı', supported: periodicSync.isSupported() },
  ];

  const featureRow = el('div', { class: 'chip-wrap' });
  for (const feature of features) {
    featureRow.appendChild(
      el('span', {
        class: `pill ${feature.supported ? 'pill-success' : ''}`,
        text: `${feature.label}: ${feature.supported ? 'var' : 'yok'}`,
      }),
    );
  }

  return card(
    'Cihaz',
    settingRow({
      title: 'Titreşimli geri bildirim',
      description: 'Kronometre, görev tamamlama ve pomodoro bitişinde kısa titreşim.',
      control: toggle(settings.hapticsEnabled !== false, (value) => {
        store.updateSettings({ hapticsEnabled: value });
        if (value) haptics.success();
      }),
    }),
    settingRow({
      title: 'Kronometre çalışırken ekran kapanmasın',
      description: 'Pil tüketimini artırır ama sayacı izlemeyi kolaylaştırır.',
      control: toggle(settings.keepScreenAwake !== false, (value) => store.updateSettings({ keepScreenAwake: value })),
    }),
    el('div', { class: 'divider' }),
    el('p', { class: 'field-label', text: 'Bu cihazda desteklenenler' }),
    featureRow,
    el('p', {
      class: 'note',
      text: 'Desteklenmeyen özellikler sessizce devre dışı kalır, uygulamanın çalışmasını engellemez.',
    }),
  );
}

// ---------------------------------------------------------------- tema

function buildThemeSection() {
  const current = store.settings().theme || 'dark';
  const seg = el('div', { class: 'seg' });
  const options = [
    { value: 'dark', label: 'Karanlık' },
    { value: 'light', label: 'Aydınlık' },
    { value: 'system', label: 'Sistem' },
  ];
  for (const option of options) {
    seg.appendChild(
      el('button', {
        class: current === option.value ? 'is-active' : '',
        type: 'button',
        text: option.label,
        on: {
          click: () => {
            store.updateSettings({ theme: option.value });
            applyTheme(option.value);
            rebuild();
          },
        },
      }),
    );
  }
  return card('Görünüm', settingRow({ title: 'Tema', description: 'Varsayılan karanlık.', control: seg }));
}

// ---------------------------------------------------------------- yedekleme

function buildBackupSection() {
  const fileInput = el('input', {
    type: 'file',
    accept: 'application/json,.json',
    style: { display: 'none' },
  });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    const result = await backup.readBackupFile(file);
    if (!result.ok) {
      snack.error(result.error);
      return;
    }
    openRestoreConfirm(result);
  });

  const counts = {
    subjects: store.subjects().length,
    sessions: store.sessions().length,
    questions: store.questions().length,
    exams: store.exams().length,
    tasks: store.tasks().length,
    habitLogs: store.habitLogs().length,
  };
  const totalRecords = Object.values(counts).reduce((sum, value) => sum + value, 0);

  const children = [
    el('p', {
      class: 'note',
      text: 'Tüm verin bu telefonun içinde. Yedeği tek JSON dosyası olarak alabilir, aynı dosyadan geri yükleyebilirsin.',
    }),
    el(
      'div',
      { class: 'btn-row' },
      el(
        'button',
        {
          class: 'btn btn-primary',
          type: 'button',
          on: {
            click: async () => {
              try {
                const result = await backup.downloadBackup();
                snack.success(`${result.fileName} indirildi (${formatCount(result.recordCount)} kayıt)`);
              } catch (err) {
                console.error(err);
                snack.error('Yedek alınamadı.');
              }
            },
          },
        },
        icon('download', 18),
        el('span', { text: 'Yedeği indir' }),
      ),
      el(
        'button',
        {
          class: 'btn',
          type: 'button',
          on: { click: () => fileInput.click() },
        },
        icon('upload', 18),
        el('span', { text: 'Geri yükle' }),
      ),
    ),
  ];

  if (backup.canShareBackup()) {
    children.push(
      el(
        'button',
        {
          class: 'btn btn-block',
          type: 'button',
          on: {
            click: async () => {
              try {
                await backup.shareBackup();
              } catch (err) {
                if (err?.name !== 'AbortError') snack.error('Paylaşılamadı.');
              }
            },
          },
        },
        icon('share', 18),
        el('span', { text: 'Yedeği başka uygulamaya gönder' }),
      ),
    );
  }

  children.push(fileInput);
  children.push(el('div', { class: 'divider' }));
  children.push(
    el('p', {
      class: 'small muted',
      text: `Şu an ${formatCount(totalRecords)} kayıt var: ${counts.sessions} çalışma, ${counts.questions} soru kaydı, ${counts.exams} deneme, ${counts.tasks} görev.`,
    }),
  );

  if (storageInfo?.usage) {
    const usedMb = (storageInfo.usage / (1024 * 1024)).toFixed(1);
    children.push(
      el('p', { class: 'note', text: `Cihazda kullanılan yer: ${usedMb} MB.` }),
    );
  }

  children.push(
    el(
      'button',
      {
        class: 'btn btn-ghost btn-block',
        type: 'button',
        on: {
          click: async () => {
            const granted = await db.requestPersistentStorage();
            snack.toast(
              granted
                ? 'Tarayıcı verini kalıcı olarak saklayacak.'
                : 'Tarayıcı kalıcı depolama izni vermedi. Yedek almayı ihmal etme.',
              { duration: 4200 },
            );
          },
        },
      },
      icon('target', 18),
      el('span', { text: 'Verimi kalıcı sakla' }),
    ),
  );

  return card('Yedekleme', ...children);
}

function openRestoreConfirm(result) {
  const summary = result.summary || summarizeBackup({});
  const lines = [
    `${summary.subjects} ders`,
    `${summary.sessions} çalışma kaydı`,
    `${summary.questions} soru kaydı`,
    `${summary.exams} deneme`,
    `${summary.tasks} görev`,
    `${summary.habits} rutin maddesi`,
  ];

  const body = [
    el('p', { class: 'small', text: 'Yedek dosyası okundu. İçindekiler:' }),
    el('div', { class: 'chip-wrap' }, ...lines.map((line) => el('span', { class: 'pill', text: line }))),
    result.exportedAt
      ? el('p', { class: 'note', text: `Yedek tarihi: ${new Date(result.exportedAt).toLocaleString('tr-TR')}` })
      : null,
    el('p', {
      class: 'note-warn',
      text: 'Geri yükleme şu andaki tüm verilerin yerine geçer. Bu işlem geri alınamaz.',
    }),
  ];

  const sheet = openSheet({
    title: 'Yedeği geri yükle',
    body,
    actions: [
      el('button', { class: 'btn btn-ghost', type: 'button', text: 'Vazgeç', on: { click: () => sheet.close() } }),
      el('button', {
        class: 'btn btn-primary',
        type: 'button',
        text: 'Geri yükle',
        on: {
          click: async () => {
            try {
              await backup.restoreBackup(result.payload);
              sheet.close();
              applyTheme(store.settings().theme);
              snack.success('Yedek geri yüklendi.');
              rebuild();
            } catch (err) {
              sheet.close();
              snack.error(err?.userMessage || 'Geri yükleme başarısız oldu.');
            }
          },
        },
      }),
    ],
  });
}

// ---------------------------------------------------------------- sifirlama

function buildDangerSection() {
  return card(
    'Tehlikeli bölge',
    el('p', {
      class: 'note',
      text: 'Tüm çalışma kayıtları, soru kayıtları, denemeler, görevler ve rutin geçmişi silinir. Dersler baştan kurulur. Önce yedek almayı düşün.',
    }),
    holdToConfirmButton({
      label: 'Tüm verileri sil (basılı tut)',
      holdMs: 1800,
      onConfirm: async () => {
        try {
          await store.resetEverything();
          haptics.alarm();
          snack.success('Her şey silindi, uygulama sıfırlandı.');
          rebuild();
        } catch (err) {
          snack.error(err?.userMessage || 'Silme işlemi başarısız oldu.');
        }
      },
    }),
  );
}

// ---------------------------------------------------------------- hakkinda

function buildAboutSection() {
  const isStandalone =
    globalThis.matchMedia?.('(display-mode: standalone)').matches ||
    globalThis.navigator?.standalone === true;

  return card(
    'Hakkında ve Sistem Bakımı',
    el('p', { class: 'small muted', text: `YKS Takip · sürüm ${APP_VERSION}` }),
    el('p', {
      class: 'note',
      text:
        'Sunucu yok, hesap yok, internet gerekmez. Bütün veriler bu tarayıcının kendi deposunda (IndexedDB) duruyor. ' +
        'Tarayıcı verilerini silersen kayıtlar da gider, bu yüzden ara ara yedek al.',
    }),
    el('div', { class: 'divider' }),
    el(
      'button',
      {
        class: 'btn btn-block',
        type: 'button',
        on: {
          click: async () => {
            snack.toast('Önbellek temizleniyor, güncel sürüm çekiliyor...');
            try {
              if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (const r of regs) await r.unregister();
              }
              if ('caches' in window) {
                const keys = await caches.keys();
                for (const k of keys) await caches.delete(k);
              }
            } catch (err) {
              console.error(err);
            }
            setTimeout(() => {
              location.reload(true);
            }, 300);
          },
        },
      },
      icon('rotate', 18),
      el('span', { text: 'Güncellemeleri Yükle & Sert Yenile' }),
    ),
    el('p', {
      class: 'field-hint',
      text: 'Telefonda Ctrl+Shift+R yapamadığında bu düğmeye dokunarak en güncel sürüme geçebilirsin. Kayıtlı verilerin silinmez.',
    }),
    el('div', { class: 'divider' }),
    isStandalone
      ? el('p', { class: 'note ok-text', text: 'Uygulama ana ekrandan açıldı, tam ekran modunda çalışıyor.' })
      : el('p', {
          class: 'note',
          text: 'Tarayıcı menüsünden "Ana ekrana ekle" dersen uygulama tam ekran açılır ve çevrimdışı çalışır.',
        }),
  );
}
