// wspolne.js — backend (Firebase albo tryb próbny) oraz liczenie i rysowanie wyników.
import { firebaseConfig } from "./konfiguracja.js";

const SDK = "https://www.gstatic.com/firebasejs/13.4.0/";

export const parametry = new URLSearchParams(location.search);
export const DEMO = parametry.has("demo") || !firebaseConfig.projectId;
export const SALA = (parametry.get("sala") || "wyklad").replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || "wyklad";

// ───────── Backend: Firebase ─────────
async function backendFirebase() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(SDK + "firebase-app.js"),
    import(SDK + "firebase-auth.js"),
    import(SDK + "firebase-firestore.js"),
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  const salaRef = F.doc(db, "sale", SALA);
  const glosyCol = F.collection(db, "sale", SALA, "glosy");
  const gotowe = new Promise((ok) => { const u = A.onAuthStateChanged(auth, (x) => { u(); ok(x); }); });

  return {
    demo: false,
    async zalogujAnonimowo() {
      const u = await gotowe;
      if (u) return u.uid;
      return (await A.signInAnonymously(auth)).user.uid;
    },
    async biezacyProwadzacy() {
      const u = await gotowe;
      return u && !u.isAnonymous ? u.email : null;
    },
    async zalogujProwadzacego(email, haslo) {
      return (await A.signInWithEmailAndPassword(auth, email, haslo)).user.email;
    },
    async wyloguj() { await A.signOut(auth); },
    sluchajSali(cb, blad) {
      return F.onSnapshot(salaRef, (s) => cb(s.exists() ? s.data() : null), blad);
    },
    ustawSale(stan) { return F.setDoc(salaRef, stan); },
    zmienSale(zm) { return F.updateDoc(salaRef, zm); },
    glosuj(runda, w) {
      const uid = auth.currentUser.uid;
      return F.setDoc(F.doc(glosyCol, runda + "_" + uid),
        { runda, uid, w, t: F.serverTimestamp() });
    },
    sluchajGlosow(runda, cb, blad) {
      return F.onSnapshot(F.query(glosyCol, F.where("runda", "==", runda)),
        (q) => cb(q.docs.map((d) => ({ uid: d.get("uid"), w: d.get("w") }))), blad);
    },
  };
}

// ───────── Backend: tryb próbny (localStorage + BroadcastChannel, jedna przeglądarka) ─────────
function backendDemo() {
  const klucz = (k) => `glos-demo:${SALA}:${k}`;
  const kanal = new BroadcastChannel(klucz("kanal"));
  const czytaj = (k, d) => { try { return JSON.parse(localStorage.getItem(klucz(k))) ?? d; } catch { return d; } };
  const pisz = (k, v) => { localStorage.setItem(klucz(k), JSON.stringify(v)); kanal.postMessage(k); };
  const sluchacze = new Set();
  const powiadom = (k) => sluchacze.forEach((f) => f(k));
  kanal.onmessage = (e) => powiadom(e.data);
  let uid = sessionStorage.getItem("glos-demo-uid");
  if (!uid) { uid = "demo-" + Math.random().toString(36).slice(2, 10); sessionStorage.setItem("glos-demo-uid", uid); }
  const sluchaj = (filtr, f) => { const g = (k) => { if (filtr(k)) f(); }; sluchacze.add(g); f(); return () => sluchacze.delete(g); };

  return {
    demo: true,
    async zalogujAnonimowo() { return uid; },
    async biezacyProwadzacy() { return "tryb próbny"; },
    async zalogujProwadzacego() { return "tryb próbny"; },
    async wyloguj() {},
    sluchajSali(cb) { return sluchaj((k) => k === "stan", () => cb(czytaj("stan", null))); },
    async ustawSale(stan) { pisz("stan", stan); powiadom("stan"); },
    async zmienSale(zm) { pisz("stan", { ...czytaj("stan", {}), ...zm }); powiadom("stan"); },
    async glosuj(runda, w, kto = uid) {
      const s = czytaj("stan", null);
      if (!s || !s.otwarte || s.runda !== runda) throw new Error("Głosowanie jest zamknięte.");
      const g = czytaj("glosy:" + runda, {});
      g[kto] = w;
      pisz("glosy:" + runda, g); powiadom("glosy:" + runda);
    },
    sluchajGlosow(runda, cb) {
      return sluchaj((k) => k === "glosy:" + runda,
        () => cb(Object.entries(czytaj("glosy:" + runda, {})).map(([uid, w]) => ({ uid, w }))));
    },
  };
}

