const DEFAULT_SIZE = {width: 220, height: 160};

// Палитра — те же цвета, что в модалке редактирования обычной доски
const COLORS = ['#ffffff', '#fff183', '#d6c3ff', '#65d3ff', '#ffab89'];

// Акцент интерфейса доски (см. board.css: ссылки breadcrumbs)
const ACCENT = '#4a90d9';

function boardUrl(boardId) {
  return `/board/${boardId}/`;
}

function canEdit() {
  return !!window.DJANGO_DATA?.canEdit;
}

// Единственный открытый редактор в момент времени
let activeEditor = null;

/**
 * Сохраняет название вложенной (дочерней) доски на сервере.
 */
async function saveBoardTitle(boardId, title) {
  try {
    const response = await fetch('/api/update_board/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': window.DJANGO_DATA.csrfToken,
      },
      credentials: 'same-origin',
      body: JSON.stringify({board_id: boardId, title}),
    });
    const data = await response.json();
    if (!data.success) {
      console.error('Не удалось сохранить название доски:', data.error);
    }
  } catch (e) {
    console.error('Ошибка сети при сохранении названия доски:', e);
  }
}

/**
 * Редактор вложенной доски — поповер под самой карточкой.
 * Структура как в окне редактирования обычной доски (название + цвет),
 * но в светлой теме интерфейса доски.
 * Открывается сразу после создания и повторно — по шестерёнке.
 */
export function openNestedBoardEditor(group, objectLayer, stage) {
  if (!canEdit() || !group) return null;
  if (activeEditor) activeEditor.close(false);

  const rect = group.findOne('.background');
  const titleText = group.findOne('.board-title');
  const childId = group.getAttr('childBoardId');

  const originalTitle =
      group.getAttr('boardTitle') || titleText?.text() || 'Новая доска';
  const originalFill =
      String(group.getAttr('fill') || rect?.fill() || '#65d3ff');
  let chosenFill = originalFill;

  // Живой предпросмотр на холсте (карточка видна — поповер её не перекрывает)
  const previewTitle = value => {
    if (titleText) titleText.text(value.trim() || 'Новая доска');
    objectLayer.batchDraw();
  };
  const previewFill = color => {
    if (rect) rect.fill(color);
    objectLayer.batchDraw();
  };

  // ─── Поповер ───
  const popover = document.createElement('div');
  Object.assign(popover.style, {
    position: 'absolute',
    zIndex: '50',
    boxSizing: 'border-box',
    width: '248px',
    padding: '14px',
    background: 'rgba(255,255,255,0.96)',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: '10px',
    boxShadow: '0 4px 18px rgba(0,0,0,0.18)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    color: '#333',
    font: '13px sans-serif',
  });

  // Заголовок + крестик
  const heading = document.createElement('div');
  heading.textContent = 'Параметры доски';
  Object.assign(heading.style, {
    fontSize: '13px',
    fontWeight: '700',
    color: '#333',
    margin: '0 0 10px',
    paddingRight: '18px',
  });

  const closeIcon = document.createElement('span');
  closeIcon.textContent = '✕';
  Object.assign(closeIcon.style, {
    position: 'absolute',
    top: '10px',
    right: '12px',
    cursor: 'pointer',
    opacity: '0.45',
    transition: '0.2s',
    fontSize: '15px',
    lineHeight: '1',
    userSelect: 'none',
  });
  closeIcon.addEventListener('mouseenter', () => {
    closeIcon.style.opacity = '1';
  });
  closeIcon.addEventListener('mouseleave', () => {
    closeIcon.style.opacity = '0.45';
  });
  closeIcon.addEventListener('click', () => close(false));

  // Форма
  const form = document.createElement('form');

  const input = document.createElement('input');
  input.type = 'text';
  input.required = true;
  input.maxLength = 200;
  input.value = originalTitle;
  Object.assign(input.style, {
    boxSizing: 'border-box',
    width: '100%',
    background: '#ffffff',
    border: '1px solid #d0d7de',
    color: '#333',
    padding: '8px 10px',
    borderRadius: '8px',
    outline: 'none',
    transition: '0.2s',
    fontSize: '14px',
  });
  input.addEventListener('focus', () => {
    input.style.borderColor = ACCENT;
    input.style.boxShadow = `0 0 0 2px rgba(74,144,217,0.15)`;
  });
  input.addEventListener('blur', () => {
    input.style.borderColor = '#d0d7de';
    input.style.boxShadow = 'none';
  });
  input.addEventListener('input', () => previewTitle(input.value));

  // Кружки цветов
  const colorsRow = document.createElement('div');
  Object.assign(colorsRow.style, {
    display: 'flex',
    gap: '8px',
    margin: '12px 0',
    justifyContent: 'center',
  });

  const swatches = [];
  const markSelected = () => {
    swatches.forEach(s => {
      const selected = s.dataset.color.toLowerCase() === chosenFill.toLowerCase();
      s.style.borderColor = selected ? ACCENT : 'transparent';
      s.style.transform = selected ? 'scale(1.15)' : 'none';
    });
  };
  COLORS.forEach(color => {
    const swatch = document.createElement('div');
    swatch.dataset.color = color;
    Object.assign(swatch.style, {
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      cursor: 'pointer',
      background: color,
      border: '2px solid transparent',
      boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)',
      transition: '0.15s',
    });
    swatch.addEventListener('click', () => {
      chosenFill = color;
      markSelected();
      previewFill(color);
    });
    swatches.push(swatch);
    colorsRow.appendChild(swatch);
  });
  markSelected();

  // Кнопка «Сохранить»
  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.textContent = 'Сохранить';
  Object.assign(saveBtn.style, {
    boxSizing: 'border-box',
    width: '100%',
    background: ACCENT,
    color: '#ffffff',
    fontWeight: '700',
    padding: '8px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    transition: '0.2s',
    fontSize: '13px',
  });
  saveBtn.addEventListener('mouseenter', () => {
    saveBtn.style.background = '#3a7bc0';
  });
  saveBtn.addEventListener('mouseleave', () => {
    saveBtn.style.background = ACCENT;
  });

  form.append(input, colorsRow, saveBtn);
  popover.append(heading, closeIcon, form);
  document.body.appendChild(popover);

  // ─── Позиционирование под карточкой ───
  const abs = group.getAbsolutePosition();
  const cardW = group.width() * (stage?.scaleX() || 1);
  const cardH = group.height() * (stage?.scaleY() || 1);
  let left = abs.x + (cardW - popover.offsetWidth) / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - popover.offsetWidth - 8));
  let top = abs.y + cardH + 8;
  if (top + popover.offsetHeight > window.innerHeight - 8) {
    top = abs.y - popover.offsetHeight - 8;  // не влезло снизу — показываем сверху
  }
  top = Math.max(8, top);
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;

  input.focus();
  input.select();

  // ─── Поведение ───
  function close(commit) {
    if (activeEditor !== api) return;
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('keydown', onKey, true);
    popover.remove();
    activeEditor = null;

    if (!commit) {
      // Откат предпросмотра
      previewTitle(originalTitle);
      previewFill(originalFill);
      return;
    }

    const newTitle = input.value.trim() || 'Новая доска';
    if (titleText) titleText.text(newTitle);
    group.setAttr('boardTitle', newTitle);
    if (rect) rect.fill(chosenFill);
    group.setAttr('fill', chosenFill);
    objectLayer.batchDraw();

    const titleChanged = newTitle !== originalTitle;
    const fillChanged = chosenFill.toLowerCase() !== originalFill.toLowerCase();
    if (titleChanged && childId) saveBoardTitle(childId, newTitle);
    if ((titleChanged || fillChanged) && window.API_SAVE_BOARD) {
      window.API_SAVE_BOARD();
    }
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    close(true);
  });

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close(false);
    }
  }
  document.addEventListener('keydown', onKey, true);

  function onOutside(e) {
    if (!popover.contains(e.target)) close(true);
  }
  // setTimeout — чтобы клик/тап, открывший редактор, его же не закрыл
  setTimeout(() => document.addEventListener('mousedown', onOutside, true), 0);

  const api = {close};
  activeEditor = api;
  return api;
}

