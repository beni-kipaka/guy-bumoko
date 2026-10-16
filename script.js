/* ===== À MODIFIER : réglages du cabinet ===== */
const CONFIG = {
  whatsapp: "243800000000",           // numéro WhatsApp, sans + ni espaces
  email: "contact@drbumoko.cd",       // adresse qui reçoit les messages et réservations
  envoiAuto: false,                    // true = envoi direct par e-mail via formsubmit.co (activer l'adresse une fois)
  joursAffiches: 14,                   // nombre de jours proposés
  horaires: {                          // 0 = dimanche … 6 = samedi ; [] = fermé
    0: [], 1: ["9:00","10:00","11:00","14:00","15:00","16:00"],
    2: ["9:00","10:00","11:00","14:00","15:00","16:00"],
    3: ["9:00","10:00","11:00","14:00","15:00","16:00"],
    4: ["9:00","10:00","11:00","14:00","15:00","16:00"],
    5: ["9:00","10:00","11:00","14:00","15:00","16:00"],
    6: ["9:00","10:00","11:00"]
  }
};
/* ============================================ */

const $ = (s, r = document) => r.querySelector(s);
const KEY = "rdv-bumoko";
const jours = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
const mois = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
let choix = { date: null, heure: null };

const pris = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const libelle = d => `${jours[d.getDay()]} ${d.getDate()} ${mois[d.getMonth()]}`;

// Créneaux déjà occupés (simulation stable) + ceux réservés sur cet appareil
function occupe(date, heure) {
  const seed = [...(date + heure)].reduce((a, c) => a + c.charCodeAt(0), 0);
  return seed % 4 === 0 || pris().some(r => r.date === date && r.heure === heure);
}
function libres(d) {
  return (CONFIG.horaires[d.getDay()] || []).filter(h => !occupe(iso(d), h));
}
function prochainsJours() {
  const out = [], d = new Date();
  for (let i = 1; out.length < CONFIG.joursAffiches; i++) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
    if ((CONFIG.horaires[x.getDay()] || []).length) out.push(x);
  }
  return out;
}

// Envoi WhatsApp / e-mail
const lienWA = t => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(t)}`;
const lienMail = (sujet, corps) => `mailto:${CONFIG.email}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
function envoiAuto(sujet, champs) {
  if (!CONFIG.envoiAuto) return;
  fetch("https://formsubmit.co/ajax/" + CONFIG.email, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ _subject: sujet, ...champs }) }).catch(() => {});
}

// Choix du jour
function afficherJours() {
  const box = $("#days");
  box.innerHTML = "";
  prochainsJours().forEach(d => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = libelle(d);
    b.setAttribute("aria-pressed", "false");
    b.disabled = !libres(d).length;
    b.onclick = () => choisirJour(d);
    b.dataset.date = iso(d);
    box.appendChild(b);
  });
}
function choisirJour(d, heure) {
  choix = { date: iso(d), heure: null };
  document.querySelectorAll("#days button").forEach(b => b.setAttribute("aria-pressed", b.dataset.date === choix.date));
  const box = $("#slots");
  box.innerHTML = "";
  (CONFIG.horaires[d.getDay()] || []).forEach(h => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = h.replace(":", "h");
    b.dataset.h = h;
    b.disabled = occupe(choix.date, h);
    b.setAttribute("aria-pressed", "false");
    b.onclick = () => choisirHeure(h);
    box.appendChild(b);
  });
  if (heure) choisirHeure(heure);
}
function choisirHeure(h) {
  choix.heure = h;
  document.querySelectorAll("#slots button").forEach(b => b.setAttribute("aria-pressed", b.dataset.h === h));
}

// Prochaines disponibilités (page d'accueil)
function afficherProchains() {
  const ul = $("#nextSlots");
  let n = 0;
  for (const d of prochainsJours()) {
    const l = libres(d);
    if (!l.length) continue;
    const li = document.createElement("li");
    li.innerHTML = `<button type="button"><span>${libelle(d)}</span><b>${l[0].replace(":", "h")}</b></button>`;
    li.firstChild.onclick = () => {
      location.hash = "#reservation";
      choisirJour(d, l[0]);
    };
    ul.appendChild(li);
    if (++n === 3) break;
  }
}

