const collage = document.querySelector("#collage");
const fileList = document.querySelector("#fileList");
const templateList = document.querySelector("#templateList");
const customGridControls = document.querySelector("#customGridControls");
const customColsInput = document.querySelector("#customCols");
const customRowsInput = document.querySelector("#customRows");
const clearButton = document.querySelector("#clearButton");
const exportButton = document.querySelector("#exportButton");
const exportResolution = document.querySelector("#exportResolution");
const exportStatus = document.querySelector("#exportStatus");
const exportScaleButtons = document.querySelectorAll(".export-scale");
const gapRange = document.querySelector("#gapRange");
const radiusRange = document.querySelector("#radiusRange");
const gapValue = document.querySelector("#gapValue");
const radiusValue = document.querySelector("#radiusValue");
const ratioSelect = document.querySelector("#ratioSelect");
const alignXSelect = document.querySelector("#alignXSelect");
const alignYSelect = document.querySelector("#alignYSelect");

const templates = {
  "grid-4": {
    cols: 2,
    rows: 2,
    slots: [
      { col: 1, row: 1 },
      { col: 2, row: 1 },
      { col: 1, row: 2 },
      { col: 2, row: 2 },
    ],
  },
  "hero-left": {
    cols: 2,
    rows: 2,
    slots: [
      { col: 1, row: 1, rowSpan: 2 },
      { col: 2, row: 1 },
      { col: 2, row: 2 },
    ],
  },
  mosaic: {
    cols: 3,
    rows: 3,
    slots: [
      { col: 1, row: 1, colSpan: 2, rowSpan: 2 },
      { col: 3, row: 1 },
      { col: 3, row: 2 },
      { col: 1, row: 3, colSpan: 2 },
      { col: 3, row: 3 },
    ],
  },
  stack: {
    cols: 1,
    rows: 3,
    slots: [
      { col: 1, row: 1 },
      { col: 1, row: 2 },
      { col: 1, row: 3 },
    ],
  },
};

let photos = [];
let activeTemplate = "custom-grid";
let selectedExportScale = 2;
let loadingSlots = new Set();
let slotErrors = new Map();
let lastExportUrl = "";

const baseCollageClasses =
  "grid overflow-hidden bg-white p-2 shadow-[0_14px_44px_rgba(15,23,42,.14)]";
const alignXPercent = { left: 0, center: 50, right: 100 };
const alignYPercent = { top: 0, center: 50, bottom: 100 };
const alignXFactor = { left: 0, center: 0.5, right: 1 };
const alignYFactor = { top: 0, center: 0.5, bottom: 1 };
const imageExtensionPattern = /\.(avif|gif|jpe?g|png|webp|heic|heif)$/i;
const heicTypePattern = /^image\/(heic|heif|heic-sequence|heif-sequence)$/i;
const previewMaxSize = 1200;
const exportBaseSize = 1080;
const mobileExportMaxPixels = 12000000;

function uploadIcon() {
  return `
    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 15V3m0 0 4 4m-4-4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M3 14c0 3.77 0 5.66 1.17 6.83C5.34 22 7.23 22 11 22h2c3.77 0 5.66 0 6.83-1.17C21 19.66 21 17.77 21 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`;
}

function createElement(tagName, className, textContent) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (textContent !== undefined) element.textContent = textContent;
  return element;
}

