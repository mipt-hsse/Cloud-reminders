import {adjustText} from './stickers.js';

// Форматирование даты
function formatDeadline(date) {
  if (!date) return 'Без даты';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `Дедлайн: ${day}.${month}.${year} ${hours}:${minutes}`;
}

// === ОСНОВНАЯ ФУНКЦИЯ НАСТРОЙКИ СОБЫТИЙ ===
/**
 * @param {function|null} [onMove] - колбэк(groupId) при
 *     перемещении/трансформации
 */
export function setupReminderEvents(
    group, tr, stage, objectLayer, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE,
    MAX_TEXT_WIDTH, tempTextNode, onMove = null) {
  // 1. Надежный поиск элементов по именам (которые мы задаем при создании)
  const rect = group.findOne('.background');
  const text = group.findOne('.text');
  const datePlate = group.findOne('.date-plate');

  // Проверка на случай поврежденных данных
  if (!rect || !text || !datePlate) {
    console.warn(
        'Структура напоминания повреждена, пропускаем настройку событий',
        group);
    return;
  }

  const deadlineText = datePlate.findOne('Text');
  const plateBg = datePlate.findOne('Rect');

  const BASE_STICKER_SIZE = 200;
  const BASE_PLATE_HEIGHT = 30;
  const BASE_PLATE_FONT_SIZE = 14;
  const PLATE_MARGIN = 5;

  // ─── Drag ─────────────────────────────────────────────────────────────────
  group.off('dragmove');
  group.on('dragmove', () => {
    if (onMove) onMove(group.id());
  });
  group.off('dragend');
  group.on('dragend', () => {
    if (onMove) onMove(group.id());
  });

  // 2. Восстановление даты
  let deadlineDate;
  const savedISO = group.getAttr('deadline_iso');
  if (savedISO) {
    deadlineDate = new Date(savedISO);
  } else {
    deadlineDate = new Date(Date.now() + 86400000);  // Завтра
  }

  // --- ЛОГИКА КАЛЕНДАРЯ (Flatpickr) ---
  function openDatePicker() {
    // Создаем невидимый инпут
    const datePickerInput = document.createElement('input');
    datePickerInput.style.position = 'absolute';
    datePickerInput.style.opacity = '0';
    datePickerInput.style.pointerEvents = 'none';
    document.body.appendChild(datePickerInput);

    // Настройка Flatpickr
    const fp = flatpickr(datePickerInput, {
      enableTime: true,
      dateFormat: 'd.m.Y H:i',
      time_24hr: true,
      defaultDate: deadlineDate,
      disableMobile: 'true',  // Важно для корректной работы на мобильных
      // onClose — фиксируем финальное значение (включая введённые вручную
      // минуты)
      onClose: (selectedDates) => {
        if (selectedDates.length > 0) {
          deadlineDate = selectedDates[0];
          deadlineText.text(formatDeadline(deadlineDate));
          group.setAttr('deadline_iso', deadlineDate.toISOString());
          objectLayer.draw();
        }
        setTimeout(() => {
          fp.destroy();
          if (document.body.contains(datePickerInput)) {
            document.body.removeChild(datePickerInput);
          }
        }, 100);
      },
      onChange: (selectedDates) => {
        if (selectedDates.length > 0) {
          deadlineDate = selectedDates[0];
          deadlineText.text(formatDeadline(deadlineDate));
          group.setAttr('deadline_iso', deadlineDate.toISOString());
          objectLayer.draw();
        }
      }
    });

    // Открываем календарь
    fp.open();

    // Позиционируем календарь рядом с напоминанием
    // Получаем координаты стикера относительно окна браузера
    const groupRect = group.getClientRect();
    // Если календарь создался, двигаем его контейнер
    if (fp.calendarContainer) {
      const calendarDiv = fp.calendarContainer;
      const top = groupRect.y + groupRect.height + 10;
      const left = groupRect.x;

      // Корректируем CSS напрямую
      calendarDiv.style.top = `${top}px`;
      calendarDiv.style.left = `${left}px`;
      calendarDiv.style.zIndex = '10000';  // Поверх всего
    }
  }

  // --- ЛОГИКА РЕДАКТИРОВАНИЯ ТЕКСТА (аналогично stickers.js) ---
  function startEditing() {
    text.hide();
    datePlate.hide();
    tr.nodes([]);
    objectLayer.draw();

    // Позиция группы на экране
    const groupPos = group.getAbsolutePosition();
    const stageBox = stage.container().getBoundingClientRect();
    // rect начинается ниже плашки даты — учитываем его смещение
    const rectOffsetY = rect.y() * group.scaleY() * stage.scaleY();

    const areaPosition = {
      x: stageBox.left + groupPos.x,
      y: stageBox.top + groupPos.y + rectOffsetY,
    };

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    let lastValidText = text.text();
    textarea.value = text.text();

    Object.assign(textarea.style, {
      position: 'absolute',
      top: `${areaPosition.y}px`,
      left: `${areaPosition.x}px`,
      width: `${rect.width() * group.scaleX() * stage.scaleX()}px`,
      height: `${rect.height() * group.scaleY() * stage.scaleY()}px`,
      border: 'none',
      margin: '0',
      overflow: 'hidden',
      background: 'transparent',
      outline: 'none',
      resize: 'none',
      fontFamily: text.fontFamily(),
      color: text.fill(),
      textAlign: 'center',
      lineHeight: String(text.lineHeight()),
      boxSizing: 'border-box',
    });

    function updateTextareaStyle() {
      text.text(textarea.value || ' ');
      const fits = adjustText(
          text, rect, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH,
          tempTextNode);
      if (fits) {
        lastValidText = textarea.value;
        textarea.style.fontSize = `${text.fontSize() * stage.scaleX()}px`;
        const textHeight = text.getClientRect({skipTransform: true}).height;
        const paddingTop = (rect.height() - textHeight) / 2;
        textarea.style.paddingTop =
            `${Math.max(0, paddingTop) * stage.scaleY()}px`;
      } else {
        textarea.value = lastValidText;
        text.text(lastValidText || ' ');
        adjustText(
            text, rect, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH,
            tempTextNode);
      }
    }

    textarea.addEventListener('input', updateTextareaStyle);

    textarea.addEventListener('blur', () => {
      text.text(lastValidText);
      group.setAttr('text_content', lastValidText);
      adjustText(
          text, rect, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH,
          tempTextNode);
      // Центрируем текст вертикально
      const textHeight = text.getClientRect({skipTransform: true}).height;
      text.y(rect.y() + (rect.height() - textHeight) / 2);
      text.show();
      datePlate.show();
      if (document.body.contains(textarea)) document.body.removeChild(textarea);
      tr.nodes([group]);
      objectLayer.draw();
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        textarea.blur();
      }
      if (e.key === 'Escape') {
        textarea.value = lastValidText;
        textarea.blur();
      }
    });

    updateTextareaStyle();
    textarea.focus();
  }

  // --- ПРИВЯЗКА СОБЫТИЙ ---

  // 1. Клик по ДАТЕ (открывает календарь)
  // Важно: click должен быть на datePlate, и он должен останавливать всплытие
  datePlate.off('click tap mousedown touchstart');  // Очистка старых

  datePlate.on('mousedown touchstart', (e) => {
    e.cancelBubble = true;  // Запрещаем перетаскивание за плашку даты
  });

  datePlate.on('click tap', (e) => {
    e.cancelBubble = true;  // Запрещаем выделение стикера
    openDatePicker();
  });

  // 2. Двойной клик по ТЕЛУ стикера (редактирование текста)
  group.off('dblclick dbltap');
  group.on('dblclick dbltap', (e) => {
    // Если кликнули по дате - игнорируем (там свое событие)
    const clickedOnPlate = e.target.findAncestor('.date-plate') ||
        e.target.name() === 'date-plate';
    if (clickedOnPlate) return;

    startEditing();
  });

  // 3. Пересчет размеров при трансформации
  group.off('transformend');
  group.on('transformend', () => {
    const scaleX = group.scaleX();
    const scaleY = group.scaleY();
    group.scale({x: 1, y: 1});  // Сбрасываем масштаб, применяем к размерам

    const newSize = Math.max(100, rect.width() * Math.max(scaleX, scaleY));
    const scaleRatio = newSize / BASE_STICKER_SIZE;

    // Обновляем размеры плашки даты
    const newPlateHeight = BASE_PLATE_HEIGHT * scaleRatio;

    plateBg.width(newSize).height(newPlateHeight);
    deadlineText.width(newSize).height(newPlateHeight);
    deadlineText.fontSize(BASE_PLATE_FONT_SIZE * scaleRatio);

    // Обновляем размеры основного квадрата
    rect.width(newSize).height(newSize);
    rect.y(0);  // Сбрасываем Y, будем считать относительно группы

    // Позиционируем плашку даты (сверху или внутри, как в дизайне)
    // В addReminder дата добавляется первой, потом rect.
    // Допустим, дата сверху:
    datePlate.y(0);
    rect.y(newPlateHeight + PLATE_MARGIN * scaleRatio);

    // Позиционируем текст
    text.width(newSize - PADDING * 2);
    text.x(PADDING);

    adjustText(
        text, rect, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH,
        tempTextNode);

    // Центрируем текст вертикально в рабочей области (ниже даты)
    const textHeight = text.getClientRect({skipTransform: true}).height;
    const workAreaY = rect.y();
    const workAreaH = rect.height();
    text.y(workAreaY + (workAreaH - textHeight) / 2);

    group.clearCache();
    objectLayer.batchDraw();
    if (onMove) onMove(group.id());
  });
}