export function setupNestedBoardEvents(group, tr, stage, objectLayer, onMove = null) {
  group.on('dragstart', () => {
    group.moveToTop();
    tr.moveToTop();
  });
  group.on('dragend', () => {
    if (onMove) onMove(group.id());
    if (window.API_SAVE_BOARD) window.API_SAVE_BOARD();
  });
  group.on('dragmove', () => {
    if (onMove) onMove(group.id());
  });

  group.on('transformend', () => {
    const scaleX = group.scaleX();
    const scaleY = group.scaleY();
    group.scale({x: 1, y: 1});

    const newW = Math.max(160, group.width() * scaleX);
    const newH = Math.max(120, group.height() * scaleY);
    group.width(newW);
    group.height(newH);

    const rect = group.findOne('.background');
    const titleText = group.findOne('.board-title');
    const hintText = group.findOne('.open-hint');
    const gear = group.findOne('.edit-gear');
    if (rect) {
      rect.width(newW);
      rect.height(newH);
    }
    if (titleText) {
      titleText.width(newW - 24);
      titleText.y(newH - 52);
    }
    if (hintText) {
      hintText.y(newH - 28);
    }
    if (gear) {
      gear.x(newW - 30);
    }

    tr.forceUpdate();
    objectLayer.batchDraw();
    if (onMove) onMove(group.id());
    if (window.API_SAVE_BOARD) window.API_SAVE_BOARD();
  });

  group.on('dblclick dbltap', e => {
    e.cancelBubble = true;
    const childId = group.getAttr('childBoardId');
    if (childId) window.location.href = boardUrl(childId);
  });

  // Шестерёнка: плавно появляется при наведении на карточку
  const gear = group.findOne('.edit-gear');
  if (gear) {
    group.on('mouseenter', () => {
      if (canEdit()) {
        gear.to({opacity: 1, duration: 0.18});
      }
    });
    group.on('mouseleave', () => {
      gear.to({opacity: 0, duration: 0.18});
    });
    // Клик по шестерёнке не должен начинать drag/открытие доски
    gear.on('mousedown touchstart', e => {
      e.cancelBubble = true;
    });
    gear.on('click tap', e => {
      e.cancelBubble = true;
      openNestedBoardEditor(group, objectLayer, stage);
    });
    gear.on('mouseenter', () => {
      stage.container().style.cursor = 'pointer';
    });
    gear.on('mouseleave', () => {
      stage.container().style.cursor = 'default';
    });
  }
}

