
// reminder.js с исправленной логикой сохранения пропорций
import {adjustText} from './stickers.js';

function formatDeadline(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `Дедлайн: ${day}.${month}.${year} ${hours}:${minutes}`;
}

export function addReminder(
    pos, color, objectLayer, tr, stage, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE,
    MAX_TEXT_WIDTH, tempTextNode) {
  const group = new Konva.Group({
    x: pos.x - 100,
    y: pos.y - 100,
    draggable: true,
    name: 'reminder-group'
  });
  objectLayer.add(group);
  group.moveToTop();

  const BASE_STICKER_SIZE = 200;
  const BASE_PLATE_HEIGHT = 30;
  const BASE_PLATE_FONT_SIZE = 14;
  const PLATE_MARGIN = 5;
  let deadlineDate = new Date(Date.now() + 86400000);

  const datePlate = new Konva.Group({y: 0});
  const plateBg = new Konva.Rect({
    width: BASE_STICKER_SIZE,
    height: BASE_PLATE_HEIGHT,
    fill: '#f0f0f0',
    stroke: '#ccc',
    cornerRadius: 5
  });
  const deadlineText = new Konva.Text({
    text: formatDeadline(deadlineDate),
    fontSize: BASE_PLATE_FONT_SIZE,
    fill: '#333',
    width: BASE_STICKER_SIZE,
    height: BASE_PLATE_HEIGHT,
    verticalAlign: 'middle',
    align: 'center'
  });
  datePlate.add(plateBg, deadlineText);
  group.add(datePlate);

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
    shadowOffsetX: 5,
    shadowOffsetY: 5,
    name: 'background',
  });
  group.add(rect);

  const text = new Konva.Text({
    x: rect.x() + PADDING,
    y: rect.y(),
    text: 'Новое напоминание',
    fontFamily: 'Arial',
    fill: '#000',
    align: 'center',
    name: 'text',
    visible: true,
    lineHeight: 1.2,
    fontSize: MAX_FONT_SIZE,
    wrap: 'word',
  });
  group.add(text);

  function openDatePicker() {
    const datePickerInput = document.createElement('input');
    datePickerInput.type = 'text';
    datePickerInput.style.display = 'none';
    document.body.appendChild(datePickerInput);

    const label = document.createElement('div');
    label.innerText = 'Выберите дедлайн:';
    Object.assign(label.style, {
      position: 'absolute',
      zIndex: '1002',
      background: 'white',
      padding: '5px',
      borderRadius: '3px',
      boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
    });
    document.body.appendChild(label);

    const fp = flatpickr(datePickerInput, {
      enableTime: true,
      dateFormat: 'd.m.Y H:i',
      time_24hr: true,
      defaultDate: deadlineDate,
      onReady: function(selectedDates, dateStr, instance) {
        setTimeout(() => {
          const canvasRect = stage.container().getBoundingClientRect();
          const groupRect = group.getClientRect({skipTransform: false});
          const stickerRightEdge =
              canvasRect.left + groupRect.x + groupRect.width;
          const stickerTopEdge = canvasRect.top + groupRect.y;

          label.style.left = `${stickerRightEdge + 10}px`;
          label.style.top = `${stickerTopEdge}px`;

          instance.calendarContainer.style.left = `${stickerRightEdge + 10}px`;
          instance.calendarContainer.style.top =
              `${stickerTopEdge + label.offsetHeight + 5}px`;
        }, 50);
      },
      onChange: function(selectedDates) {
        if (selectedDates.length > 0) {
          deadlineDate = selectedDates[0];
          deadlineText.text(formatDeadline(deadlineDate));
          objectLayer.draw();
        }
      },
      onClose: function() {
        setTimeout(() => {
          if (document.body.contains(label)) document.body.removeChild(label);
          fp.destroy();
          if (document.body.contains(datePickerInput))
            document.body.removeChild(datePickerInput);
        }, 0);
      }
    });
    fp.open();
  }

  function startEditing() {
    tr.nodes([]);
    text.hide();
    datePlate.hide();
    objectLayer.draw();

    const textPosition = rect.getAbsolutePosition();
    const stageBox = stage.container().getBoundingClientRect();
    const areaPosition = {
      x: stageBox.left + textPosition.x,
      y: stageBox.top + textPosition.y
    };
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    let lastValidText = text.text();
    textarea.value = text.text();

    Object.assign(textarea.style, {
      position: 'absolute',
      top: `${areaPosition.y}px`,
      left: `${areaPosition.x}px`,
      width: `${rect.width() * stage.scaleX()}px`,
      height: `${rect.height() * stage.scaleY()}px`,
      border: 'none',
      margin: '0',
      overflow: 'hidden',
      background: 'transparent',
      outline: 'none',
      resize: 'none',
      fontFamily: text.fontFamily(),
      color: text.fill(),
      boxSizing: 'border-box',
      textAlign: 'center',
      lineHeight: text.lineHeight(),
      fontSize: `${text.fontSize() * stage.scaleX()}px`,
      padding: `${PADDING * stage.scaleX()}px`,
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
        textarea.style.paddingTop = `${
            Math.max(0, (rect.height() - textHeight) / 2) * stage.scaleY()}px`;
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
      const textHeight = text.getClientRect({skipTransform: true}).height;
      text.y(rect.y() + (rect.height() - textHeight) / 2);
      text.show();
      datePlate.show();
      document.body.removeChild(textarea);
      objectLayer.draw();
      tr.nodes([group]);
      objectLayer.draw();
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        textarea.blur();
        openDatePicker();
      }
      if (e.key === 'Escape') {
        textarea.blur();
      }
    });
    updateTextareaStyle();
    textarea.focus();
  }

  group.on('transformend', (e) => {
    const scaleX = group.scaleX();
    const scaleY = group.scaleY();
    group.scale({x: 1, y: 1});

    const newSize = Math.max(50, rect.width() * Math.max(scaleX, scaleY));
    const scaleRatio = newSize / BASE_STICKER_SIZE;

    const newPlateHeight = BASE_PLATE_HEIGHT * scaleRatio;
    plateBg.width(newSize).height(newPlateHeight);
    deadlineText.width(newSize).height(newPlateHeight);
    deadlineText.fontSize(BASE_PLATE_FONT_SIZE * scaleRatio);
    datePlate.y(0);

    rect.width(newSize).height(newSize);
    rect.y(newPlateHeight + PLATE_MARGIN * scaleRatio);

    text.x(rect.x() + PADDING);
    text.width(newSize - PADDING * 2);

    adjustText(
        text, rect, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH,
        tempTextNode);

    const textHeight = text.getClientRect({skipTransform: true}).height;
    text.y(rect.y() + (rect.height() - textHeight) / 2);

    group.clearCache();
    tr.nodes([group]);
    objectLayer.batchDraw();
  });

  datePlate.on('click', () => openDatePicker());
  group.on('dragstart', () => {
    group.moveToTop();
    tr.moveToTop();
  });

  // ИЗМЕНЕНО: Добавлена логика сохранения пропорций при трансформации
  group.on('transformstart', () => {
    group.moveToTop();
    tr.moveToTop();
    tr.keepRatio(true);
    tr.enabledAnchors(['top-left', 'top-right', 'bottom-left', 'bottom-right']);
  });

  group.on('dblclick dbltap', (e) => {
    if (e.target.findAncestor('.konva-group', true) === datePlate) return;
    startEditing();
  });

  adjustText(
      text, rect, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH,
      tempTextNode);
  const textHeight = text.getClientRect({skipTransform: true}).height;
  text.y(rect.y() + (rect.height() - textHeight) / 2);
  startEditing();
  tr.nodes([group]);
  objectLayer.draw();
}