// === ФУНКЦИЯ СОЗДАНИЯ НАПОМИНАНИЯ (ASYNC) ===
export async function addReminder(
    pos, color, objectLayer, tr, stage, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE,
    MAX_TEXT_WIDTH, tempTextNode, onMove = null) {
  // 1. Создаем ID в базе данных
  let serverId = null;
  try {
    const boardId = window.DJANGO_DATA?.boardId;
    const csrftoken = window.DJANGO_DATA?.csrfToken;

    if (boardId) {
      const response = await fetch('/api/reminders/create/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken  // Используем токен из куки
        },
        credentials: 'same-origin',
        body: JSON.stringify({board_id: boardId, x: pos.x, y: pos.y})
      });

      if (response.ok) {
        if (window.API_SAVE_BOARD) {
          setTimeout(() => {
            window.API_SAVE_BOARD();
          }, 100);
        }
        const data = await response.json();
        if (data.success) serverId = data.id;
      } else {
        console.error('Ошибка сервера:', response.status);
      }
    } else {
      console.error('Board ID не найден! Напоминание будет создано локально.');
    }
  } catch (e) {
    console.error('Ошибка создания в БД', e);
  }

  // 2. Создаем группу
  const group = new Konva.Group({
    x: pos.x - 100,
    y: pos.y - 100,
    draggable: true,
    name: 'reminder-group',
    id: serverId ? serverId.toString() :
                   ('reminder_' + Date.now() + '_' +
                    Math.random().toString(36).substr(2, 7))
  });
  group.setAttr('color', color);
  group.setAttr('text_content', 'Новое напоминание');

  objectLayer.add(group);

  // Константы размеров
  const BASE_STICKER_SIZE = 200;
  const BASE_PLATE_HEIGHT = 30;
  const PLATE_MARGIN = 5;

  let deadlineDate = new Date(Date.now() + 86400000);
  group.setAttr('deadline_iso', deadlineDate.toISOString());

  // 3. Создаем Плашку Даты (с именем класса .date-plate)
  const datePlate = new Konva.Group({
    y: 0,
    name: 'date-plate'  // ВАЖНО для поиска
  });

  const plateBg = new Konva.Rect({
    width: BASE_STICKER_SIZE,
    height: BASE_PLATE_HEIGHT,
    fill: '#f0f0f0',
    stroke: '#ccc',
    cornerRadius: 5
  });

  const deadlineText = new Konva.Text({
    text: formatDeadline(deadlineDate),
    fontSize: 14,
    fill: '#333',
    width: BASE_STICKER_SIZE,
    height: BASE_PLATE_HEIGHT,
    verticalAlign: 'middle',
    align: 'center'
  });

  datePlate.add(plateBg, deadlineText);
  group.add(datePlate);

  // 4. Создаем Основной Фон (с именем .background)
  const rect = new Konva.Rect({
    x: 0,
    y: BASE_PLATE_HEIGHT + PLATE_MARGIN,
    width: BASE_STICKER_SIZE,
    height: BASE_STICKER_SIZE,
    fill: color,
    stroke: '#e6b800',
    strokeWidth: 1,
    cornerRadius: 10,
    shadowColor: 'black',
    shadowBlur: 10,
    shadowOpacity: 0.3,
    name: 'background',  // ВАЖНО для поиска
  });
  group.add(rect);

  // 5. Создаем Текст (с именем .text)
  const text = new Konva.Text({
    x: PADDING,
    y: rect.y() + PADDING,
    text: 'Новое напоминание',
    fontFamily: 'Arial',
    fill: '#000',
    align: 'center',
    name: 'text',  // ВАЖНО для поиска
    width: BASE_STICKER_SIZE - PADDING * 2,
    fontSize: 24
  });
  group.add(text);

  // 6. Подключаем события
  setupReminderEvents(
      group, tr, stage, objectLayer, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE,
      MAX_TEXT_WIDTH, tempTextNode, onMove);

  // Первичная подгонка текста
  adjustText(
      text, rect, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH,
      tempTextNode);

  // Центрируем
  const textHeight = text.getClientRect({skipTransform: true}).height;
  const workAreaH = rect.height();
  text.y(rect.y() + (workAreaH - textHeight) / 2);

  // Сразу открываем редактирование для удобства
  group.fire('dblclick');

  tr.nodes([group]);
  objectLayer.draw();
}
// Вспомогательная функция для получения CSRF токена из куки (Стандарт Django)
export function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      // Ищем куку с нужным именем
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}