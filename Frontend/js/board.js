
document.addEventListener('DOMContentLoaded', function() {
  const stage = new Konva.Stage({
    container: 'sticker-board',
    width: window.innerWidth,
    height: window.innerHeight,
    draggable: false
  });

  // --- State & Constants ---
  let tool = 'selection';
  let stickerColor = '#ffffcc';
  let brushType = 'pen';
  let brushColor = '#000000';
  let brushSize = 2;
  let eraserSize = 20;                     // State for eraser size
  let isPanning = false;                   // New state for panning
  let lastPointerPosition = {x: 0, y: 0};  // New state for panning

  const PADDING = 10, MIN_FONT_SIZE = 8, MAX_FONT_SIZE = 75,
        MAX_TEXT_WIDTH = 500, MIN_SCALE = 0.05, MAX_SCALE = 8.0, SCALE_BY = 1.1;

  // --- Helpers ---
  function rgbToHex(rgb) {
    if (!rgb || rgb.startsWith('#')) return rgb;
    const result = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(rgb);
    if (!result) return '#000000';
    return '#' +
        ((1 << 24) + (parseInt(result[1]) << 16) + (parseInt(result[2]) << 8) +
         parseInt(result[3]))
            .toString(16)
            .slice(1)
            .toLowerCase();
  }

  // --- Layers & Transformer---
  const gridLayer = new Konva.Layer({listening: false});
  const objectLayer = new Konva.Layer();
  const drawingLayer = new Konva.Layer();
  stage.add(gridLayer, drawingLayer, objectLayer);  // Changed layer order here

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

  // --- Drawing & Eraser Logic ---
  let isDrawing = false, currentLine;

  stage.on('mousedown.drawing', (e) => {
    if (tool !== 'drawing' && tool !== 'eraser') return;
    if (e.target !== stage && tool !== 'eraser')
      return;  // Only draw on stage, unless in pixel eraser mode

    isDrawing = true;
    const pos = stage.getPointerPosition(),
          transform = stage.getAbsoluteTransform().copy().invert(),
          transformedPos = transform.point(pos);
    let compositeOp = 'source-over', size = brushSize / stage.scaleX();

    if (tool === 'eraser') {
      compositeOp = 'destination-out';
      size = eraserSize / stage.scaleX();  // Use eraserSize for pixel erasing
    } else if (brushType === 'highlighter') {
      compositeOp = 'multiply';
    }
    currentLine = new Konva.Line({
      stroke: tool === 'eraser' ? 'rgba(0,0,0,1)' : brushColor,
      strokeWidth: size,
      globalCompositeOperation: compositeOp,
      points: [transformedPos.x, transformedPos.y],
      lineCap: 'round',
      opacity: brushType === 'highlighter' ? 0.5 : 1,
      name: tool === 'eraser' ? undefined :
                                'stroke-object',  // Assign name if not eraser
      listening: tool !== 'eraser'  // Listen to strokes, but not eraser marks
    });
    drawingLayer.add(currentLine);
  });

  stage.on('mousemove.drawing', () => {
    if (!isDrawing) return;
    const pos = stage.getPointerPosition(),
          transform = stage.getAbsoluteTransform().copy().invert(),
          transformedPos = transform.point(pos),
          newPoints =
              currentLine.points().concat([transformedPos.x, transformedPos.y]);
    currentLine.points(newPoints);
    drawingLayer.batchDraw();
  });
  stage.on('mouseup.drawing mouseleave.drawing', () => {
    isDrawing = false;
  });

  // --- Text Editing (Advanced, for Text Objects) ---
  function advancedTextEdit(textNode) {
    if (document.querySelector('body > textarea')) return;
    tr.nodes([]);
    hideTextToolbar();
    textNode.hide();
    objectLayer.draw();

    const absPos = textNode.getAbsolutePosition();
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.value = textNode.text();

    Object.assign(textarea.style, {
      position: 'absolute',
      top: `${absPos.y}px`,
      left: `${absPos.x}px`,
      width: `${textNode.width() * stage.scaleX()}px`,
      height: `${textNode.height() * stage.scaleY()}px`,
      border: '1px solid #007bff',
      margin: '0',
      overflow: 'auto',
      background: 'transparent',
      outline: 'none',
      resize: 'none',
      fontFamily: textNode.fontFamily(),
      fontSize: `${textNode.fontSize() * stage.scaleX()}px`,
      color: textNode.fill(),
      lineHeight: textNode.lineHeight(),
      padding: `${textNode.padding()}px`,
    });
    textarea.focus();

    function removeTextarea() {
      if (!document.body.contains(textarea)) return;
      textNode.text(textarea.value);
      textNode.show();
      document.body.removeChild(textarea);
      objectLayer.draw();
      tr.nodes([textNode]);
      updateTextToolbar(textNode);
    }

    textarea.addEventListener('blur', removeTextarea);
    textarea.addEventListener('input', () => {
      textNode.width(Math.min(MAX_TEXT_WIDTH, textarea.clientWidth));
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    });
    textarea.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Escape') {
        e.preventDefault();
        textarea.blur();
      }
    });
  }

  // --- Object Creation ---
  function adjustText(textNode) {
    const rect = textNode.parent.findOne('.background');
    const maxWidth = rect.width() - PADDING * 2;
    const maxHeight = rect.height() - PADDING * 2;

    textNode.width(maxWidth);
    textNode.x(PADDING);

    const words = textNode.text().split(/\s+/);
    const longestWord =
        words.reduce((l, c) => (c.length > l.length ? c : l), '');

    let low = MIN_FONT_SIZE;
    let high = MAX_FONT_SIZE;
    let bestFit = low;

    while (low <= high) {
      let mid = Math.floor((low + high) / 2);
      tempTextNode.fontSize(mid);
      tempTextNode.text(longestWord);
      if (tempTextNode.width() > maxWidth) {
        high = mid - 1;
        continue;
      }
      textNode.fontSize(mid);
      if (textNode.getClientRect({skipTransform: true}).height > maxHeight) {
        high = mid - 1;
      } else {
        bestFit = mid;
        low = mid + 1;
      }
    }

    textNode.fontSize(bestFit);
    const textHeight = textNode.getClientRect({skipTransform: true}).height;
    textNode.y((rect.height() - textHeight) / 2);

    return textNode.getClientRect({skipTransform: true}).height <= maxHeight;
  }


  function addSticker(pos, color) {
    const group = new Konva.Group({
      x: pos.x - 100,
      y: pos.y - 100,
      draggable: true,
      name: 'sticker-group'
    });
    objectLayer.add(group);
    group.moveToTop();  // Bring newly created sticker to top

    const rect = new Konva.Rect({
      width: 200,
      height: 200,
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

    group.on('dragstart', () => {
      rect.shadowOffsetX(10);
      rect.shadowOffsetY(10);
      rect.shadowBlur(15);
      group.moveToTop();  // Ensure sticker is on top when dragging
      tr.moveToTop();
    });
    group.on('dragend', () => {
      rect.shadowOffsetX(5);
      rect.shadowOffsetY(5);
      rect.shadowBlur(10);
    });

    group.on(
        'transformstart', () => {  // Ensure sticker is on top when transforming
          group.moveToTop();
          tr.moveToTop();
        });

    const text = new Konva.Text({
      text: '',
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

    group.on('transformend', (e) => {
      const scale = group.scaleX();
      group.scale({x: 1, y: 1});
      const newWidth = Math.max(50, rect.width() * scale);
      rect.width(newWidth).height(newWidth);
      adjustText(text);  // Let adjustText handle font size and position
      group.clearCache();
      tr.nodes([group]);
      objectLayer.batchDraw();
    });

    function startEditing() {
      tr.nodes([]);
      text.hide();
      objectLayer.draw();
      const textPosition = group.getAbsolutePosition();
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
        boxSizing: 'border-box',
        textAlign: 'center',
        lineHeight: text.lineHeight(),
      });

      function updateTextareaStyle() {
        text.text(textarea.value || ' ');
        const fits = adjustText(text);
        if (fits) {
          lastValidText = textarea.value;
          const newFontSize = text.fontSize();
          textarea.style.fontSize = `${newFontSize * stage.scaleX()}px`;
          const textHeight = text.getClientRect({skipTransform: true}).height;
          const paddingTop = (rect.height() - textHeight) / 2;
          textarea.style.paddingTop =
              `${Math.max(0, paddingTop) * stage.scaleY()}px`;
        } else {
          textarea.value = lastValidText;
          text.text(lastValidText || ' ');
          adjustText(text);
        }
      }
      textarea.addEventListener('input', updateTextareaStyle);
      textarea.addEventListener('blur', () => {
        text.text(lastValidText);
        text.show();
        document.body.removeChild(textarea);
        objectLayer.draw();
        tr.nodes([group]);
        objectLayer.draw();
      });
      updateTextareaStyle();
      textarea.focus();
    }

    group.on('dblclick dbltap', startEditing);
    adjustText(text);
    startEditing();
    tr.nodes([group]);
    objectLayer.draw();
  }

  function addTextField(pos) {
    const textNode = new Konva.Text({
      x: pos.x,
      y: pos.y,
      text: 'Editable Text',
      fontSize: 30,
      fontFamily: 'Arial',
      fill: '#000000',
      padding: PADDING,
      draggable: true,
      name: 'text-object',
      width: 200
    });
    objectLayer.add(textNode);
    textNode.moveToTop();  // Bring newly created text field to top
    textNode.on('dblclick dbltap', () => advancedTextEdit(textNode));
    textNode.on('transform', () => {
      textNode.width(Math.max(20, textNode.width() * textNode.scaleX()));
      textNode.scale({x: 1, y: 1});
    });
    textNode.on('dragstart', () => {  // Ensure text is on top when dragging
      textNode.moveToTop();
      tr.moveToTop();
    });
    textNode.on(
        'transformstart', () => {  // Ensure text is on top when transforming
          textNode.moveToTop();
          tr.moveToTop();
        });
    tr.nodes([textNode]);
    advancedTextEdit(textNode);
    objectLayer.draw();
  }

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

  function setTool(newTool) {
    // Deactivate all main tool buttons first
    document.querySelectorAll('.control-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    // Activate the clicked button
    const activeBtn = document.getElementById(`${newTool}-tool-btn`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }

    tool = newTool;

    // Toggle visibility of contextual toolbars
    stickerColorPalette.classList.toggle('hidden', newTool !== 'placement');
    drawingOptions.classList.toggle('hidden', newTool !== 'drawing');
    eraserOptions.classList.toggle('hidden', newTool !== 'eraser');

    // Reset panning state
    isPanning = false;

    if (newTool === 'selection') {
      stage.draggable(false);       // Disable Konva's built-in draggable
      objectLayer.listening(true);  // Ensure objects are clickable
      drawingLayer.listening(
          true);  // Enable listening on drawing layer for selection

      // Add panning logic for right-click
      stage.on('mousedown.panning', (e) => {
        if (e.evt.button === 2) {  // Right-click
          isPanning = true;
          lastPointerPosition = {x: e.evt.clientX, y: e.evt.clientY};
          e.evt.preventDefault();  // Prevent context menu
        }
      });

      stage.on('mousemove.panning', (e) => {
        if (isPanning) {
          const dx = e.evt.clientX - lastPointerPosition.x;
          const dy = e.evt.clientY - lastPointerPosition.y;

          stage.x(stage.x() + dx);
          stage.y(stage.y() + dy);
          lastPointerPosition = {x: e.evt.clientX, y: e.evt.clientY};
          drawGrid();
          objectLayer.batchDraw();   // Redraw objects to move with stage
          drawingLayer.batchDraw();  // Redraw drawings to move with stage
        }
      });

      stage.on('mouseup.panning', () => {
        isPanning = false;
      });

      // Prevent browser context menu on right click
      stage.on('contextmenu', (e) => {
        e.evt.preventDefault();
      });

      // Re-attach drawing/eraser listeners (for other tools)
      stage.off(
          'mousedown.drawing mousemove.drawing mouseup.drawing mouseleave.drawing');

    } else if (newTool === 'drawing' || newTool === 'eraser') {
      stage.draggable(
          false);  // Disable stage draggable when drawing or erasing
      objectLayer.listening(
          false);  // Disable object interaction when drawing or erasing
      drawingLayer.listening(
          false);  // Disable drawing layer interaction when drawing or erasing

      stage.off('.panning');     // Remove panning listeners
      stage.off('contextmenu');  // Remove contextmenu listener

      // Re-attach mousedown.drawing, mousemove.drawing for pixel erase or
      // drawing
      stage.on('mousedown.drawing', (e) => {
        if (tool !== 'drawing' && tool !== 'eraser') return;
        if (e.target !== stage && tool !== 'eraser') return;

        isDrawing = true;
        const pos = stage.getPointerPosition(),
              transform = stage.getAbsoluteTransform().copy().invert(),
              transformedPos = transform.point(pos);
        let compositeOp = 'source-over', size = brushSize / stage.scaleX();

        if (tool === 'eraser') {
          compositeOp = 'destination-out';
          size = eraserSize / stage.scaleX();
        } else if (brushType === 'highlighter') {
          compositeOp = 'multiply';
        }
        currentLine = new Konva.Line({
          stroke: tool === 'eraser' ? 'rgba(0,0,0,1)' : brushColor,
          strokeWidth: size,
          globalCompositeOperation: compositeOp,
          points: [transformedPos.x, transformedPos.y],
          lineCap: 'round',
          opacity: brushType === 'highlighter' ? 0.5 : 1,
          name: tool === 'eraser' ?
              undefined :
              'stroke-object',  // Assign name if not eraser
          listening:
              tool !== 'eraser'  // Listen to strokes, but not eraser marks
        });
        drawingLayer.add(currentLine);
      });
      stage.on('mousemove.drawing', () => {
        if (!isDrawing) return;
        const pos = stage.getPointerPosition(),
              transform = stage.getAbsoluteTransform().copy().invert(),
              transformedPos = transform.point(pos),
              newPoints = currentLine.points().concat(
                  [transformedPos.x, transformedPos.y]);
        currentLine.points(newPoints);
        drawingLayer.batchDraw();
      });
      stage.on('mouseup.drawing mouseleave.drawing', () => {
        isDrawing = false;
      });

    } else {  // For 'placement' and 'text' tools
      stage.draggable(false);
      objectLayer.listening(true);
      drawingLayer.listening(
          true);  // Enable listening on drawing layer for selection

      stage.off('.panning');     // Remove panning listeners
      stage.off('contextmenu');  // Remove contextmenu listener
      stage.off(
          'mousedown.drawing mousemove.drawing mouseup.drawing mouseleave.drawing');
    }

    // Clear selection if not in selection mode
    if (newTool !== 'selection') {
      tr.nodes([]);
      hideTextToolbar();
    }
  }

  // --- Drawing Options Handlers ---
  penBtn.addEventListener('click', () => {
    brushType = 'pen';
    penBtn.classList.add('active');
    highlighterBtn.classList.remove('active');
  });

  highlighterBtn.addEventListener('click', () => {
    brushType = 'highlighter';
    highlighterBtn.classList.add('active');
    penBtn.classList.remove('active');
  });

  brushColorInput.addEventListener('input', (e) => {
    brushColor = e.target.value;
  });

  brushSizeSlider.addEventListener('input', (e) => {
    brushSize = parseInt(e.target.value, 10);
  });

  // --- Eraser Options Handlers ---
  eraserSizeSlider.addEventListener('input', (e) => {
    eraserSize = parseInt(e.target.value, 10);
  });


  selectionBtn.addEventListener('click', () => setTool('selection'));
  addBtn.addEventListener('click', () => setTool('placement'));
  textBtn.addEventListener('click', () => setTool('text'));
  drawBtn.addEventListener('click', () => setTool('drawing'));
  eraserBtn.addEventListener('click', () => setTool('eraser'));
  deleteBtn.addEventListener('click', () => {
    tr.nodes().forEach(node => node.destroy());
    tr.nodes([]);
    hideTextToolbar();
    objectLayer.draw();
    drawingLayer.draw();
  });
  setTool('selection');

  function hideTextToolbar() {
    textToolbar.classList.add('hidden');
  }
  function updateTextToolbar(node) {
    if (!node || node.name() !== 'text-object') {
      hideTextToolbar();
      return;
    }
    textToolbar.classList.remove('hidden');
    const box = node.getClientRect();
    Object.assign(
        textToolbar.style,
        {top: `${box.y - 60}px`, left: `${box.x}px`, display: 'flex'});
    fontSizeInput.value = node.fontSize();
    boldBtn.classList.toggle('active', node.fontStyle().includes('bold'));
    italicBtn.classList.toggle('active', node.fontStyle().includes('italic'));
    underlineBtn.classList.toggle(
        'active', node.textDecoration() === 'underline');
    textHighlightColorInput.value = rgbToHex(node.fill());
  }

  fontSizeInput.addEventListener('input', (e) => {
    const nodes = tr.nodes();
    if (nodes.length === 1 && nodes[0].name() === 'text-object') {
      nodes[0].fontSize(parseInt(e.target.value, 10));
      objectLayer.draw();
      updateTextToolbar(nodes[0]);
    }
  });
  boldBtn.addEventListener('click', () => {
    const nodes = tr.nodes();
    if (nodes.length === 1 && nodes[0].name() === 'text-object') {
      const s = nodes[0].fontStyle();
      nodes[0].fontStyle(
          s.includes('bold') ? s.replace('bold', '').trim() :
                               `${s} bold`.trim());
      objectLayer.draw();
      updateTextToolbar(nodes[0]);
    }
  });
  italicBtn.addEventListener('click', () => {
    const nodes = tr.nodes();
    if (nodes.length === 1 && nodes[0].name() === 'text-object') {
      const s = nodes[0].fontStyle();
      nodes[0].fontStyle(
          s.includes('italic') ? s.replace('italic', '').trim() :
                                 `${s} italic`.trim());
      objectLayer.draw();
      updateTextToolbar(nodes[0]);
    }
  });
  underlineBtn.addEventListener('click', () => {
    const nodes = tr.nodes();
    if (nodes.length === 1 && nodes[0].name() === 'text-object') {
      nodes[0].textDecoration(
          nodes[0].textDecoration() === 'underline' ? '' : 'underline');
      objectLayer.draw();
      updateTextToolbar(nodes[0]);
    }
  });
  textHighlightColorInput.addEventListener('input', (e) => {
    const nodes = tr.nodes();
    if (nodes.length === 1 && nodes[0].name() === 'text-object') {
      nodes[0].fill(e.target.value);
      objectLayer.draw();
      updateTextToolbar(nodes[0]);
    }
  });

  // --- Main Event Handlers ---
  stage.on('click tap', function(e) {
    if (e.evt.button === 2) return;  // Ignore right-clicks for selection

    if (document.querySelector('body > textarea')) return;
    const transform = stage.getAbsoluteTransform().copy().invert();
    const pos = transform.point(stage.getPointerPosition());

    if (tool === 'placement') {
      addSticker(pos, stickerColor);
      setTool('selection');
      return;
    }
    if (tool === 'text') {
      addTextField(pos);
      setTool('selection');
      return;
    }
    if (e.target === stage) {
      tr.nodes([]);
      hideTextToolbar();
      objectLayer.draw();  // Redraw to clear transformer
      drawingLayer
          .draw();  // Redraw drawing layer to clear transformer on strokes
      return;
    }
    if (e.target.findAncestor('.konvajs-content') &&
        e.target.getParent().hasName('konva-transformer'))
      return;

    const target = e.target.findAncestor('.sticker-group') ||
        (e.target.name() === 'text-object' ? e.target : null) ||
        (e.target.name() === 'stroke-object' ? e.target :
                                               null);  // Include stroke objects
    if (target && tool === 'selection') {
      if (e.evt.shiftKey) {
        const nodes = tr.nodes().slice();
        const index = nodes.indexOf(target);
        index >= 0 ? nodes.splice(index, 1) : nodes.push(target);
        tr.nodes(nodes);
      } else if (!tr.nodes().includes(target)) {
        tr.nodes([target]);
      }
      target.moveToTop();  // Bring selected object to top
      tr.moveToTop();      // Ensure transformer is on top
    } else {
      tr.nodes([]);
    }

    const selectedNodes = tr.nodes();
    if (selectedNodes.length === 1 &&
        selectedNodes[0].name() === 'text-object') {
      tr.enabledAnchors(['middle-left', 'middle-right']);
      tr.keepRatio(false);
      updateTextToolbar(selectedNodes[0]);
    } else if (
        selectedNodes.length === 1 &&
        selectedNodes[0].name() === 'stroke-object') {  // Handle stroke objects
      tr.enabledAnchors(
          ['rotater']);  // Only rotation for strokes or adjust as needed
      tr.keepRatio(true);
      hideTextToolbar();
    } else {
      tr.enabledAnchors(
          ['top-left', 'top-right', 'bottom-left', 'bottom-right']);
      tr.keepRatio(true);
      hideTextToolbar();
    }
    objectLayer.draw();
    drawingLayer.draw();  // Redraw drawing layer to show/hide transformer
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
      hideTextToolbar();
      objectLayer.draw();  // Redraw to clear transformer
      drawingLayer
          .draw();  // Redraw drawing layer to clear transformer on strokes
    }
    if (e.key.toLowerCase() === 'v') setTool('selection');
    if (e.key.toLowerCase() === 'a') setTool('placement');
    if (e.key.toLowerCase() === 't') setTool('text');
    if (e.key.toLowerCase() === 'd') setTool('drawing');
    if (e.key.toLowerCase() === 'e') setTool('eraser');
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
      hideTextToolbar();
    }
  });
  window.addEventListener('resize', () => {
    stage.width(window.innerWidth).height(window.innerHeight);
    drawGrid();
  });
});