function clampNumber(value, min, max) {
  const number = Number.parseInt(value, 10);
  if (Number.isNaN(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function getTemplate() {
  if (activeTemplate !== "custom-grid") return templates[activeTemplate];

  const cols = clampNumber(customColsInput.value, 1, 6);
  const rows = clampNumber(customRowsInput.value, 1, 6);
  const slots = Array.from({ length: cols * rows }, (_, index) => ({
    col: (index % cols) + 1,
    row: Math.floor(index / cols) + 1,
  }));

  return { cols, rows, slots };
}

function slotStyle(slot) {
  return [
    `grid-column:${slot.col} / span ${slot.colSpan || 1}`,
    `grid-row:${slot.row} / span ${slot.rowSpan || 1}`,
  ].join(";");
}

function formatPixels(value) {
  return new Intl.NumberFormat("cs-CZ").format(value);
}

function updateValues(template = getTemplate()) {
  gapValue.textContent = `${gapRange.value} px`;
  radiusValue.textContent = `${radiusRange.value} px`;

  const ratio = getActiveRatio(template);
  const { width, height, effectiveScale } = exportDimensions(ratio, selectedExportScale);
  const scaleLabel =
    Math.abs(effectiveScale - selectedExportScale) < 0.05
      ? `${selectedExportScale}x`
      : `${selectedExportScale}x, omezeno na ${effectiveScale.toFixed(1)}x`;

  exportResolution.textContent = `${scaleLabel} = ${formatPixels(width)} × ${formatPixels(height)} px`;
}

function getPhotoRatio(template = getTemplate()) {
  const filledSlots = template.slots
    .map((slot, index) => {
      const photo = photos[index];
      if (!photo?.width || !photo?.height) return null;

      const photoRatio = photo.width / photo.height;
      const colSpan = slot.colSpan || 1;
      const rowSpan = slot.rowSpan || 1;
      const slotArea = colSpan * rowSpan;

      return {
        ratio: (photoRatio * rowSpan * template.cols) / (colSpan * template.rows),
        area: slotArea,
      };
    })
    .filter(Boolean);

  if (!filledSlots.length) return template.cols / template.rows;

  const totalArea = filledSlots.reduce((sum, item) => sum + item.area, 0);
  const weightedRatio = filledSlots.reduce((sum, item) => sum + item.ratio * item.area, 0) / totalArea;
  return Math.min(4, Math.max(0.25, weightedRatio));
}

function parseRatio() {
  const [width, height] = ratioSelect.value.split("/").map((part) => Number(part.trim()));
  return width / height;
}

function getActiveRatio(template = getTemplate()) {
  if (ratioSelect.value === "photo") return getPhotoRatio(template);

  const slotRatio = parseRatio();

  if (activeTemplate === "custom-grid") {
    // In a custom grid the ratio selector describes each slot, not the whole canvas.
    return slotRatio * (template.cols / template.rows);
  }

  return slotRatio;
}

function getObjectPosition() {
  return `${alignXPercent[alignXSelect.value]}% ${alignYPercent[alignYSelect.value]}%`;
}

function getSlotRatio(template, slot) {
  const colSpan = slot.colSpan || 1;
  const rowSpan = slot.rowSpan || 1;
  return getActiveRatio(template) * (colSpan / template.cols) / (rowSpan / template.rows);
}

function getCoverCrop(sourceWidth, sourceHeight, targetRatio) {
  const imageRatio = sourceWidth / sourceHeight;
  let width = sourceWidth;
  let height = sourceHeight;
  let x = 0;
  let y = 0;

  if (imageRatio > targetRatio) {
    width = height * targetRatio;
    x = (sourceWidth - width) * alignXFactor[alignXSelect.value];
  } else {
    height = width / targetRatio;
    y = (sourceHeight - height) * alignYFactor[alignYSelect.value];
  }

  return { x, y, width, height };
}

function applyCoverPlacement(image, photo, slotRatio) {
  if (!photo.width || !photo.height) {
    image.className = "h-full w-full";
    image.style.objectFit = "cover";
    image.style.objectPosition = getObjectPosition();
    return;
  }

  const photoRatio = photo.width / photo.height;
  image.className = "absolute max-h-none max-w-none";
  image.style.objectFit = "";
  image.style.objectPosition = "";

  if (photoRatio > slotRatio) {
    const width = (photoRatio / slotRatio) * 100;
    const overflow = width - 100;
    image.style.width = `${width}%`;
    image.style.height = "100%";
    image.style.left = `${-overflow * alignXFactor[alignXSelect.value]}%`;
    image.style.top = "0";
  } else {
    const height = (slotRatio / photoRatio) * 100;
    const overflow = height - 100;
    image.style.width = "100%";
    image.style.height = `${height}%`;
    image.style.left = "0";
    image.style.top = `${-overflow * alignYFactor[alignYSelect.value]}%`;
  }
}

function updateCollageFrameSize(template = getTemplate()) {
  const frame = collage.parentElement;
  const frameStyle = window.getComputedStyle(frame);
  const horizontalPadding = Number.parseFloat(frameStyle.paddingLeft) + Number.parseFloat(frameStyle.paddingRight);
  const verticalPadding = Number.parseFloat(frameStyle.paddingTop) + Number.parseFloat(frameStyle.paddingBottom);
  const availableWidth = Math.max(120, frame.clientWidth - horizontalPadding);
  const availableHeight = Math.max(120, frame.clientHeight - verticalPadding);
  const maxWidth = Math.min(980, availableWidth);
  const maxHeight = Math.min(860, availableHeight);
  const ratio = getActiveRatio(template);
  const frameRatio = maxWidth / maxHeight;
  let width = maxWidth;
  let height = width / ratio;

  if (frameRatio > ratio) {
    height = maxHeight;
    width = height * ratio;
  }

  collage.style.width = `${Math.round(width)}px`;
  collage.style.height = `${Math.round(height)}px`;
  collage.style.aspectRatio = `${ratio} / 1`;
}

function renderCollage() {
  const template = getTemplate();
  updateValues(template);

  collage.className = baseCollageClasses;
  updateCollageFrameSize(template);
  collage.style.gridTemplateColumns = `repeat(${template.cols}, minmax(0, 1fr))`;
  collage.style.gridTemplateRows = `repeat(${template.rows}, minmax(0, 1fr))`;
  collage.style.gap = `${gapRange.value}px`;
  collage.style.padding = `${gapRange.value}px`;
  collage.style.borderRadius = `${radiusRange.value}px`;
  collage.innerHTML = "";

  template.slots.forEach((slotConfig, index) => {
    const photo = photos[index];
    const slot = document.createElement("div");
    slot.className =
      "relative grid min-h-0 min-w-0 place-items-center overflow-hidden border border-dashed border-slate-300 bg-slate-100 text-center";
    slot.style.cssText = `${slotStyle(slotConfig)}; border-radius:${radiusRange.value}px;`;

    if (photo) {
      const image = document.createElement("img");
      applyCoverPlacement(image, photo, getSlotRatio(template, slotConfig));
      image.src = photo.previewUrl;
      image.alt = photo.name;
      slot.append(image);
    } else {
      const placeholder = document.createElement("span");
      placeholder.className = "px-2 text-xs font-semibold text-slate-400";
      placeholder.textContent = `Slot ${index + 1}`;
      slot.append(placeholder);
    }

    collage.append(slot);
  });
}

function renderFileList() {
  const template = getTemplate();
  fileList.innerHTML = "";

  template.slots.forEach((_, index) => {
    const photo = photos[index];
    const isLoading = loadingSlots.has(index);
    const error = slotErrors.get(index);
    const row = document.createElement("label");
    row.className =
      "group relative grid cursor-pointer grid-cols-[36px_1fr_28px] items-center gap-2 border-b border-slate-200 bg-white px-2.5 py-2 text-sm transition last:border-b-0 hover:bg-slate-50";
    if (error) row.title = error;

    const thumb = document.createElement("span");
    thumb.className = "grid h-9 w-9 place-items-center overflow-hidden rounded-md bg-slate-100 text-[11px] font-extrabold text-slate-500";

    if (photo) {
      const previewImage = createElement("img", "h-full w-full object-cover");
      previewImage.src = photo.previewUrl;
      previewImage.alt = "";
      thumb.append(previewImage);
    } else {
      thumb.textContent = `S${index + 1}`;
    }

    const text = document.createElement("span");
    text.className = "min-w-0";
    text.append(createElement("strong", "block text-xs font-bold text-slate-900", `Slot ${index + 1}`));
    const statusClass = error
      ? "block truncate text-xs leading-tight text-red-600"
      : photo
        ? "block truncate text-xs leading-tight text-slate-500"
        : "block text-xs leading-tight text-slate-400";
    text.append(createElement("span", statusClass, error || (photo ? photo.name : "Prázdný")));

    const action = document.createElement("span");
    action.className = "ml-auto grid h-6 w-6 place-items-center rounded-md text-slate-500 transition group-hover:text-slate-900";
    action.innerHTML = uploadIcon();

    const input = document.createElement("input");
    input.className = "sr-only";
    input.type = "file";
    input.accept = "image/*,.heic,.heif,image/heic,image/heif,image/heic-sequence,image/heif-sequence";
    input.multiple = true;
    input.disabled = isLoading;
    input.dataset.slot = String(index);

    row.append(thumb, text, action, input);

    if (isLoading) {
      const overlay = document.createElement("span");
      overlay.className =
        "absolute inset-0 grid grid-cols-[36px_1fr_28px] items-center gap-2 bg-white/80 px-2.5 backdrop-blur-[1px]";
      overlay.innerHTML = `
        <span class="grid h-9 w-9 place-items-center rounded-md bg-slate-100">
          <span class="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800"></span>
        </span>
        <span class="min-w-0">
          <strong class="block text-xs font-bold text-slate-900">Slot ${index + 1}</strong>
          <span class="block text-xs leading-tight text-slate-500">Nahrávám...</span>
        </span>
        <span></span>
      `;
      row.append(overlay);
    }

    fileList.append(row);
  });
}

function render() {
  customGridControls.classList.toggle("hidden", activeTemplate !== "custom-grid");
  customGridControls.classList.toggle("grid", activeTemplate === "custom-grid");
  renderCollage();
  renderFileList();
}

function isSupportedImageFile(file) {
  return file.type.startsWith("image/") || imageExtensionPattern.test(file.name);
}

async function looksLikeHeic(file) {
  if (/\.(heic|heif)$/i.test(file.name) || heicTypePattern.test(file.type)) return true;

  const buffer = await file.slice(0, 32).arrayBuffer().catch(() => null);
  if (!buffer) return false;

  const header = String.fromCharCode(...new Uint8Array(buffer));
  return /ftyp(heic|heix|hevc|hevx|mif1|msf1)/i.test(header);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Prohlížeč neumí soubor dekódovat."));
    image.src = src;
  });
}

async function createPreviewUrl(image) {
  const scale = Math.min(1, previewMaxSize / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Canvas není dostupný.");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  canvas.width = 1;
  canvas.height = 1;

  if (!blob) throw new Error("Preview se nepodařilo vytvořit.");
  return URL.createObjectURL(blob);
}

async function convertHeic(file) {
  if (window.HeicTo) {
    return window.HeicTo({
      blob: file,
      type: "image/jpeg",
      quality: 0.9,
    });
  }

  if (window.heic2any) {
    const converted = await window.heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.9,
    });

    return Array.isArray(converted) ? converted[0] : converted;
  }

  throw new Error("HEIC převodník není dostupný.");
}

