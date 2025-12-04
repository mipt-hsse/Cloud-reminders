document.addEventListener('DOMContentLoaded', function() {
  const stage = new Konva.Stage({
    container: 'sticker-board',
    width: window.innerWidth,
    height: window.innerHeight,
    draggable: true,  // Make the whole board draggable
  });

  const layer = new Konva.Layer();
  stage.add(layer);

  const PADDING = 10;
  const MIN_FONT_SIZE = 15;
  const MAX_FONT_SIZE = 75;  // Increased max font size for search

  // Create a single transformer for the whole layer
  const tr = new Konva.Transformer({
    keepRatio: true,
    enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    anchorSize: 12,
    anchorCornerRadius: 6,
    borderStroke: '#007bff',
    anchorStroke: '#007bff',
    anchorFill: 'white',
  });
  layer.add(tr);

  // Helper node for measuring text
  const tempTextNode = new Konva.Text({fontFamily: 'Arial', text: ''});

  /**
   * Adjusts text size to find the largest possible font that fits without
   * breaking words.
   */
  function adjustText(textNode) {
    const rect = textNode.parent.findOne('.background');
    const maxWidth = rect.width() - PADDING;
    const maxHeight = rect.height() - PADDING;

    textNode.width(maxWidth);
    textNode.x(PADDING / 2);

    const words = textNode.text().split(/\s+/);
    const longestWord =
        words.reduce((l, c) => (c.length > l.length ? c : l), '');

    let low = MIN_FONT_SIZE;
    let high = MAX_FONT_SIZE;
    let bestFit = low;

    // Binary search for the best font size
    while (low <= high) {
      let mid = Math.floor((low + high) / 2);

      // Check if the longest word fits at this font size
      tempTextNode.fontSize(mid);
      tempTextNode.text(longestWord);
      if (tempTextNode.width() > maxWidth) {
        high = mid - 1;
        continue;  // This font size is too big even for a single word
      }

      // If the longest word fits, check the total height with wrapping
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

  function addSticker() {
    const transform = stage.getAbsoluteTransform().copy().invert();
    const pos = transform.point({x: stage.width() / 2, y: stage.height() / 2});

    const group = new Konva.Group({
      x: pos.x - 100,
      y: pos.y - 100,
      draggable: true,
    });
    layer.add(group);

    const rect = new Konva.Rect({
      width: 200,
      height: 200,
      fill: '#ffc',
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
      group.moveToTop();
      tr.moveToTop();
    });
    group.on('dragend', () => {
      rect.shadowOffsetX(5);
      rect.shadowOffsetY(5);
      rect.shadowBlur(10);
    });

    const text = new Konva.Text({
      text: '',
      fontFamily: 'Arial',
      fill: '#000',
      align: 'center',
      name: 'text',
      visible: true,
      lineHeight: 1.2,
      fontSize: MAX_FONT_SIZE,  // Start with max font size
      wrap: 'word',             // Enable word wrapping
    });
    group.add(text);

    group.on('transformend', (e) => {
      const scale = group.scaleX();
      group.scaleX(1).scaleY(1);

      const newWidth = Math.max(50, rect.width() * scale);
      rect.width(newWidth);
      rect.height(newWidth);

      const currentFontSize = text.fontSize();
      const newFontSize = Math.max(MIN_FONT_SIZE, currentFontSize * scale);
      text.fontSize(newFontSize);

      text.width(newWidth - PADDING);
      text.x(PADDING / 2);

      adjustText(text);

      group.clearCache();
      tr.nodes([group]);
      layer.batchDraw();
    });

    function startEditing() {
      tr.nodes([]);
      text.hide();
      layer.draw();

      const textPosition = group.getAbsolutePosition();
      const stageBox = stage.container().getBoundingClientRect();
      const areaPosition = {
        x: stageBox.left + textPosition.x,
        y: stageBox.top + textPosition.y,
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
        layer.draw();
        tr.nodes([group]);
        layer.draw();
      });

      updateTextareaStyle();
      textarea.focus();
    }

    group.on('dblclick dbltap', startEditing);

    adjustText(text);
    startEditing();
  }

  // Handle selecting/deselecting stickers
  stage.on('click tap', function(e) {
    // if we clicked on empty space - deselect all
    if (e.target === stage) {
      tr.nodes([]);
      layer.draw();
      return;
    }

    // if we clicked on transformer - do nothing
    if (e.target.getParent().className === 'Transformer') {
      return;
    }

    // find clicked group
    const group = e.target.findAncestor('Group');

    if (group) {
      // move group to top
      group.moveToTop();
      // attach transformer to it
      tr.nodes([group]);
      // and move transformer to top
      tr.moveToTop();
    } else {
      // we clicked on something else? deselect
      tr.nodes([]);
    }

    layer.draw();
  });

  const scaleBy = 1.1;
  stage.on('wheel', (e) => {
    e.evt.preventDefault();
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale
    };
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    stage.scale({x: newScale, y: newScale});
    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale
    };
    stage.position(newPos);
    stage.draw();
  });

  const addStickerBtn = document.getElementById('add-sticker-btn');
  if (addStickerBtn) {
    addStickerBtn.addEventListener('click', addSticker);
  }

  const saveBtn = document.getElementById('save-board-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const boardData = [];
      layer.find('Group').forEach(group => {
        const rect = group.findOne('.background');
        const text = group.findOne('text');
        if (rect && text) {
          boardData.push({
            x: group.x(),
            y: group.y(),
            width: rect.width(),
            text: text.text(),
          });
        }
      });
      console.log('Board data:', JSON.stringify(boardData, null, 2));
    });
  }

  window.addEventListener('resize', () => {
    stage.width(window.innerWidth);
    stage.height(window.innerHeight);
    stage.draw();
  });
});