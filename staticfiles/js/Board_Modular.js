// // board_modular.js
// // Основной файл — инициализация сцены и свзяь с модулями

// import {createDrawingModule} from './modules/drawing.js';
// import {createSelectionModule} from './modules/selection.js';
// import {createStickerModule} from './modules/stickers.js';
// import {createTextModule} from './modules/text.js';

// const KonvaRef = window.Konva;  // Rely на глобальную Konva из <script>

// document.addEventListener('DOMContentLoaded', function() {
//   const stage = new KonvaRef.Stage({
//     container: 'sticker-board',
//     width: window.innerWidth,
//     height: window.innerHeight,
//     draggable: false
//   });

//   // --- State & Constants ---
//   let tool = 'selection';
//   let stickerColor = '#ffffcc';

//   const PADDING = 10, MIN_FONT_SIZE = 8, MAX_FONT_SIZE = 75,
//         MAX_TEXT_WIDTH = 500, MIN_SCALE = 0.05, MAX_SCALE = 8.0, SCALE_BY
//         = 1.1;

//   // --- Layers & Transformer---
//   const gridLayer = new KonvaRef.Layer({listening: false});
//   const objectLayer = new KonvaRef.Layer();
//   const drawingLayer = new KonvaRef.Layer();
//   const uiLayer = new KonvaRef.Layer();
//   stage.add(gridLayer, objectLayer, drawingLayer, uiLayer);

//   const tr = new KonvaRef.Transformer({
//     // Временно удаляем boundBoxFunc для отладки
//     // boundBoxFunc: function(oldBox, newBox) {
//     //   const MIN_SIZE = 20;
//     //   if (newBox.width < MIN_SIZE || newBox.height < MIN_SIZE) {
//     //     return oldBox;
//     //   }
//     //   return newBox;
//     // },
//     rotateEnabled: false,
//     anchorSize: 12,
//     anchorCornerRadius: 6,
//     borderStroke: '#007bff',
//     anchorStroke: '#007bff',
//     anchorFill: 'white',
//     keepRatio: false,  // Временно отключаем сохранение пропорций для отладки
//     enabledAnchors: [
//       'top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left',
//       'middle-right', 'top-center', 'bottom-center'
//     ]  // Включаем все якоря для изменения размера
//   });
//   uiLayer.add(tr);

//   // robust group-drag handlers: start dragging selected nodes when clicking
//   // inside transformer bbox (but NOT on anchors)
//   stage.on('mousedown.trdrag', (e) => {
//     if (!tr || tr.nodes().length === 0) return;
//     const pos = stage.getPointerPosition();
//     if (!pos) return;
//     const bbox = tr.getClientRect({relativeTo: stage});
//     const inside = pos.x >= bbox.x && pos.x <= bbox.x + bbox.width &&
//         pos.y >= bbox.y && pos.y <= bbox.y + bbox.height;
//     if (!inside) return;

//     const target = e.target;
//     try {
//       const name = (typeof target.name === 'function') ? target.name() :
//       null; const anchorNames = new Set([
//         'top-left', 'top-right', 'bottom-left', 'bottom-right',
//         'middle-left', 'middle-right', 'top-center', 'bottom-center',
//         'rotater'
//       ]);
//       if (name && anchorNames.has(name)) return;
//       if (target === tr || (target.getParent && target.getParent() === tr))
//         return;
//     } catch (err) {
//     }

//     tr.nodes().forEach(n => n.startDrag());
//   });

//   stage.on('mouseup.trdrag', () => {
//     if (!tr) return;
//     tr.nodes().forEach(n => n.stopDrag && n.stopDrag());
//   });

//   // --- NEW: group dragging via transformer ---
//   stage.on('mouseup.trdrag', () => {
//     if (!tr) return;
//     tr.nodes().forEach(n => n.stopDrag && n.stopDrag());
//   });

//   const tempTextNode = new KonvaRef.Text({fontFamily: 'Arial', text: ''});

//   // подключаем модули
//   const stickers = createStickerModule(
//       KonvaRef, objectLayer, stage, tr, uiLayer, (textNode) => {
//         // adjustText (копия логики из оригинального файла)
//         const rect = textNode.parent.findOne('.background');
//         const maxWidth = rect.width() - PADDING * 2;
//         const maxHeight = rect.height() - PADDING * 2;

//         textNode.width(maxWidth);
//         textNode.x(PADDING);

