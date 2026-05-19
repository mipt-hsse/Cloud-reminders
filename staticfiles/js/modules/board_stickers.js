import {adjustText} from './stickers.js';

const DEFAULT_SIZE = 200;
const STICKER_STROKE = '#e6b800';

export function setupBoardStickerEvents(
    group, tr, stage, objectLayer, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE,
    MAX_TEXT_WIDTH, tempTextNode, onMove = null) {
  const rect = group.findOne('.background');
  const text = group.findOne('.text');
  const hint = group.findOne('.board-hint');

  let dragMoved = false;

  group.on('dragstart', () => {
    dragMoved = false;
    rect.shadowOffsetX(10);
    rect.shadowOffsetY(10);
    rect.shadowBlur(15);
    group.moveToTop();
    tr.moveToTop();
  });
  group.on('dragmove', () => {
    dragMoved = true;
    if (onMove) onMove(group.id());
  });
  group.on('dragend', () => {
    rect.shadowOffsetX(5);
    rect.shadowOffsetY(5);
    rect.shadowBlur(10);
    if (onMove) onMove(group.id());
    if (window.API_SAVE_BOARD) window.API_SAVE_BOARD();
  });

  group.on('transformend', () => {
    const scaleX = group.scaleX();
    const scaleY = group.scaleY();
    group.scale({x: 1, y: 1});

    const newSize = Math.max(150, group.width() * scaleX, group.height() * scaleY);
    group.width(newSize);
    group.height(newSize);
    rect.width(newSize);
    rect.height(newSize);
    text.width(newSize);
    if (hint) {
      hint.width(newSize);
      hint.y(newSize - 22);
    }

    adjustText(text, rect, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode);
    tr.forceUpdate();
    group.clearCache();
    objectLayer.batchDraw();
    if (onMove) onMove(group.id());
    if (window.API_SAVE_BOARD) window.API_SAVE_BOARD();
  });

  const navigateToBoard = (e) => {
    if (dragMoved) {
      dragMoved = false;
      return;
    }
    if (e.evt.shiftKey) return;
    if (document.body.classList.contains('connect-mode') ||
        document.body.classList.contains('placement-mode')) {
      return;
    }

    const boardId = group.getAttr('linked_board_id');
    if (!boardId) return;

    e.cancelBubble = true;
    window.location.href = `/board/${boardId}/`;
  };

  group.on('click tap', navigateToBoard);
  rect.on('click tap', navigateToBoard);
  text.on('click tap', navigateToBoard);

  group.on('mouseenter', () => {
    if (!document.body.classList.contains('connect-mode')) {
      document.body.style.cursor = 'pointer';
    }
  });
  group.on('mouseleave', () => {
    document.body.style.cursor = '';
  });
}

export function renderBoardSticker(
    pos, color, objectLayer, tr, stage, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE,
    MAX_TEXT_WIDTH, tempTextNode, existingData = null, onMove = null) {
  const serverId = existingData ? existingData.id.toString() : undefined;
  const linkedBoardId = existingData ?
      String(existingData.board_id || existingData.content_payload || '') :
      '';
  const title = existingData ?
      (existingData.style?.boardTitle || existingData.title || 'Доска') :
      'Доска';

  const geo = existingData?.geometry || {};
  const w = geo.width || DEFAULT_SIZE;
  const h = geo.height || DEFAULT_SIZE;
  const rotation = geo.rotation || 0;
  const style = existingData?.style || {};
  const fill = style.fill || color || '#ffffcc';

  const group = new Konva.Group({
    x: pos.x - (existingData ? 0 : w / 2),
    y: pos.y - (existingData ? 0 : h / 2),
    scaleX: 1,
    scaleY: 1,
    width: w,
    height: h,
    rotation,
    draggable: true,
    name: 'board-sticker-group',
    id: serverId,
  });

  group.setAttr('linked_board_id', linkedBoardId);
  group.setAttr('content_payload', linkedBoardId);
  group.setAttr('boardTitle', title);

  objectLayer.add(group);
  group.moveToTop();

  const rect = new Konva.Rect({
    width: w,
    height: h,
    fill,
    stroke: STICKER_STROKE,
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
    text: title,
    fontFamily: 'Arial',
    fill: '#000',
    align: 'center',
    name: 'text',
    lineHeight: 1.2,
    fontSize: MAX_FONT_SIZE,
    wrap: 'word',
    width: w,
  });
  group.add(text);

  const hint = new Konva.Text({
    text: 'доска',
    fontFamily: 'Arial',
    fill: 'rgba(0,0,0,0.35)',
    align: 'center',
    fontSize: 11,
    width: w,
    y: h - 22,
    name: 'board-hint',
    listening: false,
  });
  group.add(hint);

  setupBoardStickerEvents(
      group, tr, stage, objectLayer, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE,
      MAX_TEXT_WIDTH, tempTextNode, onMove);

  adjustText(text, rect, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode);
  text.y(Math.max(PADDING, (h - text.height() - 18) / 2));

  tr.nodes([group]);
  objectLayer.draw();
  return group;
}

export async function createBoardStickerAt(
    pos, title, color, objectLayer, tr, stage, PADDING, MIN_FONT_SIZE,
    MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode, onMove = null) {
  const DD = window.DJANGO_DATA;
  if (!DD?.boardId) {
    console.error('Нет ID доски');
    return null;
  }

  const w = DEFAULT_SIZE;
  const h = DEFAULT_SIZE;
  const geometry = {
    x: pos.x - w / 2,
    y: pos.y - h / 2,
    width: w,
    height: h,
  };

  try {
    const response = await fetch(DD.createBoardUrl || '/api/create_board/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': DD.csrfToken || '',
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        title,
        color,
        parent_id: DD.boardId,
        geometry,
      }),
    });
    const data = await response.json();
    if (!data.success) {
      alert(data.error || 'Не удалось создать доску');
      return null;
    }

    const newData = {
      id: data.item_id,
      board_id: data.board_id,
      content_payload: String(data.board_id),
      title,
      geometry,
      style: {fill: color, boardTitle: title},
    };

    return renderBoardSticker(
        pos, color, objectLayer, tr, stage, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE,
        MAX_TEXT_WIDTH, tempTextNode, newData, onMove);
  } catch (err) {
    console.error(err);
    alert('Ошибка сети');
    return null;
  }
}
