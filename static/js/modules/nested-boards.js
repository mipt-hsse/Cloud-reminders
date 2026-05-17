const DEFAULT_SIZE = {width: 220, height: 160};

function boardUrl(boardId) {
  return `/board/${boardId}/`;
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
  } catch (e) {
    console.error('Ошибка сети:', e);
  }
}