//         const words = textNode.text().split(/\s+/);
//         const longestWord =
//             words.reduce((l, c) => (c.length > l.length ? c : l), '');

//         let low = MIN_FONT_SIZE;
//         let high = MAX_FONT_SIZE;
//         let bestFit = low;

//         while (low <= high) {
//           let mid = Math.floor((low + high) / 2);
//           tempTextNode.fontSize(mid);
//           tempTextNode.text(longestWord);
//           if (tempTextNode.width() > maxWidth) {
//             high = mid - 1;
//             continue;
//           }
//           textNode.fontSize(mid);
//           if (textNode.getClientRect({skipTransform: true}).height >
//               maxHeight) {
//             high = mid - 1;
//           } else {
//             bestFit = mid;
//             low = mid + 1;
//           }
//         }

//         textNode.fontSize(bestFit);
//         const textHeight = textNode.getClientRect({skipTransform:
//         true}).height; textNode.y((rect.height() - textHeight) / 2);

//         return textNode.getClientRect({skipTransform: true}).height <=
//             maxHeight;
//       }, PADDING, MAX_FONT_SIZE);

//   const textModule = createTextModule(
//       stage, objectLayer, tr, tempTextNode, PADDING, MAX_FONT_SIZE,
//       MAX_TEXT_WIDTH);

//   const drawing = createDrawingModule(stage, drawingLayer, KonvaRef);

//   // selection module
//   const selection = createSelectionModule(KonvaRef, stage, uiLayer, tr);

//   // --- Grid drawing code (same as original) ---
//   function getNiceStep(e) {
//     const t = Math.floor(Math.log10(e)), o = Math.pow(10, t);
//     return e / o > 5 ? 10 * o : e / o > 2 ? 5 * o : e / o > 1 ? 2 * o : o;
//   }
//   function drawGrid() {
//     gridLayer.destroyChildren();
//     const e = stage.scaleX(), t = 1 / e, o = {
//       x1: -stage.x() / e,
//       y1: -stage.y() / e,
//       x2: (stage.width() - stage.x()) / e,
//       y2: (stage.height() - stage.y()) / e
//     };
//     const a = 60 / e, i = getNiceStep(a), r = i / 5, d = r * e,
//           s = Math.min(1, Math.max(0, (d - 15) / (30 - 15)));
//     const n = (a, i, r) => {
//       if (!a || r <= 0) return;
//       const d = Math.floor(o.x1 / a) * a;
//       for (let s = d; s < o.x2; s += a)
//         gridLayer.add(new KonvaRef.Line({
//           points: [s, o.y1, s, o.y2],
//           stroke: i,
//           strokeWidth: t,
//           opacity: r
//         }));
//       const s = Math.floor(o.y1 / a) * a;
//       for (let d = s; d < o.y2; d += a)
//         gridLayer.add(new KonvaRef.Line({
//           points: [o.x1, d, o.x2, d],
//           stroke: i,
//           strokeWidth: t,
//           opacity: r
//         }));
//     };
//     s > 0 && n(r, '#ddd', s);
//     n(i, '#ccc', 1);
//     gridLayer.batchDraw();
//   }
//   drawGrid();
//   stage.on('dragmove', drawGrid);

//   // --- UI wiring (упрощённо, оставил оригинальные селекторы) ---
//   const selectionBtn = document.getElementById('selection-tool-btn');
//   const addBtn = document.getElementById('add-sticker-btn');
//   const textBtn = document.getElementById('text-tool-btn');
//   const drawBtn = document.getElementById('draw-tool-btn');
//   const eraserBtn = document.getElementById('eraser-tool-btn');
//   const deleteBtn = document.getElementById('delete-btn');

//   const stickerColorPalette = document.getElementById('color-palette');
//   const drawingOptions = document.getElementById('drawing-options');
//   const eraserOptions = document.getElementById('eraser-options');

//   const penBtn = document.getElementById('pen-btn');
//   const highlighterBtn = document.getElementById('highlighter-btn');
//   const brushColorInput = document.getElementById('brush-color-input');
//   const brushSizeSlider = document.getElementById('brush-size-slider');
//   const eraserSizeSlider = document.getElementById('eraser-size-slider');