async function normalizePhotoFile(file) {
  const isHeic = await looksLikeHeic(file);
  let sourceBlob = file;
  let name = file.name;
  let originalName;

  if (isHeic) {
    originalName = file.name;

    try {
      sourceBlob = await convertHeic(file);
      name = file.name.replace(/\.(heic|heif)$/i, ".jpg");
    } catch (error) {
      console.warn("HEIC conversion failed, trying native browser decode", file.name, error);
    }
  }

  const originalUrl = URL.createObjectURL(sourceBlob);

  return {
    name,
    originalName,
    sourceBlob,
    originalUrl,
    previewUrl: originalUrl,
  };
}

function revokePhoto(photo) {
  if (!photo) return;
  URL.revokeObjectURL(photo.originalUrl);
  URL.revokeObjectURL(photo.previewUrl);
}

async function hydratePhoto(slotIndex) {
  const photo = photos[slotIndex];
  if (!photo) return;

  const image = await loadImage(photo.originalUrl);
  const previewUrl = await createPreviewUrl(image).catch(() => photo.originalUrl);

  if (photos[slotIndex] !== photo) {
    if (previewUrl !== photo.originalUrl) URL.revokeObjectURL(previewUrl);
    return;
  }

  if (photo.previewUrl !== photo.originalUrl && photo.previewUrl !== previewUrl) {
    URL.revokeObjectURL(photo.previewUrl);
  }

  photos[slotIndex] = {
    ...photo,
    previewUrl,
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
  render();
}

async function setPhotosFromSlot(startSlotIndex, files) {
  const template = getTemplate();
  const supportedFiles = files.filter(isSupportedImageFile);
  const availableSlots = Math.max(0, template.slots.length - startSlotIndex);
  const targetFiles = supportedFiles.slice(0, availableSlots);
  const targetSlots = targetFiles.map((_, offset) => startSlotIndex + offset);

  if (!targetSlots.length) return;

  loadingSlots = new Set(targetSlots);
  targetSlots.forEach((slotIndex) => slotErrors.delete(slotIndex));
  renderFileList();

  const nextPhotos = [...photos];
  const nextErrors = new Map(slotErrors);
  const hydratedSlots = [];

  for (let offset = 0; offset < targetFiles.length; offset += 1) {
    const slotIndex = targetSlots[offset];
    const file = targetFiles[offset];

    try {
      const nextPhoto = await normalizePhotoFile(file);
      revokePhoto(nextPhotos[slotIndex]);
      nextPhotos[slotIndex] = nextPhoto;
      nextErrors.delete(slotIndex);
      hydratedSlots.push(slotIndex);
    } catch (error) {
      console.error("Photo upload failed", file.name, error);
      nextErrors.set(slotIndex, `Nelze načíst: ${file.name}`);
    }
  }

  photos = nextPhotos;
  slotErrors = nextErrors;
  loadingSlots = new Set();
  render();
  hydratedSlots.forEach((slotIndex) => hydratePhoto(slotIndex).catch(() => {}));
}

function roundedRect(ctx, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
  ctx.arcTo(x, y + height, x, y, safeRadius);
  ctx.arcTo(x, y, x + width, y, safeRadius);
  ctx.closePath();
}

function drawCoverImage(ctx, image, x, y, width, height) {
  const crop = getCoverCrop(image.naturalWidth, image.naturalHeight, width / height);
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, x, y, width, height);
}

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 760;
}

