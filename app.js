(() => {
  const CAP = 150;
  const CFG = window.RSVP_CONFIG || {};
  const LIVE = !!(CFG.supabaseUrl && CFG.supabaseKey);
  const KEY = "cinemanight-rsvp";
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

  // This device's RSVP ({id, token}), so a guest can see their ticket, edit or cancel
  const loadMe = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } };
  const saveMe = v => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch {} };

  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
  const validEmail = () => EMAIL_RE.test($("email").value.trim());

  // Mailchimp: add the guest to the audience through the embedded-form JSONP endpoint (no secret key needed).
  // Best effort: an RSVP never fails because of it, and the emails are also kept in Supabase.
  function toMailchimp(email, name) {
    if (!CFG.mailchimpForm) return;
    try {
      const u = new URL(CFG.mailchimpForm.replace("/subscribe/post?", "/subscribe/post-json?"));
      const cb = "mc_cb_" + Date.now();
      const [first, ...rest] = name.split(" ");
      u.searchParams.set("EMAIL", email);
      u.searchParams.set("FNAME", first);
      if (rest.length) u.searchParams.set("LNAME", rest.join(" "));
      if (CFG.mailchimpTags) u.searchParams.set("tags", CFG.mailchimpTags);
      u.searchParams.set("c", cb);
      const s = document.createElement("script");
      const done = () => { delete window[cb]; s.remove(); };
      window[cb] = done; s.onerror = done; s.src = u.toString();
      document.head.appendChild(s);
    } catch {}
  }

  const state = { me: loadMe(), guests: [], mine: null, photo: null, editing: false, loaded: false };

  async function rpc(fn, args) {
    const headers = { apikey: CFG.supabaseKey, "Content-Type": "application/json" };
    if (CFG.supabaseKey.startsWith("eyJ")) headers.Authorization = "Bearer " + CFG.supabaseKey; // legacy anon JWT
    const r = await fetch(`${CFG.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(args || {}) });
    const text = await r.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
    if (!r.ok) { const e = new Error((data && data.message) || "request failed"); e.reason = data && data.message; throw e; }
    return data;
  }

  const meter = $("meter");
  for (let i = 0; i < 50; i++) meter.appendChild(document.createElement("i"));

  function setMsg(el, text, err) { el.textContent = text || ""; el.classList.toggle("err", !!err); }

  // Photo: center-crop to a 240px square JPEG data URL
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(img.naturalWidth, img.naturalHeight);
        const c = document.createElement("canvas"); c.width = c.height = 240;
        c.getContext("2d").drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 240, 240);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
      img.src = url;
    });
  }

  $("photo").addEventListener("change", async e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      state.photo = await shrink(f);
      $("pick-img").src = state.photo; $("pick-img").hidden = false; $("pick-empty").hidden = true;
      setMsg($("msg"), "");
    } catch { setMsg($("msg"), "That file couldn't be read as an image. Try a JPG or PNG.", true); }
    updateSubmit();
  });
  $("name").addEventListener("input", updateSubmit);
  $("email").addEventListener("input", updateSubmit);

  function updateSubmit() {
    const b = $("submit");
    if (!LIVE) { b.disabled = true; b.textContent = "RSVP opens soon"; return; }
    if (!state.loaded) { b.disabled = true; b.textContent = "Loading guest list…"; return; }
    const full = !state.mine && state.guests.length >= CAP;
    b.disabled = full || !$("name").value.trim() || !validEmail() || !state.photo;
    b.textContent = full ? "Sold out · 150 / 150" : state.mine ? "Save changes" : "Save my seat";
  }

  function initials(n) { return n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join(""); }

  function render() {
    const g = state.guests, n = g.length;
    $("count").textContent = n;
    $("left").textContent = n >= CAP ? "Sold out" : `${CAP - n} seat${CAP - n === 1 ? "" : "s"} left`;
    [...meter.children].forEach((cell, i) => {
      const filled = n - i * 3;
      cell.className = filled >= 3 ? "on" : filled > 0 ? "half" : "";
    });
    $("empty").hidden = n > 0;
    const ul = $("guests"); ul.textContent = "";
    g.forEach((d, i) => {
      const li = document.createElement("li");
      if (state.me && d.id === state.me.id) li.className = "me";
      if (typeof d.photo === "string" && d.photo.startsWith("data:image/")) {
        const im = document.createElement("img"); im.src = d.photo; im.alt = ""; im.loading = "lazy"; li.appendChild(im);
      } else {
        const ph = document.createElement("div"); ph.className = "noimg"; ph.textContent = initials(String(d.name || "?")); li.appendChild(ph);
      }
      const nm = document.createElement("span"); nm.className = "nm"; nm.textContent = String(d.name || "Guest").slice(0, 60); li.appendChild(nm);
      const seat = document.createElement("span"); seat.className = "seat"; seat.textContent = "Seat " + String(i + 1).padStart(3, "0"); li.appendChild(seat);
      ul.appendChild(li);
    });

    const idx = state.me ? g.findIndex(d => d.id === state.me.id) : -1;
    state.mine = idx >= 0 ? g[idx] : null;
    const showTicket = state.mine && !state.editing;
    $("desk-ticket").hidden = !showTicket;
    $("desk-form").hidden = !!showTicket;
    if (state.mine) {
      $("t-name").textContent = state.mine.name;
      $("t-img").src = state.mine.photo || ""; $("t-img").hidden = !state.mine.photo;
      $("t-seat").textContent = String(idx + 1).padStart(3, "0");
    }
    updateSubmit();
  }

  async function refresh() {
    if (!LIVE) return;
    try {
      state.guests = (await rpc("guest_list")) || [];
      state.loaded = true;
      // This device's RSVP was removed (by the organisers or another device): forget it
      if (state.me && !state.guests.some(d => d.id === state.me.id)) { state.me = null; saveMe(null); state.editing = false; }
      render();
    } catch {
      if (!state.loaded) setMsg($("msg"), "The guest list didn't load. Check your connection and reload the page.", true);
    }
  }

  $("rsvp").addEventListener("submit", async e => {
    e.preventDefault();
    const name = $("name").value.trim().replace(/\s+/g, " ");
    const email = $("email").value.trim().toLowerCase();
    if (!name || !state.photo) { setMsg($("msg"), "Add your name and a photo to save a seat.", true); return; }
    if (!EMAIL_RE.test(email)) { setMsg($("msg"), "Check your email address. It should look like name@example.com.", true); return; }
    const b = $("submit"); b.disabled = true; b.textContent = "Saving…";
    try {
      if (state.mine) {
        const ok = await rpc("update_rsvp", { p_id: state.me.id, p_token: state.me.token, p_name: name, p_email: email, p_photo: state.photo });
        if (!ok) { state.me = null; saveMe(null); }
        else { if (email !== state.me.email) toMailchimp(email, name); state.me = { ...state.me, email }; saveMe(state.me); }
      } else {
        const res = await rpc("rsvp", { p_name: name, p_email: email, p_photo: state.photo });
        state.me = { id: res.id, token: res.token, email }; saveMe(state.me);
        toMailchimp(email, name);
      }
      state.editing = false; setMsg($("msg"), "");
      await refresh();
    } catch (err) {
      if (err.reason === "duplicate") setMsg($("msg"), "That email already has a seat. Each guest signs up with their own email.", true);
      else if (err.reason === "full") { setMsg($("msg"), "All 150 seats are taken.", true); await refresh(); }
      else setMsg($("msg"), "Your seat wasn't saved. Check your connection and try again.", true);
      updateSubmit();
    }
  });

  $("edit").onclick = () => {
    state.editing = true;
    $("name").value = state.mine.name; $("email").value = state.me.email || ""; state.photo = state.mine.photo;
    $("pick-img").src = state.photo; $("pick-img").hidden = !state.photo; $("pick-empty").hidden = !!state.photo;
    render(); $("name").focus();
  };
  const toggleCancel = on => { $("cancel-yes").hidden = $("cancel-no").hidden = !on; $("cancel").hidden = $("edit").hidden = on; };
  $("cancel").onclick = () => toggleCancel(true);
  $("cancel-no").onclick = () => toggleCancel(false);
  $("cancel-yes").onclick = async () => {
    try {
      await rpc("cancel_rsvp", { p_id: state.me.id, p_token: state.me.token });
      state.me = null; saveMe(null);
      toggleCancel(false); state.photo = null; $("name").value = ""; $("email").value = ""; $("pick-img").hidden = true; $("pick-empty").hidden = false;
      await refresh();
    } catch { setMsg($("tmsg"), "Your RSVP wasn't cancelled. Try again.", true); }
  };

  render();
  if (LIVE) {
    refresh();
    setInterval(() => { if (!document.hidden) refresh(); }, 30000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  } else {
    setMsg($("msg"), "Sign-ups open shortly. Check back soon.");
  }
})();
