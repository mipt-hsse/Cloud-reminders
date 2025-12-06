
export function setTool(
    newTool, tool, stage, objectLayer, drawingLayer, stickerColorPalette,
    drawingOptions, eraserOptions, tr, hideTextToolbar, drawGrid, isPanning,
    lastPointerPosition, setupDrawing, brushColor, brushSize, eraserSize,
    brushType, isDrawing, currentLine) {
  document.querySelectorAll('.control-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  const activeBtn = document.getElementById(`${newTool}-tool-btn`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }

  tool.current = newTool;

  stickerColorPalette.classList.toggle('hidden', newTool !== 'placement');
  drawingOptions.classList.toggle('hidden', newTool !== 'drawing');
  eraserOptions.classList.toggle('hidden', newTool !== 'eraser');

  isPanning.current = false;
  stage.off('.panning');
  stage.off('contextmenu');
  stage.off('.drawing');


  if (newTool === 'selection') {
    stage.draggable(false);
    objectLayer.listening(true);
    drawingLayer.listening(true);

    stage.on('mousedown.panning', (e) => {
      if (e.evt.button === 2) {
        isPanning.current = true;
        lastPointerPosition.current = {x: e.evt.clientX, y: e.evt.clientY};
        e.evt.preventDefault();
      }
    });

    stage.on('mousemove.panning', (e) => {
      if (isPanning.current) {
        const dx = e.evt.clientX - lastPointerPosition.current.x;
        const dy = e.evt.clientY - lastPointerPosition.current.y;

        stage.x(stage.x() + dx);
        stage.y(stage.y() + dy);
        lastPointerPosition.current = {x: e.evt.clientX, y: e.evt.clientY};
        drawGrid();
        objectLayer.batchDraw();
        drawingLayer.batchDraw();
      }
    });

    stage.on('mouseup.panning', () => {
      isPanning.current = false;
    });

    stage.on('contextmenu', (e) => {
      e.evt.preventDefault();
    });

  } else if (newTool === 'drawing' || newTool === 'eraser') {
    stage.draggable(false);
    objectLayer.listening(false);
    drawingLayer.listening(false);

    // Re-attach drawing listeners
    setupDrawing(
        stage, drawingLayer, brushColor, brushSize, eraserSize, brushType, tool,
        isDrawing, currentLine);

  } else {  // placement, text
    stage.draggable(false);
    objectLayer.listening(true);
    drawingLayer.listening(true);
  }

  if (newTool !== 'selection') {
    tr.nodes([]);
    hideTextToolbar();
  }
}