function exportDimensions(ratio, scale) {
  const baseWidth = ratio >= 1 ? exportBaseSize * ratio : exportBaseSize;
  const baseHeight = ratio >= 1 ? exportBaseSize : exportBaseSize / ratio;
  let width = Math.round(baseWidth * scale);
  let height = Math.round(baseHeight * scale);
  const maxPixels = isMobileDevice() ? mobileExportMaxPixels : Infinity;
  const pixels = width * height;

  if (pixels > maxPixels) {
    const resizeFactor = Math.sqrt(maxPixels / pixels);
    width = Math.floor(width * resizeFactor);
    height = Math.floor(height * resizeFactor);
  }

  return { width, height, effectiveScale: width / baseWidth };
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Export se nepodařilo vytvořit."));
      }
    }, "image/png");
  });
}

function revokeLastExportUrl() {
  if (!lastExportUrl) return;
  URL.revokeObjectURL(lastExportUrl);
  lastExportUrl = "";
}

function setExportStatus(content, tone = "neutral") {
  exportStatus.className = [
    "border-t pt-3 text-sm",
    tone === "error"
      ? "border-red-200 text-red-700"
      : "border-slate-200 text-slate-600",
  ].join(" ");
  exportStatus.innerHTML = "";

  if (typeof content === "string") {
    exportStatus.textContent = content;
  } else {
    exportStatus.append(content);
  }
}

