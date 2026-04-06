// connections.js — Менеджер соединений (нитей) между стикерами

let _uidCounter = 0;
function uid() {
  return `conn_${Date.now()}_${++_uidCounter}`;
}

export class ConnectionsManager {
  constructor(connectionsLayer, objectLayer) {
    this.connectionsLayer = connectionsLayer;
    this.objectLayer = objectLayer;
    this.connections = [];
    this._previewArrow = null;
    this._activeConnId = null;
  }

  // ─── Приватные помощники ───────────────────────────────────────────────────

  /** Центр .background-прямоугольника группы */
  _groupCenter(group) {
    const bg = group.findOne('.background');
    const bx = bg ? bg.x() : 0;
    const by = bg ? bg.y() : 0;
    const w = bg ? bg.width() : 200;
    const h = bg ? bg.height() : 100;
    return {
      x: group.x() + bx + w / 2,
      y: group.y() + by + h / 2,
    };
  }

  /**
   * Точка привязки на ближайшей к targetPoint стороне .background.
   * Если targetPoint не передан — возвращает верхний центр (обратная
   * совместимость).
   */
  _anchorPoint(group, targetPoint) {
    const bg = group.findOne('.background');
    if (!bg) return {x: group.x(), y: group.y()};

    const bx = bg.x();
    const by = bg.y();
    const w = bg.width();
    const h = bg.height();

    const left = group.x() + bx;
    const right = group.x() + bx + w;
    const top = group.y() + by;
    const bottom = group.y() + by + h;
    const cx = left + w / 2;
    const cy = top + h / 2;

    if (!targetPoint) {
      // Обратная совместимость: верхний центр
      return {x: cx, y: top};
    }

    const dx = targetPoint.x - cx;
    const dy = targetPoint.y - cy;
    const hw = w / 2 || 1;
    const hh = h / 2 || 1;

    if (Math.abs(dx / hw) >= Math.abs(dy / hh)) {
      // Левая или правая сторона
      return dx >= 0 ? {x: right, y: cy}  // правая
                       :
                       {x: left, y: cy};  // левая
    } else {
      // Верхняя или нижняя сторона
      return dy >= 0 ? {x: cx, y: bottom}  // нижняя
                       :
                       {x: cx, y: top};  // верхняя
    }
  }

  /**
   * Начальное смещение ручки-изгиба от середины линии.
   * Перпендикулярно соединению — даёт плавный дугообразный изгиб.
   */
  _defaultOffset(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const bend = Math.min(dist * 0.28, 90);
    const len = Math.max(dist, 1);
    return {x: (-dy / len) * bend, y: (dx / len) * bend};
  }

  /**
   * 8 координат кубического Безье через ручку (t = 0.5).
   * Квадратичный cp: qcp = 2*handle − midpoint.
   * Конверсия в кубический: cp1 = P0 + 2/3*(qcp−P0), cp2 = P2 + 2/3*(qcp−P2).
   */
  _curvePoints(x1, y1, x2, y2, hx, hy) {
    const qx = 2 * hx - (x1 + x2) / 2;
    const qy = 2 * hy - (y1 + y2) / 2;
    return [
      x1,
      y1,
      x1 + 2 / 3 * (qx - x1),
      y1 + 2 / 3 * (qy - y1),
      x2 + 2 / 3 * (qx - x2),
      y2 + 2 / 3 * (qy - y2),
      x2,
      y2,
    ];
  }

  _makeArrow(id, points, color, style) {
    return new Konva.Arrow({
      id,
      name: 'connection-arrow',
      points,
      bezier: true,
      pointerLength: 10,
      pointerWidth: 10,
      pointerAtBeginning: false,
      fill: color,
      stroke: color,
      strokeWidth: 2.5,
      dash: style === 'dashed' ? [12, 6] : undefined,
      lineCap: 'round',
      lineJoin: 'round',
      hitStrokeWidth: 18,
      shadowColor: 'rgba(0,0,0,0.15)',
      shadowBlur: 4,
      shadowOffsetY: 1,
    });
  }

  /** Маленькая точка-якорь у стикера */
  _makeDot(x, y, color, name) {
    return new Konva.Circle({
      name,
      x,
      y,
      radius: 5,
      fill: color,
      stroke: '#fff',
      strokeWidth: 2,
      listening: false,
      shadowColor: 'rgba(0,0,0,0.2)',
      shadowBlur: 3,
    });
  }

  /** Перетаскиваемая ручка для изменения изгиба — скрыта по умолчанию */
  _makeHandle(x, y, connId) {
    return new Konva.Circle({
      id: connId + '_handle',
      name: 'connection-handle',
      x,
      y,
      radius: 7,
      fill: 'rgba(255,255,255,0.92)',
      stroke: '#4a90d9',
      strokeWidth: 2,
      draggable: true,
      opacity: 0,  // скрыта до клика по стрелке
      listening: false,  // не перехватывает события до активации
      shadowColor: 'rgba(0,0,0,0.25)',
      shadowBlur: 5,
      cursor: 'move',
    });
  }

