import { adjustText } from './stickers.js';

// Форматирование даты
function formatDeadline(date) {
    if (!date) return 'Без даты';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `Дедлайн: ${day}.${month}.${year} ${hours}:${minutes}`;
}

// === ОСНОВНАЯ ФУНКЦИЯ НАСТРОЙКИ СОБЫТИЙ ===
export function setupReminderEvents(group, tr, stage, objectLayer, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode) {
    const rect = group.findOne('.background');
    const text = group.findOne('.text');
    const datePlate = group.findOne('.date-plate');

    const BASE_PLATE_HEIGHT = 30;
    const PLATE_MARGIN = 5;

    if (!rect || !text || !datePlate) {
        console.warn('Структура напоминания повреждена, пропускаем настройку событий', group);
        return;
    }

    const deadlineText = datePlate.findOne('Text');
    let deadlineDate;
    const savedISO = group.getAttr('deadline_iso');
    if (savedISO) {
        deadlineDate = new Date(savedISO);
    } else {
        deadlineDate = new Date(Date.now() + 86400000);
    }

    function openDatePicker() {
        const datePickerInput = document.createElement('input');
        datePickerInput.style.position = 'absolute';
        datePickerInput.style.opacity = '0';
        datePickerInput.style.pointerEvents = 'none';
        document.body.appendChild(datePickerInput);

        const fp = flatpickr(datePickerInput, {
            enableTime: true,
            dateFormat: 'd.m.Y H:i',
            time_24hr: true,
            defaultDate: deadlineDate,
            disableMobile: "true",
            onClose: () => {
                setTimeout(() => {
                    fp.destroy();
                    if (document.body.contains(datePickerInput)) {
                        document.body.removeChild(datePickerInput);
                    }
                }, 100);
            },
            onChange: (selectedDates) => {
                if (selectedDates.length > 0) {
                    deadlineDate = selectedDates[0];
                    deadlineText.text(formatDeadline(deadlineDate));
                    group.setAttr('deadline_iso', deadlineDate.toISOString());
                    objectLayer.draw();
                }
            }
        });

        fp.open();
        const groupRect = group.getClientRect();
        if (fp.calendarContainer) {
            const calendarDiv = fp.calendarContainer;

            const nodeRect = group.getClientRect();

            const stageRect = stage.container().getBoundingClientRect();

            const absX = stageRect.left + nodeRect.x;
            const absY = stageRect.top + nodeRect.y;

            const calendarWidth = calendarDiv.offsetWidth;

            const leftPos = absX + (nodeRect.width / 2) - (calendarWidth / 2);
            const topPos = absY + nodeRect.height + 10;

            calendarDiv.style.top = `${topPos}px`;
            calendarDiv.style.left = `${leftPos}px`;
            calendarDiv.style.position = 'absolute';
            calendarDiv.style.zIndex = '10000';

            calendarDiv.classList.add('arrowTop');
            calendarDiv.classList.add('arrowLeft');
        }
    }

    function startEditing() {
        text.hide();
        datePlate.hide();
        tr.nodes([]);
        objectLayer.draw();

        const textPosition = text.getAbsolutePosition();
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
            width: `${(rect.width() - PADDING * 2) * stage.scaleX()}px`,
            height: `${(rect.height() - BASE_PLATE_HEIGHT - PADDING * 2) * stage.scaleY()}px`,
            border: '1px dashed #666',
            background: 'rgba(255,255,255,0.8)',
            outline: 'none',
            resize: 'none',
            fontFamily: text.fontFamily(),
            color: text.fill(),
            textAlign: 'center',
            lineHeight: text.lineHeight(),
            fontSize: `${text.fontSize() * stage.scaleX()}px`,
            zIndex: '1000', // Поверх холста
            padding: '5px',
            boxSizing: 'border-box'
        });

        textarea.focus();

        function finishEditing() {
            text.text(textarea.value);

            group.setAttr('text_content', textarea.value);

            // Подгоняем размер шрифта (используем импортированную adjustText)
            adjustText(text, rect, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode);

            // Центрируем текст по вертикали
            const textHeight = text.getClientRect({ skipTransform: true }).height;
            const availableHeight = rect.height() - BASE_PLATE_HEIGHT - PLATE_MARGIN;
            const startY = BASE_PLATE_HEIGHT + PLATE_MARGIN;
            text.y(startY + (availableHeight - textHeight) / 2);

            text.show();
            datePlate.show();

            if (document.body.contains(textarea)) {
                document.body.removeChild(textarea);
            }

            // Возвращаем выделение
            tr.nodes([group]);
            if (window.API_SAVE_BOARD) window.API_SAVE_BOARD();
            objectLayer.draw();
        }

        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                textarea.blur();
            }
            if (e.key === 'Escape') {
                textarea.value = lastValidText; // Отмена
                textarea.blur();
            }
        });

        textarea.addEventListener('blur', finishEditing);
    }



    // --- ПРИВЯЗКА СОБЫТИЙ ---
    datePlate.off('click tap mousedown touchstart');

    datePlate.on('mousedown touchstart', (e) => {
        e.cancelBubble = true;
    });

    datePlate.on('click tap', (e) => {
        e.cancelBubble = true;
        openDatePicker();
    });

    group.off('dblclick dbltap');
    group.on('dblclick dbltap', (e) => {
        const clickedOnPlate = e.target.findAncestor('.date-plate') || e.target.name() === 'date-plate';
        if (clickedOnPlate) return;

        startEditing();
    });

    group.on('dragstart', () => {
        group.moveToTop();
        tr.moveToTop();
        rect.shadowOffsetX(10);
        rect.shadowOffsetY(10);
        rect.shadowBlur(15);
    });

    group.on('dragend', () => {
        rect.shadowOffsetX(5);
        rect.shadowOffsetY(5);
        rect.shadowBlur(10);
        if (window.API_SAVE_BOARD) window.API_SAVE_BOARD();
    });

    group.on('transformstart', () => {
        tr.keepRatio(false);
        tr.nodes([group]);
    });
    // 3. Пересчет размеров при трансформации
    group.on('transformend', () => {

        const scaleX = group.scaleX();
        const scaleY = group.scaleY();

        group.scale({ x: 1, y: 1 });

        const oldWidth = group.width();
        const oldHeight = group.height();

        const newWidth = Math.max(100, oldWidth * scaleX);
        const newHeight = Math.max(100, oldHeight * scaleY);

        group.width(newWidth);
        group.height(newHeight);

        const datePlate = group.findOne('.date-plate');

        if (datePlate) {
            const plateBg = datePlate.findOne('Rect');
            const plateText = datePlate.findOne('Text');
            if (plateBg) {
                plateBg.width(newWidth);
            }
            if (plateText) {
                plateText.width(newWidth);
            }
        }

        const rectY = BASE_PLATE_HEIGHT + PLATE_MARGIN;
        const rectHeight = newHeight - rectY;

        rect.width(newWidth);
        rect.height(Math.max(50, rectHeight));
        rect.y(rectY);

        text.width(newWidth - PADDING * 2);
        text.x(PADDING);

        adjustText(text, rect, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode);

        const textH = text.getClientRect({ skipTransform: true }).height;
        text.y(rectY + (rect.height() - textH) / 2);

        tr.forceUpdate();

        group.clearCache();
        objectLayer.batchDraw();
        if (window.API_SAVE_BOARD) window.API_SAVE_BOARD();
    });

    datePlate.off('click tap mousedown touchstart');
    datePlate.on('mousedown touchstart', (e) => { e.cancelBubble = true; });
    datePlate.on('click tap', (e) => {
        e.cancelBubble = true;
        openDatePicker();
    });

    group.off('dblclick dbltap');
    group.on('dblclick dbltap', (e) => {
        const clickedOnPlate = e.target.findAncestor('.date-plate') || e.target.name() === 'date-plate';
        if (clickedOnPlate) return;
        startEditing();
    });
}


