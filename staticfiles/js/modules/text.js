export function TextEdit(textNode, stage, layer, tr) {
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
        border: 'rgba(0, 123, 255, 0.5)',
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
        textNode.setAttr('content_payload', textarea.value);
        textNode.show();
        document.body.removeChild(textarea);
        tr.nodes([textNode]);
        tr.forceUpdate();
        layer.draw();
        if (window.API_SAVE_BOARD) window.API_SAVE_BOARD();
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

export function setupTextEvents(textNode, objectLayer, tr, stage) {
    textNode.off('dblclick dbltap transform');

    textNode.on('dblclick dbltap', () => TextEdit(textNode, stage, objectLayer, tr));

    textNode.on('transform', () => {
        textNode.width(Math.max(20, textNode.width() * textNode.scaleX()));
        textNode.scale({ x: 1, y: 1 });
    });

    textNode.on('dragend', () => {
        if (window.API_SAVE_BOARD) window.API_SAVE_BOARD();
    });

}


export function renderText(pos, objectLayer, tr, stage, existingData = null) {
    const serverId = existingData ? existingData.id.toString() : undefined;
    const content = existingData ? existingData.content : 'Новый текст';

    const geo = (existingData && existingData.geometry) ? existingData.geometry : {};
    const style = (existingData && existingData.style) ? existingData.style : {};

    const w = geo.width || 200;
    const rotation = geo.rotation || 0;

    const fontSize = style.fontSize || 30;
    const fill = style.fill || '#000000';
    const fontStyle = style.fontStyle || 'normal';
    const textDecoration = style.textDecoration || '';
    // const fontFamily = style.fontFamily || 'Arial';
    // const align = style.align || 'left';

    const textNode = new Konva.Text({
        x: pos.x,
        y: pos.y,
        scaleX: 1,
        scaleY: 1,
        rotation: rotation,
        text: content,
        fontSize: fontSize,
        fontFamily: 'Arial',
        fill: fill,
        fontStyle: fontStyle,
        textDecoration: textDecoration,
        padding: 10,
        draggable: true,
        name: 'text-object',
        id: serverId,
        width: w,
    });

    textNode.setAttr('content_payload', content);

    objectLayer.add(textNode);
    setupTextEvents(textNode, objectLayer, tr, stage);

    objectLayer.draw();
    return textNode;
}

export async function addTextField(pos, objectLayer, tr, stage) {
    const boardId = window.DJANGO_DATA?.boardId;
    if (!boardId) return;

    const defaultGeo = { x: pos.x, y: pos.y, width: 200, rotation: 0 };
    const defaultStyle = { fontSize: 30, fill: '#000000', fontStyle: 'normal' };
    const defaultContent = 'Новый текст';

    try {
        const response = await fetch('/api/create_reminder/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': window.DJANGO_DATA.csrfToken
            },
            body: JSON.stringify({
                board_id: boardId,
                item_type: 'text',
                geometry: defaultGeo,
                style: defaultStyle,
                content_payload: defaultContent
            })
        });

        const data = await response.json();

        if (data.success) {
            const newData = {
                id: data.id,
                geometry: defaultGeo,
                style: defaultStyle,
                content: defaultContent
            };

            const textNode = renderText(pos, objectLayer, tr, stage, newData);

            tr.nodes([textNode]);
            objectLayer.draw();
            TextEdit(textNode, stage, objectLayer, tr);

            return textNode;
        }

    } catch (e) {
        console.error('Ошибка создания текста:', e);
    }
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
    return `#${((1 << 24) + (parseInt(result[1]) << 16) + (parseInt(result[2]) << 8) +
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
        { top: `${box.y - 60}px`, left: `${box.x}px`, display: 'flex' });

    fontSizeInput.value = node.fontSize();
    boldBtn.classList.toggle('active', node.fontStyle().includes('bold'));
    italicBtn.classList.toggle('active', node.fontStyle().includes('italic'));
    underlineBtn.classList.toggle(
        'active', node.textDecoration() === 'underline');
    textHighlightColorInput.value = rgbToHex(node.fill());
}

export function setupTextToolbarHandlers(
    getTr, getObjectLayer, textToolbar, fontSizeInput, boldBtn, italicBtn,
    underlineBtn, textHighlightColorInput) {
    if (!textToolbar) return;

    const getSelectedTextNode = () => {
        const tr = getTr();
        if (!tr) return null;
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
            const layer = getObjectLayer();
            if (layer) {
                layer.draw();
            }
            updateTextToolbar(
                node, textToolbar, fontSizeInput, boldBtn, italicBtn, underlineBtn,
                textHighlightColorInput);
        }
    };

    const saveChanges = () => {
        if (window.API_SAVE_BOARD) window.API_SAVE_BOARD();
    };

    fontSizeInput.addEventListener('input', (e) => {
        updateNode(node => node.fontSize(parseInt(e.target.value, 10)));
    });


    textHighlightColorInput.addEventListener('input', (e) => {
        updateNode(node => node.fill(e.target.value));
    });

    boldBtn.addEventListener('click', () => {
        updateNode(node => {
            const currentStyle = node.fontStyle();
            node.fontStyle(
                currentStyle.includes('bold') ?
                    currentStyle.replace('bold', '').trim() :
                    `${currentStyle} bold`.trim());
        });
        saveChanges();
    });

    italicBtn.addEventListener('click', () => {
        updateNode(node => {
            const currentStyle = node.fontStyle();
            node.fontStyle(
                currentStyle.includes('italic') ?
                    currentStyle.replace('italic', '').trim() :
                    `${currentStyle} italic`.trim());
        });
        saveChanges();
    });

    underlineBtn.addEventListener('click', () => {
        updateNode(node => {
            node.textDecoration(
                node.textDecoration() === 'underline' ? '' : 'underline');
        });
        saveChanges();
    });
}