  /** Показать ручку конкретного соединения, остальные скрыть */
  _showHandle(connId) {
    if (this._activeConnId && this._activeConnId !== connId) {
      const prev =
          this.connectionsLayer.findOne('#' + this._activeConnId + '_handle');
      if (prev) {
        prev.opacity(0);
        prev.listening(false);
      }
    }
    const handle = this.connectionsLayer.findOne('#' + connId + '_handle');
    if (handle) {
      handle.opacity(1);
      handle.listening(true);
    }
    this._activeConnId = connId;
    this.connectionsLayer.batchDraw();
  }

  /** Скрыть все ручки (вызывается из board.js при клике на пустое место) */
  hideAllHandles() {
    this.connections.forEach(conn => {
      const handle = this.connectionsLayer.findOne('#' + conn.id + '_handle');
      if (handle) {
        handle.opacity(0);
        handle.listening(false);
      }
    });
    this._activeConnId = null;
    this.connectionsLayer.batchDraw();
  }

  /** Создаёт все визуальные элементы и навешивает события для одного conn */
  _buildVisuals(conn) {
    const src = this.objectLayer.findOne('#' + conn.sourceId);
    const tgt = this.objectLayer.findOne('#' + conn.targetId);
    if (!src || !tgt) return;

    const srcCenter = this._groupCenter(src);
    const tgtCenter = this._groupCenter(tgt);
    const s = this._anchorPoint(src, tgtCenter);
    const t = this._anchorPoint(tgt, srcCenter);
    const hx = (s.x + t.x) / 2 + conn.handleOffsetX;
    const hy = (s.y + t.y) / 2 + conn.handleOffsetY;

    const pts = this._curvePoints(s.x, s.y, t.x, t.y, hx, hy);
    const arrow = this._makeArrow(conn.id, pts, conn.color, conn.style);
    const dotSrc = this._makeDot(s.x, s.y, conn.color, 'dot_src_' + conn.id);
    const dotTgt = this._makeDot(t.x, t.y, conn.color, 'dot_tgt_' + conn.id);
    const handle = this._makeHandle(hx, hy, conn.id);

    // Показываем ручку при клике по стрелке
    arrow.on('click tap', () => {
      this._showHandle(conn.id);
    });

    handle.on('dragmove', () => {
      const srcNode = this.objectLayer.findOne('#' + conn.sourceId);
      const tgtNode = this.objectLayer.findOne('#' + conn.targetId);
      if (!srcNode || !tgtNode) return;
      const sc = this._groupCenter(srcNode);
      const tc = this._groupCenter(tgtNode);
      const sp = this._anchorPoint(srcNode, tc);
      const tp = this._anchorPoint(tgtNode, sc);
      const midX = (sp.x + tp.x) / 2;
      const midY = (sp.y + tp.y) / 2;
      conn.handleOffsetX = handle.x() - midX;
      conn.handleOffsetY = handle.y() - midY;
      arrow.points(
          this._curvePoints(sp.x, sp.y, tp.x, tp.y, handle.x(), handle.y()));
      dotSrc.position(sp);
      dotTgt.position(tp);
      this.connectionsLayer.batchDraw();
    });

    const onCtx = e => {
      e.evt.preventDefault();
      this.removeConnection(conn.id);
    };
    arrow.on('contextmenu', onCtx);
    handle.on('contextmenu', onCtx);

    this.connectionsLayer.add(arrow);
    this.connectionsLayer.add(dotSrc);
    this.connectionsLayer.add(dotTgt);
    this.connectionsLayer.add(handle);
  }

  // ─── Публичное API ─────────────────────────────────────────────────────────

  addConnection(sourceGroup, targetGroup, color = '#4a90d9', style = 'solid') {
    const srcId = sourceGroup.id();
    const tgtId = targetGroup.id();
    if (!srcId || !tgtId) return null;

    // Защита от дубликатов
    if (this.connections.find(
            c => (c.sourceId === srcId && c.targetId === tgtId) ||
                (c.sourceId === tgtId && c.targetId === srcId)))
      return null;

    const srcCenter = this._groupCenter(sourceGroup);
    const tgtCenter = this._groupCenter(targetGroup);
    const s = this._anchorPoint(sourceGroup, tgtCenter);
    const t = this._anchorPoint(targetGroup, srcCenter);
    const off = this._defaultOffset(s.x, s.y, t.x, t.y);

    const conn = {
      id: uid(),
      sourceId: srcId,
      targetId: tgtId,
      color,
      style,
      handleOffsetX: off.x,
      handleOffsetY: off.y,
    };

    this._buildVisuals(conn);
    this.connections.push(conn);
    this.connectionsLayer.batchDraw();
    return conn;
  }

