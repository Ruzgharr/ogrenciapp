// Adimli sayi girisi: klavye acmadan artir/azalt.
// Basili tutunca hizlanarak devam eder. Yaninda hizli secim cipleri kullanilabilir.

import { el } from './dom.js';
import * as haptics from '../platform/haptics.js';
import { clamp } from '../util.js';

/**
 * options: { value, min, max, step, unit, label, tight, onChange }
 * Donus: { element, get, set }
 */
export function stepper({
  value = 0,
  min = 0,
  max = 9999,
  step = 1,
  unit = '',
  tight = false,
  onChange,
} = {}) {
  let current = clamp(Number(value) || 0, min, max);

  const valueText = el('strong', { text: String(current) });
  const unitText = unit ? el('small', { text: unit }) : null;
  const display = el('div', { class: 'stepper-value', role: 'spinbutton', 'aria-valuenow': current }, valueText, unitText);

  const render = () => {
    valueText.textContent = String(current);
    display.setAttribute('aria-valuenow', current);
    minus.disabled = current <= min;
    plus.disabled = current >= max;
  };

  const apply = (next, silent = false) => {
    const clamped = clamp(next, min, max);
    if (clamped === current) return;
    current = clamped;
    render();
    if (!silent) onChange?.(current);
  };

  const makeButton = (text, delta, label) => {
    const button = el('button', { type: 'button', text, 'aria-label': label });
    let holdTimer = null;
    let repeatTimer = null;
    let speed = 260;

    const stopHold = () => {
      if (holdTimer) clearTimeout(holdTimer);
      if (repeatTimer) clearInterval(repeatTimer);
      holdTimer = null;
      repeatTimer = null;
      speed = 260;
    };

    button.addEventListener('click', () => {
      apply(current + delta);
    });

    button.addEventListener(
      'pointerdown',
      () => {
        stopHold();
        holdTimer = setTimeout(() => {
          const tick = () => {
            apply(current + delta);
            // Kademeli hizlanma
            if (speed > 60) {
              speed = Math.max(60, speed - 40);
              clearInterval(repeatTimer);
              repeatTimer = setInterval(tick, speed);
            }
          };
          repeatTimer = setInterval(tick, speed);
        }, 420);
      },
      { passive: true },
    );

    for (const event of ['pointerup', 'pointercancel', 'pointerleave']) {
      button.addEventListener(event, stopHold);
    }
    return button;
  };

  const minus = makeButton('−', -step, 'Azalt');
  const plus = makeButton('+', step, 'Artır');

  const element = el('div', { class: `stepper${tight ? ' is-tight' : ''}` }, minus, display, plus);
  render();

  return {
    element,
    get: () => current,
    set: (next, silent = true) => apply(Number(next) || 0, silent),
  };
}

/**
 * Hizli secim cipleri.
 * options: { values, unit, active, onPick, format }
 */
export function quickPicks({ values = [], unit = '', active = null, onPick, format } = {}) {
  const row = el('div', { class: 'chip-row' });
  const buttons = new Map();

  const setActive = (value) => {
    for (const [key, button] of buttons) {
      button.classList.toggle('is-active', key === value);
    }
  };

  for (const value of values) {
    const label = format ? format(value) : `${value}${unit ? ` ${unit}` : ''}`;
    const button = el('button', {
      class: `chip${value === active ? ' is-active' : ''}`,
      type: 'button',
      text: label,
      on: {
        click: () => {
          haptics.success();
          setActive(value);
          onPick?.(value);
        },
      },
    });
    buttons.set(value, button);
    row.appendChild(button);
  }

  return { element: row, setActive };
}

/**
 * Dogru / Yanlis / Bos ucluk girisi. Net degeri anlik hesaplanip gosterilir.
 * options: { correct, wrong, blank, questionCount, penalty, onChange }
 */
export function answerTriplet({ correct = 0, wrong = 0, blank = 0, max = 200, onChange } = {}) {
  const state = { correct, wrong, blank };
  const emit = () => onChange?.({ ...state });

  const make = (key, label, colorClass) => {
    const control = stepper({
      value: state[key],
      min: 0,
      max,
      step: 1,
      tight: true,
      onChange: (value) => {
        state[key] = value;
        emit();
      },
    });
    return {
      control,
      node: el(
        'div',
        { class: 'field' },
        el('span', { class: `field-label ${colorClass}`, text: label }),
        control.element,
      ),
    };
  };

  const correctControl = make('correct', 'Doğru', 'ok-text');
  const wrongControl = make('wrong', 'Yanlış', 'bad-text');
  const blankControl = make('blank', 'Boş', 'faint');

  const element = el(
    'div',
    { class: 'grid-3' },
    correctControl.node,
    wrongControl.node,
    blankControl.node,
  );

  return {
    element,
    get: () => ({ ...state }),
    set: (next) => {
      state.correct = next.correct ?? state.correct;
      state.wrong = next.wrong ?? state.wrong;
      state.blank = next.blank ?? state.blank;
      correctControl.control.set(state.correct);
      wrongControl.control.set(state.wrong);
      blankControl.control.set(state.blank);
    },
  };
}
