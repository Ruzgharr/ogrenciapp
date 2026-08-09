import { el, icon, replaceChildren } from './dom.js';
import * as store from '../store.js';
import { uuid } from '../util.js';
import * as snack from './snack.js';
import { openSheet } from './sheet.js';
import * as haptics from '../platform/haptics.js';
import { formatDayLong } from '../core/dates.js';

let container = null;
let searchTimer = null;

// Anki benzeri seviye katsayilari (gun)
const LEVELS = [0, 1, 3, 7, 14, 30, 90]; 

export function render(root) {
  container = root;
  rebuild();
}

export function onEnter() {
  rebuild();
}

export function onLeave() {}

function rebuild() {
  if (!container) return;

  const allWords = store.words();
  const now = Date.now();
  
  // Bugun tekrari gelmis kelimeler
  const dueWords = allWords.filter(w => !w.nextReview || w.nextReview <= now);
  
  replaceChildren(
    container,
    buildHeader(dueWords.length),
    buildAddSection(),
    buildDueSection(dueWords),
    buildListSection(allWords)
  );
}

function buildHeader(dueCount) {
  return el(
    'div',
    { class: 'screen-head' },
    el('div', {}, 
      el('p', { class: 'eyebrow', text: dueCount > 0 ? `${dueCount} kelime bekliyor` : 'Harika! Tekrar kalmadı.' }),
      el('h1', { text: 'Kelimeler' })
    )
  );
}

