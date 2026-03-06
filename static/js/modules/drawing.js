async function eraseLine(stage, drawingLayer) {
  const pos = stage.getPointerPosition();
  if (!pos) return;

  const shape = stage.getIntersection(pos);
  if (shape && shape.name() === 'stroke-object') {
    const lineId = shape.id();

    shape.destroy();
    drawingLayer.batchDraw();

    if (lineId) {
      try {
        await fetch('/api/delete_reminder/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': window.DJANGO_DATA.csrfToken
          },
          body: JSON.stringify({ id: lineId })
        });
      } catch (e) {
        console.error("Ошибка при удалении линии:", e);
      }
    }
  }
}

export async function addDrawing(lineNode) {
  const boardId = window.DJANGO_DATA?.boardId;
  const csrfToken = window.DJANGO_DATA?.csrfToken;

  if (!boardId || !csrfToken) {
    console.error("[DRAWING] Ошибка: нет boardId или csrfToken");
    return;
  }


  try {
    const response = await fetch('/api/create_reminder/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken
      },
      body: JSON.stringify({
        board_id: boardId,
        item_type: 'drawing',
        geometry: {
          points: lineNode.points(),
          x: lineNode.x(),
          y: lineNode.y(),
          scaleX: lineNode.scaleX(),
          scaleY: lineNode.scaleY(),
          rotation: lineNode.rotation()
        },
        style: {
          stroke: lineNode.stroke(),
          strokeWidth: lineNode.strokeWidth(),
          globalCompositeOperation: lineNode.globalCompositeOperation(),
          opacity: lineNode.opacity(),
          lineCap: lineNode.lineCap()
        },
        content_payload: 'drawing'
      })
    });

    const data = await response.json();

    if (data.success) {
      lineNode.id(data.id.toString());

      lineNode.on('dragend transformend', () => {
        if (window.API_SAVE_BOARD) window.API_SAVE_BOARD();
      });
    } else {
      console.error('[DRAWING] Ошибка сервера:', data.error);
    }
  } catch (e) {
    console.error("[DRAWING] Ошибка сети:", e);
  }
}

export function setupDrawing(
  stage, drawingLayer, brushColor, brushSize, eraserSize, brushType, tool,
  isDrawing, currentLine) {

  stage.on('mousedown.drawing', (e) => {
    if (tool.current !== 'drawing' && tool.current !== 'eraser') return;

    isDrawing.current = true;

    if (tool.current === 'eraser') {
      eraseLine(stage, drawingLayer);
      return;
    }

    if (e.target !== stage) return;

    const pos = stage.getPointerPosition();
    const transform = stage.getAbsoluteTransform().copy().invert();
    const p = transform.point(pos);

    let compositeOp = brushType.current === 'highlighter' ? 'multiply' : 'source-over';
    let size = brushSize.current / stage.scaleX();

    currentLine.current = new Konva.Line({
      stroke: brushColor.current,
      strokeWidth: size,
      globalCompositeOperation: compositeOp,
      points: [p.x, p.y, p.x, p.y],
      lineCap: 'round',
      lineJoin: 'round',
      tension: 0.5,
      opacity: brushType.current === 'highlighter' ? 0.5 : 1,
      name: 'stroke-object',

      hitStrokeWidth: Math.max(20, size + 10),

      listening: true
    });
    drawingLayer.add(currentLine.current);
  });

  stage.on('mousemove.drawing', () => {
    if (tool.current === 'eraser' && isDrawing.current) {
      eraseLine(stage, drawingLayer);
      return;
    }

    if (!isDrawing.current || !currentLine.current) return;

    const pos = stage.getPointerPosition();
    const transform = stage.getAbsoluteTransform().copy().invert();
    const p = transform.point(pos);

    const newPoints = currentLine.current.points().concat([p.x, p.y]);
    currentLine.current.points(newPoints);
    drawingLayer.batchDraw();
  });

  stage.on('mouseup.drawing mouseleave.drawing', () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (tool.current === 'drawing' && currentLine.current) {
      addDrawing(currentLine.current);
      currentLine.current = null;
    }
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
export function setBrushColor(color, brushColor) { brushColor.current = color; }
export function setBrushSize(size, brushSize) { brushSize.current = size; }
export function setEraserSize(size, eraserSize) { eraserSize.current = size; }