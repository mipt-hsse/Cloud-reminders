/**
 * Создает редактируемое текстовое поле (textarea) поверх узла Konva.Text.
 */
export function advancedTextEdit(textNode, stage, layer, tr) {
    if (document.querySelector('body > textarea')) return;

    textNode.hide();
    tr.nodes([]);
    layer.draw();

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.value = textNode.text();

    const absPos = textNode.getAbsolutePosition();
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

    const finishEditing = () => {
        if (!document.body.contains(textarea)) return;
        textNode.text(textarea.value);
        textNode.show();
        document.body.removeChild(textarea);
        tr.nodes([textNode]);
        layer.draw();
    };

    textarea.addEventListener('blur', finishEditing);
    textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
        textNode.width(Math.min(500, textarea.clientWidth));
    });
    textarea.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Escape') {
            e.preventDefault();
            textarea.blur();
        }
    });
}

// === НОВАЯ ФУНКЦИЯ: Гидратация текста ===
export function setupTextEvents(textNode, objectLayer, tr, stage) {
    textNode.off('dblclick dbltap transform');
    
    textNode.on('dblclick dbltap', () => advancedTextEdit(textNode, stage, objectLayer, tr));

    textNode.on('transform', () => {
        textNode.width(Math.max(20, textNode.width() * textNode.scaleX()));
        textNode.scale({ x: 1, y: 1 });
    });
}


/**
 * Добавляет новое текстовое поле на сцену.
 */
export function addTextField(pos, objectLayer, tr, stage) {
    const textNode = new Konva.Text({
        x: pos.x,
        y: pos.y,
        text: 'Новый текст',
        fontSize: 30,
        fontFamily: 'Arial',
        fill: '#000000',
        padding: 10,
        draggable: true,
        name: 'text-object',
        width: 200
    });
    objectLayer.add(textNode);

    // Гидратация
    setupTextEvents(textNode, objectLayer, tr, stage);

    tr.nodes([textNode]);
    advancedTextEdit(textNode, stage, objectLayer, tr);
    objectLayer.draw();
}

export function hideTextToolbar(textToolbar) {
    if (textToolbar) {
        textToolbar.classList.add('hidden');
    }
}

function rgbToHex(rgb) {
  if (!rgb || !rgb.startsWith('rgb')) return rgb;
  const result = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(rgb);
  if (!result) return '#000000';
  return `#${
      ((1 << 24) + (parseInt(result[1]) << 16) + (parseInt(result[2]) << 8) +
       parseInt(result[3]))
          .toString(16)
          .slice(1)
          .toLowerCase()}`;
}

export function updateTextToolbar(
    node, textToolbar, fontSizeInput, boldBtn, italicBtn, underlineBtn,
    textHighlightColorInput) {
  if (!node || node.name() !== 'text-object' || !textToolbar) {
    hideTextToolbar(textToolbar);
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

export function setupTextToolbarHandlers(
    tr, objectLayer, textToolbar, fontSizeInput, boldBtn, italicBtn,
    underlineBtn, textHighlightColorInput) {
  if (!textToolbar) return;

  const getSelectedTextNode = () => {
    const nodes = tr.nodes();
    if (nodes.length === 1 && nodes[0].name() === 'text-object') {
      return nodes[0];
    }
    return null;
  };

  const updateNode = (callback) => {
    const node = getSelectedTextNode();
    if (node) {
      callback(node);
      objectLayer.draw();
      updateTextToolbar(
          node, textToolbar, fontSizeInput, boldBtn, italicBtn, underlineBtn,
          textHighlightColorInput);
    }
  };

  fontSizeInput.addEventListener(
      'input',
      (e) => updateNode(node => node.fontSize(parseInt(e.target.value, 10))));
  textHighlightColorInput.addEventListener(
      'input', (e) => updateNode(node => node.fill(e.target.value)));

  boldBtn.addEventListener(
      'click', () => updateNode(node => {
                 const currentStyle = node.fontStyle();
                 node.fontStyle(
                     currentStyle.includes('bold') ?
                         currentStyle.replace('bold', '').trim() :
                         `${currentStyle} bold`.trim());
               }));

  italicBtn.addEventListener(
      'click', () => updateNode(node => {
                 const currentStyle = node.fontStyle();
                 node.fontStyle(
                     currentStyle.includes('italic') ?
                         currentStyle.replace('italic', '').trim() :
                         `${currentStyle} italic`.trim());
               }));

  underlineBtn.addEventListener(
      'click', () => updateNode(node => {
                 node.textDecoration(
                     node.textDecoration() === 'underline' ? '' : 'underline');
               }));
}
