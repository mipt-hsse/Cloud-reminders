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
    // 1. Надежный поиск элементов по именам (которые мы задаем при создании)
    const rect = group.findOne('.background');
    const text = group.findOne('.text');
    const datePlate = group.findOne('.date-plate'); 
    
    // Проверка на случай поврежденных данных
    if (!rect || !text || !datePlate) {
        console.warn('Структура напоминания повреждена, пропускаем настройку событий', group);
        return;
    }

    const deadlineText = datePlate.findOne('Text');
    const plateBg = datePlate.findOne('Rect');

    const BASE_STICKER_SIZE = 200;
    const BASE_PLATE_HEIGHT = 30;
    const BASE_PLATE_FONT_SIZE = 14;
    const PLATE_MARGIN = 5;

    // 2. Восстановление даты
    let deadlineDate;
    const savedISO = group.getAttr('deadline_iso');
    if (savedISO) {
        deadlineDate = new Date(savedISO);
    } else {
        deadlineDate = new Date(Date.now() + 86400000); // Завтра
    }

    // --- ЛОГИКА КАЛЕНДАРЯ (Flatpickr) ---
    function openDatePicker() {
        // Создаем невидимый инпут
        const datePickerInput = document.createElement('input');
        datePickerInput.style.position = 'absolute';
        datePickerInput.style.opacity = '0';
        datePickerInput.style.pointerEvents = 'none';
        document.body.appendChild(datePickerInput);

        // Настройка Flatpickr
        const fp = flatpickr(datePickerInput, {
            enableTime: true,
            dateFormat: 'd.m.Y H:i',
            time_24hr: true,
            defaultDate: deadlineDate,
            disableMobile: "true", // Важно для корректной работы на мобильных
            onClose: () => {
                // Удаляем мусор из DOM после закрытия
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
                    // Обновляем текст
                    deadlineText.text(formatDeadline(deadlineDate));
                    // Сохраняем в атрибут для БД
                    group.setAttr('deadline_iso', deadlineDate.toISOString());
                    objectLayer.draw(); // Перерисовываем слой
                }
            }
        });

        // Открываем календарь
        fp.open();
        
        // Позиционируем календарь рядом с напоминанием
        // Получаем координаты стикера относительно окна браузера
        const groupRect = group.getClientRect(); 
        // Если календарь создался, двигаем его контейнер
        if (fp.calendarContainer) {
            const calendarDiv = fp.calendarContainer;
            const top = groupRect.y + groupRect.height + 10;
            const left = groupRect.x;
            
            // Корректируем CSS напрямую
            calendarDiv.style.top = `${top}px`;
            calendarDiv.style.left = `${left}px`;
            calendarDiv.style.zIndex = '10000'; // Поверх всего
        }
    }

    // --- ЛОГИКА РЕДАКТИРОВАНИЯ ТЕКСТА ---
    function startEditing() {
        // Скрываем текст Konva, показываем textarea
        text.hide();
        datePlate.hide(); // Скрываем дату, чтобы не мешала
        tr.nodes([]); // Убираем рамку выделения
        objectLayer.draw();

        // Вычисляем позицию для textarea
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

        // Стили textarea
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

    // 1. Клик по ДАТЕ (открывает календарь)
    // Важно: click должен быть на datePlate, и он должен останавливать всплытие
    datePlate.off('click tap mousedown touchstart'); // Очистка старых
    
    datePlate.on('mousedown touchstart', (e) => {
        e.cancelBubble = true; // Запрещаем перетаскивание за плашку даты
    });

    datePlate.on('click tap', (e) => {
        e.cancelBubble = true; // Запрещаем выделение стикера
        openDatePicker();
    });

    // 2. Двойной клик по ТЕЛУ стикера (редактирование текста)
    group.off('dblclick dbltap');
    group.on('dblclick dbltap', (e) => {
        // Если кликнули по дате - игнорируем (там свое событие)
        const clickedOnPlate = e.target.findAncestor('.date-plate') || e.target.name() === 'date-plate';
        if (clickedOnPlate) return;
        
        startEditing();
    });

    // 3. Пересчет размеров при трансформации
    group.on('transformend', () => {
        const scaleX = group.scaleX();
        const scaleY = group.scaleY();
        group.scale({ x: 1, y: 1 }); // Сбрасываем масштаб, применяем к размерам

        const newSize = Math.max(100, rect.width() * Math.max(scaleX, scaleY));
        const scaleRatio = newSize / BASE_STICKER_SIZE;

        // Обновляем размеры плашки даты
        const newPlateHeight = BASE_PLATE_HEIGHT * scaleRatio;
        
        plateBg.width(newSize).height(newPlateHeight);
        deadlineText.width(newSize).height(newPlateHeight);
        deadlineText.fontSize(BASE_PLATE_FONT_SIZE * scaleRatio);
        
        // Обновляем размеры основного квадрата
        rect.width(newSize).height(newSize);
        rect.y(0); // Сбрасываем Y, будем считать относительно группы
        
        // Позиционируем плашку даты (сверху или внутри, как в дизайне)
        // В addReminder дата добавляется первой, потом rect.
        // Допустим, дата сверху:
        datePlate.y(0);
        rect.y(newPlateHeight + PLATE_MARGIN * scaleRatio);

        // Позиционируем текст
        text.width(newSize - PADDING * 2);
        text.x(PADDING);
        
        adjustText(text, rect, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode);

        // Центрируем текст вертикально в рабочей области (ниже даты)
        const textHeight = text.getClientRect({ skipTransform: true }).height;
        const workAreaY = rect.y();
        const workAreaH = rect.height();
        text.y(workAreaY + (workAreaH - textHeight) / 2);

        group.clearCache();
        objectLayer.batchDraw();
    });
}


