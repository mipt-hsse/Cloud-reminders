import {ConnectionsManager} from './modules/connections.js';
import {setBrushColor, setBrushSize, setBrushType, setEraserSize, setupDrawing} from './modules/drawing.js';
import {addReminder, renderReminder, setupReminderEvents} from './modules/reminder.js';
import {setTool} from './modules/selection.js';
import {addSticker, renderSticker, setupStickerEvents} from './modules/stickers.js';
import {addTextField, renderText, hideTextToolbar, setupTextEvents, setupTextToolbarHandlers, updateTextToolbar} from './modules/text.js';
import {applyTheme, THEMES} from './modules/themes.js';
import {rgbToHex} from './modules/utils.js';

document.addEventListener('DOMContentLoaded', function() {
  let stage;
  let gridLayer, objectLayer, drawingLayer, connectionsLayer;
  let tr;
  let connectionsManager = null;

  // ─── Состояние ────────────────────────────────────────────────────────────
  let tool = {current: 'selection'};
  let stickerColor = '#ffffcc';
  let brushType = {current: 'pen'};
  let brushColor = {current: '#000000'};
  let brushSize = {current: 2};
  let eraserSize = {current: 20};
  let isPanning = {current: false};
  let lastPointerPosition = {current: {x: 0, y: 0}};
  let isDrawing = {current: false};
  let currentLine = {current: null};
  let currentTheme = {current: 'classic'};

  // Состояние инструмента «соединение»
  let pendingConnection = {source: null};
  let connectionColor = {current: '#4a90d9'};
  let connectionStyle = {current: 'solid'};

  const PADDING = 10;
  const MIN_FONT_SIZE = 8;
  const MAX_FONT_SIZE = 75;
  const MAX_TEXT_WIDTH = 180;
  const MIN_SCALE = 0.05, MAX_SCALE = 8.0, SCALE_BY = 1.1;
  const tempTextNode = new Konva.Text({fontFamily: 'Arial', text: ''});

  // ─── UI-элементы ──────────────────────────────────────────────────────────
  const selectionBtn = document.getElementById('selection-tool-btn');
  const addBtn = document.getElementById('add-sticker-btn');
  const addReminderBtn = document.getElementById('add-reminder-btn');
  const textBtn = document.getElementById('text-tool-btn');
  const drawBtn = document.getElementById('draw-tool-btn');
  const eraserBtn = document.getElementById('eraser-tool-btn');
  const deleteBtn = document.getElementById('delete-btn');
  const saveBtn = document.getElementById('save-board-btn');
  const connectBtn = document.getElementById('connect-tool-btn');
  const themeBtn = document.getElementById('theme-btn');
  const themePanel = document.getElementById('theme-panel');

  const stickerColorPalette = document.getElementById('color-palette');
  const drawingOptions = document.getElementById('drawing-options');
  const eraserOptions = document.getElementById('eraser-options');
  const connectionOptions = document.getElementById('connection-options');
  const penBtn = document.getElementById('pen-btn');
  const highlighterBtn = document.getElementById('highlighter-btn');
  const brushColorInput = document.getElementById('brush-color-input');
  const brushSizeSlider = document.getElementById('brush-size-slider');
  const eraserSizeSlider = document.getElementById('eraser-size-slider');
  const textToolbar = document.getElementById('text-toolbar');
  const fontSizeInput = document.getElementById('font-size-input');
  const boldBtn = document.getElementById('bold-btn');
  const italicBtn = document.getElementById('italic-btn');
  const underlineBtn = document.getElementById('underline-btn');
  const textHighlightColorInput =
      document.getElementById('text-highlight-color-input');
  const connColorInput = document.getElementById('connection-color-input');
  const connStyleSelect = document.getElementById('connection-style-select');

  const boardEl = document.getElementById('sticker-board');

  // ─── Колбэк обновления нитей ─────────────────────────────────────────────
  const onMoveCallback = (groupId) => {
    if (connectionsManager) connectionsManager.updateForGroup(groupId);
  };

  // ─── doSetTool ────────────────────────────────────────────────────────────
  const doSetTool = (newTool) => {
    if (!stage) return;

    // Отменяем незавершённое соединение
    if (newTool !== 'connect' && pendingConnection.source) {
      cancelPendingConnection();
    }

    setTool(
        newTool, tool, stage, objectLayer, drawingLayer, stickerColorPalette,
        drawingOptions, eraserOptions, tr, () => hideTextToolbar(textToolbar),
        drawGrid, isPanning, lastPointerPosition, setupDrawing, brushColor,
        brushSize, eraserSize, brushType, isDrawing, currentLine,
        connectionOptions);
  };

  // ─── Инициализация сцены ─────────────────────────────────────────────────
  if (window.DJANGO_DATA && window.DJANGO_DATA.boardData) {
    setTimeout(() => initStage(window.DJANGO_DATA.boardData), 50);
  } else {
    initStage();
  }

  function initStage(fromJSON = null) {
    if (stage) stage.destroy();

    const boardData = fromJSON && Array.isArray(fromJSON.items) ? fromJSON : null;
    const savedSettings = boardData?.settings || {};

    if (fromJSON && !boardData) {
      stage = Konva.Node.create(fromJSON, 'sticker-board');

      // Ищем слои по имени (устойчиво к изменению порядка)
      const layers = stage.getLayers();
      const byName = name => layers.find(l => l.name() === name);

      gridLayer = byName('grid-layer') || layers[0];
      connectionsLayer = byName('connections-layer');
      drawingLayer = byName('drawing-layer') || layers[layers.length - 2];
      objectLayer = byName('object-layer') || layers[layers.length - 1];

      if (!connectionsLayer) {
        // Старый формат без слоя соединений — создаём
        connectionsLayer =
            new Konva.Layer({name: 'connections-layer', listening: true});
        stage.add(connectionsLayer);
        connectionsLayer.zIndex(1);  // между grid и drawing
      } else {
        // Очищаем устаревшие визуальные стрелки из JSON
        connectionsLayer.destroyChildren();
      }

      tr = objectLayer.findOne('Transformer');

    } else {
      stage = new Konva.Stage({
        container: 'sticker-board',
        width: window.innerWidth,
        height: window.innerHeight,
        draggable: false,
      });

      gridLayer = new Konva.Layer({listening: false, name: 'grid-layer'});
      connectionsLayer =
          new Konva.Layer({listening: true, name: 'connections-layer'});
      drawingLayer = new Konva.Layer({name: 'drawing-layer'});
      objectLayer = new Konva.Layer({name: 'object-layer'});
      stage.add(gridLayer, connectionsLayer, drawingLayer, objectLayer);

      tr = new Konva.Transformer({
        rotateEnabled: false,
        anchorSize: 12,
        anchorCornerRadius: 6,
        borderStroke: '#007bff',
        anchorStroke: '#007bff',
        anchorFill: 'white',
        keepRatio: false,
        enabledAnchors:
            ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      });
      objectLayer.add(tr);
    }

    if (savedSettings.connectionData) {
      stage.setAttr('connectionData', savedSettings.connectionData);
    }
    if (savedSettings.boardTheme) {
      stage.setAttr('boardTheme', savedSettings.boardTheme);
    }

    // Менеджер соединений
    connectionsManager = new ConnectionsManager(connectionsLayer, objectLayer);

    // Применяем тему
    const savedTheme =
        (fromJSON || boardData) ? (stage.getAttr('boardTheme') || 'classic') : 'classic';
    applyTheme(savedTheme, boardEl, currentTheme);
    _syncThemeUI(savedTheme);

    stage.off('dragmove');
    drawGrid();
    stage.on('dragmove', drawGrid);

    bindStageEvents(stage, objectLayer, drawingLayer, tr, tempTextNode);

    if (boardData) {
      renderBoardItems(boardData.items);
      const connData = stage.getAttr('connectionData');
      if (connData) connectionsManager.deserialize(connData);
      stage.batchDraw();
    } else if (fromJSON) {
      const connData = stage.getAttr('connectionData');
      if (connData) connectionsManager.deserialize(connData);

      // Гидратация событий
      objectLayer.find('.sticker-group').forEach(group => {
        setupStickerEvents(
            group, tr, stage, objectLayer, PADDING, MIN_FONT_SIZE,
            MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode, onMoveCallback);
      });
      objectLayer.find('.reminder-group').forEach(group => {
        setupReminderEvents(
            group, tr, stage, objectLayer, PADDING, MIN_FONT_SIZE,
            MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode, onMoveCallback);
      });
      objectLayer.find('.text-object').forEach(node => {
        setupTextEvents(node, objectLayer, tr, stage);
      });
      stage.batchDraw();
    }

    doSetTool('selection');
  }

  function renderBoardItems(items) {
    if (!Array.isArray(items)) return;

    items.forEach(item => {
      const pos = {x: item.geometry?.x || 0, y: item.geometry?.y || 0};
      const extraData = {
        id: item.id,
        geometry: item.geometry || {},
        style: item.style || {},
        content: item.content_payload || '',
        task_data: item.task_data || {},
      };

      switch (item.item_type) {
        case 'task':
          renderReminder(
              pos, extraData.style.fill || '#ffffcc', objectLayer, tr, stage,
              PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH,
              tempTextNode, extraData, onMoveCallback);
          break;
        case 'sticker':
          renderSticker(
              pos, extraData.style.fill || '#ffffcc', objectLayer, tr, stage,
              PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH,
              tempTextNode, extraData, onMoveCallback);
          break;
        case 'text':
          renderText(pos, objectLayer, tr, stage, extraData);
          break;
        case 'drawing':
          if (Array.isArray(item.geometry?.points)) {
            const line = new Konva.Line({
              id: item.id.toString(),
              name: 'stroke-object',
              points: item.geometry.points,
              stroke: extraData.style.stroke || '#000000',
              strokeWidth: extraData.style.strokeWidth || 2,
              hitStrokeWidth: Math.max(20, (extraData.style.strokeWidth || 5) + 10),
              tension: 0.5,
              lineCap: 'round',
              lineJoin: 'round',
              globalCompositeOperation:
                  extraData.style.globalCompositeOperation || 'source-over',
              opacity: extraData.style.opacity || 1,
              draggable: true,
              x: item.geometry.x || 0,
              y: item.geometry.y || 0,
              scaleX: item.geometry.scaleX || 1,
              scaleY: item.geometry.scaleY || 1,
              rotation: item.geometry.rotation || 0,
              listening: true,
            });
            line.on('dragend transformend', () => {
              if (window.API_SAVE_BOARD) window.API_SAVE_BOARD();
            });
            drawingLayer.add(line);
          }
          break;
        default:
          console.warn(`Неизвестный тип элемента: ${item.item_type}`, item);
      }
    });

    objectLayer.draw();
    drawingLayer.draw();
  }

  // ─── Рисование сетки (учитывает тему) ────────────────────────────────────
  function getNiceStep(e) {
    const t = Math.floor(Math.log10(e)), o = Math.pow(10, t);
    return e / o > 5 ? 10 * o : e / o > 2 ? 5 * o : e / o > 1 ? 2 * o : o;
  }

  function drawGrid() {
    if (!gridLayer) return;
    const theme = THEMES[currentTheme.current] || THEMES.classic;
    const minorColor = theme.gridMinor;
    const majorColor = theme.gridMajor;

    gridLayer.destroyChildren();
    const e = stage.scaleX(), t = 1 / e, o = {
      x1: -stage.x() / e,
      y1: -stage.y() / e,
      x2: (stage.width() - stage.x()) / e,
      y2: (stage.height() - stage.y()) / e,
    };
    const a = 60 / e, i = getNiceStep(a), r = i / 5, d = r * e;
    const s = Math.min(1, Math.max(0, (d - 15) / (30 - 15)));
    const draw = (step, color, opacity) => {
      if (!step || opacity <= 0) return;
      const dx = Math.floor(o.x1 / step) * step;
      for (let x = dx; x < o.x2; x += step)
        gridLayer.add(new Konva.Line({
          points: [x, o.y1, x, o.y2],
          stroke: color,
          strokeWidth: t,
          opacity
        }));
      const dy = Math.floor(o.y1 / step) * step;
      for (let y = dy; y < o.y2; y += step)
        gridLayer.add(new Konva.Line({
          points: [o.x1, y, o.x2, y],
          stroke: color,
          strokeWidth: t,
          opacity
        }));
    };
    s > 0 && draw(r, minorColor, s);
    draw(i, majorColor, 1);
    gridLayer.batchDraw();
  }

  // ─── Соединение: отмена ───────────────────────────────────────────────────
  function cancelPendingConnection() {
    if (!pendingConnection.source) return;
    const bg = pendingConnection.source.findOne('.background');
    if (bg) {
      bg.stroke(bg.getAttr('_savedStroke') || '#e6b800');
      bg.strokeWidth(bg.getAttr('_savedStrokeWidth') || 1);
      objectLayer.batchDraw();
    }
    if (connectionsManager) connectionsManager.hidePreview();
    pendingConnection.source = null;
  }

  // ─── Обработчики сцены ───────────────────────────────────────────────────
  function bindStageEvents(
      stageInstance, objLayer, drawLayer, trans, tempNode) {
    stageInstance.off('click tap wheel mousemove.connect');

    // ── Клик / тап ──
    stageInstance.on('click tap', function(e) {
      if (e.evt.button === 2) return;
      if (document.querySelector('body > textarea')) return;

      // Скрываем ручку изгиба при клике не по нити
      if (!e.target.hasName('connection-arrow') &&
          !e.target.hasName('connection-handle')) {
        connectionsManager?.hideAllHandles();
      }

      const transform = stageInstance.getAbsoluteTransform().copy().invert();
      const pos = transform.point(stageInstance.getPointerPosition());

      // ── Инструмент «Соединение» ──
      if (tool.current === 'connect') {
        const clickedGroup =
            e.target.findAncestor('.sticker-group, .reminder-group') ||
            (e.target.hasName &&
                     (e.target.hasName('sticker-group') ||
                      e.target.hasName('reminder-group')) ?
                 e.target :
                 null);

        if (clickedGroup) {
          if (!pendingConnection.source) {
            // Выбираем источник
            pendingConnection.source = clickedGroup;
            const bg = clickedGroup.findOne('.background');
            if (bg) {
              bg.setAttr('_savedStroke', bg.stroke());
              bg.setAttr('_savedStrokeWidth', bg.strokeWidth());
              bg.stroke('#007bff');
              bg.strokeWidth(3);
              objLayer.batchDraw();
            }
          } else if (pendingConnection.source !== clickedGroup) {
            // Создаём соединение
            connectionsManager.addConnection(
                pendingConnection.source, clickedGroup, connectionColor.current,
                connectionStyle.current);
            // Восстанавливаем вид источника
            const bg = pendingConnection.source.findOne('.background');
            if (bg) {
              bg.stroke(bg.getAttr('_savedStroke') || '#e6b800');
              bg.strokeWidth(bg.getAttr('_savedStrokeWidth') || 1);
            }
            connectionsManager.hidePreview();
            pendingConnection.source = null;
            objLayer.batchDraw();
          } else {
            // Клик по тому же стикеру — отмена
            cancelPendingConnection();
          }
        } else if (e.target === stageInstance) {
          cancelPendingConnection();
        }
        return;
      }

      // ── Стандартные инструменты ──
      if (tool.current === 'placement') {
        addSticker(
            pos, stickerColor, objLayer, trans, stageInstance, PADDING,
            MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempNode,
            onMoveCallback);
        doSetTool('selection');
        return;
      }
      if (tool.current === 'reminder') {
        addReminder(
            pos, stickerColor, objLayer, trans, stageInstance, PADDING,
            MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempNode,
            onMoveCallback);
        doSetTool('selection');
        return;
      }
      if (tool.current === 'text') {
        addTextField(pos, objLayer, trans, stageInstance);
        doSetTool('selection');
        return;
      }

      if (e.target === stageInstance) {
        trans.nodes([]);
        hideTextToolbar(textToolbar);
        objLayer.draw();
        return;
      }
      if (e.target.getParent().hasName('konva-transformer')) return;

      const target =
          e.target.findAncestor(
              '.sticker-group, .reminder-group, .text-object, .stroke-object') ||
          e.target;

      if (target && tool.current === 'selection') {
        if (e.evt.shiftKey) {
          const nodes = trans.nodes().slice();
          const index = nodes.indexOf(target);
          index >= 0 ? nodes.splice(index, 1) : nodes.push(target);
          trans.nodes(nodes);
        } else if (!trans.nodes().includes(target)) {
          trans.nodes([target]);
        }
        target.moveToTop();
        trans.moveToTop();
      } else {
        trans.nodes([]);
      }

      const selectedNodes = trans.nodes();
      if (selectedNodes.length === 1 &&
          selectedNodes[0].name() === 'text-object') {
        trans.enabledAnchors(['middle-left', 'middle-right']);
        trans.keepRatio(false);
        updateTextToolbar(
            selectedNodes[0], textToolbar, fontSizeInput, boldBtn, italicBtn,
            underlineBtn, textHighlightColorInput);
      } else {
        trans.enabledAnchors(
            ['top-left', 'top-right', 'bottom-left', 'bottom-right']);
        trans.keepRatio(
            !selectedNodes.some(node => node.name() === 'sticker-group'));
        hideTextToolbar(textToolbar);
      }
      objLayer.draw();
    });

    // ── Mousemove: предпросмотр нити ──
    stageInstance.on('mousemove.connect', () => {
      if (tool.current !== 'connect' || !pendingConnection.source) return;
      const transform = stageInstance.getAbsoluteTransform().copy().invert();
      const pos = transform.point(stageInstance.getPointerPosition());
      connectionsManager.showPreview(
          pendingConnection.source, pos, connectionColor.current);
    });

    // ── Колесо: зум ──
    stageInstance.on('wheel', e => {
      e.evt.preventDefault();
      const t = document.querySelector('textarea');
      if (t) t.blur();
      const o = stageInstance.scaleX();
      const a = stageInstance.getPointerPosition();
      const i = {
        x: (a.x - stageInstance.x()) / o,
        y: (a.y - stageInstance.y()) / o
      };
      let r = e.evt.deltaY > 0 ? o / SCALE_BY : o * SCALE_BY;
      r = Math.max(MIN_SCALE, Math.min(r, MAX_SCALE));
      if (o !== r) {
        stageInstance.scale({x: r, y: r});
        stageInstance.position({x: a.x - i.x * r, y: a.y - i.y * r});
        drawGrid();
        hideTextToolbar(textToolbar);
      }
    });
  }

  // ─── Слушатели панели инструментов ───────────────────────────────────────
  penBtn?.addEventListener(
      'click', () => setBrushType('pen', penBtn, highlighterBtn, brushType));
  highlighterBtn?.addEventListener(
      'click',
      () => setBrushType('highlighter', penBtn, highlighterBtn, brushType));
  brushColorInput?.addEventListener(
      'input', e => setBrushColor(e.target.value, brushColor));
  brushSizeSlider?.addEventListener(
      'input', e => setBrushSize(parseInt(e.target.value, 10), brushSize));
  eraserSizeSlider?.addEventListener(
      'input', e => setEraserSize(parseInt(e.target.value, 10), eraserSize));

  selectionBtn?.addEventListener('click', () => doSetTool('selection'));
  addBtn?.addEventListener('click', () => doSetTool('placement'));
  addReminderBtn?.addEventListener('click', () => doSetTool('reminder'));
  textBtn?.addEventListener('click', () => doSetTool('text'));
  drawBtn?.addEventListener('click', () => doSetTool('drawing'));
  eraserBtn?.addEventListener('click', () => doSetTool('eraser'));
  connectBtn?.addEventListener('click', () => doSetTool('connect'));

  // ─── Параметры нити ───────────────────────────────────────────────────────
  connColorInput?.addEventListener('input', e => {
    connectionColor.current = e.target.value;
  });
  connStyleSelect?.addEventListener('change', e => {
    connectionStyle.current = e.target.value;
  });

  // ─── Тема доски ───────────────────────────────────────────────────────────
  function _syncThemeUI(themeName) {
    document.querySelectorAll('.theme-option').forEach(el => {
      el.classList.toggle('active', el.dataset.theme === themeName);
    });
  }

  themeBtn?.addEventListener('click', e => {
    e.stopPropagation();
    const wasHidden = themePanel?.classList.contains('hidden');
    themePanel?.classList.toggle('hidden');
    // Позиционируем панель под тулбаром при открытии
    if (wasHidden && themePanel) {
      const tbRect =
          document.getElementById('controls').getBoundingClientRect();
      themePanel.style.left = tbRect.left + 'px';
      themePanel.style.top = (tbRect.bottom + 8) + 'px';
    }
  });

  document.querySelectorAll('.theme-option').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const name = el.dataset.theme;
      applyTheme(name, boardEl, currentTheme);
      _syncThemeUI(name);
      drawGrid();  // Перерисовываем сетку с цветами новой темы
      themePanel?.classList.add('hidden');
    });
  });

  // Закрываем панель тем по клику вне
  document.addEventListener('click', e => {
    if (themePanel && !themePanel.classList.contains('hidden')) {
      if (!themePanel.contains(e.target) && e.target !== themeBtn) {
        themePanel.classList.add('hidden');
      }
    }
  });

  // ─── Палитра цветов стикеров ──────────────────────────────────────────────
  document.querySelectorAll('.color-swatch').forEach(el => {
    const colorHex = rgbToHex(el.dataset.color);
    el.style.backgroundColor = colorHex;
    el.addEventListener('click', () => {
      stickerColor = colorHex;
      document.querySelectorAll('.color-swatch')
          .forEach(sw => sw.style.border = '1px solid #ccc');
      el.style.border = '2px solid #007bff';
    });
  });

  // ─── Сохранение ──────────────────────────────────────────────────────────
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const icon = saveBtn.querySelector('i');
      const originalIconClass = icon.className;
      icon.className = 'fa-solid fa-spinner fa-spin';
      window.API_SAVE_BOARD().then(() => {
        setTimeout(() => {
          icon.className = originalIconClass;
        }, 500);
      });
    });
  }

  // ─── Удаление ─────────────────────────────────────────────────────────────
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!tr || !objectLayer) return;
      const nodes = tr.nodes().slice();
      let needSave = false;

      for (const node of nodes) {
        // Удаляем связанные нити
        if (connectionsManager && node.id()) {
          connectionsManager.removeForGroup(node.id());
        }

        if (node.id() && window.DJANGO_DATA?.csrfToken) {
          try {
            await fetch('/api/delete_reminder/', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': window.DJANGO_DATA.csrfToken
              },
              credentials: 'same-origin',
              body: JSON.stringify({id: node.id()}),
            });
            needSave = true;
          } catch (err) {
            console.error('Delete error:', err);
          }
        }
        node.destroy();
        needSave = true;
      }

      tr.nodes([]);
      hideTextToolbar(textToolbar);
      objectLayer.draw();
      if (drawingLayer) drawingLayer.draw();
      if (needSave) window.API_SAVE_BOARD();
    });
  }

  // ─── Клавиатура ──────────────────────────────────────────────────────────
  window.addEventListener('keydown', e => {
    if (document.querySelector('textarea') != null ||
        e.target.tagName === 'INPUT')
      return;

    if (e.key === 'Backspace' || e.key === 'Delete') {
      deleteBtn?.click();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveBtn ? saveBtn.click() : window.API_SAVE_BOARD();
    }
    if (e.key === 'Escape') {
      cancelPendingConnection();
      if (tr) tr.nodes([]);
      hideTextToolbar(textToolbar);
      if (objectLayer) objectLayer.draw();
      doSetTool('selection');
    }
    if (e.key.toLowerCase() === 'v') doSetTool('selection');
    if (e.key.toLowerCase() === 'a') doSetTool('placement');
    if (e.key.toLowerCase() === 'r') doSetTool('reminder');
    if (e.key.toLowerCase() === 't') doSetTool('text');
    if (e.key.toLowerCase() === 'd') doSetTool('drawing');
    if (e.key.toLowerCase() === 'e') doSetTool('eraser');
    if (e.key.toLowerCase() === 'c') doSetTool('connect');
  });

  window.addEventListener('resize', () => {
    if (stage) {
      stage.width(window.innerWidth).height(window.innerHeight);
      drawGrid();
    }
  });

  setupTextToolbarHandlers(
      () => tr, () => objectLayer, textToolbar, fontSizeInput, boldBtn, italicBtn,
      underlineBtn, textHighlightColorInput);

  // ─── Перетаскивание тулбара ───────────────────────────────────────────────
  function initToolbarDrag() {
    const toolbar = document.getElementById('controls');
    const grip = document.getElementById('toolbar-grip');
    if (!toolbar || !grip) return;

    let active = false, startX, startY, startLeft, startTop;

    grip.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      active = true;
      const r = toolbar.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = r.left;
      startTop = r.top;
      grip.style.cursor = 'grabbing';
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener('mousemove', e => {
      if (!active) return;
      const x = Math.max(
          0,
          Math.min(
              window.innerWidth - toolbar.offsetWidth,
              startLeft + e.clientX - startX));
      const y = Math.max(
          0,
          Math.min(
              window.innerHeight - toolbar.offsetHeight,
              startTop + e.clientY - startY));
      toolbar.style.left = x + 'px';
      toolbar.style.top = y + 'px';
      // Синхронизируем панель тем, если она открыта
      if (themePanel && !themePanel.classList.contains('hidden')) {
        themePanel.style.left = x + 'px';
        themePanel.style.top = (y + toolbar.offsetHeight + 8) + 'px';
      }
    });

    document.addEventListener('mouseup', () => {
      if (active) {
        active = false;
        grip.style.cursor = 'grab';
      }
    });
  }
  initToolbarDrag();

  // ─── API ──────────────────────────────────────────────────────────────────
  window.API_SAVE_BOARD = async function() {
    if (!stage) return;

    // Сохраняем соединения и тему в атрибуты сцены
    if (connectionsManager) {
      stage.setAttr('connectionData', connectionsManager.serialize());
    }
    stage.setAttr('boardTheme', currentTheme.current);

    const json = stage.toJSON();
    const boardId = window.DJANGO_DATA?.boardId;
    if (!boardId) return;

    try {
      await fetch('/api/save_board/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': window.DJANGO_DATA.csrfToken,
        },
        credentials: 'same-origin',
        body: JSON.stringify({board_data: json, board_id: boardId}),
      });
    } catch (err) {
      console.error(err);
    }
  };

  window.API_LOAD_BOARD = function() {
    if (window.DJANGO_DATA && window.DJANGO_DATA.boardData) {
      initStage(window.DJANGO_DATA.boardData);
    }
  };
});