function buildAddSection() {
  const input = el('input', {
    type: 'text',
    class: 'input',
    placeholder: 'Yeni kelime ekle...',
    style: { width: '100%', fontSize: '18px', padding: '16px' }
  });

  const suggestions = el('div', { class: 'suggestions-list', style: { marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' } });

  input.addEventListener('input', () => {
    const val = input.value.trim();
    if (val.length < 2) {
      replaceChildren(suggestions);
      return;
    }
    
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => fetchSuggestions(val, suggestions, input), 500);
  });

  return el(
    'div',
    { class: 'card', style: { marginBottom: '24px' } },
    input,
    suggestions
  );
}

async function fetchSuggestions(query, containerEl, inputEl) {
  try {
    replaceChildren(containerEl, el('p', { class: 'text-sm text-muted', text: 'Aranıyor...' }));
    
    // İngilizce dictionary API (Ucretsiz)
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(query)}`);
    if (!res.ok) {
      replaceChildren(containerEl, buildManualAdd(query, inputEl, containerEl));
      return;
    }

    const data = await res.json();
    if (!data || !data.length) {
      replaceChildren(containerEl, buildManualAdd(query, inputEl, containerEl));
      return;
    }

    const firstEntry = data[0];
    const meanings = [];
    firstEntry.meanings.forEach(m => {
      m.definitions.forEach(d => {
        if (meanings.length < 3) meanings.push(`${m.partOfSpeech}: ${d.definition}`);
      });
    });

    const suggestions = meanings.map(meaning => {
      const btn = el('button', { class: 'btn btn-ghost', style: { textAlign: 'left', justifyContent: 'flex-start', padding: '12px' } }, 
        el('strong', { text: firstEntry.word, style: { marginRight: '8px' } }),
        el('span', { class: 'text-sm text-muted', text: meaning, style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } })
      );
      btn.addEventListener('click', () => {
        saveWord(firstEntry.word, meaning);
        inputEl.value = '';
        replaceChildren(containerEl);
      });
      return btn;
    });

    replaceChildren(containerEl, ...suggestions, buildManualAdd(query, inputEl, containerEl));

  } catch (err) {
    console.error(err);
    replaceChildren(containerEl, buildManualAdd(query, inputEl, containerEl));
  }
}

function buildManualAdd(word, inputEl, containerEl) {
  const wrapper = el('div', { style: { display: 'flex', gap: '8px', marginTop: '8px' } });
  const meaningInput = el('input', { type: 'text', class: 'input', placeholder: 'Anlamını kendin yaz...' });
  const btn = el('button', { class: 'btn btn-primary', text: 'Ekle' });
  
  btn.addEventListener('click', () => {
    if (!meaningInput.value.trim()) return;
    saveWord(word, meaningInput.value.trim());
    inputEl.value = '';
    replaceChildren(containerEl);
  });

  wrapper.appendChild(meaningInput);
  wrapper.appendChild(btn);
  return wrapper;
}

function saveWord(word, meaning) {
  store.add('words', {
    id: uuid(),
    word,
    meaning,
    level: 0,
    nextReview: Date.now(), // Hemen tekrar kuyruguna girsin
    createdAt: Date.now()
  });
  haptics.success();
  snack.success('Kelime eklendi!');
  rebuild();
}

function buildDueSection(dueWords) {
  if (dueWords.length === 0) return null;

  const btn = el('button', { class: 'btn btn-primary', style: { width: '100%', padding: '24px', fontSize: '20px', marginBottom: '24px' } }, 
    icon('flame', 24), el('span', { text: `Günün Kelimelerini Çalış (${dueWords.length})`, style: { marginLeft: '8px' } })
  );

  btn.addEventListener('click', () => startStudySession(dueWords));

  return btn;
}

function startStudySession(words) {
  let currentIndex = 0;
  
  function renderCard(sheetContent) {
    if (currentIndex >= words.length) {
      replaceChildren(sheetContent, el('div', { style: { textAlign: 'center', padding: '40px 20px' } }, 
        icon('check-circle', 64, { color: 'var(--brand)' }),
        el('h2', { text: 'Harika!', style: { marginTop: '16px' } }),
        el('p', { class: 'text-muted', text: 'Bugünkü tüm tekrarları bitirdin.' })
      ));
      rebuild();
      return;
    }

    const currentWord = words[currentIndex];
    
    const wordTitle = el('h1', { text: currentWord.word, style: { fontSize: '48px', textAlign: 'center', margin: '40px 0' } });
    
    const meaningBox = el('div', { class: 'card', style: { textAlign: 'center', marginBottom: '40px', padding: '40px 20px', display: 'none' } }, 
      el('p', { text: currentWord.meaning, style: { fontSize: '24px' } })
    );

    const showBtn = el('button', { class: 'btn btn-primary', style: { width: '100%', padding: '16px' }, text: 'Anlamını Gör' });
    
    const actions = el('div', { style: { display: 'none', gap: '8px' } });
    
    const btnHard = el('button', { class: 'btn', style: { flex: 1, backgroundColor: 'rgba(248,113,113,0.2)', color: '#f87171' }, text: 'Zor (Tekrar et)' });
    const btnMid = el('button', { class: 'btn', style: { flex: 1, backgroundColor: 'rgba(250,204,21,0.2)', color: '#facc15' }, text: 'Orta (1 Gün)' });
    const btnEasy = el('button', { class: 'btn', style: { flex: 1, backgroundColor: 'rgba(52,211,153,0.2)', color: '#34d399' }, text: `Kolay (${LEVELS[Math.min(currentWord.level + 1, LEVELS.length - 1)]} Gün)` });

    showBtn.addEventListener('click', () => {
      meaningBox.style.display = 'block';
      showBtn.style.display = 'none';
      actions.style.display = 'flex';
    });

    const handleAnswer = (quality) => {
      let nextLvl = currentWord.level;
      if (quality === 'hard') nextLvl = 0;
      else if (quality === 'mid') nextLvl = Math.max(1, currentWord.level);
      else if (quality === 'easy') nextLvl = Math.min(currentWord.level + 1, LEVELS.length - 1);

      const daysToAdd = LEVELS[nextLvl];
      const nextReview = Date.now() + (daysToAdd === 0 ? 10 * 60000 : daysToAdd * 86400000); // Zor ise 10 dk sonra, digerleri gun bazinda

      store.update('words', currentWord.id, {
        level: nextLvl,
        nextReview: nextReview
      });

      currentIndex++;
      renderCard(sheetContent);
    };

    btnHard.addEventListener('click', () => handleAnswer('hard'));
    btnMid.addEventListener('click', () => handleAnswer('mid'));
    btnEasy.addEventListener('click', () => handleAnswer('easy'));

    actions.appendChild(btnHard);
    actions.appendChild(btnMid);
    actions.appendChild(btnEasy);

    replaceChildren(sheetContent, wordTitle, meaningBox, showBtn, actions);
  }

  const container = el('div', { style: { minHeight: '300px' } });
  openSheet({ title: 'Kelime Çalışması', body: container });
  renderCard(container);
}

function buildListSection(allWords) {
  if (allWords.length === 0) return null;

  const list = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } });

  // İleri tarihli tekrarları siralama
  allWords.sort((a, b) => (a.nextReview || 0) - (b.nextReview || 0)).forEach(w => {
    const deleteBtn = el('button', { class: 'btn btn-icon btn-ghost', style: { color: '#f87171', marginLeft: '8px' } }, icon('trash', 18));
    deleteBtn.addEventListener('click', () => {
      store.softDelete('words', w.id);
      haptics.success();
      snack.toast('Kelime silindi');
      rebuild();
    });

    const card = el('div', { class: 'card', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      el('div', { style: { flex: 1 } }, 
        el('strong', { text: w.word }),
        el('p', { class: 'text-sm text-muted', text: w.meaning })
      ),
      el('div', { style: { display: 'flex', alignItems: 'center' } },
        el('div', { class: 'text-sm text-muted', style: { textAlign: 'right' } },
          el('span', { text: w.level > 0 ? `Seviye ${w.level}` : 'Yeni' }),
          el('br'),
          el('span', { text: w.nextReview > Date.now() ? `${Math.ceil((w.nextReview - Date.now())/86400000)} gün sonra` : 'Şimdi' })
        ),
        deleteBtn
      )
    );
    list.appendChild(card);
  });

  return el('div', {}, 
    el('h3', { text: 'Tüm Kelimeler', style: { marginBottom: '16px' } }),
    list
  );
}
