/* Карта розвитку Castro Transit (перенесено з info/index.html) */
(() => {
  const root = document.querySelector(".transitRoadmap");
  const map = root?.querySelector(".transitFamilyMap");
  const grid = root?.querySelector(".familyTree__grid");
  if (!root || !map) return;

  const editor = {
    root: root.querySelector(".transitMapEditor"),
    toggle: document.getElementById("transitMapEditToggle"),
    add: document.getElementById("transitMapAddNode"),
    save: document.getElementById("transitMapSave"),
    exportBtn: document.getElementById("transitMapExport"),
    importBtn: document.getElementById("transitMapImport"),
    addRedLine: document.getElementById("transitMapAddRedLine"),
    addGrayLine: document.getElementById("transitMapAddGrayLine"),
    deleteLine: document.getElementById("transitMapDeleteLine"),
    reset: document.getElementById("transitMapReset"),
    status: document.getElementById("transitMapStatus"),
    panel: document.getElementById("transitMapPanel"),
    box: document.getElementById("transitMapJsonBox"),
    icon: document.getElementById("transitMapIcon"),
    title: document.getElementById("transitMapTitle"),
    level: document.getElementById("transitMapLevel"),
    category: document.getElementById("transitMapCategory"),
    description: document.getElementById("transitMapDescription"),
    req1: document.getElementById("transitMapReq1"),
    req1Value: document.getElementById("transitMapReq1Value"),
    req2: document.getElementById("transitMapReq2"),
    req2Value: document.getElementById("transitMapReq2Value"),
    reputation: document.getElementById("transitMapReputation"),
    x: document.getElementById("transitMapX"),
    y: document.getElementById("transitMapY"),
    muted: document.getElementById("transitMapMuted"),
    apply: document.getElementById("transitMapApply"),
    duplicate: document.getElementById("transitMapDuplicate"),
    remove: document.getElementById("transitMapDelete"),
  };

  const details = {
    root: document.getElementById("transitUpgradeDetails"),
    close: document.getElementById("transitUpgradeDetailsClose"),
    category: document.getElementById("transitUpgradeDetailsCategory"),
    title: document.getElementById("transitUpgradeDetailsTitle"),
    description: document.getElementById("transitUpgradeDetailsDescription"),
    req1: document.getElementById("transitUpgradeDetailsReq1"),
    req1Value: document.getElementById("transitUpgradeDetailsReq1Value"),
    req2: document.getElementById("transitUpgradeDetailsReq2"),
    req2Value: document.getElementById("transitUpgradeDetailsReq2Value"),
    reputation: document.getElementById("transitUpgradeDetailsReputation"),
  };

  const authMeUrl = "https://auth.family-castro.fun/auth/me";
  const apiBase = String(window.CASTRO_MAP_API || "https://api.family-castro.fun").replace(/\/+$/, "");
  const readUrl = `${apiBase}/info/transit-map`;
  const saveUrl = `${apiBase}/admin/info/transit-map`;
  const transitMapSchema = "transport-company-grid-v1";
  const storageKey = "family-castro-transit-map-v2";
  const allowedDiscordIds = ["916397417421738034"];
  const allowLocalEditorPreview = window.location.protocol === "file:";
  let editMode = false;
  let selected = null;
  let selectedLine = null;
  let selectedGroup = new Set();
  let lineMode = null;
  let lineStart = null;
  let drag = null;
  let panDrag = null;
  let detailsItem = null;
  const content = { width: 1720, height: 1120 };
  let scale = 0.68;
  let panX = 0;
  let panY = 0;

  function setStatus(text){
    if (editor.status) editor.status.textContent = text;
  }

  function isEditorAllowed(user){
    const discordId = String(user?.id || "");
    return allowLocalEditorPreview || allowedDiscordIds.includes(discordId);
  }

  function setEditorAccess(user){
    const allowed = isEditorAllowed(user);
    if (editor.root) editor.root.hidden = !allowed;
    if (!allowed && editMode) setEditMode(false);
  }

  async function refreshEditorAccess(){
    if (allowLocalEditorPreview) {
      setEditorAccess(window.__CASTRO_AUTH__?.user);
      return;
    }

    try{
      const res = await fetch(authMeUrl, { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => null);
      setEditorAccess(data?.ok ? data.user : null);
    }catch{
      setEditorAccess(window.__CASTRO_AUTH__?.user);
    }
  }

  function nodes(){
    return [...grid.querySelectorAll(".upgradeNode, .upgradePill, .upgradeSide")];
  }

  function lineItems(){
    return [...grid.querySelectorAll(".familyTree__lines .mapLine")];
  }

  function ensureIds(){
    nodes().forEach((node, index) => {
      if (!node.dataset.mapId) node.dataset.mapId = `transit_node_${index + 1}`;
    });
  }

  function getPosition(node){
    return {
      x: parseFloat(node.style.getPropertyValue("--left")) || 0,
      y: parseFloat(node.style.getPropertyValue("--top")) || 0,
    };
  }

  function setPosition(node, x, y){
    const safeX = Math.max(-120, Math.min(content.width + 120, Math.round(Number(x) || 0)));
    const safeY = Math.max(-120, Math.min(content.height + 120, Math.round(Number(y) || 0)));
    node.style.setProperty("--left", `${safeX}px`);
    node.style.setProperty("--top", `${safeY}px`);
    if (node === selected) fillPanel(node);
    updateConnectedLines(node);
    if (detailsItem === node) positionDetails(node);
  }

  function itemKind(item){
    if (item.classList.contains("upgradePill")) return "pill";
    if (item.classList.contains("upgradeSide")) return "side";
    if (item.classList.contains("upgradeNode--core")) return "core";
    return "node";
  }

  function readNode(node){
    const pos = getPosition(node);
    const icon = node.querySelector(".upgradeNode__icon, span")?.textContent.trim() || "";
    const title = node.querySelector("b")?.textContent.trim() || "";
    const level = itemKind(node) === "core"
      ? node.querySelector("strong")?.textContent.trim() || ""
      : node.querySelector("small")?.textContent.trim() || "";

    return {
      id: node.dataset.mapId,
      kind: itemKind(node),
      x: pos.x,
      y: pos.y,
      icon,
      title,
      level,
      category: node.dataset.category || "Логістика",
      description: node.dataset.description || `Відкриває етап “${title || "вузол"}”`,
      req1: node.dataset.req1 || "Рівень компанії:",
      req1Value: node.dataset.req1Value || "7",
      req2: node.dataset.req2 || "Працівників",
      req2Value: node.dataset.req2Value || "170 / 50",
      reputation: node.dataset.reputation || "Castro Transit",
      muted: node.classList.contains("upgradeNode--muted"),
      html: node.outerHTML,
    };
  }

  function writeNode(node, data){
    if (!node || !data) return;
    node.dataset.mapId = data.id || node.dataset.mapId;
    setPosition(node, data.x ?? getPosition(node).x, data.y ?? getPosition(node).y);
    const icon = node.querySelector(".upgradeNode__icon, span");
    const title = node.querySelector("b");
    const level = itemKind(node) === "core" ? node.querySelector("strong") : node.querySelector("small");
    if (icon && data.icon !== undefined) icon.textContent = data.icon || "🚚";
    if (title && data.title !== undefined) title.textContent = data.title || "Етап";
    if (level && data.level !== undefined) level.textContent = data.level || "";
    if (data.category !== undefined) node.dataset.category = data.category;
    if (data.description !== undefined) node.dataset.description = data.description;
    if (data.req1 !== undefined) node.dataset.req1 = data.req1;
    if (data.req1Value !== undefined) node.dataset.req1Value = data.req1Value;
    if (data.req2 !== undefined) node.dataset.req2 = data.req2;
    if (data.req2Value !== undefined) node.dataset.req2Value = data.req2Value;
    if (data.reputation !== undefined) node.dataset.reputation = data.reputation;
    node.classList.toggle("upgradeNode--muted", Boolean(data.muted) && itemKind(node) === "node");
    node.setAttribute("aria-label", [data.title, data.level].filter(Boolean).join(" "));
  }

  function serializeMap(){
    return {
      version: 1,
      schema: transitMapSchema,
      savedAt: new Date().toISOString(),
      items: nodes().map(readNode),
      lines: lineItems().map(readLine),
    };
  }

  let defaultTransitMap = null;

  function cloneTransitMap(data){
    return JSON.parse(JSON.stringify(data));
  }

  function defaultMapData(){
    return cloneTransitMap(defaultTransitMap || serializeMap());
  }

  function mapTimestamp(mapData){
    return Date.parse(mapData?.updated_at || mapData?.savedAt || "") || 0;
  }

  function normalizeTransitMap(data){
    if (!data || data.version !== 1 || !Array.isArray(data.items)) return null;
    return {
      ...data,
      schema: data.schema || transitMapSchema,
    };
  }

  function readLocalMap(){
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    try{
      return normalizeTransitMap(JSON.parse(raw));
    }catch{
      return null;
    }
  }

  function saveLocalDraft(){
    localStorage.setItem(storageKey, JSON.stringify(serializeMap(), null, 2));
  }

  function applyMapData(data){
    data = normalizeTransitMap(data);
    if (!data) return false;
    lineItems().forEach(line => line.remove());
    const existing = new Map(nodes().map(node => [node.dataset.mapId, node]));
    const savedIds = new Set(data.items.map(item => item.id));

    existing.forEach((node, id) => {
      if (!savedIds.has(id)) node.remove();
    });

    data.items.forEach((item) => {
      const node = existing.get(item.id);
      if (node) {
        writeNode(node, item);
      } else {
        createNode(item);
      }
    });

    if (Array.isArray(data.lines)) {
      data.lines.forEach((line) => createLine(line.from, line.to, line.color, line.id));
    }
    return true;
  }

  function selectNode(node){
    if (!editMode || !node) return;

    if (lineMode) {
      selectedLine?.classList.remove("mapLineSelected");
      selectedLine = null;

      if (!lineStart) {
        clearSelectedItems();
        lineStart = node;
        markSelectedItem(node);
        if (editor.panel) editor.panel.hidden = true;
        setStatus("Тепер клікни другий вузол для лінії");
        return;
      }

      createLine(lineStart.dataset.mapId, node.dataset.mapId, lineMode);
      saveLocalDraft();
      clearSelectedItems();
      lineStart = null;
      lineMode = null;
      setStatus("Лінію додано");
      return;
    }

    selectedLine?.classList.remove("mapLineSelected");
    selectedLine = null;
    clearSelectedItems();
    markSelectedItem(node);
    fillPanel(node);
    setStatus("Вузол вибрано");
  }

  function fillPanel(node){
    if (!node || !editor.panel) return;
    const data = readNode(node);
    editor.panel.hidden = false;
    editor.icon.value = data.icon;
    editor.title.value = data.title;
    editor.level.value = data.level;
    editor.category.value = data.category;
    editor.description.value = data.description;
    editor.req1.value = data.req1;
    editor.req1Value.value = data.req1Value;
    editor.req2.value = data.req2;
    editor.req2Value.value = data.req2Value;
    editor.reputation.value = data.reputation;
    editor.x.value = Math.round(data.x);
    editor.y.value = Math.round(data.y);
    editor.muted.checked = data.muted;
  }

  function applyPanel(){
    if (!selected) return;
    writeNode(selected, {
      ...readNode(selected),
      icon: editor.icon.value.trim(),
      title: editor.title.value.trim(),
      level: editor.level.value.trim(),
      category: editor.category.value.trim(),
      description: editor.description.value.trim(),
      req1: editor.req1.value.trim(),
      req1Value: editor.req1Value.value.trim(),
      req2: editor.req2.value.trim(),
      req2Value: editor.req2Value.value.trim(),
      reputation: editor.reputation.value.trim(),
      x: Number(editor.x.value),
      y: Number(editor.y.value),
      muted: editor.muted.checked,
    });
    saveLocalDraft();
    setStatus("Зміни застосовано");
  }

  function bindNode(node){
    node.addEventListener("pointerdown", (event) => {
      if (!editMode) {
        event.stopPropagation();
        showDetails(node);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      selectNode(node);
      if (lineMode) return;
      const pos = getPosition(node);
      const point = clientToMapPoint(event);
      drag = {
        node,
        pointerId: event.pointerId,
        offsetX: point.x - pos.x,
        offsetY: point.y - pos.y,
      };
      node.setPointerCapture?.(event.pointerId);
    });
  }

  function createNode(data = {}){
    const node = document.createElement("article");
    node.className = "upgradeNode";
    node.dataset.mapId = data.id || `transit_custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    node.style.setProperty("--left", `${data.x ?? 860}px`);
    node.style.setProperty("--top", `${data.y ?? 700}px`);
    node.innerHTML = `<span class="upgradeNode__icon">${data.icon || "🚚"}</span><b>${data.title || "Новий вузол"}</b><small>${data.level || "I"}</small>`;
    grid.appendChild(node);
    writeNode(node, {
      ...data,
      id: node.dataset.mapId,
      x: data.x ?? 860,
      y: data.y ?? 700,
      icon: data.icon || "🚚",
      title: data.title || "Новий вузол",
      level: data.level || "I",
      category: data.category || "Логістика",
      description: data.description || "Опис етапу розвитку транспортної компанії",
      req1: data.req1 || "Рівень компанії:",
      req1Value: data.req1Value || "7",
      req2: data.req2 || "Працівників",
      req2Value: data.req2Value || "170 / 50",
      reputation: data.reputation || "Castro Transit",
    });
    bindNode(node);
    return node;
  }

  function duplicateSelectedNode(){
    if (!selected) {
      setStatus("Спочатку вибери вузол");
      return;
    }
    if (itemKind(selected) !== "node") {
      setStatus("Дублювати можна тільки звичайний вузол");
      return;
    }

    const source = readNode(selected);
    const copy = createNode({
      ...source,
      id: `transit_custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      x: source.x + 48,
      y: source.y + 48,
      title: source.title ? `${source.title} копія` : "Новий вузол",
    });
    clearSelectedItems();
    selectNode(copy);
    saveLocalDraft();
    setStatus("Вузол дубльовано");
  }

  function setEditMode(value){
    editMode = Boolean(value);
    map.classList.toggle("is-editing", editMode);
    root.classList.toggle("is-transit-editing", editMode);
    editor.toggle.textContent = editMode ? "Вийти з редактора" : "Редагувати карту";
    if (!editMode) {
      clearSelectedItems();
      selectedLine?.classList.remove("mapLineSelected");
      selectedLine = null;
      lineMode = null;
      lineStart = null;
      if (editor.panel) editor.panel.hidden = true;
      setStatus("Режим перегляду");
    } else {
      setStatus("Клікни етап або перетягни його");
    }
  }

  function loadLocalMap(){
    const data = readLocalMap();
    return data ? applyMapData(data) : false;
  }

  async function loadTransitMap(){
    let remoteMap = null;

    try{
      const res = await fetch(`${readUrl}?t=${Date.now()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) remoteMap = normalizeTransitMap(data.map);
    }catch(e){
      console.warn("Transit map load failed", e);
    }

    const localMap = readLocalMap();
    if (localMap && (!remoteMap || mapTimestamp(localMap) >= mapTimestamp(remoteMap))) {
      applyMapData(localMap);
      setStatus(remoteMap ? "Карту ТК завантажено з новішої чернетки браузера" : "Карту ТК завантажено з браузера");
      return true;
    }

    if (remoteMap && applyMapData(remoteMap)) {
      localStorage.setItem(storageKey, JSON.stringify(remoteMap, null, 2));
      setStatus("Карту ТК завантажено з Cloudflare");
      return true;
    }

    localStorage.setItem(storageKey, JSON.stringify(defaultMapData(), null, 2));
    return false;
  }

  async function saveTransitMap(){
    const mapData = serializeMap();
    localStorage.setItem(storageKey, JSON.stringify(mapData, null, 2));
    setStatus("Збережено локально, синхронізую Cloudflare...");

    try{
      const res = await fetch(saveUrl, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ map: mapData }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setStatus(`Локально збережено. Cloudflare: ${data?.error || res.status}`);
        return false;
      }
      localStorage.setItem(storageKey, JSON.stringify(data.map || mapData, null, 2));
      setStatus("Карту ТК збережено в Cloudflare");
      return true;
    }catch(e){
      console.warn("Transit map save failed", e);
      setStatus("Локально збережено. Cloudflare недоступний");
      return false;
    }
  }

  editor.toggle?.addEventListener("click", () => setEditMode(!editMode));
  editor.add?.addEventListener("click", () => {
    if (!editMode) setEditMode(true);
    const node = createNode();
    selectNode(node);
    saveLocalDraft();
    setStatus("Новий етап додано");
  });
  editor.save?.addEventListener("click", saveTransitMap);
  editor.exportBtn?.addEventListener("click", () => {
    editor.box.value = JSON.stringify(serializeMap(), null, 2);
    editor.box.classList.add("is-open");
    editor.box.select();
    setStatus("JSON готовий до копіювання");
  });
  editor.importBtn?.addEventListener("click", () => {
    editor.box.classList.add("is-open");
    if (!editor.box.value.trim()) {
      setStatus("Встав JSON у поле і натисни імпорт ще раз");
      return;
    }
    try{
      const data = JSON.parse(editor.box.value);
      if (!applyMapData(data)) throw new Error("map apply failed");
      localStorage.setItem(storageKey, JSON.stringify(data, null, 2));
      saveTransitMap();
      setStatus("JSON імпортовано, зберігаю Cloudflare...");
    }catch{
      setStatus("Помилка JSON");
    }
  });
  editor.reset?.addEventListener("click", () => {
    if (!confirm("Скинути карту ТК до поточного дефолту і зберегти?")) return;
    localStorage.removeItem(storageKey);
    applyMapData(defaultMapData());
    saveTransitMap();
  });
  editor.apply?.addEventListener("click", applyPanel);
  editor.duplicate?.addEventListener("click", duplicateSelectedNode);
  editor.remove?.addEventListener("click", () => {
    if (!selected || selected.classList.contains("upgradeNode--core")) return;
    lineItems().forEach((line) => {
      if (line.dataset.from === selected.dataset.mapId || line.dataset.to === selected.dataset.mapId) line.remove();
    });
    selected.remove();
    selected = null;
    if (editor.panel) editor.panel.hidden = true;
    saveLocalDraft();
    setStatus("Етап видалено");
  });
  [editor.icon, editor.title, editor.level, editor.category, editor.description, editor.req1, editor.req1Value, editor.req2, editor.req2Value, editor.reputation, editor.x, editor.y, editor.muted].forEach((input) => {
    input?.addEventListener("change", applyPanel);
  });

  function startLineMode(color){
    if (!editMode) setEditMode(true);
    clearSelectedItems();
    selectedLine?.classList.remove("mapLineSelected");
    selectedLine = null;
    lineStart = null;
    lineMode = color;
    if (editor.panel) editor.panel.hidden = true;
    setStatus(`Клікни перший вузол для ${color === "gray" ? "сірої" : "червоної"} лінії`);
  }

  editor.addRedLine?.addEventListener("click", () => startLineMode("red"));
  editor.addGrayLine?.addEventListener("click", () => startLineMode("gray"));
  editor.deleteLine?.addEventListener("click", () => {
    if (!selectedLine) {
      setStatus("Спочатку клікни лінію в режимі редагування");
      return;
    }
    selectedLine.remove();
    selectedLine = null;
    saveLocalDraft();
    setStatus("Лінію видалено");
  });

  map.addEventListener("pointermove", (event) => {
    if (editMode && drag) {
      event.preventDefault();
      const point = clientToMapPoint(event);
      setPosition(drag.node, point.x - drag.offsetX, point.y - drag.offsetY);
      return;
    }
    if (!panDrag) return;
    event.preventDefault();
    const z = pageZoom();
    panX = panDrag.x + (event.clientX - panDrag.clientX) / z;
    panY = panDrag.y + (event.clientY - panDrag.clientY) / z;
    applyPan();
  });
  const endDrag = () => {
    if (drag) {
      drag.node.releasePointerCapture?.(drag.pointerId);
      drag = null;
      saveLocalDraft();
    }
    panDrag = null;
    map.classList.remove("is-dragging");
  };
  map.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".upgradeNode, .upgradePill, .upgradeSide, .upgradeDetails")) return;
    panDrag = { clientX: event.clientX, clientY: event.clientY, x: panX, y: panY };
    map.classList.add("is-dragging");
  });
  map.addEventListener("pointerup", endDrag);
  map.addEventListener("pointercancel", endDrag);
  map.addEventListener("pointerleave", endDrag);

  function clearSelectedItems(){
    selected?.classList.remove("mapItemSelected");
    selectedGroup.forEach((item) => item.classList.remove("mapItemSelected"));
    selectedGroup.clear();
    selected = null;
  }

  function markSelectedItem(item){
    selected = item;
    selectedGroup.add(item);
    item.classList.add("mapItemSelected");
  }

  function itemCenter(item){
    const pos = getPosition(item);
    return { x: pos.x + item.offsetWidth / 2, y: pos.y + item.offsetHeight / 2 };
  }

  function linePath(fromItem, toItem){
    const a = itemCenter(fromItem);
    const b = itemCenter(toItem);
    return `M${Math.round(a.x)} ${Math.round(a.y)} L${Math.round(b.x)} ${Math.round(b.y)}`;
  }

  function readLine(line){
    return {
      id: line.dataset.lineId,
      from: line.dataset.from,
      to: line.dataset.to,
      color: line.dataset.color || "red",
    };
  }

  function updateLine(line){
    const from = grid.querySelector(`[data-map-id="${line.dataset.from}"]`);
    const to = grid.querySelector(`[data-map-id="${line.dataset.to}"]`);
    if (!from || !to) {
      line.remove();
      return;
    }
    line.setAttribute("d", linePath(from, to));
  }

  function updateConnectedLines(item){
    lineItems().forEach((line) => {
      if (line.dataset.from === item.dataset.mapId || line.dataset.to === item.dataset.mapId) updateLine(line);
    });
  }

  function selectLine(line){
    if (!editMode || !line) return;
    clearSelectedItems();
    selectedLine?.classList.remove("mapLineSelected");
    selectedLine = line;
    selectedLine.classList.add("mapLineSelected");
    if (editor.panel) editor.panel.hidden = true;
    setStatus(`Вибрана ${line.dataset.color === "gray" ? "сіра" : "червона"} лінія`);
  }

  function bindLine(line){
    line.addEventListener("pointerdown", (event) => {
      if (!editMode) return;
      event.preventDefault();
      event.stopPropagation();
      selectLine(line);
    });
  }

  function createLine(fromId, toId, color = "red", id = `transit_line_${Date.now()}`){
    const svg = grid.querySelector(".familyTree__lines");
    const from = grid.querySelector(`[data-map-id="${fromId}"]`);
    const to = grid.querySelector(`[data-map-id="${toId}"]`);
    if (!svg || !from || !to || fromId === toId) return null;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    line.dataset.lineId = id;
    line.dataset.from = fromId;
    line.dataset.to = toId;
    line.dataset.color = color;
    line.classList.add("mapLine", color === "gray" ? "mapLine--gray" : "mapLine--red");
    line.setAttribute("d", linePath(from, to));
    svg.appendChild(line);
    bindLine(line);
    return line;
  }

  // Масштаб сторінки на великих екранах (/screen-scale.css, CSS zoom): clientX/Y — у екранних px,
  // а координати карти — у CSS px, тому ділимо на коефіцієнт
  function pageZoom(){
    return map.offsetWidth ? (map.getBoundingClientRect().width / map.offsetWidth) || 1 : 1;
  }

  function clientToMapPoint(event){
    const rect = map.getBoundingClientRect();
    const z = pageZoom();
    return {
      x: ((event.clientX - rect.left) / z - panX) / scale,
      y: ((event.clientY - rect.top) / z - panY) / scale,
    };
  }

  function clampTransitPan(){
    const viewW = map.clientWidth;
    const viewH = map.clientHeight;
    const scaledW = content.width * scale;
    const scaledH = content.height * scale;
    const edgePadding = 90;

    if (scaledW <= viewW - edgePadding * 2) {
      panX = (viewW - scaledW) / 2;
    } else {
      const minX = viewW - scaledW - edgePadding;
      const maxX = edgePadding;
      panX = Math.max(minX, Math.min(maxX, panX));
    }

    if (scaledH <= viewH - edgePadding * 2) {
      panY = (viewH - scaledH) / 2;
    } else {
      const minY = viewH - scaledH - edgePadding;
      const maxY = edgePadding;
      panY = Math.max(minY, Math.min(maxY, panY));
    }
  }

  function applyPan(){
    clampTransitPan();
    grid.style.setProperty("--map-scale", scale);
    grid.style.setProperty("--pan-x", `${panX}px`);
    grid.style.setProperty("--pan-y", `${panY}px`);
    if (details.root?.classList.contains("is-open") && detailsItem) positionDetails(detailsItem);
  }

  function fitMap(){
    const byWidth = map.clientWidth / content.width;
    const byHeight = map.clientHeight / content.height;
    scale = Math.max(0.48, Math.min(0.76, Math.min(byWidth, byHeight) * 1.18));
    const core = grid.querySelector(".upgradeNode--core");
    const focus = core ? itemCenter(core) : { x: content.width / 2, y: content.height / 2 };
    panX = map.clientWidth / 2 - focus.x * scale;
    panY = map.clientHeight / 2 - focus.y * scale;
    applyPan();
  }

  function positionDetails(item){
    if (!details.root || !item) return;
    const pos = getPosition(item);
    const detailW = details.root.offsetWidth || 420;
    const rawX = panX + (pos.x + item.offsetWidth + 24) * scale;
    const rawY = panY + (pos.y - 18) * scale;
    const x = Math.max(12, Math.min(map.clientWidth - detailW - 12, rawX));
    const y = Math.max(12, Math.min(map.clientHeight - 360, rawY));
    details.root.style.setProperty("--detail-left", `${Math.round(x)}px`);
    details.root.style.setProperty("--detail-top", `${Math.round(y)}px`);
  }

  function showDetails(item){
    if (!details.root || !item || itemKind(item) !== "node") return;
    const data = readNode(item);
    detailsItem = item;
    details.category.textContent = data.category || "Логістика";
    details.title.textContent = data.title || "Етап";
    details.description.textContent = data.description || "Опис";
    details.req1.textContent = data.req1 || "Рівень компанії:";
    details.req1Value.textContent = data.req1Value || "7";
    details.req2.textContent = data.req2 || "Працівників";
    details.req2Value.textContent = data.req2Value || "170 / 50";
    details.reputation.textContent = data.reputation || "Castro Transit";
    details.root.classList.add("is-open");
    details.root.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => positionDetails(item));
  }

  function hideDetails(){
    details.root?.classList.remove("is-open");
    details.root?.setAttribute("aria-hidden", "true");
    detailsItem = null;
  }

  details.root?.addEventListener("pointerdown", (event) => event.stopPropagation());
  details.root?.addEventListener("click", (event) => event.stopPropagation());
  details.close?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    hideDetails();
  });

  ensureIds();
  lineItems().forEach((line) => {
    bindLine(line);
    updateLine(line);
  });
  defaultTransitMap = serializeMap();
  nodes().forEach(bindNode);
  loadTransitMap().then(() => fitMap());
  // Карта згорнута за замовчуванням — перераховуємо масштаб, коли її розгортають
  root.addEventListener("transit-roadmap:open", () => requestAnimationFrame(fitMap));
  refreshEditorAccess();
  window.addEventListener("castro-auth", (event) => setEditorAccess(event.detail?.user));
  window.addEventListener("resize", fitMap);
})();
