/* Карта покращень сім'ї: рендер, деталі вузлів, адмін-редактор (перенесено з info/index.html) */
(() => {
  const map = document.querySelector(".familyTablet");
  const screen = map;
  const grid = document.querySelector(".familyTree__grid");
  if (!map) return;

  const editor = {
    root: document.querySelector(".mapEditor"),
    toggle: document.getElementById("mapEditToggle"),
    add: document.getElementById("mapAddNode"),
    save: document.getElementById("mapSave"),
    exportBtn: document.getElementById("mapExport"),
    importBtn: document.getElementById("mapImport"),
    addRedLine: document.getElementById("mapAddRedLine"),
    addGrayLine: document.getElementById("mapAddGrayLine"),
    deleteLine: document.getElementById("mapDeleteLine"),
    reset: document.getElementById("mapReset"),
    panel: document.getElementById("mapEditorPanel"),
    status: document.getElementById("mapEditorStatus"),
    box: document.getElementById("mapJsonBox"),
    icon: document.getElementById("mapEditIcon"),
    title: document.getElementById("mapEditTitle"),
    level: document.getElementById("mapEditLevel"),
    category: document.getElementById("mapEditCategory"),
    description: document.getElementById("mapEditDescription"),
    req1: document.getElementById("mapEditReq1"),
    req1Value: document.getElementById("mapEditReq1Value"),
    req2: document.getElementById("mapEditReq2"),
    req2Value: document.getElementById("mapEditReq2Value"),
    reputation: document.getElementById("mapEditReputation"),
    x: document.getElementById("mapEditX"),
    y: document.getElementById("mapEditY"),
    muted: document.getElementById("mapEditMuted"),
    apply: document.getElementById("mapApplySelected"),
    duplicate: document.getElementById("mapDuplicateSelected"),
    remove: document.getElementById("mapDeleteSelected"),
  };

  const details = {
    root: document.getElementById("upgradeDetails"),
    close: document.getElementById("upgradeDetailsClose"),
    category: document.getElementById("upgradeDetailsCategory"),
    title: document.getElementById("upgradeDetailsTitle"),
    description: document.getElementById("upgradeDetailsDescription"),
    req1: document.getElementById("upgradeDetailsReq1"),
    req1Value: document.getElementById("upgradeDetailsReq1Value"),
    req2: document.getElementById("upgradeDetailsReq2"),
    req2Value: document.getElementById("upgradeDetailsReq2Value"),
    reputation: document.getElementById("upgradeDetailsReputation"),
  };

  const familyTotal = document.getElementById("fcTotal2");

  function liveMembersRequirement(savedValue){
    const fallback = String(savedValue || "93 / 10");
    const separator = fallback.indexOf("/");
    if (separator === -1) return fallback;

    const total = familyTotal?.textContent.trim();
    const required = fallback.slice(separator + 1).trim();
    return /^\d+$/.test(total || "") && required
      ? `${total} / ${required}`
      : fallback;
  }

  const storageKey = "family-castro-upgrade-map-v1";
  const authMeUrl = "https://auth.family-castro.fun/auth/me";
  const mapApiBase = String(window.CASTRO_MAP_API || "https://api.family-castro.fun").replace(/\/+$/, "");
  const mapReadUrl = `${mapApiBase}/info/map`;
  const mapSaveUrl = `${mapApiBase}/admin/info/map`;
  const mapEditorAllowedDiscordIds = [
    "916397417421738034",
  ];
  const allowLocalEditorPreview = window.location.protocol === "file:";
  const content = { width: 1720, height: 1120 };
  let active = false;
  let itemDrag = null;
  let editMode = false;
  let selected = null;
  let selectedLine = null;
  let selectedGroup = new Set();
  let detailsItem = null;
  let lineMode = null;
  let lineStart = null;
  let startX = 0;
  let startY = 0;
  let startPanX = 0;
  let startPanY = 0;
  let panX = 0;
  let panY = 0;
  let scale = 0.68;
  let pointerId = null;
  const edgePadding = 90;

  function isEditorAllowed(user){
    const discordId = String(user?.id || "");
    return allowLocalEditorPreview || mapEditorAllowedDiscordIds.includes(discordId);
  }

  function setEditorAccess(user){
    const allowed = isEditorAllowed(user);
    if (editor.root) editor.root.hidden = !allowed;

    if (!allowed && editMode) {
      editMode = false;
      map.classList.remove("is-editing");
      clearSelectedItems();
      selectedLine?.classList.remove("mapLineSelected");
      selectedLine = null;
      lineMode = null;
      lineStart = null;
      if (editor.panel) editor.panel.hidden = true;
      setStatus("Редактор приховано");
    }
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
    }catch(e){
      setEditorAccess(window.__CASTRO_AUTH__?.user);
    }
  }

  function clamp(value, min, max){
    return Math.min(Math.max(value, min), max);
  }

  function applyPan(){
    grid?.style.setProperty("--map-scale", scale);
    grid?.style.setProperty("--pan-x", `${panX}px`);
    grid?.style.setProperty("--pan-y", `${panY}px`);
    if (details.root?.classList.contains("is-open") && detailsItem) positionDetails(detailsItem);
  }

  function mapItems(){
    return [...grid.querySelectorAll(".upgradeNode, .upgradePill, .upgradeSide")];
  }

  function lineItems(){
    return [...grid.querySelectorAll(".familyTree__lines .mapLine")];
  }

  function ensureIds(){
    mapItems().forEach((item, index) => {
      if (!item.dataset.mapId) item.dataset.mapId = `map_item_${index + 1}`;
    });
  }

  function getPosition(item){
    return {
      x: parseFloat(item.style.getPropertyValue("--left")) || 0,
      y: parseFloat(item.style.getPropertyValue("--top")) || 0,
    };
  }

  function setPosition(item, x, y){
    const safeX = clamp(Math.round(x), -120, content.width + 120);
    const safeY = clamp(Math.round(y), -120, content.height + 120);
    item.style.setProperty("--left", `${safeX}px`);
    item.style.setProperty("--top", `${safeY}px`);
    if (item === selected) fillPanel(item);
    updateConnectedLines(item);
    if (detailsItem === item) positionDetails(item);
  }

  function itemKind(item){
    if (item.classList.contains("upgradePill")) return "pill";
    if (item.classList.contains("upgradeSide")) return "side";
    if (item.classList.contains("upgradeNode--core")) return "core";
    return "node";
  }

  function readItem(item){
    const icon = item.querySelector(".upgradeNode__icon, span")?.textContent.trim() || "";
    const title = item.querySelector("b")?.textContent.trim() || "";
    const level = itemKind(item) === "core"
      ? item.querySelector("strong")?.textContent.trim() || ""
      : item.querySelector("small")?.textContent.trim() || "";
    const pos = getPosition(item);

    return {
      id: item.dataset.mapId,
      kind: itemKind(item),
      x: pos.x,
      y: pos.y,
      icon,
      title,
      level,
      category: item.dataset.category || "Нейтральні",
      description: item.dataset.description || `Відкриває покращення “${title || "вузол"}”`,
      req1: item.dataset.req1 || "Рівень сім’ї:",
      req1Value: item.dataset.req1Value || "4",
      req2: item.dataset.req2 || "Учасників сім’ї",
      req2Value: item.dataset.req2Value || "93 / 10",
      reputation: item.dataset.reputation || "7000",
      muted: item.classList.contains("upgradeNode--muted"),
      html: item.outerHTML,
    };
  }

  function writeItem(item, data){
    if (!item || !data) return;

    item.dataset.mapId = data.id || item.dataset.mapId;
    setPosition(item, data.x ?? getPosition(item).x, data.y ?? getPosition(item).y);

    const iconEl = item.querySelector(".upgradeNode__icon, span");
    const titleEl = item.querySelector("b");
    const levelEl = itemKind(item) === "core" ? item.querySelector("strong") : item.querySelector("small");

    if (iconEl && data.icon !== undefined) iconEl.textContent = data.icon;
    if (titleEl && data.title !== undefined) titleEl.textContent = data.title;
    if (levelEl && data.level !== undefined) levelEl.textContent = data.level;

    if (data.category !== undefined) item.dataset.category = data.category;
    if (data.description !== undefined) item.dataset.description = data.description;
    if (data.req1 !== undefined) item.dataset.req1 = data.req1;
    if (data.req1Value !== undefined) item.dataset.req1Value = data.req1Value;
    if (data.req2 !== undefined) item.dataset.req2 = data.req2;
    if (data.req2Value !== undefined) item.dataset.req2Value = data.req2Value;
    if (data.reputation !== undefined) item.dataset.reputation = data.reputation;

    item.classList.toggle("upgradeNode--muted", Boolean(data.muted) && itemKind(item) === "node");
    item.setAttribute("aria-label", [data.title, data.level].filter(Boolean).join(" "));
  }

  function serializeMap(){
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      items: mapItems().map(readItem),
      lines: lineItems().map(readLine),
    };
  }

  function readLine(line){
    return {
      id: line.dataset.lineId,
      from: line.dataset.from,
      to: line.dataset.to,
      color: line.dataset.color || "red",
    };
  }

  function itemCenter(item){
    const pos = getPosition(item);
    return {
      x: pos.x + item.offsetWidth / 2,
      y: pos.y + item.offsetHeight / 2,
    };
  }

  function linePath(fromItem, toItem){
    const a = itemCenter(fromItem);
    const b = itemCenter(toItem);
    return `M${Math.round(a.x)} ${Math.round(a.y)} L${Math.round(b.x)} ${Math.round(b.y)}`;
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
    line.addEventListener("pointerdown", (e) => {
      if (!editMode) return;
      e.preventDefault();
      e.stopPropagation();
      selectLine(line);
    });
  }

  function createLine(fromId, toId, color = "red", id = `line_${Date.now()}`){
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

  function createNode(data = {}){
    const node = document.createElement("article");
    node.className = "upgradeNode";
    node.dataset.mapId = data.id || `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    node.style.setProperty("--left", `${data.x ?? 860}px`);
    node.style.setProperty("--top", `${data.y ?? 700}px`);
    node.setAttribute("aria-label", data.title || "Новий вузол");
    node.innerHTML = `<span class="upgradeNode__icon">${data.icon || "★"}</span><b>${data.title || "Новий вузол"}</b><small>${data.level || "I"}</small>`;
    if (data.muted) node.classList.add("upgradeNode--muted");
    grid.appendChild(node);
    writeItem(node, {
      ...data,
      id: node.dataset.mapId,
      x: data.x ?? 860,
      y: data.y ?? 700,
      icon: data.icon || "★",
      title: data.title || "Новий вузол",
      level: data.level || "I",
      category: data.category || "Нейтральні",
      description: data.description || "Опис покращення",
      req1: data.req1 || "Рівень сім’ї:",
      req1Value: data.req1Value || "4",
      req2: data.req2 || "Учасників сім’ї",
      req2Value: data.req2Value || "93 / 10",
      reputation: data.reputation || "7000",
    });
    bindItem(node);
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

    const source = readItem(selected);
    const copy = createNode({
      ...source,
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      x: source.x + 48,
      y: source.y + 48,
      title: source.title ? `${source.title} копія` : "Новий вузол",
    });
    clearSelectedItems();
    selectItem(copy);
    setStatus("Вузол дубльовано");
  }

  function defaultMapData(){
    const defaultMap = document.getElementById("familyDefaultMap");
    if (!defaultMap?.textContent.trim()) return null;

    try{
      return JSON.parse(defaultMap.textContent);
    }catch(e){
      console.warn("Default map JSON failed", e);
      return null;
    }
  }

  function applyMapData(data){
    if (!Array.isArray(data?.items)) return false;

    lineItems().forEach(line => line.remove());
    const existing = new Map(mapItems().map(item => [item.dataset.mapId, item]));
    const savedIds = new Set(data.items.map(item => item.id));
    existing.forEach((item, id) => {
      if (!savedIds.has(id)) item.remove();
    });

    data.items.forEach((itemData) => {
      const item = existing.get(itemData.id);
      if (item) {
        writeItem(item, itemData);
      } else if (itemData.kind === "node") {
        createNode(itemData);
      }
    });

    if (Array.isArray(data.lines)) {
      data.lines.forEach((line) => createLine(line.from, line.to, line.color, line.id));
    }
    return true;
  }

  function loadLocalMap(){
    let loaded = false;
    const raw = localStorage.getItem(storageKey);

    if (raw) {
      try{
        loaded = applyMapData(JSON.parse(raw));
        if (loaded) setStatus("Карту завантажено з браузера");
      }catch(e){
        console.warn("Map load failed", e);
      }
    }

    if (loaded) return true;

    loaded = applyMapData(defaultMapData());
    if (loaded) setStatus("Карту завантажено з дефолту");
    return loaded;
  }

  async function loadMap(){
    try{
      const res = await fetch(`${mapReadUrl}?t=${Date.now()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok && data.map && applyMapData(data.map)) {
        localStorage.setItem(storageKey, JSON.stringify(data.map, null, 2));
        setStatus("Карту завантажено з Cloudflare");
        return true;
      }
    }catch(e){
      console.warn("Remote map load failed", e);
    }

    return loadLocalMap();
  }

  async function saveMap(){
    const mapData = serializeMap();
    localStorage.setItem(storageKey, JSON.stringify(mapData, null, 2));
    setStatus("Збережено локально, синхронізую Cloudflare...");

    try{
      const res = await fetch(mapSaveUrl, {
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
      setStatus("Збережено в Cloudflare");
      return true;
    }catch(e){
      console.warn("Remote map save failed", e);
      setStatus("Локально збережено. Cloudflare недоступний");
      return false;
    }
  }

  function setStatus(text){
    if (editor.status) editor.status.textContent = text;
  }

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

  function selectItem(item, additive = false){
    if (!editMode || !item) return;

    if (lineMode) {
      selectedLine?.classList.remove("mapLineSelected");
      selectedLine = null;

      if (!lineStart) {
        lineStart = item;
        clearSelectedItems();
        markSelectedItem(item);
        if (editor.panel) editor.panel.hidden = true;
        setStatus("Тепер клікни другий вузол для лінії");
        return;
      }

      createLine(lineStart.dataset.mapId, item.dataset.mapId, lineMode);
      lineStart.classList.remove("mapItemSelected");
      lineStart = null;
      lineMode = null;
      clearSelectedItems();
      setStatus("Лінію додано");
      return;
    }

    selectedLine?.classList.remove("mapLineSelected");
    selectedLine = null;

    if (additive) {
      if (selectedGroup.has(item) && selectedGroup.size > 1) {
        item.classList.remove("mapItemSelected");
        selectedGroup.delete(item);
        selected = [...selectedGroup].at(-1) || null;
      } else {
        markSelectedItem(item);
      }
    } else {
      clearSelectedItems();
      markSelectedItem(item);
    }

    if (selected) fillPanel(selected);
    setStatus(selectedGroup.size > 1 ? `Вибрано вузлів: ${selectedGroup.size}` : "Вузол вибрано");
  }

  function fillPanel(item){
    if (!item || !editor.panel) return;
    const data = readItem(item);
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
    writeItem(selected, {
      id: selected.dataset.mapId,
      x: Number(editor.x.value),
      y: Number(editor.y.value),
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
      muted: editor.muted.checked,
    });
    setStatus("Зміни застосовано");
  }

  function positionDetails(item){
    if (!details.root || !item) return;
    const pos = getPosition(item);
    const detailW = details.root.offsetWidth || 420;
    const detailH = details.root.offsetHeight || 360;
    const rawX = panX + (pos.x + item.offsetWidth + 24) * scale;
    const rawY = panY + (pos.y - 18) * scale;
    const maxX = Math.max(12, map.clientWidth - detailW - 12);
    const maxY = Math.max(12, map.clientHeight - detailH - 12);
    const x = clamp(rawX, 12, maxX);
    const y = clamp(rawY, 12, maxY);
    details.root.style.setProperty("--detail-left", `${Math.round(x)}px`);
    details.root.style.setProperty("--detail-top", `${Math.round(y)}px`);
  }

  function showDetails(item){
    if (!details.root || !item || itemKind(item) !== "node") return;
    const data = readItem(item);
    detailsItem = item;
    details.category.textContent = data.category || "Нейтральні";
    details.title.textContent = data.title || "Покращення";
    details.description.textContent = data.description || "Опис покращення";
    details.req1.textContent = data.req1 || "Рівень сім’ї:";
    details.req1Value.textContent = data.req1Value || "4";
    details.req2.textContent = data.req2 || "Учасників сім’ї";
    details.req2Value.textContent = liveMembersRequirement(data.req2Value);
    details.reputation.textContent = data.reputation || "7000";
    details.root.classList.add("is-open");
    details.root.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => positionDetails(item));
  }

  function hideDetails(){
    details.root?.classList.remove("is-open");
    details.root?.setAttribute("aria-hidden", "true");
    detailsItem = null;
  }

  function clientToMapPoint(e){
    const rect = map.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - panX) / scale,
      y: (e.clientY - rect.top - panY) / scale,
    };
  }

  function bindItem(item){
    item.addEventListener("pointerdown", (e) => {
      if (!editMode) {
        e.stopPropagation();
        showDetails(item);
        return;
      }
      e.preventDefault();
      e.stopPropagation();

      selectItem(item, e.ctrlKey || e.metaKey);
      const point = clientToMapPoint(e);
      const pos = getPosition(item);
      const dragItems = selectedGroup.has(item) ? [...selectedGroup] : [item];
      itemDrag = {
        item,
        items: dragItems.map((dragItem) => ({
          item: dragItem,
          ...getPosition(dragItem),
        })),
        origin: pos,
        dx: point.x - pos.x,
        dy: point.y - pos.y,
        pointerId: e.pointerId,
      };
      item.setPointerCapture?.(e.pointerId);
    });
  }

  function clampPan(){
    if (!screen) return;

    const viewW = screen.clientWidth;
    const viewH = screen.clientHeight;
    const scaledW = content.width * scale;
    const scaledH = content.height * scale;

    if (scaledW <= viewW - edgePadding * 2) {
      panX = (viewW - scaledW) / 2;
    } else {
      panX = clamp(panX, viewW - scaledW - edgePadding, edgePadding);
    }

    if (scaledH <= viewH - edgePadding * 2) {
      panY = (viewH - scaledH) / 2;
    } else {
      panY = clamp(panY, viewH - scaledH - edgePadding, edgePadding);
    }
  }

  function fitMap(){
    if (!screen || !grid) return;

    const byWidth = screen.clientWidth / content.width;
    const byHeight = screen.clientHeight / content.height;
    scale = clamp(Math.min(byWidth, byHeight) * 1.18, 0.48, 0.76);

    const coreNode = grid.querySelector(".upgradeNode--core");
    const focus = coreNode ? itemCenter(coreNode) : { x: content.width / 2, y: content.height / 2 };
    const focusX = focus.x;
    const focusY = focus.y;
    panX = screen.clientWidth / 2 - focusX * scale;
    panY = screen.clientHeight / 2 - focusY * scale;

    clampPan();
    applyPan();
  }

  function startDrag(e){
    if (e.button !== undefined && e.button !== 0) return;

    active = true;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    startPanX = panX;
    startPanY = panY;
    map.classList.add("is-dragging");
    map.setPointerCapture?.(pointerId);
  }

  function moveDrag(e){
    if (editMode && itemDrag) {
      e.preventDefault();
      const point = clientToMapPoint(e);
      const nextX = point.x - itemDrag.dx;
      const nextY = point.y - itemDrag.dy;
      const deltaX = nextX - itemDrag.origin.x;
      const deltaY = nextY - itemDrag.origin.y;
      itemDrag.items.forEach((entry) => {
        setPosition(entry.item, entry.x + deltaX, entry.y + deltaY);
      });
      return;
    }

    if (!active) return;
    e.preventDefault();
    panX = startPanX + (e.clientX - startX);
    panY = startPanY + (e.clientY - startY);
    clampPan();
    applyPan();
  }

  function endDrag(){
    if (itemDrag) {
      itemDrag.item.releasePointerCapture?.(itemDrag.pointerId);
      itemDrag = null;
      return;
    }

    if (!active) return;
    active = false;
    map.classList.remove("is-dragging");
    if (pointerId !== null) map.releasePointerCapture?.(pointerId);
    pointerId = null;
  }

  map.addEventListener("pointerdown", startDrag);
  map.addEventListener("pointermove", moveDrag);
  map.addEventListener("pointerup", endDrag);
  map.addEventListener("pointercancel", endDrag);
  map.addEventListener("pointerleave", endDrag);

  editor.toggle?.addEventListener("click", () => {
    editMode = !editMode;
    map.classList.toggle("is-editing", editMode);
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
      setStatus("Клікни вузол або перетягни його");
    }
  });

  editor.add?.addEventListener("click", () => {
    if (!editMode) editor.toggle?.click();
    const node = createNode();
    selectItem(node);
    setStatus("Новий вузол додано");
  });

  editor.apply?.addEventListener("click", applyPanel);
  editor.duplicate?.addEventListener("click", duplicateSelectedNode);
  [
    editor.icon,
    editor.title,
    editor.level,
    editor.category,
    editor.description,
    editor.req1,
    editor.req1Value,
    editor.req2,
    editor.req2Value,
    editor.reputation,
    editor.x,
    editor.y,
    editor.muted,
  ].forEach((input) => {
    input?.addEventListener("change", applyPanel);
  });

  editor.remove?.addEventListener("click", () => {
    if (!selected) return;
    const itemsToRemove = selectedGroup.size ? [...selectedGroup] : [selected];
    itemsToRemove.forEach((item) => {
      lineItems().forEach((line) => {
        if (line.dataset.from === item.dataset.mapId || line.dataset.to === item.dataset.mapId) line.remove();
      });
      item.remove();
    });
    clearSelectedItems();
    if (editor.panel) editor.panel.hidden = true;
    setStatus(itemsToRemove.length > 1 ? "Групу вузлів видалено" : "Вузол видалено");
  });

  editor.save?.addEventListener("click", saveMap);

  function startLineMode(color){
    if (!editMode) editor.toggle?.click();
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
    setStatus("Лінію видалено");
  });

  details.root?.addEventListener("pointerdown", (e) => e.stopPropagation());
  details.root?.addEventListener("click", (e) => e.stopPropagation());
  details.close?.addEventListener("pointerdown", (e) => e.stopPropagation());
  details.close?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    hideDetails();
  });

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
      if (!Array.isArray(data.items)) throw new Error("items missing");
      if (!applyMapData(data)) throw new Error("map apply failed");
      localStorage.setItem(storageKey, JSON.stringify(data, null, 2));
      saveMap();
      setStatus("JSON імпортовано, зберігаю Cloudflare...");
    }catch(e){
      setStatus("Помилка JSON");
    }
  });

  editor.reset?.addEventListener("click", () => {
    if (!confirm("Скинути карту до дефолтної і зберегти це в Cloudflare?")) return;
    localStorage.removeItem(storageKey);
    applyMapData(defaultMapData());
    saveMap();
    setStatus("Карту скинуто, зберігаю Cloudflare...");
  });

  ensureIds();
  mapItems().forEach(bindItem);
  loadMap().then(() => fitMap());
  refreshEditorAccess();
  window.addEventListener("castro-auth", (event) => {
    setEditorAccess(event.detail?.user);
  });
  if (familyTotal) {
    new MutationObserver(() => {
      if (!details.root?.classList.contains("is-open") || !detailsItem) return;
      details.req2Value.textContent = liveMembersRequirement(readItem(detailsItem).req2Value);
    }).observe(familyTotal, { childList: true, characterData: true, subtree: true });
  }
  window.addEventListener("resize", fitMap);
  fitMap();
})();
