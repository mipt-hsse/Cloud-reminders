// board-manager.js
class BoardManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.canvas = null;
    this.isDrawingMode = false;
    this.init();
  }

  init() {
    try {
      // Создаем контейнер для доски
      this.createBoardContainer();

      // Инициализируем canvas
      this.canvas = new fabric.Canvas('drawing-board', {
        isDrawingMode: false,
        width: this.container.clientWidth,
        height: this.container.clientHeight,
        backgroundColor: '#f8f9fa',
        freeDrawingCursor: 'crosshair'
      });

      // Настраиваем кисть по умолчанию
      this.setDefaultBrush();

      // Добавляем обработчики событий
      this.setupEventListeners();

      // Включаем бесконечный режим
      this.enableInfiniteCanvas();

      // обработчик добавления картинок
      this.setupImageControls();

      // Обработчик клавиши Delete для удаления элементов
      this.setupDeleteHandler();

      console.log('Доска инициализирована успешно!');

    } catch (error) {
      console.error('Ошибка при инициализации доски:', error);
    }
  }

  createBoardContainer() {
    // Проверяем, существует ли контейнер
    if (!this.container) {
      throw new Error('Контейнер не найден!');
    }

    this.container.innerHTML = `
        <div class="board-header">
            <div class="board-tools">
                <button id="draw-mode-btn" class="tool-btn">✏️ Рисовать</button>
                <button id="select-mode-btn" class="tool-btn">↗ Выделять</button>
                <button id="add-image-btn" class="tool-btn">🖼️ Добавить изображение</button>
                <button id="delete-btn" class="tool-btn">🗑 Удалить</button>
                <button id="clear-btn" class="tool-btn">🗑 Очистить всё</button>
                <button id="zoom-in-btn" class="tool-btn">➕</button>
                <button id="zoom-out-btn" class="tool-btn">➖</button>
                <button id="reset-view-btn" class="tool-btn">⌂ Сброс</button>
                <input type="color" id="color-picker" value="#000000">
                <input type="range" id="brush-size" min="1" max="50" value="5">
                <input type="file" id="image-input" accept="image/*" style="display: none;">
            </div>
            <button id="close-board" class="close-btn">× Закрыть</button>
        </div>
        <div class="canvas-container">
            <canvas id="drawing-board"></canvas>
        </div>
    `;
  }

  setDefaultBrush() {
    this.canvas.freeDrawingBrush = new fabric.PencilBrush(this.canvas);
    this.canvas.freeDrawingBrush.width = 5;
    this.canvas.freeDrawingBrush.color = '#000000';
  }

  setupEventListeners() {
    // Переключение режимов
    document.getElementById('draw-mode-btn').addEventListener('click', () => {
      this.isDrawingMode = true;
      this.canvas.isDrawingMode = true;
      this.updateActiveTool('draw-mode-btn');
    });

    document.getElementById('select-mode-btn').addEventListener('click', () => {
      this.isDrawingMode = false;
      this.canvas.isDrawingMode = false;
      this.updateActiveTool('select-mode-btn');
    });

    // Очистка холста
    document.getElementById('clear-btn').addEventListener('click', () => {
      if (confirm('Очистить всю доску?')) {
        this.canvas.clear();
        this.canvas.backgroundColor = '#f8f9fa';
        this.canvas.renderAll();
      }
    });

    // Изменение цвета
    document.getElementById('color-picker').addEventListener('change', (e) => {
      this.canvas.freeDrawingBrush.color = e.target.value;
      if (!this.isDrawingMode) {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject) {
          activeObject.set('fill', e.target.value);
          this.canvas.renderAll();
        }
      }
    });

    // Изменение размера кисти
    document.getElementById('brush-size').addEventListener('input', (e) => {
      this.canvas.freeDrawingBrush.width = parseInt(e.target.value);
    });

    // Масштабирование
    document.getElementById('zoom-in-btn').addEventListener('click', () => {
      this.zoom(0.1);
    });

    document.getElementById('zoom-out-btn').addEventListener('click', () => {
      this.zoom(-0.1);
    });

    document.getElementById('reset-view-btn').addEventListener('click', () => {
      this.resetView();
    });

    // Закрытие доски
    document.getElementById('close-board').addEventListener('click', () => {
      this.hide();
    });

    // Обработка колесика мыши для масштабирования
    this.canvas.on('mouse:wheel', (opt) => {
      const delta = opt.e.deltaY;
      this.zoom(delta > 0 ? -0.1 : 0.1);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    // Перетаскивание холста
    this.setupPanning();

    // добавления картнки
    const addImageBtn = document.getElementById('add-image-btn');
    const imageInput = document.getElementById('image-input');

    if (addImageBtn && imageInput) {
      addImageBtn.addEventListener('click', () => {
        imageInput.click();  // Программно кликаем по скрытому input
      });

      imageInput.addEventListener('change', (e) => {
        this.handleImageUpload(e);
      });
    }

    // Обработчик для кнопки удаления
    const deleteBtn = document.getElementById('delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        this.deleteSelectedObjects();
      });
    }

    // Обработчик клавиши Delete для удаления элементов
    this.setupDeleteHandler();
  }

  setupPanning() {
    let isDragging = false;
    let lastPosX, lastPosY;

    this.canvas.on('mouse:down', (opt) => {
      if (opt.e.altKey || opt.e.ctrlKey) {  // Pan with Alt or Ctrl
        isDragging = true;
        lastPosX = opt.e.clientX;
        lastPosY = opt.e.clientY;
        this.canvas.selection = false;
        this.canvas.defaultCursor = 'grabbing';
      }
    });

    this.canvas.on('mouse:move', (opt) => {
      if (isDragging) {
        const deltaX = opt.e.clientX - lastPosX;
        const deltaY = opt.e.clientY - lastPosY;

        this.canvas.viewportTransform[4] += deltaX;
        this.canvas.viewportTransform[5] += deltaY;

        this.canvas.requestRenderAll();

        lastPosX = opt.e.clientX;
        lastPosY = opt.e.clientY;
      }
    });

    this.canvas.on('mouse:up', () => {
      isDragging = false;
      this.canvas.selection = true;
      this.canvas.defaultCursor = 'default';
    });
  }

  enableInfiniteCanvas() {
    console.log('Бесконечная доска активирована!');
  }

  zoom(delta) {
    const zoom = this.canvas.getZoom();
    const newZoom = zoom + delta * zoom;

    // Ограничиваем масштаб
    if (newZoom > 0.1 && newZoom < 10) {
      this.canvas.zoomToPoint(
          {x: this.canvas.width / 2, y: this.canvas.height / 2}, newZoom);
    }
  }

  resetView() {
    this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    this.canvas.setZoom(1);
  }

  updateActiveTool(activeToolId) {
    // Снимаем активность со всех кнопок
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    // Добавляем активность текущей кнопке
    document.getElementById(activeToolId).classList.add('active');
  }

  show() {
    this.container.style.display = 'block';
    // Обновляем размеры canvas при показе
    setTimeout(() => {
      this.canvas.setDimensions({
        width: this.container.clientWidth,
        height: this.container.clientHeight - 60  // учитываем высоту header
      });
    }, 100);
  }

  hide() {
    this.container.style.display = 'none';
  }

  // Метод для добавления простых фигур (пример)
  addRectangle() {
    const rect = new fabric.Rect({
      left: 100,
      top: 100,
      width: 100,
      height: 100,
      fill: '#ff0000',
      stroke: '#000000',
      strokeWidth: 2
    });
    this.canvas.add(rect);
  }

  handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Проверяем, что файл является изображением
    if (!file.type.match('image.*')) {
      alert('Пожалуйста, выберите файл изображения!');
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      // Создаем изображение Fabric.js
      fabric.Image.fromURL(e.target.result, (img) => {
        if (!this.canvas) return;

        // Масштабируем изображение если оно слишком большое
        const maxWidth = 400;
        const maxHeight = 400;

        if (img.width > maxWidth || img.height > maxHeight) {
          const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
          img.scale(scale);
        }

        // Центрируем изображение на холсте
        img.set({
          left: (this.canvas.width / 2 - img.width * img.scaleX / 2) +
              (this.canvas.viewportTransform[4] || 0),
          top: (this.canvas.height / 2 - img.height * img.scaleY / 2) +
              (this.canvas.viewportTransform[5] || 0),
          cornerStyle: 'circle',
          cornerColor: '#4fc3f7',
          cornerSize: 12,
          transparentCorners: false
        });

        // Добавляем на холст
        this.canvas.add(img);
        this.canvas.setActiveObject(img);
        this.canvas.renderAll();

        // Включаем режим выделения
        this.setDrawingMode(false);
      }, {crossOrigin: 'anonymous'});
    };

    reader.onerror = () => {
      alert('Ошибка при загрузке изображения!');
    };

    reader.readAsDataURL(file);
    event.target.value = '';
  }

  setupImageControls() {
    if (!this.canvas) return;

    this.canvas.on('object:added', (e) => {
      const obj = e.target;
      if (obj.type === 'image') {
        // Настраиваем возможности для изображений
        obj.set({
          borderColor: '#4fc3f7',
          cornerColor: '#4fc3f7',
          cornerSize: 12,
          transparentCorners: false,
          cornerStyle: 'circle',
          rotatingPointOffset: 40
        });
      }
    });
  }

  setupDeleteHandler() {
    // Обработчик нажатия клавиш
    document.addEventListener('keydown', (e) => {
      // Проверяем, что доска активна и нажата Delete или Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') &&
          this.container.style.display !== 'none') {
        this.deleteSelectedObjects();
        e.preventDefault();  // Предотвращаем стандартное поведение браузера
      }
    });
  }

  deleteSelectedObjects() {
    if (!this.canvas) return;

    const activeObjects = this.canvas.getActiveObjects();

    if (activeObjects && activeObjects.length > 0) {
      // Анимация удаления (опционально)
      activeObjects.forEach(obj => {
        obj.animate('opacity', 0, {
          duration: 200,
          onChange: this.canvas.renderAll.bind(this.canvas),
          onComplete: () => {
            this.canvas.remove(obj);
            this.canvas.renderAll();
          }
        });
      });

      this.canvas.discardActiveObject();

      // Показываем уведомление (опционально)
      this.showNotification(`Удалено объектов: ${activeObjects.length}`);

    } else {
      this.showNotification('Нет выделенных объектов для удаления', 'warning');
    }
  }

  // Метод для показа уведомлений (опционально)
  showNotification(message, type = 'info') {
    // Создаем временное уведомление
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'warning' ? '#ff9800' : '#4fc3f7'};
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        z-index: 1001;
        font-family: 'customfont', sans-serif;
    `;

    document.body.appendChild(notification);

    // Автоматически удаляем через 2 секунды
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 2000);
  }
}