(() => {
  const CAP = 200;
  const RESERVED = 161;        // seats taken (set by JK44)
  const FACES = 20;            // real guest photos shown on the wall: the first 20 to sign up
  const CFG = window.RSVP_CONFIG || {};
  const $ = id => document.getElementById(id);

  // Marquee bulbs: evenly spaced along the frame's center line, clockwise, exactly one bulb per corner
  function layBulbs(ring) {
    const t = 9, w = ring.clientWidth, h = ring.clientHeight, W = w - 2 * t, H = h - 2 * t;
    if (W <= 0 || H <= 0) return;
    const nx = Math.max(1, Math.round(W / 18)), ny = Math.max(1, Math.round(H / 18)), pts = [];
    for (let i = 0; i <= nx; i++) pts.push([t + i * W / nx, t]);
    for (let j = 1; j <= ny; j++) pts.push([t + W, t + j * H / ny]);
    for (let i = nx - 1; i >= 0; i--) pts.push([t + i * W / nx, t + H]);
    for (let j = ny - 1; j >= 1; j--) pts.push([t, t + j * H / ny]);
    ring.textContent = "";
    for (const [x, y] of pts) { const b = document.createElement("i"); b.style.left = x + "px"; b.style.top = y + "px"; ring.appendChild(b); }
  }
  document.querySelectorAll(".bulbs").forEach(ring => {
    layBulbs(ring);
    if (window.ResizeObserver) new ResizeObserver(() => layBulbs(ring)).observe(ring);
  });

  const taken = Math.min(CAP, RESERVED);
  const left = CAP - taken;

  // Counter and meter
  $("count").textContent = taken;
  $("left").textContent = left <= 0 ? "Sold out" : `${left <= 50 ? "Only " : ""}${left} seat${left === 1 ? "" : "s"} left`;
  $("seats-left").textContent = left;
  const meter = $("meter");
  for (let i = 0; i < 50; i++) {
    const cell = document.createElement("i"), filled = taken - i * (CAP / 50);
    cell.className = filled >= CAP / 50 ? "on" : filled > 0 ? "half" : "";
    meter.appendChild(cell);
  }

  // Seat map: 10 rows of 20 with a centre aisle; the open seats are the last ones in the back rows
  const map = $("seatmap");
  for (let r = 0; r < CAP / 20; r++) {
    const row = document.createElement("div"); row.className = "seat-row";
    for (let c = 0; c < 20; c++) {
      const n = r * 20 + c, s = document.createElement("span");
      s.className = n < taken ? "seat taken" : "seat open";
      s.style.setProperty("--arc", (-(((c - 9.5) / 9.5) ** 2) * 6).toFixed(1) + "px");
      if (n >= taken) s.style.setProperty("--d", ((n - taken) * 0.07).toFixed(2) + "s");
      row.appendChild(s);
    }
    map.appendChild(row);
  }

  // Faces wall: the first real guests, then greyed-out seats for everyone else holding one
  function wall(guests) {
    const ul = $("guests"); ul.textContent = "";
    // the slots after the first 20 (4 on desktop, 3 on phones) are filled with the next guests; silhouettes only if there are not enough
    const slots = matchMedia("(max-width: 640px)").matches ? 3 : 4;
    const real = guests.filter(g => typeof g.photo === "string" && g.photo.startsWith("data:image/")).slice(0, FACES + slots);
    real.forEach(g => {
      const li = document.createElement("li");
      const im = document.createElement("img"); im.src = g.photo; im.alt = ""; im.loading = "lazy"; li.appendChild(im);
      const nm = document.createElement("span"); nm.className = "nm"; nm.textContent = String(g.name || "Guest").split(" ")[0].slice(0, 20); li.appendChild(nm);
      ul.appendChild(li);
    });
    const ghosts = 0;   // never show placeholder profiles, only real guests
    for (let i = 0; i < ghosts; i++) {
      const li = document.createElement("li"); li.className = "ghost"; li.setAttribute("aria-hidden", "true");
      li.style.setProperty("--fade", (1 - i / (ghosts + 2)).toFixed(2));
      li.innerHTML = '<span class="sil"></span><span class="nm">Reserved</span>';
      ul.appendChild(li);
    }
    const more = document.createElement("li"); more.className = "more";
    more.innerHTML = `<span class="sil plus">+${taken - real.length - ghosts}</span><span class="nm">more guests</span>`;
    ul.appendChild(more);
  }
  let lastGuests = [];
  wall(lastGuests);
  matchMedia("(max-width: 640px)").addEventListener("change", () => wall(lastGuests));

  async function loadFaces() {
    if (!CFG.supabaseUrl || !CFG.supabaseKey) return;
    const headers = { apikey: CFG.supabaseKey, "Content-Type": "application/json" };
    if (CFG.supabaseKey.startsWith("eyJ")) headers.Authorization = "Bearer " + CFG.supabaseKey;
    try {
      const r = await fetch(`${CFG.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/guest_list`, { method: "POST", headers, body: "{}" });
      if (r.ok) { lastGuests = (await r.json()) || []; wall(lastGuests); }
    } catch {}
  }
  loadFaces();

  // Buy button goes to Stripe Checkout; buyers come back with ?pagado=1
  const buy = $("buy");
  if (CFG.ticketCheckout) buy.href = CFG.ticketCheckout;
  if (left <= 0) { buy.textContent = "Sold out"; buy.removeAttribute("href"); buy.setAttribute("aria-disabled", "true"); }
  if (new URLSearchParams(location.search).has("pagado")) {
    $("paid").hidden = false;
    $("paid").scrollIntoView({ block: "center" });
  }
})();