  /**
   * Пересчитывает нити, связанные с группой (вызывается при перемещении
   * стикера)
   */
  updateForGroup(groupId) {
    let changed = false;
    this.connections.forEach(conn => {
      if (conn.sourceId !== groupId && conn.targetId !== groupId) return;

      const src = this.objectLayer.findOne('#' + conn.sourceId);
      const tgt = this.objectLayer.findOne('#' + conn.targetId);
      if (!src || !tgt) return;

      const arrow = this.connectionsLayer.findOne('#' + conn.id);
      const handle = this.connectionsLayer.findOne('#' + conn.id + '_handle');
      const dotSrc = this.connectionsLayer.findOne('.dot_src_' + conn.id);
      const dotTgt = this.connectionsLayer.findOne('.dot_tgt_' + conn.id);
      if (!arrow) return;

      const sc = this._groupCenter(src);
      const tc = this._groupCenter(tgt);
      const s = this._anchorPoint(src, tc);
      const t = this._anchorPoint(tgt, sc);
      const hx = (s.x + t.x) / 2 + conn.handleOffsetX;
      const hy = (s.y + t.y) / 2 + conn.handleOffsetY;

      arrow.points(this._curvePoints(s.x, s.y, t.x, t.y, hx, hy));
      if (handle) handle.position({x: hx, y: hy});
      if (dotSrc) dotSrc.position(s);
      if (dotTgt) dotTgt.position(t);
      changed = true;
    });
    if (changed) this.connectionsLayer.batchDraw();
  }

  /** Удаляет конкретное соединение */
  removeConnection(id) {
    const idx = this.connections.findIndex(c => c.id === id);
    if (idx === -1) return;
    [this.connectionsLayer.findOne('#' + id),
     this.connectionsLayer.findOne('#' + id + '_handle'),
     this.connectionsLayer.findOne('.dot_src_' + id),
     this.connectionsLayer.findOne('.dot_tgt_' + id),
    ].forEach(n => n && n.destroy());
    if (this._activeConnId === id) this._activeConnId = null;
    this.connections.splice(idx, 1);
    this.connectionsLayer.batchDraw();
  }

  /** Удаляет все нити, связанные с удалённым стикером */
  removeForGroup(groupId) {
    this.connections
        .filter(c => c.sourceId === groupId || c.targetId === groupId)
        .map(c => c.id)
        .forEach(id => this.removeConnection(id));
  }

  // ─── Предпросмотр ──────────────────────────────────────────────────────────

  showPreview(fromGroup, mousePos, color = '#4a90d9') {
    const s = this._anchorPoint(fromGroup, mousePos);
    const off = this._defaultOffset(s.x, s.y, mousePos.x, mousePos.y);
    const hx = (s.x + mousePos.x) / 2 + off.x;
    const hy = (s.y + mousePos.y) / 2 + off.y;
    const pts = this._curvePoints(s.x, s.y, mousePos.x, mousePos.y, hx, hy);

    if (!this._previewArrow) {
      this._previewArrow = new Konva.Arrow({
        name: 'preview-arrow',
        points: pts,
        bezier: true,
        pointerLength: 8,
        pointerWidth: 8,
        fill: color,
        stroke: color,
        strokeWidth: 2,
        dash: [8, 5],
        opacity: 0.55,
        listening: false,
      });
      this.connectionsLayer.add(this._previewArrow);
    } else {
      this._previewArrow.points(pts);
      this._previewArrow.stroke(color);
      this._previewArrow.fill(color);
    }
    this.connectionsLayer.batchDraw();
  }

  hidePreview() {
    if (this._previewArrow) {
      this._previewArrow.destroy();
      this._previewArrow = null;
      this.connectionsLayer.batchDraw();
    }
  }

  // ─── Сериализация ──────────────────────────────────────────────────────────

  serialize() {
    return this.connections.map(c => ({
                                  id: c.id,
                                  sourceId: c.sourceId,
                                  targetId: c.targetId,
                                  color: c.color,
                                  style: c.style,
                                  handleOffsetX: c.handleOffsetX,
                                  handleOffsetY: c.handleOffsetY,
                                }));
  }

  deserialize(data) {
    this.connectionsLayer.destroyChildren();
    this.connections = [];
    this._previewArrow = null;
    this._activeConnId = null;
    if (!Array.isArray(data)) return;

    data.forEach(raw => {
      const src = this.objectLayer.findOne('#' + raw.sourceId);
      const tgt = this.objectLayer.findOne('#' + raw.targetId);
      if (!src || !tgt) return;

      const sc = this._groupCenter(src);
      const tc = this._groupCenter(tgt);
      const s = this._anchorPoint(src, tc);
      const t = this._anchorPoint(tgt, sc);
      const def = this._defaultOffset(s.x, s.y, t.x, t.y);

      const conn = {
        id: raw.id,
        sourceId: raw.sourceId,
        targetId: raw.targetId,
        color: raw.color,
        style: raw.style,
        handleOffsetX: raw.handleOffsetX ?? def.x,
        handleOffsetY: raw.handleOffsetY ?? def.y,
      };

      this._buildVisuals(conn);
      this.connections.push(conn);
    });
    this.connectionsLayer.batchDraw();
  }
}