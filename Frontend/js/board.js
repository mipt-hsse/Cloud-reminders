
import {setBrushColor, setBrushSize, setBrushType, setEraserSize, setupDrawing} from './modules/drawing.js';
import {setTool} from './modules/selection.js';
import {addSticker} from './modules/stickers.js';
import {addTextField, advancedTextEdit, hideTextToolbar, setupTextToolbarHandlers, updateTextToolbar} from './modules/text.js';
import {rgbToHex} from './modules/utils.js';

document.addEventListener('DOMContentLoaded', function() {
  const stage = new Konva.Stage({
    container: 'sticker-board',
    width: window.innerWidth,
    height: window.innerHeight,
    draggable: false
  });

  // --- State & Constants ---
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

  const PADDING = 10, MIN_FONT_SIZE = 8, MAX_FONT_SIZE = 75,
        MAX_TEXT_WIDTH = 500, MIN_SCALE = 0.05, MAX_SCALE = 8.0, SCALE_BY = 1.1;

  // --- Layers & Transformer---
  const gridLayer = new Konva.Layer({listening: false});
  const objectLayer = new Konva.Layer();
  const drawingLayer = new Konva.Layer();
  stage.add(gridLayer, drawingLayer, objectLayer);

  const tr = new Konva.Transformer({
    rotateEnabled: false,
    anchorSize: 12,
    anchorCornerRadius: 6,
    borderStroke: '#007bff',
    anchorStroke: '#007bff',
    anchorFill: 'white',
    keepRatio: true,
    enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right']
  });
  objectLayer.add(tr);
  const tempTextNode = new Konva.Text({fontFamily: 'Arial', text: ''});

  // --- Grid Logic ---
  function getNiceStep(e) {
    const t = Math.floor(Math.log10(e)), o = Math.pow(10, t);
    return e / o > 5 ? 10 * o : e / o > 2 ? 5 * o : e / o > 1 ? 2 * o : o
  }
  function drawGrid() {
    gridLayer.destroyChildren();
    const e = stage.scaleX(), t = 1 / e, o = {
      x1: -stage.x() / e,
      y1: -stage.y() / e,
      x2: (stage.width() - stage.x()) / e,
      y2: (stage.height() - stage.y()) / e
    },
          a = 60 / e, i = getNiceStep(a), r = i / 5, d = r * e,
          s = Math.min(1, Math.max(0, (d - 15) / (30 - 15)));
    const n = (a, i, r) => {
      if (!a || r <= 0) return;
      const d = Math.floor(o.x1 / a) * a;
      for (let s = d; s < o.x2; s += a)
        gridLayer.add(new Konva.Line({
          points: [s, o.y1, s, o.y2],
          stroke: i,
          strokeWidth: t,
          opacity: r
        }));
      const s = Math.floor(o.y1 / a) * a;
      for (let d = s; d < o.y2; d += a)
        gridLayer.add(new Konva.Line({
          points: [o.x1, d, o.x2, d],
          stroke: i,
          strokeWidth: t,
          opacity: r
        }))
    };
    s > 0 && n(r, '#ddd', s), n(i, '#ccc', 1), gridLayer.batchDraw()
  }
  drawGrid();
  stage.on('dragmove', drawGrid);

  // --- UI & Toolbar ---
  const selectionBtn = document.getElementById('selection-tool-btn'),
        addBtn = document.getElementById('add-sticker-btn'),
        textBtn = document.getElementById('text-tool-btn'),
        drawBtn = document.getElementById('draw-tool-btn'),
        eraserBtn = document.getElementById('eraser-tool-btn'),
        deleteBtn = document.getElementById('delete-btn');

  const stickerColorPalette = document.getElementById('color-palette'),
        drawingOptions = document.getElementById('drawing-options'),
        eraserOptions = document.getElementById('eraser-options');

  const penBtn = document.getElementById('pen-btn'),
        highlighterBtn = document.getElementById('highlighter-btn'),
        brushColorInput = document.getElementById('brush-color-input'),
        brushSizeSlider = document.getElementById('brush-size-slider');

  const eraserSizeSlider = document.getElementById('eraser-size-slider');

  const textToolbar = document.getElementById('text-toolbar'),
        fontSizeInput = document.getElementById('font-size-input'),
        boldBtn = document.getElementById('bold-btn'),
        italicBtn = document.getElementById('italic-btn'),
        underlineBtn = document.getElementById('underline-btn'),
        textHighlightColorInput =
            document.getElementById('text-highlight-color-input');

  const internalHideTextToolbar = () => hideTextToolbar(textToolbar);
  const internalUpdateTextToolbar = (node) => updateTextToolbar(
      node, textToolbar, fontSizeInput, boldBtn, italicBtn, underlineBtn,
      textHighlightColorInput);

  const doSetTool =
      (newTool) => {
        setTool(
            newTool, tool, stage, objectLayer, drawingLayer,
            stickerColorPalette, drawingOptions, eraserOptions, tr,
            internalHideTextToolbar, drawGrid, isPanning, lastPointerPosition,
            setupDrawing, brushColor, brushSize, eraserSize, brushType,
            isDrawing, currentLine)
      }

                   // --- Event Handlers ---
                   penBtn.addEventListener(
                       'click',
                       () => setBrushType(
                           'pen', penBtn, highlighterBtn, brushType));
  highlighterBtn.addEventListener(
      'click',
      () => setBrushType('highlighter', penBtn, highlighterBtn, brushType));
  brushColorInput.addEventListener(
      'input', (e) => setBrushColor(e.target.value, brushColor));
  brushSizeSlider.addEventListener(
      'input', (e) => setBrushSize(parseInt(e.target.value, 10), brushSize));
  eraserSizeSlider.addEventListener(
      'input', (e) => setEraserSize(parseInt(e.target.value, 10), eraserSize));

  selectionBtn.addEventListener('click', () => doSetTool('selection'));
  addBtn.addEventListener('click', () => doSetTool('placement'));
  textBtn.addEventListener('click', () => doSetTool('text'));
  drawBtn.addEventListener('click', () => doSetTool('drawing'));
  eraserBtn.addEventListener('click', () => doSetTool('eraser'));

  deleteBtn.addEventListener('click', () => {
    tr.nodes().forEach(node => node.destroy());
    tr.nodes([]);
    internalHideTextToolbar();
    objectLayer.draw();
    drawingLayer.draw();
  });
  doSetTool('selection');

  setupTextToolbarHandlers(
      tr, objectLayer, textToolbar, fontSizeInput, boldBtn, italicBtn,
      underlineBtn, textHighlightColorInput, internalUpdateTextToolbar);

  stage.on('click tap', function(e) {
    if (e.evt.button === 2) return;

    if (document.querySelector('body > textarea')) return;
    const transform = stage.getAbsoluteTransform().copy().invert();
    const pos = transform.point(stage.getPointerPosition());

    if (tool.current === 'placement') {
      addSticker(
          pos, stickerColor, objectLayer, tr, stage, PADDING, MIN_FONT_SIZE,
          MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode);
      doSetTool('selection');
      return;
    }
    if (tool.current === 'text') {
      addTextField(
          pos, objectLayer, tr, PADDING, advancedTextEdit,
          internalHideTextToolbar, internalUpdateTextToolbar, MIN_FONT_SIZE,
          MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode, stage);
      doSetTool('selection');
      return;
    }
    if (e.target === stage) {
      tr.nodes([]);
      internalHideTextToolbar();
      objectLayer.draw();
      drawingLayer.draw();
      return;
    }
    if (e.target.findAncestor('.konvajs-content') &&
        e.target.getParent().hasName('konva-transformer'))
      return;

    const target = e.target.findAncestor('.sticker-group') ||
        (e.target.name() === 'text-object' ? e.target : null) ||
        (e.target.name() === 'stroke-object' ? e.target : null);
    if (target && tool.current === 'selection') {
      if (e.evt.shiftKey) {
        const nodes = tr.nodes().slice();
        const index = nodes.indexOf(target);
        index >= 0 ? nodes.splice(index, 1) : nodes.push(target);
        tr.nodes(nodes);
      } else if (!tr.nodes().includes(target)) {
        tr.nodes([target]);
      }
      target.moveToTop();
      tr.moveToTop();
    } else {
      tr.nodes([]);
    }

    const selectedNodes = tr.nodes();
    if (selectedNodes.length === 1 &&
        selectedNodes[0].name() === 'text-object') {
      tr.enabledAnchors(['middle-left', 'middle-right']);
      tr.keepRatio(false);
      internalUpdateTextToolbar(selectedNodes[0]);
    } else if (
        selectedNodes.length === 1 &&
        selectedNodes[0].name() === 'stroke-object') {
      tr.enabledAnchors(['rotater']);
      tr.keepRatio(true);
      internalHideTextToolbar();
    } else {
      tr.enabledAnchors(
          ['top-left', 'top-right', 'bottom-left', 'bottom-right']);
      tr.keepRatio(true);
      internalHideTextToolbar();
    }
    objectLayer.draw();
    drawingLayer.draw();
  });

  document.querySelectorAll('.color-swatch').forEach(e => {
    const color = rgbToHex(e.dataset.color);
    e.style.backgroundColor = color;
    e.addEventListener('click', t => {
      stickerColor = t.target.style.backgroundColor;
      document.querySelectorAll('.color-swatch')
          .forEach(sw => sw.style.border = '1px solid #ccc');
      t.target.style.border = '2px solid #007bff';
    });
  });

  window.addEventListener('keydown', e => {
    if (document.querySelector('textarea') != null ||
        e.target.tagName === 'INPUT')
      return;
    if (e.key === 'Backspace' || e.key === 'Delete') deleteBtn.click();
    if (e.key === 'Escape') {
      tr.nodes([]);
      internalHideTextToolbar();
      objectLayer.draw();
      drawingLayer.draw();
    }
    if (e.key.toLowerCase() === 'v') doSetTool('selection');
    if (e.key.toLowerCase() === 'a') doSetTool('placement');
    if (e.key.toLowerCase() === 't') doSetTool('text');
    if (e.key.toLowerCase() === 'd') doSetTool('drawing');
    if (e.key.toLowerCase() === 'e') doSetTool('eraser');
  });
  stage.on('wheel', e => {
    e.evt.preventDefault();
    const t = document.querySelector('textarea');
    t && t.blur();
    const o = stage.scaleX(), a = stage.getPointerPosition(),
          i = {x: (a.x - stage.x()) / o, y: (a.y - stage.y()) / o};
    let r = e.evt.deltaY > 0 ? o / SCALE_BY : o * SCALE_BY;
    r = Math.max(MIN_SCALE, Math.min(r, MAX_SCALE));
    if (o !== r) {
      stage.scale({x: r, y: r});
      stage.position({x: a.x - i.x * r, y: a.y - i.y * r});
      drawGrid();
      internalHideTextToolbar();
    }
  });
  window.addEventListener('resize', () => {
    stage.width(window.innerWidth).height(window.innerHeight);
    drawGrid();
  });
});
