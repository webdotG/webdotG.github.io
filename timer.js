// ============================================================
//  Timer — интерактивный счётчик стажа работы (бомба-таймер)
//  Считает от 23 мая 2023, 09:00 MSK до текущего момента
//  Обновляется через requestAnimationFrame (без setInterval)
// ============================================================

(function() {
  'use strict';

  // ---- Конфигурация ----
  const START_DATE = new Date(2023, 4, 23, 9, 0, 0); // 23 мая 2023, 09:00
  // Месяцы в JS: 0 = январь, 4 = май

  // ---- DOM-элементы ----
  const timerEl = document.querySelector('.timer-digits');
  if (!timerEl) return;

  // ---- Вспомогательные функции ----
  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function plural(num, one, few, many) {
    if (num % 10 === 1 && num % 100 !== 11) return one;
    if (num % 10 >= 2 && num % 10 <= 4 && (num % 100 < 10 || num % 100 >= 20)) return few;
    return many;
  }

  function formatDuration(ms) {
    if (ms < 0) return { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30.44); // средняя длина месяца
    const years = Math.floor(months / 12);

    const remMonths = months % 12;
    const remDays = Math.floor(days % 30.44);
    const remHours = hours % 24;
    const remMinutes = minutes % 60;
    const remSeconds = seconds % 60;

    return {
      years: years,
      months: remMonths,
      days: remDays,
      hours: remHours,
      minutes: remMinutes,
      seconds: remSeconds
    };
  }

  // ---- Рендеринг ----
  function render() {
    const now = new Date();
    const diff = now.getTime() - START_DATE.getTime();
    const d = formatDuration(diff);

    // Формируем строку с подсветкой
    const parts = [];

    // Годы
    if (d.years > 0) {
      parts.push(`<span class="timer-years">${d.years}</span><span class="timer-unit">г</span>`);
    }

    // Месяцы
    if (d.months > 0 || d.years > 0) {
      parts.push(`<span class="timer-months">${pad(d.months)}</span><span class="timer-unit">мес</span>`);
    }

    // Дни
    parts.push(`<span class="timer-days">${pad(d.days)}</span><span class="timer-unit">дн</span>`);

    // Часы
    parts.push(`<span class="timer-hours">${pad(d.hours)}</span><span class="timer-unit">ч</span>`);

    // Минуты
    parts.push(`<span class="timer-minutes">${pad(d.minutes)}</span><span class="timer-unit">мин</span>`);

    // Секунды (с мерцанием)
    const secClass = d.seconds % 2 === 0 ? 'timer-seconds blink' : 'timer-seconds';
    parts.push(`<span class="${secClass}">${pad(d.seconds)}</span><span class="timer-unit">сек</span>`);

    timerEl.innerHTML = parts.join(' ');
  }

  // ---- Анимация (requestAnimationFrame) ----
  let lastFrame = 0;

  function tick(timestamp) {
    // Обновляем не чаще чем раз в 200 мс (экономия ресурсов)
    if (timestamp - lastFrame > 200) {
      render();
      lastFrame = timestamp;
    }
    requestAnimationFrame(tick);
  }

  // ---- Старт ----
  // Первый рендер сразу
  render();
  // Запускаем анимацию
  requestAnimationFrame(tick);

})();