export async function polacz() {
  return DEMO ? backendDemo() : backendFirebase();
}

// ───────── Pytania ─────────
// Część pytania widoczna dla studentów (bez poprawnej odpowiedzi).
export function czescPubliczna(p) {
  const { poprawna, tolerancja, slajd, id, ...reszta } = p;
  return reszta;
}

export const LITERY = "ABCDEFGHIJ";
// Oznaczenie opcji: litery (domyślnie) albo cyfry 1, 2, 3… (pole numeracja: "1"), jak na slajdzie.
export const znak = (p, i) => p.numeracja === "1" ? String(i + 1) : LITERY[i];

// Normalizacja wpisu tekstowego: małe litery, pojedyncze spacje, bez interpunkcji na brzegach.
export function normalizujTekst(t) {
  return t.toLocaleLowerCase("pl").replace(/\s+/g, " ")
    .replace(/^[\s.,;:!?"'„”«»()\-–—]+|[\s.,;:!?"'„”«»()\-–—]+$/g, "");
}

// Liczba wpisana z przecinkiem albo kropką.
export function parsujLiczbe(t) {
  const s = String(t).trim().replace(/\s/g, "").replace(",", ".");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
  const x = Number(s);
  return Number.isFinite(x) ? x : null;
}

const fmt = (x, c = 2) => Number.isInteger(x) ? String(x)
  : x.toLocaleString("pl-PL", { maximumFractionDigits: c });

export function czyPoprawna(p, w) {
  if (p.poprawna === undefined || p.poprawna === null) return null;
  if (p.typ === "liczba") return Math.abs(w - p.poprawna) <= (p.tolerancja ?? 0) + 1e-12;
  if (p.typ === "tekst") {
    const dobre = [].concat(p.poprawna).map(normalizujTekst);
    return String(w).split("\n").some((x) => dobre.includes(normalizujTekst(x)));
  }
  return w === p.poprawna;
}

// Podsumowanie głosów: struktura, którą rysuje rysujWyniki i którą prowadzący publikuje studentom.
export function podsumuj(p, glosy, ukryte = new Set()) {
  const n = glosy.length;
  if (p.typ === "wybor" || p.typ === "skala") {
    const etyk = p.typ === "wybor" ? p.opcje.map((o, i) => znak(p, i) + (o ? ". " + o : ""))
      : Array.from({ length: p.max - p.min + 1 }, (_, i) => String(p.min + i));
    const wart = p.typ === "wybor" ? p.opcje.map((_, i) => i) : etyk.map((_, i) => p.min + i);
    const licz = wart.map((v) => glosy.filter((g) => g.w === v).length);
    const s = { n, slupki: etyk.map((e, i) => ({ e, v: wart[i], k: licz[i] })) };
    if (p.typ === "skala" && n) s.srednia = glosy.reduce((a, g) => a + g.w, 0) / n;
    return s;
  }
  if (p.typ === "liczba") {
    const xs = glosy.map((g) => g.w).filter((x) => typeof x === "number").sort((a, b) => a - b);
    const s = { n: xs.length };
    if (!xs.length) return { ...s, slupki: [] };
    s.mediana = xs.length % 2 ? xs[(xs.length - 1) / 2] : (xs[xs.length / 2 - 1] + xs[xs.length / 2]) / 2;
    if (p.poprawna !== undefined) s.poprawnych = xs.filter((x) => czyPoprawna(p, x)).length;
    const rozne = [...new Set(xs)];
    if (rozne.length <= 12) {
      s.slupki = rozne.map((v) => ({ e: fmt(v, 4), v, k: xs.filter((x) => x === v).length }));
    } else {
      // Odpowiedzi do mini-zadań skupiają się na kilku wartościach: 9 najczęstszych
      // (zawsze z poprawną, jeśli padła) jako osobne słupki, reszta zbiorczo.
      const ile = new Map();
      for (const x of xs) ile.set(x, (ile.get(x) || 0) + 1);
      let top = [...ile].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 9).map(([v]) => v);
      const dobra = rozne.find((v) => czyPoprawna(p, v));
      if (dobra !== undefined && !top.includes(dobra)) top = [...top.slice(0, 8), dobra];
      top.sort((a, b) => a - b);
      s.slupki = top.map((v) => ({ e: fmt(v, 4), v, k: ile.get(v) }));
      const reszta = xs.length - s.slupki.reduce((a, b) => a + b.k, 0);
      s.slupki.push({ e: `inne (${rozne.length - top.length} różnych)`, k: reszta, inne: true });
    }
    return s;
  }
  // tekst: zliczanie znormalizowanych wpisów
  const m = new Map();
  for (const g of glosy) for (const x of String(g.w).split("\n")) {
    const k = normalizujTekst(x);
    if (k && !ukryte.has(k)) m.set(k, (m.get(k) || 0) + 1);
  }
  return { n, slowa: [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pl")).slice(0, 60)
    .map(([e, k]) => ({ e, k })) };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Rysuje wyniki w elemencie el. opcje: { poprawna (pytanie z poprawną odp.), odslona, naUkryj(slowo) }
export function rysujWyniki(el, p, s, { odslona = false, pelne = null, naUkryj = null } = {}) {
  const pp = pelne || p; // pytanie z poprawną odpowiedzią (tylko przy odsłonie)
  if (!s || !s.n) { el.innerHTML = `<p class="pusto">Brak odpowiedzi.</p>`; return; }
  let h = "";
  if (s.slupki) {
    const max = Math.max(1, ...s.slupki.map((b) => b.k));
    h += `<div class="slupki">` + s.slupki.map((b) => {
      let dobry = false;
      if (odslona && pp.poprawna !== undefined) {
        if (b.v !== undefined) dobry = czyPoprawna(pp, b.v);
      }
      const proc = Math.round((100 * b.k) / s.n);
      return `<div class="wiersz${dobry ? " dobry" : ""}">
        <div class="et">${esc(b.e)}${dobry ? " ✓" : ""}</div>
        <div class="tor"><div class="pas" style="width:${(100 * b.k) / max}%"></div></div>
        <div class="ile">${b.k} <span>(${proc}%)</span></div></div>`;
    }).join("") + `</div>`;
  } else if (s.slowa) {
    const max = Math.max(1, ...s.slowa.map((w) => w.k));
    const dobre = odslona && pp.poprawna !== undefined ? [].concat(pp.poprawna).map(normalizujTekst) : [];
    h += `<div class="chmura">` + s.slowa.map((w) =>
      `<span class="slowo${dobre.includes(w.e) ? " dobry" : ""}${naUkryj ? " klik" : ""}" data-s="${esc(w.e)}"
        style="font-size:${(0.9 + 2.3 * Math.sqrt(w.k / max)).toFixed(2)}em" title="${w.k}">${esc(w.e)}</span>`).join(" ") + `</div>`;
  }
  const st = [`odpowiedzi: <b>${s.n}</b>`];
  if (s.mediana !== undefined) st.push(`mediana: <b>${fmt(s.mediana, 4)}</b>`);
  if (s.srednia !== undefined) st.push(`średnia: <b>${fmt(s.srednia)}</b>`);
  if (odslona && s.poprawnych !== undefined) st.push(`poprawnych: <b>${Math.round((100 * s.poprawnych) / s.n)}%</b>`);
  h += `<div class="staty">${st.join(" · ")}</div>`;
  el.innerHTML = h;
  if (naUkryj) el.querySelectorAll(".slowo").forEach((x) => x.addEventListener("click", () => naUkryj(x.dataset.s)));
}

export function opisPoprawnej(p) {
  if (p.poprawna === undefined || p.poprawna === null) return null;
  if (p.typ === "wybor") return znak(p, p.poprawna) + (p.opcje[p.poprawna] ? ". " + p.opcje[p.poprawna] : "");
  if (p.typ === "liczba") return fmt(p.poprawna, 6) + (p.jednostka ? " " + p.jednostka : "")
    + (p.tolerancja ? ` (± ${fmt(p.tolerancja, 6)})` : "");
  return [].concat(p.poprawna).join(", ");
}

export { esc };
