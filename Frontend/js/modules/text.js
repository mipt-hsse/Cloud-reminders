
import {adjustText} from './stickers.js';

export function advancedTextEdit(
    textNode, tr, objectLayer, stage, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE,
    MAX_TEXT_WIDTH, tempTextNode, hideTextToolbar, updateTextToolbar) {
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

export function addTextField(
    pos, objectLayer, tr, PADDING, advancedTextEdit, hideTextToolbar,
    updateTextToolbar, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH,
    tempTextNode, stage) {
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
  textNode.moveToTop();
  textNode.on(
      'dblclick dbltap',
      () => advancedTextEdit(
          textNode, tr, objectLayer, stage, PADDING, MIN_FONT_SIZE,
          MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode, hideTextToolbar,
          updateTextToolbar));
  textNode.on('transform', () => {
    textNode.width(Math.max(20, textNode.width() * textNode.scaleX()));
    textNode.scale({x: 1, y: 1});
  });
  textNode.on('dragstart', () => {
    textNode.moveToTop();
    tr.moveToTop();
  });
  textNode.on('transformstart', () => {
    textNode.moveToTop();
    tr.moveToTop();
  });
  tr.nodes([textNode]);
  advancedTextEdit(
      textNode, tr, objectLayer, stage, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE,
      MAX_TEXT_WIDTH, tempTextNode, hideTextToolbar, updateTextToolbar);
  objectLayer.draw();
}

export function hideTextToolbar(textToolbar) {
  textToolbar.classList.add('hidden');
}

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

export function updateTextToolbar(
    node, textToolbar, fontSizeInput, boldBtn, italicBtn, underlineBtn,
    textHighlightColorInput) {
  if (!node || node.name() !== 'text-object') {
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
    underlineBtn, textHighlightColorInput, updateTextToolbar) {
  fontSizeInput.addEventListener('input', (e) => {
    const nodes = tr.nodes();
    if (nodes.length === 1 && nodes[0].name() === 'text-object') {
      nodes[0].fontSize(parseInt(e.target.value, 10));
      objectLayer.draw();
      updateTextToolbar(
          nodes[0], textToolbar, fontSizeInput, boldBtn, italicBtn,
          underlineBtn, textHighlightColorInput);
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
      updateTextToolbar(
          nodes[0], textToolbar, fontSizeInput, boldBtn, italicBtn,
          underlineBtn, textHighlightColorInput);
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
      updateTextToolbar(
          nodes[0], textToolbar, fontSizeInput, boldBtn, italicBtn,
          underlineBtn, textHighlightColorInput);
    }
  });
  underlineBtn.addEventListener('click', () => {
    const nodes = tr.nodes();
    if (nodes.length === 1 && nodes[0].name() === 'text-object') {
      nodes[0].textDecoration(
          nodes[0].textDecoration() === 'underline' ? '' : 'underline');
      objectLayer.draw();
      updateTextToolbar(
          nodes[0], textToolbar, fontSizeInput, boldBtn, italicBtn,
          underlineBtn, textHighlightColorInput);
    }
  });
  textHighlightColorInput.addEventListener('input', (e) => {
    const nodes = tr.nodes();
    if (nodes.length === 1 && nodes[0].name() === 'text-object') {
      nodes[0].fill(e.target.value);
      objectLayer.draw();
      updateTextToolbar(
          nodes[0], textToolbar, fontSizeInput, boldBtn, italicBtn,
          underlineBtn, textHighlightColorInput);
    }
  });
}
