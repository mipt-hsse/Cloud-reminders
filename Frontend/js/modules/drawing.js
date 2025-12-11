
export function setupDrawing(
    stage, drawingLayer, brushColor, brushSize, eraserSize, brushType, tool,
    isDrawing, currentLine) {
  stage.on('mousedown.drawing', (e) => {
    if (tool.current !== 'drawing' && tool.current !== 'eraser') return;
    if (e.target !== stage && tool.current !== 'eraser') return;

    isDrawing.current = true;
    const pos = stage.getPointerPosition();
    const transform = stage.getAbsoluteTransform().copy().invert();
    const transformedPos = transform.point(pos);
    let compositeOp = 'source-over', size = brushSize.current / stage.scaleX();

    if (tool.current === 'eraser') {
      compositeOp = 'destination-out';
      size = eraserSize.current / stage.scaleX();
    } else if (brushType.current === 'highlighter') {
      compositeOp = 'multiply';
    }
    currentLine.current = new Konva.Line({
      stroke: tool.current === 'eraser' ? 'rgba(0,0,0,1)' : brushColor.current,
      strokeWidth: size,
      globalCompositeOperation: compositeOp,
      points: [transformedPos.x, transformedPos.y],
      lineCap: 'round',
      opacity: brushType.current === 'highlighter' ? 0.5 : 1,
      name: tool.current === 'eraser' ? undefined : 'stroke-object',
      listening: tool.current !== 'eraser'
    });
    drawingLayer.add(currentLine.current);
  });

  stage.on('mousemove.drawing', () => {
    if (!isDrawing.current) return;
    const pos = stage.getPointerPosition();
    const transform = stage.getAbsoluteTransform().copy().invert();
    const transformedPos = transform.point(pos);
    const newPoints = currentLine.current.points().concat(
        [transformedPos.x, transformedPos.y]);
    currentLine.current.points(newPoints);
    drawingLayer.batchDraw();
  });
  stage.on('mouseup.drawing mouseleave.drawing', () => {
    isDrawing.current = false;
  });
}

export function setBrushType(type, penBtn, highlighterBtn, brushType) {
  brushType.current = type;
  if (type === 'pen') {
    penBtn.classList.add('active');
    highlighterBtn.classList.remove('active');
  } else {
    highlighterBtn.classList.add('active');
    penBtn.classList.remove('active');
  }
}

export function setBrushColor(color, brushColor) {
  brushColor.current = color;
}

export function setBrushSize(size, brushSize) {
  brushSize.current = size;
}

export function setEraserSize(size, eraserSize) {
  eraserSize.current = size;
}