function clearExportStatus() {
  exportStatus.className = "hidden text-sm";
  exportStatus.innerHTML = "";
}

function renderExportReady(blob, filename) {
  revokeLastExportUrl();
  lastExportUrl = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.download = filename;
  link.href = lastExportUrl;
  link.click();

  const wrapper = createElement("div", "grid gap-2");

  const statusLine = createElement("div", "flex items-center gap-2 text-xs font-semibold text-slate-600");
  statusLine.append(createElement("span", "h-2 w-2 rounded-full bg-emerald-500", ""));
  statusLine.append(createElement("span", "", "Hotovo. Soubor se stahuje."));
  wrapper.append(statusLine);

  const actions = document.createElement("div");
  actions.className = "grid grid-cols-[1fr_auto] gap-2";

  const downloadLink = createElement(
    "a",
    "grid min-h-8 place-items-center rounded-md bg-slate-800 px-3 text-sm font-bold text-white transition hover:bg-slate-700",
    "Stáhnout znovu"
  );
  downloadLink.href = lastExportUrl;
  downloadLink.download = filename;
  downloadLink.target = "_blank";

  const openLink = createElement(
    "a",
    "grid min-h-8 place-items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50",
    "Otevřít"
  );
  openLink.href = lastExportUrl;
  openLink.target = "_blank";

  actions.append(downloadLink, openLink);

  if (navigator.canShare) {
    const file = new File([blob], filename, { type: "image/png" });
    if (navigator.canShare({ files: [file] })) {
      const shareButton = createElement(
        "button",
        "col-span-2 min-h-8 rounded-md border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50",
        "Sdílet"
      );
      shareButton.type = "button";
      shareButton.addEventListener("click", () => {
        navigator.share({ files: [file], title: "Kola export" }).catch(() => {});
      });
      actions.append(shareButton);
    }
  }

  wrapper.append(actions);
  setExportStatus(wrapper);
}

