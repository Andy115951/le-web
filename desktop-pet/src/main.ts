import "./styles.css";

// ---------- Type guard for Tauri runtime ----------
// We import lazily so the file still loads in plain vite preview (browser),
// useful for debugging the visuals without launching Tauri.
const inTauri = "__TAURI_INTERNALS__" in window;

// ---------- Pet DOM ----------

const root = document.getElementById("root")!;
root.innerHTML = `
  <div class="pet" id="pet" data-facing="right" data-dragging="false" data-blink="false">
    <div class="pet-body" id="pet-body">
      <div class="pixel p-body"></div>
      <div class="pixel p-belly"></div>
      <div class="pixel p-foot-l"></div>
      <div class="pixel p-foot-r"></div>
      <div class="pixel p-eye-l"></div>
      <div class="pixel p-eye-r"></div>
      <div class="pixel p-pup-l"></div>
      <div class="pixel p-pup-r"></div>
      <div class="pixel p-mouth"></div>
    </div>
  </div>
  <div class="bubble" id="bubble" data-visible="false"></div>
`;

const pet = document.getElementById("pet") as HTMLDivElement;
const bubble = document.getElementById("bubble") as HTMLDivElement;

// ---------- State ----------

const lines = [
  "今天也要加油呀～",
  "桃花源没有 deadline。",
  "你看，云在走。",
  "摸摸我，我就开心。",
  "别盯着代码太久。",
  "我陪你呢。",
  "去喝口水吧。",
  "小憩一下也不错。",
  "外面有风。",
  "嘿嘿。"
];

let x = 40;
let walkDir: 1 | -1 = 1;
let walking = true;
let dragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let petY = 0; // explicit y once user has dragged; else CSS centers it
let usingExplicitY = false;
let bubbleTimer: number | null = null;

// ---------- Walking loop ----------

function petWidth() {
  return pet.offsetWidth;
}

function viewportW() {
  return window.innerWidth;
}

function viewportH() {
  return window.innerHeight;
}

function applyPosition() {
  pet.style.left = `${x}px`;
  if (usingExplicitY) {
    pet.style.top = `${petY}px`;
    pet.style.transform = pet.dataset.dragging === "true"
      ? "translate(0, 0) scale(1.08)"
      : "translate(0, 0)";
  }
  pet.dataset.facing = walkDir === 1 ? "right" : "left";
}

function step() {
  if (walking && !dragging) {
    x += walkDir * 0.6;
    const maxX = viewportW() - petWidth();
    if (x <= 0) { x = 0; walkDir = 1; }
    if (x >= maxX) { x = maxX; walkDir = -1; }
    applyPosition();
  }
  requestAnimationFrame(step);
}
requestAnimationFrame(step);

// ---------- Blink loop ----------

function scheduleBlink() {
  const delay = 2200 + Math.random() * 2800;
  setTimeout(() => {
    pet.dataset.blink = "true";
    setTimeout(() => {
      pet.dataset.blink = "false";
      scheduleBlink();
    }, 140);
  }, delay);
}
scheduleBlink();

// ---------- Drag ----------

pet.addEventListener("pointerdown", (e) => {
  dragging = true;
  pet.setPointerCapture(e.pointerId);
  pet.dataset.dragging = "true";
  const rect = pet.getBoundingClientRect();
  dragOffsetX = e.clientX - rect.left;
  dragOffsetY = e.clientY - rect.top;
  usingExplicitY = true;
});

pet.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const nx = e.clientX - dragOffsetX;
  const ny = e.clientY - dragOffsetY;
  const maxX = viewportW() - petWidth();
  const maxY = viewportH() - pet.offsetHeight;
  x = Math.max(0, Math.min(maxX, nx));
  petY = Math.max(0, Math.min(maxY, ny));
  applyPosition();
});

function endDrag(e: PointerEvent) {
  if (!dragging) return;
  dragging = false;
  pet.releasePointerCapture(e.pointerId);
  pet.dataset.dragging = "false";
}
pet.addEventListener("pointerup", endDrag);
pet.addEventListener("pointercancel", endDrag);

// ---------- Click → say something ----------

let suppressClick = false;
pet.addEventListener("pointerdown", () => {
  // If the user drags > a few px, treat as drag, not click.
  const startX = x;
  const startTime = performance.now();
  const onUp = () => {
    const drifted = Math.abs(x - startX) > 4 || performance.now() - startTime > 250;
    if (!drifted) say(randomLine());
    pet.removeEventListener("pointerup", onUp);
  };
  pet.addEventListener("pointerup", onUp);
});

function randomLine() {
  return lines[Math.floor(Math.random() * lines.length)];
}

function say(text: string) {
  bubble.textContent = text;
  // Position bubble above the pet, anchored to its left.
  const left = Math.max(8, x);
  const top = (usingExplicitY ? petY : (viewportH() - pet.offsetHeight) / 2) - 44;
  bubble.style.left = `${left}px`;
  bubble.style.top = `${Math.max(8, top)}px`;
  bubble.dataset.visible = "true";
  if (bubbleTimer) window.clearTimeout(bubbleTimer);
  bubbleTimer = window.setTimeout(() => {
    bubble.dataset.visible = "false";
  }, 2400);
}

// ---------- Tray-driven commands (Rust → JS) ----------

if (inTauri) {
  import("@tauri-apps/api/event").then(({ listen }) => {
    listen<string>("pet-command", (event) => {
      switch (event.payload) {
        case "toggle-walking":
          walking = !walking;
          break;
        case "say-hi":
          say(randomLine());
          break;
      }
    });
  }).catch(() => { /* ignore: dev w/o tauri */ });
}