//   // util
//   function rgbToHex(rgb) {
//     if (!rgb || rgb.startsWith('#')) return rgb;
//     const m = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(rgb);
//     if (!m) return '#000000';
//     return '#' +
//         ((1 << 24) + (+m[1] << 16) + (+m[2] << 8) + (+m[3]))
//             .toString(16)
//             .slice(1);
//   }
//   const fontSizeInput = document.getElementById('font-size-input');
//   const boldBtn = document.getElementById('bold-btn');
//   const italicBtn = document.getElementById('italic-btn');
//   const underlineBtn = document.getElementById('underline-btn');
//   const textHighlightColorInput =
//       document.getElementById('text-highlight-color-input');

//   function setTool(newTool) {
//     document.querySelectorAll('.control-btn')
//         .forEach(btn => btn.classList.remove('active'));
//     const activeBtn = document.getElementById(`${newTool}-tool-btn`);
//     if (activeBtn) activeBtn.classList.add('active');
//     tool = newTool;
//     stickerColorPalette?.classList.toggle('hidden', newTool !== 'placement');
//     drawingOptions?.classList.toggle('hidden', newTool !== 'drawing');
//     eraserOptions?.classList.toggle('hidden', newTool !== 'eraser');

//     // Отключаем все специфические обработчики перед установкой нового
//     // инструмента
//     stage.off('.selection');
//     stage.off('.placement');
//     stage.off('.text');
//     stage.off('.panning');
//     stage.off('contextmenu');
//     drawing.stopDrawingListeners();

//     if (newTool === 'selection') {
//       stage.draggable(false);
//       objectLayer.listening(true);
//       drawingLayer.listening(true);

//       // panning
//       let isPanning = false;
//       let lastPointerPosition = {x: 0, y: 0};
//       stage.on('mousedown.panning', (e) => {
//         if (e.evt.button === 2) {
//           isPanning = true;
//           lastPointerPosition = {x: e.evt.clientX, y: e.evt.clientY};
//           e.evt.preventDefault();
//         }
//       });
//       stage.on('mousemove.panning', (e) => {
//         if (isPanning) {
//           const dx = e.evt.clientX - lastPointerPosition.x;
//           const dy = e.evt.clientY - lastPointerPosition.y;
//           stage.x(stage.x() + dx);
//           stage.y(stage.y() + dy);
//           lastPointerPosition = {x: e.evt.clientX, y: e.evt.clientY};
//           drawGrid();
//           objectLayer.batchDraw();
//           drawingLayer.batchDraw();
//         }
//       });
//       stage.on('mouseup.panning', () => {
//         isPanning = false;
//       });
//       stage.on('contextmenu', (e) => {
//         e.evt.preventDefault();
//       });

//       // selection handlers
//       stage.on('mousedown.selection', e => {
//         const t = e.target;

//         // Если клик был по трансформатору или его якорям, сразу выходим
//         // Это гарантирует, что трансформатор получит свои события.
//         if (t.getParent() === tr || t === tr) {
//           console.log(
//               'Clicked on transformer or its anchor, skipping selection
//               logic.');
//           e.evt.stopPropagation();  // Останавливаем распространение DOM
//           события return;
//         }

//         const isObject = t.name() === 'sticker-group' ||
//             t.name() === 'text-object' || t.name() === 'stroke-object';
//         if (isObject) {  // Кликнули по объекту (стикеру, тексту, рисунку)
//           if (e.evt.shiftKey) {
//             const nodes = tr.nodes().slice();
//             const index = nodes.indexOf(t.findAncestor('.sticker-group') ||
//             t); index >= 0 ? nodes.splice(index, 1) :
//                          nodes.push(t.findAncestor('.sticker-group') || t);
//             tr.nodes(nodes);
//           } else if (!tr.nodes().includes(
//                          t.findAncestor('.sticker-group') || t)) {
//             tr.nodes([t.findAncestor('.sticker-group') || t]);
//           }
//           (t.findAncestor('.sticker-group') || t).moveToTop();
//           tr.moveToTop();
//         } else {  // Кликнули по пустому месту
//           tr.nodes([]);
//           textModule.hideTextToolbar();
//         }
//         objectLayer.draw();
//         drawingLayer.draw();
//         uiLayer.batchDraw();  // Обновляем UI слой, чтобы трансформатор
//                               // правильно отобразился/скрылся
//       });

