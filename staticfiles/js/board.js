import { setBrushColor, setBrushSize, setBrushType, setEraserSize, setupDrawing } from './modules/drawing.js';
import { addReminder, setupReminderEvents } from './modules/reminder.js';
import { setTool } from './modules/selection.js';
import { addSticker, setupStickerEvents } from './modules/stickers.js';
import { addTextField, hideTextToolbar, setupTextToolbarHandlers, updateTextToolbar, setupTextEvents } from './modules/text.js';
import { rgbToHex } from './modules/utils.js';

document.addEventListener('DOMContentLoaded', function () {
    let stage;
    let gridLayer, objectLayer, drawingLayer;
    let tr;

    // --- State & Constants ---
    let tool = { current: 'selection' };
    let stickerColor = '#ffffcc';
    let brushType = { current: 'pen' };
    let brushColor = { current: '#000000' };
    let brushSize = { current: 2 };
    let eraserSize = { current: 20 };
    let isPanning = { current: false };
    let lastPointerPosition = { current: { x: 0, y: 0 } };
    let isDrawing = { current: false };
    let currentLine = { current: null };

    const PADDING = 10;
    const MIN_FONT_SIZE = 8;
    const MAX_FONT_SIZE = 75;
    const MAX_TEXT_WIDTH = 180;
    const MIN_SCALE = 0.05, MAX_SCALE = 8.0, SCALE_BY = 1.1;
    const tempTextNode = new Konva.Text({ fontFamily: 'Arial', text: '' });


    // === ИНИЦИАЛИЗАЦИЯ ===
    const doSetTool = (newTool) => {
        if (!stage) return; 
        
        setTool(
            newTool, tool, stage, objectLayer, drawingLayer,
            stickerColorPalette, drawingOptions, eraserOptions, tr,
            () => hideTextToolbar(textToolbar), drawGrid, isPanning,
            lastPointerPosition, setupDrawing, brushColor, brushSize,
            eraserSize, brushType, isDrawing, currentLine
        )
    }
        // --- UI Elements ---
    const selectionBtn = document.getElementById('selection-tool-btn'),
        addBtn = document.getElementById('add-sticker-btn'),
        addReminderBtn = document.getElementById('add-reminder-btn'),
        textBtn = document.getElementById('text-tool-btn'),
        drawBtn = document.getElementById('draw-tool-btn'),
        eraserBtn = document.getElementById('eraser-tool-btn'),
        deleteBtn = document.getElementById('delete-btn'), 
        saveBtn = document.getElementById('save-board-btn'); 

    const stickerColorPalette = document.getElementById('color-palette'),
        drawingOptions = document.getElementById('drawing-options'),
        eraserOptions = document.getElementById('eraser-options'),
        penBtn = document.getElementById('pen-btn'),
        highlighterBtn = document.getElementById('highlighter-btn'),
        brushColorInput = document.getElementById('brush-color-input'),
        brushSizeSlider = document.getElementById('brush-size-slider'),
        eraserSizeSlider = document.getElementById('eraser-size-slider'),
        textToolbar = document.getElementById('text-toolbar'),
        fontSizeInput = document.getElementById('font-size-input'),
        boldBtn = document.getElementById('bold-btn'),
        italicBtn = document.getElementById('italic-btn'),
        underlineBtn = document.getElementById('underline-btn'),
        textHighlightColorInput = document.getElementById('text-highlight-color-input');

    
    if (window.DJANGO_DATA && window.DJANGO_DATA.boardData) {
        setTimeout(() => initStage(window.DJANGO_DATA.boardData), 50);
    } else {
        initStage();
    }
    function initStage(fromJSON = null) {
        if (stage) stage.destroy();

        if (fromJSON) {
            stage = Konva.Node.create(fromJSON, 'sticker-board');
        } else {
            stage = new Konva.Stage({
                container: 'sticker-board',
                width: window.innerWidth,
                height: window.innerHeight,
                draggable: false
            });
        }

        if (fromJSON) {
            const layers = stage.getLayers();
            gridLayer = layers[0];
            drawingLayer = layers[1];
            objectLayer = layers[2];
            tr = objectLayer.findOne('Transformer');
        } else {
            gridLayer = new Konva.Layer({ listening: false });
            drawingLayer = new Konva.Layer();
            objectLayer = new Konva.Layer();
            stage.add(gridLayer, drawingLayer, objectLayer);

            tr = new Konva.Transformer({
                rotateEnabled: false,
                anchorSize: 12,
                anchorCornerRadius: 6,
                borderStroke: '#007bff',
                anchorStroke: '#007bff',
                anchorFill: 'white',
                keepRatio: false,
                enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right']
            });
            objectLayer.add(tr);
        }

        stage.off('dragmove');
        drawGrid();
        stage.on('dragmove', drawGrid);

        bindStageEvents(stage, objectLayer, drawingLayer, tr, tempTextNode);

        // Гидратация
        if (fromJSON) {
            objectLayer.find('.sticker-group').forEach(group => {
                setupStickerEvents(group, tr, stage, objectLayer, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode);
            });
            objectLayer.find('.reminder-group').forEach(group => {
                setupReminderEvents(group, tr, stage, objectLayer, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempTextNode);
            });
            objectLayer.find('.text-object').forEach(node => {
                setupTextEvents(node, objectLayer, tr, stage);
            });
            stage.batchDraw();
        }

        doSetTool('selection'); 
    }

    // --- Функция рисования сетки ---
    function getNiceStep(e) {
        const t = Math.floor(Math.log10(e)), o = Math.pow(10, t);
        return e / o > 5 ? 10 * o : e / o > 2 ? 5 * o : e / o > 1 ? 2 * o : o
    }
    function drawGrid() {
        if (!gridLayer) return;
        gridLayer.destroyChildren();
        const e = stage.scaleX(), t = 1 / e, o = {
            x1: -stage.x() / e,
            y1: -stage.y() / e,
            x2: (stage.width() - stage.x()) / e,
            y2: (stage.height() - stage.y()) / e
        },
            a = 60 / e, i = getNiceStep(a), r = i / 5, d = r * e,
            s = Math.min(1, Math.max(0, (d - 15) / (30 - 15)));
        const n = (a, i, r) => {
            if (!a || r <= 0) return;
            const d = Math.floor(o.x1 / a) * a;
            for (let s = d; s < o.x2; s += a)
                gridLayer.add(new Konva.Line({
                    points: [s, o.y1, s, o.y2],
                    stroke: i,
                    strokeWidth: t,
                    opacity: r
                }));
            const s = Math.floor(o.y1 / a) * a;
            for (let d = s; d < o.y2; d += a)
                gridLayer.add(new Konva.Line({
                    points: [o.x1, d, o.x2, d],
                    stroke: i,
                    strokeWidth: t,
                    opacity: r
                }))
        };
        s > 0 && n(r, '#ddd', s), n(i, '#ccc', 1), gridLayer.batchDraw()
    }



    

    function bindStageEvents(stageInstance, objLayer, drawLayer, trans, tempNode) {
        stageInstance.off('click tap wheel');
        stageInstance.on('click tap', function (e) {
            if (e.evt.button === 2) return;
            if (document.querySelector('body > textarea')) return;

            const transform = stageInstance.getAbsoluteTransform().copy().invert();
            const pos = transform.point(stageInstance.getPointerPosition());

            if (tool.current === 'placement') {
                addSticker(pos, stickerColor, objLayer, trans, stageInstance, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempNode);
                doSetTool('selection');
                return;
            }
            if (tool.current === 'reminder') {
                addReminder(pos, stickerColor, objLayer, trans, stageInstance, PADDING, MIN_FONT_SIZE, MAX_FONT_SIZE, MAX_TEXT_WIDTH, tempNode);
                doSetTool('selection');
                return;
            }
            if (tool.current === 'text') {
                addTextField(pos, objLayer, trans, stageInstance);
                doSetTool('selection');
                return;
            }

            if (e.target === stageInstance) {
                trans.nodes([]);
                hideTextToolbar(textToolbar);
                objLayer.draw();
                return;
            }
            if (e.target.getParent().hasName('konva-transformer')) return;
            const target = e.target.findAncestor('.sticker-group, .reminder-group, .text-object, .stroke-object') || e.target;

            if (target && tool.current === 'selection') {
                if (e.evt.shiftKey) {
                    const nodes = trans.nodes().slice();
                    const index = nodes.indexOf(target);
                    index >= 0 ? nodes.splice(index, 1) : nodes.push(target);
                    trans.nodes(nodes);
                } else if (!trans.nodes().includes(target)) {
                    trans.nodes([target]);
                }
                target.moveToTop();
                trans.moveToTop();
            } else {
                trans.nodes([]);
            }
            
            // Логика Text Toolbar
            const selectedNodes = trans.nodes();
            if (selectedNodes.length === 1 && selectedNodes[0].name() === 'text-object') {
                trans.enabledAnchors(['middle-left', 'middle-right']);
                trans.keepRatio(false);
                updateTextToolbar(selectedNodes[0], textToolbar, fontSizeInput, boldBtn, italicBtn, underlineBtn, textHighlightColorInput);
            } else {
                trans.enabledAnchors(['top-left', 'top-right', 'bottom-left', 'bottom-right']);
                trans.keepRatio(!selectedNodes.some(node => node.name() === 'sticker-group'));
                hideTextToolbar(textToolbar);
            }
            objLayer.draw();
        });
        
        stageInstance.on('wheel', e => {
            e.evt.preventDefault();
            const t = document.querySelector('textarea');
            t && t.blur();
            const o = stageInstance.scaleX(), a = stageInstance.getPointerPosition(),
                i = { x: (a.x - stageInstance.x()) / o, y: (a.y - stageInstance.y()) / o };
            let r = e.evt.deltaY > 0 ? o / SCALE_BY : o * SCALE_BY;
            r = Math.max(MIN_SCALE, Math.min(r, MAX_SCALE));
            if (o !== r) {
                stageInstance.scale({ x: r, y: r });
                stageInstance.position({ x: a.x - i.x * r, y: a.y - i.y * r });
                drawGrid();
                hideTextToolbar(textToolbar);
            }
        });
    }

    // --- Listeners ---
    penBtn?.addEventListener('click', () => setBrushType('pen', penBtn, highlighterBtn, brushType));
    highlighterBtn?.addEventListener('click', () => setBrushType('highlighter', penBtn, highlighterBtn, brushType));
    brushColorInput?.addEventListener('input', (e) => setBrushColor(e.target.value, brushColor));
    brushSizeSlider?.addEventListener('input', (e) => setBrushSize(parseInt(e.target.value, 10), brushSize));
    eraserSizeSlider?.addEventListener('input', (e) => setEraserSize(parseInt(e.target.value, 10), eraserSize));

    selectionBtn?.addEventListener('click', () => doSetTool('selection'));
    addBtn?.addEventListener('click', () => doSetTool('placement'));
    addReminderBtn?.addEventListener('click', () => doSetTool('reminder'));
    textBtn?.addEventListener('click', () => doSetTool('text'));
    drawBtn?.addEventListener('click', () => doSetTool('drawing'));
    eraserBtn?.addEventListener('click', () => doSetTool('eraser'));

    // --- ЛОГИКА КНОПКИ СОХРАНЕНИЯ ---
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const icon = saveBtn.querySelector('i');
            const originalIconClass = icon.className;
            icon.className = 'fa-solid fa-spinner fa-spin';
            window.API_SAVE_BOARD().then(() => {
                setTimeout(() => { icon.className = originalIconClass; }, 500);
            });
        });
    }

    // --- ЛОГИКА КНОПКИ УДАЛЕНИЯ ---
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            // Если сцена не готова, выходим
            if (!tr || !objectLayer) return;

            const nodes = tr.nodes().slice();
            let needToSaveBoard = false;

            for (const node of nodes) {
                if (node.name() === 'reminder-group' && node.id()) {
                    try {
                        await fetch('/api/reminders/delete/', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRFToken': window.DJANGO_DATA.csrfToken
                            },
                            credentials: 'same-origin',
                            body: JSON.stringify({ id: node.id() })
                        });
                        console.log(`Reminder ${node.id()} removed from DB`);
                        needToSaveBoard = true; // Помечаем, что нужно обновить JSON доски
                    } catch (e) {
                        console.error("Delete error:", e);
                    }
                }
                // Удаляем визуально
                node.destroy();
                needToSaveBoard = true;
            }

            tr.nodes([]);
            hideTextToolbar(textToolbar);
            objectLayer.draw();
            if (drawingLayer) drawingLayer.draw();
            if (needToSaveBoard) {
                window.API_SAVE_BOARD();
            }
        });
    }

    // Палитра цветов
    document.querySelectorAll('.color-swatch').forEach(e => {
        const colorHex = rgbToHex(e.dataset.color);
        e.style.backgroundColor = colorHex;
        e.addEventListener('click', t => {
            stickerColor = colorHex;
            document.querySelectorAll('.color-swatch').forEach(sw => sw.style.border = '1px solid #ccc');
            e.style.border = '2px solid #007bff';
        });
    });

    // Клавиатура
    window.addEventListener('keydown', e => {
        if (document.querySelector('textarea') != null || e.target.tagName === 'INPUT') return;
        
        if (e.key === 'Backspace' || e.key === 'Delete') {
            if (deleteBtn) deleteBtn.click();
        }
        
        // Ctrl + S
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (saveBtn) saveBtn.click();
            else window.API_SAVE_BOARD();
        }
        
        if (e.key === 'Escape') {
            if (tr) tr.nodes([]);
            hideTextToolbar(textToolbar);
            if (objectLayer) objectLayer.draw();
        }
        if (e.key.toLowerCase() === 'v') doSetTool('selection');
        if (e.key.toLowerCase() === 'a') doSetTool('placement');
        if (e.key.toLowerCase() === 'r') doSetTool('reminder');
        if (e.key.toLowerCase() === 't') doSetTool('text');
        if (e.key.toLowerCase() === 'd') doSetTool('drawing');
        if (e.key.toLowerCase() === 'e') doSetTool('eraser');
    });

    window.addEventListener('resize', () => {
        if (stage) {
            stage.width(window.innerWidth).height(window.innerHeight);
            drawGrid();
        }
    });

    setupTextToolbarHandlers(tr, objectLayer, textToolbar, fontSizeInput, boldBtn, italicBtn, underlineBtn, textHighlightColorInput);
    
    // --- API FUNCTIONS ---
    window.API_SAVE_BOARD = async function() {
        if (!stage) return; // Защита
        const json = stage.toJSON();
        const boardId = window.DJANGO_DATA?.boardId;

        if (!boardId) return;

        try {
            await fetch('/api/save_board/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': window.DJANGO_DATA.csrfToken
                },
                credentials: 'same-origin',
                body: JSON.stringify({ 
                    board_data: json,
                    board_id: boardId 
                })
            });
        } catch(e) { 
            console.error(e); 
        }
    };
    
    window.API_LOAD_BOARD = function() {
        if(window.DJANGO_DATA && window.DJANGO_DATA.boardData) {
            initStage(window.DJANGO_DATA.boardData);
        }
    };
});