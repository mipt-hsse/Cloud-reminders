export function adjustText(textNode, rect, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode) {
    const maxWidth = rect.width() - PADDING * 2;
    const maxHeight = rect.height() - PADDING * 2;

    textNode.width(maxWidth);
    textNode.x(PADDING);

    const words = textNode.text().split(/\s+/);
    const longestWord = words.reduce((l, c) => (c.length > l.length ? c : l), '');

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
        if (textNode.getClientRect({ skipTransform: true }).height > maxHeight) {
            high = mid - 1;
        } else {
            bestFit = mid;
            low = mid + 1;
        }
    }

    textNode.fontSize(bestFit);
    const textHeight = textNode.getClientRect({ skipTransform: true }).height;
    textNode.y((rect.height() - textHeight) / 2);

    return textNode.getClientRect({ skipTransform: true }).height <= maxHeight;
}

// === НОВАЯ ФУНКЦИЯ: Навешивание событий (ГИДРАТАЦИЯ) ===
export function setupStickerEvents(group, tr, stage, objectLayer, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode, onMove = null) {
    const rect = group.findOne('.background');
    const text = group.findOne('.text');

    // Восстанавливаем ссылки на tempTextNode, если они потерялись (опционально)
    // Но лучше передавать его аргументом.

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
        if (onMove) onMove(group.id());
        if (window.API_SAVE_BOARD) window.API_SAVE_BOARD();
    });
    group.on('dragmove', () => {
        if (onMove) onMove(group.id());
    });

    // group.on('transformstart', () => {
    //     group.moveToTop();
    //     tr.moveToTop();
    //     tr.keepRatio(true);
    //     tr.enabledAnchors(['top-left', 'top-right', 'bottom-left', 'bottom-right']);
    // });

    group.on('transformend', () => {

        const scaleX = group.scaleX();
        const scaleY = group.scaleY();

        group.scale({ x: 1, y: 1 });

        const oldWidth = group.width();
        const oldHeight = group.height();
        const newWidth = Math.max(50, oldWidth * scaleX);
        const newHeight = Math.max(50, oldHeight * scaleY);

        group.width(newWidth);
        group.height(newHeight);

        rect.width(newWidth);
        rect.height(newHeight);

        text.width(newWidth);


        adjustText(text, rect, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode);

        tr.forceUpdate();

        group.clearCache();
        objectLayer.batchDraw();

        if (onMove) onMove(group.id());
        if (window.API_SAVE_BOARD) window.API_SAVE_BOARD();
    });

    // Логика редактирования текста
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

        // Стилизация textarea
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
            const fits = adjustText(text, rect, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode);

            if (fits) {
                lastValidText = textarea.value;
                const newFontSize = text.fontSize();
                textarea.style.fontSize = `${newFontSize * stage.scaleX()}px`;
                const textHeight = text.getClientRect({ skipTransform: true }).height;
                const paddingTop = (rect.height() - textHeight) / 2;
                textarea.style.paddingTop = `${Math.max(0, paddingTop) * stage.scaleY()}px`;
            } else {
                textarea.value = lastValidText;
                text.text(lastValidText || ' ');
                adjustText(text, rect, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode);
            }
        }

        textarea.addEventListener('input', updateTextareaStyle);

        textarea.addEventListener('blur', () => {
            const val = textarea.value;
            text.text(val);
            text.show();
            group.setAttr('content_payload', val);
            if (document.body.contains(textarea)) document.body.removeChild(textarea);
            objectLayer.draw();
            tr.nodes([group]);
            objectLayer.draw();
            if (window.API_SAVE_BOARD) window.API_SAVE_BOARD();
        });

        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                textarea.blur();
            }
        });

        updateTextareaStyle();
        textarea.focus();
    }

    // Удаляем старые обработчики перед добавлением новых (на случай повторного вызова)
    group.off('dblclick dbltap');
    group.on('dblclick dbltap', startEditing);
}

// === ФУНКЦИЯ СОЗДАНИЯ (Использует setupStickerEvents) ===
export function renderSticker(pos, color, objectLayer, tr, stage, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode, existingData = null, onMove = null) {
    const serverId = existingData ? existingData.id.toString() : undefined;
    const content = existingData ? existingData.content : '';

    const geo = existingData.geometry || {};
    const w = geo.width || 200;
    const h = geo.height || 200;
    const rotation = geo.rotation || 0;

    const style = existingData?.style || {};
    const fill = style.fill || color;

    const group = new Konva.Group({
        x: pos.x - (existingData ? 0 : w / 2),
        y: pos.y - (existingData ? 0 : h / 2),
        scaleX: 1,
        scaleY: 1,
        width: w,
        height: h,
        fill: fill,
        rotation: rotation,
        draggable: true,
        name: 'sticker-group',
        id: serverId
    });

    group.setAttr('content_payload', content);

    objectLayer.add(group);
    group.moveToTop();

    const rect = new Konva.Rect({
        width: w,
        height: h,
        fill: fill,
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

    const text = new Konva.Text({
        text: content,
        fontFamily: 'Arial',
        fill: '#000',
        align: 'center',
        name: 'text',
        visible: true,
        lineHeight: 1.2,
        fontSize: MAX_FONT_SIZE,
        wrap: 'word',
        width: w
    });
    group.add(text);

    // Вызываем гидратацию
    setupStickerEvents(group, tr, stage, objectLayer, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode, onMove);

    // Инициализация текста и вход в редактирование
    adjustText(text, rect, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode);

    // Эмулируем событие dblclick для входа в редактирование сразу после создания
    //group.fire('dblclick');

    tr.nodes([group]);
    objectLayer.draw();
    return group;
}
export async function addSticker(pos, color, objectLayer, tr, stage, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode, onMove = null) {
    const boardId = window.DJANGO_DATA?.boardId;
    if (!boardId) {
        console.error("Нет ID доски");
        return;
    }
    try {
        const response = await fetch('/api/create_reminder/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': window.DJANGO_DATA.csrfToken
            },
            body: JSON.stringify({
                board_id: boardId,
                item_type: 'sticker',
                geometry: { x: pos.x - 100, y: pos.y - 100, width: 200, height: 200 },
                style: { fill: color },
                content_payload: ''
            })
        });

        const data = await response.json();

        if (data.success) {
            const newData = {
                id: data.id,
                content: '',
                geometry: { x: pos.x - 100, y: pos.y - 100, width: 200, height: 200 },
                style: { fill: color }
            };

            const group = renderSticker(pos, color, objectLayer, tr, stage, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode, newData, onMove);

            group.fire('dblclick');
            tr.nodes([group]);
        } else {
            console.error('Ошибка создания стикера:', data.error);
        }

    } catch (e) {
        console.error('Ошибка сети:', e);
    }
}
