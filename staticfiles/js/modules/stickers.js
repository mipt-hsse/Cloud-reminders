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
export function setupStickerEvents(group, tr, stage, objectLayer, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode) {
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
    });

    group.on('transformstart', () => {
        group.moveToTop();
        tr.moveToTop();
        tr.keepRatio(true);
        tr.enabledAnchors(['top-left', 'top-right', 'bottom-left', 'bottom-right']);
    });

    group.on('transformend', () => {
        const scaleX = group.scaleX();
        const scaleY = group.scaleY();
        group.scale({ x: 1, y: 1 });
        const newSize = Math.max(50, rect.width() * Math.max(scaleX, scaleY));
        rect.width(newSize).height(newSize);

        adjustText(text, rect, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode);
        group.clearCache();
        tr.nodes([group]);
        objectLayer.batchDraw();
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
            text.text(lastValidText);
            text.show();
            if(document.body.contains(textarea)) document.body.removeChild(textarea);
            objectLayer.draw();
            tr.nodes([group]);
            objectLayer.draw();
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
export function addSticker(pos, color, objectLayer, tr, stage, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode) {
    const group = new Konva.Group({ 
        x: pos.x - 100, 
        y: pos.y - 100, 
        draggable: true, 
        name: 'sticker-group' 
    });
    
    objectLayer.add(group);
    group.moveToTop();

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

    // Вызываем гидратацию
    setupStickerEvents(group, tr, stage, objectLayer, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode);

    // Инициализация текста и вход в редактирование
    adjustText(text, rect, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode);
    
    // Эмулируем событие dblclick для входа в редактирование сразу после создания
    group.fire('dblclick');
    
    tr.nodes([group]);
    objectLayer.draw();
}
export function bindStickerEvents(group, tr, stage, objectLayer, ...params) {
    const text = group.findOne('.text');
    const rect = group.findOne('.background');

    group.on('dragstart', () => { /* Ваша логика тени */ });
    group.on('dragend', () => { /* Ваша логика тени */ });
    
    group.on('transformend', () => { 
        /* Ваша логика пересчета размера и adjustText */ 
    });

    group.on('dblclick dbltap', () => {
        // Логика startEditing
    });
}