// === ФУНКЦИЯ СОЗДАНИЯ НАПОМИНАНИЯ (ASYNC) ===
export async function addReminder(pos, color, objectLayer, tr, stage, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode) {
    
    // 1. Создаем ID в базе данных
    let serverId = null;
    try {
        const boardId = window.DJANGO_DATA?.boardId;
        const csrftoken = window.DJANGO_DATA?.csrfToken;

        if (boardId) {
            const response = await fetch('/api/reminders/create/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken // Используем токен из куки
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    board_id: boardId,
                    x: pos.x,
                    y: pos.y
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) serverId = data.id;
            } else {
                console.error("Ошибка сервера:", response.status);
            }
        } else {
            console.error("Board ID не найден! Напоминание будет создано локально.");
        }
    } catch (e) {
        console.error("Ошибка создания в БД", e);
    }

    // 2. Создаем группу
    const group = new Konva.Group({
        x: pos.x - 100,
        y: pos.y - 100,
        draggable: true,
        name: 'reminder-group',
        id: serverId ? serverId.toString() : undefined
    });
    group.setAttr('color', color);
    group.setAttr('text_content', 'Новое напоминание');
    
    objectLayer.add(group);

    // Константы размеров
    const BASE_STICKER_SIZE = 200;
    const BASE_PLATE_HEIGHT = 30;
    const PLATE_MARGIN = 5;
    
    let deadlineDate = new Date(Date.now() + 86400000);
    group.setAttr('deadline_iso', deadlineDate.toISOString());

    // 3. Создаем Плашку Даты (с именем класса .date-plate)
    const datePlate = new Konva.Group({ 
        y: 0, 
        name: 'date-plate' // ВАЖНО для поиска
    });
    
    const plateBg = new Konva.Rect({
        width: BASE_STICKER_SIZE,
        height: BASE_PLATE_HEIGHT,
        fill: '#f0f0f0',
        stroke: '#ccc',
        cornerRadius: 5
    });
    
    const deadlineText = new Konva.Text({
        text: formatDeadline(deadlineDate),
        fontSize: 14,
        fill: '#333',
        width: BASE_STICKER_SIZE,
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
        width: BASE_STICKER_SIZE,
        height: BASE_STICKER_SIZE,
        fill: color,
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
        text: 'Новое напоминание',
        fontFamily: 'Arial',
        fill: '#000',
        align: 'center',
        name: 'text', // ВАЖНО для поиска
        width: BASE_STICKER_SIZE - PADDING * 2,
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
    group.fire('dblclick');

    tr.nodes([group]);
    objectLayer.draw();
}
// Вспомогательная функция для получения CSRF токена из куки (Стандарт Django)
export function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            // Ищем куку с нужным именем
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}