// Envoi de la demande
$("#bookForm").addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target, err = $("#err");
  const nom = f.nom.value.trim(), tel = f.tel.value.trim();
  const msg = !choix.date ? "Choisissez un jour."
    : !choix.heure ? "Choisissez une heure."
    : !nom ? "Indiquez votre nom."
    : tel.replace(/\D/g, "").length < 9 ? "Indiquez un numéro de téléphone valide."
    : "";
  err.hidden = !msg;
  err.textContent = msg;
  if (msg) return;

  const ref = "RDV-" + Math.random().toString(36).slice(2, 7).toUpperCase();
  const liste = pris();
  liste.push({ ref, date: choix.date, heure: choix.heure, nom, tel, motif: f.motif.value, mail: f.mail.value, msg: f.msg.value });
  localStorage.setItem(KEY, JSON.stringify(liste));

  const d = new Date(choix.date + "T12:00:00");
  const quand = `${libelle(d)} à ${choix.heure.replace(":", "h")}`;
  $("#doneText").textContent = `${nom}, votre demande de ${f.motif.value.toLowerCase()} est enregistrée pour le ${quand}. Référence : ${ref}. Le cabinet vous rappellera pour la confirmer.`;
  const texte = `Bonjour Docteur, je souhaite confirmer mon rendez-vous (${f.motif.value}) le ${quand}. Nom : ${nom}. Réf. ${ref}.`;
  $("#wa").href = lienWA(texte);
  $("#mail").href = lienMail(`Demande de rendez-vous ${ref}`, `${texte}\nTéléphone : ${tel}\nE-mail : ${f.mail.value}\nMessage : ${f.msg.value}`);
  envoiAuto(`Réservation ${ref}`, { Motif: f.motif.value, Date: quand, Nom: nom, Téléphone: tel, Email: f.mail.value, Message: f.msg.value });
  f.hidden = true;
  $("#done").hidden = false;
  $("#done").scrollIntoView({ behavior: "smooth", block: "center" });
});

$("#again").onclick = () => {
  const f = $("#bookForm");
  f.reset();
  choix = { date: null, heure: null };
  $("#slots").innerHTML = '<p class="hint">Choisissez d’abord un jour.</p>';
  afficherJours();
  f.hidden = false;
  $("#done").hidden = true;
};

// Menu mobile
const burger = $(".burger"), nav = $("#nav");
const menu = ouvert => { nav.classList.toggle("open", ouvert); burger.setAttribute("aria-expanded", ouvert); burger.textContent = ouvert ? "✕ Fermer" : "☰ Menu"; };
burger.onclick = () => menu(!nav.classList.contains("open"));
nav.addEventListener("click", e => { if (e.target.tagName === "A") menu(false); });

$("#year").textContent = new Date().getFullYear();
afficherJours();
afficherProchains();

// Formulaire de contact : WhatsApp ou e-mail
$("#contactForm").addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target, err = $("#cerr"), canal = e.submitter ? e.submitter.value : "mail";
  const nom = f.nom.value.trim(), sujet = f.sujet.value.trim(), msg = f.msg.value.trim();
  err.hidden = !!(nom && sujet && msg);
  err.textContent = "Renseignez votre nom, le sujet et votre message.";
  if (err.hidden === false) return;
  const corps = `${msg}\n\n${nom}${f.tel.value ? " · " + f.tel.value : ""}`;
  if (canal === "wa") window.open(lienWA(`${sujet}\n\n${corps}`), "_blank", "noopener");
  else { envoiAuto(sujet, { Nom: nom, Téléphone: f.tel.value, Message: msg }); location.href = lienMail(sujet, corps); }
});

// Thème clair / sombre
const themeBtn = $("#theme");
function majTheme() { const sombre = document.documentElement.dataset.theme === "dark"; themeBtn.innerHTML = `<span>${sombre ? "☀" : "☾"}</span><span class="lbl"> ${sombre ? "Clair" : "Sombre"}</span>`; }
themeBtn.onclick = () => {
  const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("theme", t); } catch {}
  majTheme();
};
majTheme();

// Liens « Demander les tarifs » : pré-remplit le sujet du formulaire de contact
document.querySelectorAll("[data-sujet]").forEach(a => a.addEventListener("click", () => {
  $("#contactForm").sujet.value = a.dataset.sujet;
}));