async function exportCollage() {
  const template = getTemplate();
  const scale = selectedExportScale;
  const ratio = getActiveRatio(template);
  const { width, height, effectiveScale } = exportDimensions(ratio, scale);
  const gap = Number(gapRange.value) * effectiveScale;
  const padding = Number(gapRange.value) * effectiveScale;
  const radius = Number(radiusRange.value) * effectiveScale;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Canvas není dostupný.");

  canvas.width = width;
  canvas.height = height;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const cellWidth = (width - padding * 2 - gap * (template.cols - 1)) / template.cols;
  const cellHeight = (height - padding * 2 - gap * (template.rows - 1)) / template.rows;

  for (let index = 0; index < template.slots.length; index += 1) {
    const slot = template.slots[index];
    const photo = photos[index];
    const x = padding + (slot.col - 1) * (cellWidth + gap);
    const y = padding + (slot.row - 1) * (cellHeight + gap);
    const slotWidth = cellWidth * (slot.colSpan || 1) + gap * ((slot.colSpan || 1) - 1);
    const slotHeight = cellHeight * (slot.rowSpan || 1) + gap * ((slot.rowSpan || 1) - 1);

    ctx.save();
    roundedRect(ctx, x, y, slotWidth, slotHeight, radius);
    ctx.clip();
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(x, y, slotWidth, slotHeight);

    if (photo) {
      const image = await loadImage(isMobileDevice() ? photo.previewUrl : photo.originalUrl).catch(() =>
        loadImage(photo.previewUrl)
      );
      drawCoverImage(ctx, image, x, y, slotWidth, slotHeight);
    }

    ctx.restore();
  }

  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "");
  const filename = `kola-${timestamp}-${scale}x.png`;
  const blob = await canvasToBlob(canvas);
  renderExportReady(blob, filename);
}

fileList.addEventListener("change", (event) => {
  const input = event.target.closest("input[type='file']");
  if (!input) return;

  const slotIndex = Number(input.dataset.slot);
  setPhotosFromSlot(slotIndex, Array.from(input.files || [])).catch((error) => {
    console.error("Batch upload failed", error);
    input.closest("label")?.setAttribute("title", "Soubor se nepodařilo načíst.");
  });
  input.value = "";
});

templateList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-template]");
  if (!button) return;

  activeTemplate = button.dataset.template;
  document.querySelectorAll(".template-card").forEach((card) => {
    const isActive = card === button;
    card.classList.toggle("border-slate-700", isActive);
    card.classList.toggle("border-slate-200", !isActive);
    card.classList.toggle("shadow-[0_0_0_2px_rgba(51,65,85,.14)]", isActive);
  });
  render();
});

clearButton.addEventListener("click", () => {
  photos.forEach(revokePhoto);
  photos = [];
  slotErrors = new Map();
  clearExportStatus();
  render();
});

exportButton.addEventListener("click", () => {
  clearExportStatus();
  exportButton.disabled = true;
  exportButton.classList.add("opacity-70");
  setExportStatus("Připravuji stažení...");
  exportCollage()
    .catch((error) => {
      console.error("Export failed", error);
      exportButton.setAttribute("title", "Stažení se nepodařilo");
      setExportStatus("Stažení se nepodařilo. Zkuste menší velikost.", "error");
    })
    .finally(() => {
      exportButton.disabled = false;
      exportButton.classList.remove("opacity-70");
    });
});

exportScaleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedExportScale = Number(button.dataset.scale);
    clearExportStatus();
    updateValues();
    exportScaleButtons.forEach((scaleButton) => {
      const isActive = scaleButton === button;
      scaleButton.classList.toggle("bg-white", isActive);
      scaleButton.classList.toggle("text-slate-900", isActive);
      scaleButton.classList.toggle("shadow-sm", isActive);
      scaleButton.classList.toggle("text-slate-600", !isActive);
    });
  });
});

customColsInput.addEventListener("input", render);
customRowsInput.addEventListener("input", render);
gapRange.addEventListener("input", renderCollage);
radiusRange.addEventListener("input", renderCollage);
ratioSelect.addEventListener("change", renderCollage);
alignXSelect.addEventListener("change", renderCollage);
alignYSelect.addEventListener("change", renderCollage);
window.addEventListener("resize", renderCollage);

render();