//       stage.on('mousemove.selection', () => {
//         const pos = stage.getPointerPosition();
//         if (!pos) return;
//         const abs = stage.getAbsoluteTransform().copy().invert().point(pos);
//         selection.updateSelection(abs);
//       });
//       stage.on('mouseup.selection', e => {
//         const pos = stage.getPointerPosition();
//         if (!pos) return;
//         const abs = stage.getAbsoluteTransform().copy().invert().point(pos);
//         selection.finishSelection({...abs, shiftKey: e.evt.shiftKey});
//       });

//     } else if (newTool === 'drawing' || newTool === 'eraser') {
//       stage.draggable(false);
//       objectLayer.listening(false);
//       drawingLayer.listening(false);

//       drawing.setBrushType(newTool === 'eraser' ? 'eraser' : 'pen');
//       drawing.startDrawingListeners();
//     } else if (newTool === 'placement') {
//       stage.draggable(false);
//       objectLayer.listening(true);
//       drawingLayer.listening(true);
//       tr.nodes([
//       ]);  // Снимаем выделение трансформатором, если перешли в режим
//       размещения uiLayer.batchDraw();

//       stage.on('click.placement', (e) => {
//         if (e.target === stage) {  // Кликнули по пустому месту
//           const transform = stage.getAbsoluteTransform().copy().invert();
//           const pos = transform.point(stage.getPointerPosition());
//           stickers.addSticker(pos, stickerColor);
//           setTool(
//               'selection');  // Возвращаемся в режим выделения после
//               добавления
//         }
//       });

//     } else if (newTool === 'text') {
//       stage.draggable(false);
//       objectLayer.listening(true);
//       drawingLayer.listening(true);
//       tr.nodes([]);  // Снимаем выделение трансформатором
//       uiLayer.batchDraw();

//       stage.on('click.text', (e) => {
//         if (e.target === stage) {  // Кликнули по пустому месту
//           const transform = stage.getAbsoluteTransform().copy().invert();
//           const pos = transform.point(stage.getPointerPosition());
//           textModule.addTextField(pos);
//           setTool(
//               'selection');  // Возвращаемся в режим выделения после
//               добавления
//         }
//       });

//     } else {  // Общий случай, если tool не определен (возвращаем старые
//               // значения)
//       stage.draggable(false);
//       objectLayer.listening(true);
//       drawingLayer.listening(true);
//       drawing.stopDrawingListeners();
//     }
//   }

//   penBtn?.addEventListener('click', () => {
//     drawing.setBrushType('pen');
//     penBtn?.classList.add('active');
//     highlighterBtn?.classList.remove('active');
//   });
//   highlighterBtn?.addEventListener('click', () => {
//     drawing.setBrushType('highlighter');
//     highlighterBtn?.classList.add('active');
//     penBtn?.classList.remove('active');
//   });
//   brushColorInput?.addEventListener(
//       'input', (e) => drawing.setBrushColor(e.target.value));
//   brushSizeSlider?.addEventListener(
//       'input', (e) => drawing.setBrushSize(parseInt(e.target.value, 10)));
//   eraserSizeSlider?.addEventListener(
//       'input', (e) => drawing.setEraserSize(parseInt(e.target.value, 10)));

//   selectionBtn?.addEventListener('click', () => setTool('selection'));
//   addBtn?.addEventListener('click', () => setTool('placement'));
//   textBtn?.addEventListener('click', () => setTool('text'));
//   drawBtn?.addEventListener('click', () => setTool('drawing'));
//   eraserBtn?.addEventListener('click', () => setTool('eraser'));
//   deleteBtn?.addEventListener('click', () => {
//     tr.nodes().forEach(node => node.destroy());
//     tr.nodes([]);
//     textModule.hideTextToolbar();
//     objectLayer.draw();
//     drawingLayer.draw();
//     uiLayer.batchDraw();
//   });
//   setTool('selection');  // Устанавливаем инструмент по умолчанию

//   document.querySelectorAll('.color-swatch').forEach(e => {
//     const color = rgbToHex(e.dataset.color);
//     e.style.backgroundColor = color;
//     e.addEventListener('click', t => {
//       stickerColor = t.target.style.backgroundColor;
//       document.querySelectorAll('.color-swatch')
//           .forEach(sw => sw.style.border = '1px solid #ccc');
//       t.target.style.border = '2px solid #007bff';
//     });
//   });

//   // УДАЛЯЕМ ОБЩИЙ stage.on('mousedown'), его логика теперь в setTool

//   stage.on('mousedown', function(e) {
//     console.log('Stage mousedown event fired!');
//     if (e.evt.button === 2) return;
//     if (document.querySelector('body > textarea')) return;