export function renderNestedBoard(
    pos, objectLayer, tr, stage, extraData = {}, onMove = null) {
  const geom = extraData.geometry || {};
  const w = geom.width || DEFAULT_SIZE.width;
  const h = geom.height || DEFAULT_SIZE.height;
  const x = geom.x ?? pos.x - w / 2;
  const y = geom.y ?? pos.y - h / 2;
  const fill = extraData.style?.fill || '#65d3ff';
  const title = extraData.linked_board_title || extraData.content || 'Новая доска';
  const childBoardId = extraData.linked_board_id ||
      parseInt(extraData.content || extraData.content_payload || '0', 10);

  const group = new Konva.Group({
    x,
    y,
    width: w,
    height: h,
    draggable: true,
    name: 'nested-board-group',
    childBoardId,
    boardTitle: title,
    // fill хранится как атрибут группы, чтобы save_board сохранял цвет в style
    fill,
  });

  if (extraData.id) group.id(String(extraData.id));

  const rect = new Konva.Rect({
    width: w,
    height: h,
    fill,
    cornerRadius: 16,
    stroke: '#2c5282',
    strokeWidth: 2,
    shadowColor: 'black',
    shadowBlur: 12,
    shadowOpacity: 0.2,
    shadowOffsetX: 4,
    shadowOffsetY: 4,
    name: 'background',
  });
  group.add(rect);

  const iconBg = new Konva.Rect({
    x: 14,
    y: 12,
    width: 40,
    height: 40,
    fill: 'rgba(255,255,255,0.45)',
    cornerRadius: 10,
    listening: false,
    name: 'board-icon-bg',
  });
  group.add(iconBg);

  const icon = new Konva.Text({
    x: 22,
    y: 18,
    text: '▦',
    fontSize: 26,
    fill: '#1a365d',
    listening: false,
    name: 'board-icon',
  });
  group.add(icon);

  const titleText = new Konva.Text({
    x: 12,
    y: h - 52,
    width: w - 24,
    text: title,
    fontFamily: 'Arial',
    fontSize: 16,
    fontStyle: 'bold',
    fill: '#1a202c',
    wrap: 'word',
    ellipsis: true,
    listening: false,
    name: 'board-title',
  });
  group.add(titleText);

  const hint = new Konva.Text({
    x: 12,
    y: h - 28,
    text: 'Двойной клик — открыть',
    fontFamily: 'Arial',
    fontSize: 11,
    fill: 'rgba(26, 32, 44, 0.55)',
    listening: false,
    name: 'open-hint',
  });
  group.add(hint);

  // Шестерёнка настроек (правый верхний угол), плавно появляется при наведении
  const gear = new Konva.Text({
    x: w - 30,
    y: 8,
    text: '⚙',
    fontSize: 20,
    fill: '#2d3748',
    opacity: 0,
    shadowColor: 'white',
    shadowBlur: 3,
    shadowOpacity: 0.85,
    name: 'edit-gear',
  });
  group.add(gear);

  objectLayer.add(group);
  setupNestedBoardEvents(group, tr, stage, objectLayer, onMove);
  return group;
}

export async function addNestedBoard(pos, objectLayer, tr, stage, onMove = null) {
  const boardId = window.DJANGO_DATA?.boardId;
  if (!boardId || !window.DJANGO_DATA?.canEdit) {
    console.error('Нет прав или ID доски');
    return;
  }

  const geometry = {
    x: pos.x - DEFAULT_SIZE.width / 2,
    y: pos.y - DEFAULT_SIZE.height / 2,
    width: DEFAULT_SIZE.width,
    height: DEFAULT_SIZE.height,
  };

  try {
    const response = await fetch('/api/create_reminder/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': window.DJANGO_DATA.csrfToken,
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        board_id: boardId,
        item_type: 'nested_board',
        geometry,
        style: {fill: '#65d3ff'},
        title: 'Новая доска',
      }),
    });

    const data = await response.json();
    if (!data.success) {
      console.error('Ошибка создания вложенной доски:', data.error);
      return;
    }

    const extraData = {
      id: data.id,
      linked_board_id: data.linked_board_id,
      linked_board_title: data.linked_board_title,
      geometry,
      style: {fill: '#65d3ff'},
    };

    const group = renderNestedBoard(pos, objectLayer, tr, stage, extraData, onMove);
    tr.nodes([group]);
    objectLayer.draw();
    if (window.API_SAVE_BOARD) window.API_SAVE_BOARD();

    // Редактирование начинается сразу после создания
    openNestedBoardEditor(group, objectLayer, stage);
  } catch (e) {
    console.error('Ошибка сети:', e);
  }
}
