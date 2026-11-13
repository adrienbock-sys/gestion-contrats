(() => {
  "use strict";

  const KEY = "gestion-contrats:v1";
  const STATUS = {
    brouillon: "Brouillon",
    actif: "Actif",
    a_renouveler: "À renouveler",
    termine: "Terminé",
    resilie: "Résilié",
  };
  const ALERT_DAYS = 30;
  const CLOSED = ["termine", "resilie"];

  const $ = (id) => document.getElementById(id);
  const els = {
    stats: $("stats"), alerts: $("alerts"), rows: $("rows"), empty: $("empty"),
    search: $("search"), filter: $("filter-status"), dialog: $("dialog"), form: $("form"),
    title: $("dialog-title"), btnNew: $("btn-new"), btnCancel: $("btn-cancel"),
    btnSeed: $("btn-seed"), btnExport: $("btn-export"),
  };

  // ---------- Stockage (localStorage, protégé) ----------
  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* stockage indisponible */ }
  }
  let contracts = load();

  // ---------- Utilitaires ----------
  const uid = () => Math.random().toString(36).slice(2, 10);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const eur = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n) || 0);
  const fmtDate = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("fr-FR") : "—");
  const today = () => new Date(new Date().toDateString());
  const daysUntil = (d) => Math.round((new Date(d + "T00:00:00") - today()) / 864e5);
  const isOpen = (c) => !CLOSED.includes(c.status) && !!c.end;

  // ---------- Données aléatoires ----------
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const CLIENTS = ["Nordlys Logistique", "Atelier Verdier", "Cabinet Lumen", "Groupe Hasard & Fils", "Maison Okari", "Brasserie Quartz", "Studio Pivoine", "Transports Caldera", "Clinique du Lac", "Ferme Azur", "Helix Consulting", "Vélo Mirage"];
  const OBJETS = ["Maintenance informatique", "Prestation de conseil", "Location de véhicules", "Licence logicielle SaaS", "Nettoyage de locaux", "Développement web", "Assurance flotte", "Formation des équipes", "Hébergement serveur", "Fourniture de matériel", "Audit de sécurité", "Abonnement téléphonie"];
  const CONTACTS = ["Léa Martin", "Hugo Bernard", "Chloé Dubois", "Nathan Petit", "Inès Moreau", "Louis Laurent", "Jade Simon", "Gabriel Michel"];
  const NOTES = ["Renouvellement tacite annuel.", "Préavis de 3 mois.", "Clause de révision annuelle (indice Syntec).", "À relancer avant signature.", "Pénalités de retard prévues.", "", "", "Accord cadre, bons de commande ponctuels."];
  const STATUSES = Object.keys(STATUS);

  function randomContract() {
    const start = new Date(Date.now() - rnd(-300, 900) * 864e5);
    const end = new Date(start.getTime() + rnd(6, 36) * 30 * 864e5);
    const iso = (d) => d.toISOString().slice(0, 10);
    return {
      id: uid(),
      ref: "CT-" + new Date().getFullYear() + "-" + rnd(100, 999),
      client: pick(CLIENTS),
      object: pick(OBJETS),
      start: iso(start),
      end: iso(end),
      amount: rnd(900, 180000) + pick([0, 0.5, 0.25]),
      status: pick(STATUSES),
      contact: pick(CONTACTS),
      notes: pick(NOTES),
    };
  }

  // ---------- Rendu ----------
  function filtered() {
    const q = els.search.value.trim().toLowerCase();
    const st = els.filter.value;
    return contracts
      .filter((c) => !st || c.status === st)
      .filter((c) => !q || [c.ref, c.client, c.object, c.contact].some((v) => String(v || "").toLowerCase().includes(q)))
      .sort((a, b) => (a.end || "").localeCompare(b.end || ""));
  }

  function renderStats() {
    const active = contracts.filter((c) => c.status === "actif" || c.status === "a_renouveler");
    const value = active.reduce((s, c) => s + Number(c.amount || 0), 0);
    const soon = contracts.filter((c) => isOpen(c) && daysUntil(c.end) >= 0 && daysUntil(c.end) <= ALERT_DAYS).length;
    const items = [
      ["Contrats", contracts.length],
      ["Actifs", contracts.filter((c) => c.status === "actif").length],
      ["Échéances < 30 j", soon],
      ["Valeur active", eur(value)],
    ];
    els.stats.innerHTML = items.map(([l, v]) => `<div class="stat"><div class="label">${l}</div><div class="value">${esc(v)}</div></div>`).join("");
  }

  function renderAlerts() {
    const due = contracts
      .filter(isOpen)
      .map((c) => ({ c, d: daysUntil(c.end) }))
      .filter(({ d }) => d <= ALERT_DAYS)
      .sort((a, b) => a.d - b.d);
    if (!due.length) { els.alerts.hidden = true; els.alerts.innerHTML = ""; return; }
    els.alerts.hidden = false;
    const when = (d) => (d < 0 ? `expiré depuis ${-d} j` : d === 0 ? "expire aujourd’hui" : `dans ${d} j`);
    els.alerts.innerHTML = `<strong>⚠️ ${due.length} échéance(s) à traiter</strong><ul>` +
      due.map(({ c, d }) => `<li>${esc(c.ref)} · ${esc(c.client)} — ${when(d)}</li>`).join("") + "</ul>";
  }

  function renderRows() {
    const list = filtered();
    els.empty.hidden = list.length > 0;
    els.empty.textContent = contracts.length
      ? "Aucun résultat pour ces filtres."
      : "Aucun contrat. Crée-en un ou charge les données démo.";
    els.rows.innerHTML = list.map((c) => `
      <tr>
        <td>${esc(c.ref)}</td>
        <td>${esc(c.client)}</td>
        <td class="obj">${esc(c.object)}</td>
        <td>${fmtDate(c.start)}</td>
        <td>${fmtDate(c.end)}</td>
        <td class="num">${eur(c.amount)}</td>
        <td><span class="badge ${esc(c.status)}">${esc(STATUS[c.status] || c.status)}</span></td>
        <td><div class="row-actions">
          <button data-act="edit" data-id="${esc(c.id)}" type="button">Modifier</button>
          <button data-act="del" data-id="${esc(c.id)}" class="del" type="button">Supprimer</button>
        </div></td>
      </tr>`).join("");
  }

  function render() { renderStats(); renderAlerts(); renderRows(); }

  function commit(list) { contracts = list; save(contracts); render(); }

  // ---------- Formulaire ----------
  function openForm(c) {
    els.form.reset();
    $("f-id").value = c?.id || "";
    $("f-ref").value = c?.ref || "";
    $("f-client").value = c?.client || "";
    $("f-object").value = c?.object || "";
    $("f-start").value = c?.start || new Date().toISOString().slice(0, 10);
    $("f-end").value = c?.end || "";
    $("f-amount").value = c?.amount ?? "";
    $("f-status").value = c?.status || "brouillon";
    $("f-contact").value = c?.contact || "";
    $("f-notes").value = c?.notes || "";
    els.title.textContent = c ? "Modifier le contrat" : "Nouveau contrat";
    els.dialog.showModal();
    $("f-ref").focus();
  }

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = {
      id: $("f-id").value || uid(),
      ref: $("f-ref").value.trim(),
      client: $("f-client").value.trim(),
      object: $("f-object").value.trim(),
      start: $("f-start").value,
      end: $("f-end").value,
      amount: Number($("f-amount").value),
      status: $("f-status").value,
      contact: $("f-contact").value.trim(),
      notes: $("f-notes").value.trim(),
    };
    if (data.end < data.start) { alert("La date d’échéance doit être après le début."); return; }
    const exists = contracts.some((c) => c.id === data.id);
    commit(exists ? contracts.map((c) => (c.id === data.id ? data : c)) : [...contracts, data]);
    els.dialog.close();
  });
  els.btnCancel.addEventListener("click", () => els.dialog.close());

  // ---------- Actions ----------
  els.btnNew.addEventListener("click", () => openForm(null));
  els.rows.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const c = contracts.find((x) => x.id === b.dataset.id);
    if (!c) return;
    if (b.dataset.act === "edit") openForm(c);
    if (b.dataset.act === "del" && confirm(`Supprimer le contrat ${c.ref} (${c.client}) ? Action irréversible.`)) {
      commit(contracts.filter((x) => x.id !== c.id));
    }
  });
  els.search.addEventListener("input", renderRows);
  els.filter.addEventListener("change", renderRows);

  els.btnSeed.addEventListener("click", () => {
    if (contracts.length && !confirm("Ajouter 12 contrats aléatoires aux contrats existants ?")) return;
    commit([...contracts, ...Array.from({ length: 12 }, randomContract)]);
  });

  els.btnExport.addEventListener("click", () => {
    const head = ["Référence", "Client", "Objet", "Début", "Échéance", "Montant", "Statut", "Contact", "Notes"];
    const lines = [head, ...contracts.map((c) => [c.ref, c.client, c.object, c.start, c.end, c.amount, STATUS[c.status] || c.status, c.contact, c.notes])]
      .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";"));
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "contrats.csv" });
    a.click();
    URL.revokeObjectURL(a.href);
  });

  render();
})();