//     // Если текущий инструмент - selection, то позволяем selection-логике
//     // обрабатывать событие Если tool не selection, то этот mousedown не
//     должен
//     // обрабатываться здесь
//     if (tool === 'selection') {
//       // Логика, которая была в stage.on('mousedown.selection')
//       const t = e.target;

//       // Если клик был по трансформатору или его якорям, сразу выходим
//       // Это гарантирует, что трансформатор получит свои события.
//       if (t.getParent() === tr || t === tr) {
//         console.log(
//             'Clicked on transformer or its anchor, stopping selection logic
//             in general mousedown.');
//         e.evt.stopPropagation();  // Останавливаем распространение DOM
//         события return;
//       }

//       const isObject = t.name() === 'sticker-group' ||
//           t.name() === 'text-object' || t.name() === 'stroke-object';
//       if (isObject) {  // Кликнули по объекту (стикеру, тексту, рисунку)
//         if (e.evt.shiftKey) {
//           const nodes = tr.nodes().slice();
//           const index = nodes.indexOf(t.findAncestor('.sticker-group') || t);
//           index >= 0 ? nodes.splice(index, 1) :
//                        nodes.push(t.findAncestor('.sticker-group') || t);
//           tr.nodes(nodes);
//         } else if (!tr.nodes().includes(
//                        t.findAncestor('.sticker-group') || t)) {
//           tr.nodes([t.findAncestor('.sticker-group') || t]);
//         }
//         (t.findAncestor('.sticker-group') || t).moveToTop();
//         tr.moveToTop();
//       } else {  // Кликнули по пустому месту
//         tr.nodes([]);
//         textModule.hideTextToolbar();
//       }
//       objectLayer.draw();
//       drawingLayer.draw();
//       uiLayer.batchDraw();  // Обновляем UI слой, чтобы трансформатор
//       правильно
//                             // отобразился/скрылся
//     }

//     // Handle double-click for stickers (остается здесь, так как это не
//     зависит
//     // от инструмента, но инициируется mousedown)
//     const target = e.target.findAncestor('.sticker-group') ||
//         (e.target.name() === 'text-object' ? e.target : null) ||
//         (e.target.name() === 'stroke-object' ? e.target : null);

//     if (e.evt.detail === 2 && target && target.name() === 'sticker-group') {
//       console.log('Double-clicked on a sticker group!');
//       target.fire(
//           'dblclick', {evt: e.evt});  // Fire custom dblclick event on the
//           group
//       e.evt.stopPropagation();  // Останавливаем распространение, чтобы
//       избежать
//                                 // конфликтов
//       return;
//     }
//   });

//   window.addEventListener('keydown', e => {
//     if (document.querySelector('textarea') != null ||
//         e.target.tagName === 'INPUT')
//       return;
//     if (e.key === 'Backspace' || e.key === 'Delete') deleteBtn?.click();
//     if (e.key === 'Escape') {
//       tr.nodes([]);
//       textModule.hideTextToolbar();
//       objectLayer.draw();
//       drawingLayer.draw();
//       uiLayer.batchDraw();
//     }
//     if (e.key.toLowerCase() === 'v') setTool('selection');
//     if (e.key.toLowerCase() === 'a') setTool('placement');
//     if (e.key.toLowerCase() === 't') setTool('text');
//     if (e.key.toLowerCase() === 'd') setTool('drawing');
//     if (e.key.toLowerCase() === 'e') setTool('eraser');
//   });

//   stage.on('wheel', e => {
//     e.evt.preventDefault();
//     const t = document.querySelector('textarea');
//     t && t.blur();
//     const o = stage.scaleX(), a = stage.getPointerPosition(),
//           i = {x: (a.x - stage.x()) / o, y: (a.y - stage.y()) / o};
//     let r = e.evt.deltaY > 0 ? o / SCALE_BY : o * SCALE_BY;
//     r = Math.max(MIN_SCALE, Math.min(r, MAX_SCALE));
//     if (o !== r) {
//       stage.scale({x: r, y: r});
//       stage.position({x: a.x - i.x * r, y: a.y - i.y * r});
//       drawGrid();
//       textModule.hideTextToolbar();
//     }
//   });

//   window.addEventListener('resize', () => {
//     stage.width(window.innerWidth).height(window.innerHeight);
//     drawGrid();
//   });
// });