// === ФУНКЦИЯ СОЗДАНИЯ НАПОМИНАНИЯ (ASYNC) ===
export function renderReminder(pos, color, objectLayer, tr, stage, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode, existingData = null) {

    const serverId = existingData ? existingData.id.toString() : undefined;
    const geo = existingData?.geometry || {};
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
        name: 'reminder-group',
        id: serverId
    });

    const contentText = existingData ? existingData.content : '';
    const taskData = existingData ? existingData.task_data : {};
    let deadlineIso = taskData.due_date || new Date(Date.now() + 86400000).toISOString();
    const deadlineDate = new Date(deadlineIso);

    group.setAttr('text_content', contentText);
    group.setAttr('deadline_iso', deadlineIso);
    group.setAttr('is_completed', taskData.is_completed || false);

    objectLayer.add(group);

    const BASE_STICKER_SIZE = w;
    const BASE_PLATE_HEIGHT = 30;
    const PLATE_MARGIN = 5;

    // 3. Создаем Плашку Даты (с именем класса .date-plate)
    const datePlate = new Konva.Group({
        y: 0,
        name: 'date-plate'
    });

    const plateBg = new Konva.Rect({
        width: w,
        height: BASE_PLATE_HEIGHT,
        fill: '#f0f0f0',
        stroke: '#ccc',
        cornerRadius: 5
    });

    const deadlineText = new Konva.Text({
        text: formatDeadline(deadlineDate),
        fontSize: 14,
        fill: '#333',
        width: w,
        height: BASE_PLATE_HEIGHT,
        verticalAlign: 'middle',
        align: 'center'
    });

    datePlate.add(plateBg, deadlineText);
    group.add(datePlate);

    // 4. Создаем Основной Фон (с именем .background)
    const rect = new Konva.Rect({
        x: 0,
        y: BASE_PLATE_HEIGHT + PLATE_MARGIN,
        width: w,
        height: h - (BASE_PLATE_HEIGHT + PLATE_MARGIN),
        fill: fill,
        stroke: '#e6b800',
        strokeWidth: 1,
        cornerRadius: 10,
        shadowColor: 'black',
        shadowBlur: 10,
        shadowOpacity: 0.3,
        name: 'background', // ВАЖНО для поиска
    });
    group.add(rect);

    // 5. Создаем Текст (с именем .text)
    const text = new Konva.Text({
        x: PADDING,
        y: rect.y() + PADDING,
        text: contentText,
        fontFamily: 'Arial',
        fill: '#000',
        align: 'center',
        name: 'text', // ВАЖНО для поиска
        width: w - PADDING * 2,
        fontSize: 24
    });
    group.add(text);

    // 6. Подключаем события
    setupReminderEvents(group, tr, stage, objectLayer, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode);

    // Первичная подгонка текста
    adjustText(text, rect, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode);

    // Центрируем
    const textHeight = text.getClientRect({ skipTransform: true }).height;
    const workAreaH = rect.height();
    text.y(rect.y() + (workAreaH - textHeight) / 2);

    // Сразу открываем редактирование для удобства
    //group.fire('dblclick');

    tr.nodes([group]);
    objectLayer.draw();
    return group;
}

export async function addReminder(pos, color, objectLayer, tr, stage, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode) {
    const boardId = window.DJANGO_DATA?.boardId;

    if (!boardId) return;

    const assignedToId = window.DJANGO_DATA?.user?.id || window.DJANGO_DATA?.userId || null;

    try {
        const response = await fetch('/api/create_reminder/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': window.DJANGO_DATA.csrfToken
            },
            body: JSON.stringify({
                board_id: boardId,
                item_type: 'task',
                geometry: { x: pos.x, y: pos.y },
                title: 'Новое напоминание',
                task_data: {
                    assigned_to_id: assignedToId
                }
            })
        });

        const data = await response.json();

        if (data.success) {
            const newData = {
                id: data.id,
                content: '',
                task_data: { due_date: null, is_completed: false }
            };

            const group = renderReminder(pos, color, objectLayer, tr, stage, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode, newData);

            group.fire('dblclick');
            tr.nodes([group]);
        } else {
            console.error('Ошибка сервера:', data.error);
        }
    } catch (e) {
        console.error("Ошибка создания:", e);
    }
}
