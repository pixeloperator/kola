const collage = document.querySelector("#collage");
const fileList = document.querySelector("#fileList");
const templateList = document.querySelector("#templateList");
const customGridControls = document.querySelector("#customGridControls");
const customColsInput = document.querySelector("#customCols");
const customRowsInput = document.querySelector("#customRows");
const clearButton = document.querySelector("#clearButton");
const exportButton = document.querySelector("#exportButton");
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

const baseCollageClasses =
  "grid overflow-hidden bg-white p-2 shadow-[0_14px_44px_rgba(15,23,42,.14)]";
const alignXPercent = { left: 0, center: 50, right: 100 };
const alignYPercent = { top: 0, center: 50, bottom: 100 };

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

function clampNumber(value, min, max) {
  const number = Number.parseInt(value, 10);
  if (Number.isNaN(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function slotStyle(slot) {
  return [
    `grid-column:${slot.col} / span ${slot.colSpan || 1}`,
    `grid-row:${slot.row} / span ${slot.rowSpan || 1}`,
  ].join(";");
}

function updateValues() {
  gapValue.textContent = `${gapRange.value} px`;
  radiusValue.textContent = `${radiusRange.value} px`;
}

function getPhotoRatio(template = getTemplate()) {
  const slotRatios = template.slots
    .map((slot, index) => {
      const photo = photos[index];
      if (!photo?.width || !photo?.height) return null;

      const photoRatio = photo.width / photo.height;
      const colSpan = slot.colSpan || 1;
      const rowSpan = slot.rowSpan || 1;
      return photoRatio * (rowSpan * template.cols) / (colSpan * template.rows);
    })
    .filter(Boolean);

  if (!slotRatios.length) return template.cols / template.rows;

  const totalRatio = slotRatios.reduce((sum, ratio) => sum + ratio, 0);
  return Math.min(4, Math.max(0.25, totalRatio / slotRatios.length));
}

function getActiveRatio(template = getTemplate()) {
  if (ratioSelect.value === "photo") return getPhotoRatio(template);
  return parseRatio();
}

function getObjectPosition() {
  return `${alignXPercent[alignXSelect.value]}% ${alignYPercent[alignYSelect.value]}%`;
}

function updateCollageFrameSize() {
  const frame = collage.parentElement;
  const frameStyle = window.getComputedStyle(frame);
  const horizontalPadding = Number.parseFloat(frameStyle.paddingLeft) + Number.parseFloat(frameStyle.paddingRight);
  const verticalPadding = Number.parseFloat(frameStyle.paddingTop) + Number.parseFloat(frameStyle.paddingBottom);
  const availableWidth = Math.max(120, frame.clientWidth - horizontalPadding);
  const availableHeight = Math.max(120, frame.clientHeight - verticalPadding);
  const maxWidth = Math.min(820, availableWidth);
  const maxHeight = Math.min(820, availableHeight);
  const ratio = getActiveRatio();
  const frameRatio = maxWidth / maxHeight;
  let width = maxWidth;
  let height = width / ratio;

  if (frameRatio > ratio) {
    height = maxHeight;
    width = height * ratio;
  }

  collage.style.width = `${Math.round(width)}px`;
  collage.style.height = `${Math.round(height)}px`;
}

function renderCollage() {
  const template = getTemplate();
  updateValues();

  collage.className = baseCollageClasses;
  updateCollageFrameSize();
  collage.style.gridTemplateColumns = `repeat(${template.cols}, minmax(0, 1fr))`;
  collage.style.gridTemplateRows = `repeat(${template.rows}, minmax(0, 1fr))`;
  collage.style.gap = `${gapRange.value}px`;
  collage.style.padding = `${gapRange.value}px`;
  collage.style.borderRadius = `${radiusRange.value}px`;
  collage.style.aspectRatio = "";
  collage.innerHTML = "";

  template.slots.forEach((slotConfig, index) => {
    const photo = photos[index];
    const slot = document.createElement("div");
    slot.className =
      "relative grid min-h-0 min-w-0 place-items-center overflow-hidden border border-dashed border-slate-300 bg-slate-100 text-center";
    slot.style.cssText = `${slotStyle(slotConfig)}; border-radius:${radiusRange.value}px;`;

    if (photo) {
      const image = document.createElement("img");
      image.className = "h-full w-full";
      image.style.objectFit = "cover";
      image.style.objectPosition = getObjectPosition();
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
    input.accept = "image/*,.heic,.heif,image/heic,image/heif";
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

function isHeicFile(file) {
  return /\.(heic|heif)$/i.test(file.name) || ["image/heic", "image/heif"].includes(file.type);
}

function isSupportedImageFile(file) {
  return file.type.startsWith("image/") || isHeicFile(file);
}

function imageDimensions(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = reject;
    image.src = url;
  });
}

function loadBrowserImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function createPreviewUrl(sourceUrl, maxSize = 1200) {
  try {
    const image = await loadBrowserImage(sourceUrl);
    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));

    if (scale === 1) return sourceUrl;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const ctx = canvas.getContext("2d");

    if (!ctx) return sourceUrl;

    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob ? URL.createObjectURL(blob) : sourceUrl;
  } catch {
    return sourceUrl;
  }
}

async function hydratePreview(slotIndex) {
  const photo = photos[slotIndex];
  if (!photo || photo.previewUrl !== photo.originalUrl) return;

  const [dimensions, previewUrl] = await Promise.all([
    imageDimensions(photo.originalUrl).catch(() => null),
    createPreviewUrl(photo.originalUrl),
  ]);

  if (!photos[slotIndex] || photos[slotIndex] !== photo) return;

  const updatedPhoto = {
    ...photo,
    ...(dimensions || {}),
    previewUrl,
  };

  if (photo.previewUrl !== photo.originalUrl && photo.previewUrl !== previewUrl) {
    URL.revokeObjectURL(photo.previewUrl);
  }

  photos[slotIndex] = updatedPhoto;
  render();
}

function revokePhoto(photo) {
  if (!photo) return;
  URL.revokeObjectURL(photo.originalUrl);
  if (photo.previewUrl !== photo.originalUrl) {
    URL.revokeObjectURL(photo.previewUrl);
  }
}

async function normalizePhotoFile(file) {
  if (!isHeicFile(file)) {
    const originalUrl = URL.createObjectURL(file);
    return { name: file.name, originalUrl, previewUrl: originalUrl };
  }

  if (!window.heic2any) {
    throw new Error("HEIC převodník není dostupný.");
  }

  const converted = await window.heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.92,
  });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  const originalUrl = URL.createObjectURL(blob);
  const name = file.name.replace(/\.(heic|heif)$/i, ".jpg");

  return { name, originalName: file.name, originalUrl, previewUrl: originalUrl };
}

async function setPhotosFromSlot(startSlotIndex, files) {
  const template = getTemplate();
  const supportedFiles = files.filter(isSupportedImageFile);
  const availableSlots = template.slots.length - startSlotIndex;
  const targetSlots = supportedFiles.slice(0, availableSlots).map((_, offset) => startSlotIndex + offset);

  if (!targetSlots.length) return;

  loadingSlots = new Set(targetSlots);
  targetSlots.forEach((slotIndex) => slotErrors.delete(slotIndex));
  renderFileList();

  try {
    for (let offset = 0; offset < targetSlots.length; offset += 1) {
      const slotIndex = targetSlots[offset];
      try {
        const nextPhoto = await normalizePhotoFile(supportedFiles[offset]);

        revokePhoto(photos[slotIndex]);
        photos[slotIndex] = nextPhoto;
        slotErrors.delete(slotIndex);
        hydratePreview(slotIndex).catch(() => {});
      } catch {
        slotErrors.set(slotIndex, "Soubor nelze načíst");
      }
    }
  } finally {
    loadingSlots = new Set();
    render();
  }
}

function parseRatio() {
  if (ratioSelect.value === "photo") return getPhotoRatio();
  const [width, height] = ratioSelect.value.split("/").map((part) => Number(part.trim()));
  return width / height;
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

function alignedOffset(availableSpace, alignment) {
  if (alignment === "left" || alignment === "top") return 0;
  if (alignment === "right" || alignment === "bottom") return availableSpace;
  return availableSpace / 2;
}

function drawCoverImage(ctx, image, x, y, width, height) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;
  let sourceX = 0;
  let sourceY = 0;

  if (imageRatio > targetRatio) {
    sourceWidth = sourceHeight * targetRatio;
    sourceX = alignedOffset(image.naturalWidth - sourceWidth, alignXSelect.value);
  } else {
    sourceHeight = sourceWidth / targetRatio;
    sourceY = alignedOffset(image.naturalHeight - sourceHeight, alignYSelect.value);
  }

  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function exportCollage() {
  const template = getTemplate();
  const scale = selectedExportScale;
  const ratio = getActiveRatio(template);
  const base = 1080;
  const width = Math.round((ratio >= 1 ? base * ratio : base) * scale);
  const height = Math.round((ratio >= 1 ? base : base / ratio) * scale);
  const gap = Number(gapRange.value) * scale;
  const padding = Number(gapRange.value) * scale;
  const radius = Number(radiusRange.value) * scale;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

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
      const image = await loadImage(photo.originalUrl);
      drawCoverImage(ctx, image, x, y, slotWidth, slotHeight);
    }

    ctx.restore();
  }

  const link = document.createElement("a");
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "");
  link.download = `kola-${timestamp}-${scale}x.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

fileList.addEventListener("change", (event) => {
  const input = event.target.closest("input[type='file']");
  if (!input) return;

  const slotIndex = Number(input.dataset.slot);
  setPhotosFromSlot(slotIndex, Array.from(input.files || [])).catch(() => {
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
  photos.forEach((photo) => {
    revokePhoto(photo);
  });
  photos = [];
  render();
});

exportButton.addEventListener("click", () => {
  exportCollage().catch(() => {
    exportButton.setAttribute("title", "Export se nepodařil");
  });
});

exportScaleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedExportScale = Number(button.dataset.scale);
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
