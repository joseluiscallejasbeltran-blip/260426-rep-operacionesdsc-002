/*
  Simple bitácora / checklist app for unidades.
  - Stores data in localStorage
  - Background image from project asset is used in CSS for all windows
  - Mobile-first, single-screen layout. Modals used for entry (no separate pages)
*/

const STORAGE_KEY = "bitacora_unidades_v1";
// persistence key for selected branch
const BRANCH_STORAGE_KEY = "bitacora_selected_branch_v1";
let currentBranch = null;
let currentModule = "Reparto"; // default module (will be set after branch selection)

const BRANCH_UNITS = {
  tijuana: ["freightliner","international","isuzu","kenworth","peugeot","sprinter","transit"],
  ensenada: ["international","sprinter"],
  mexicali: ["freightliner","sprinter"],
  guadalajara: ["freightliner","isuzu","sprinter","transit"],
  mexico: ["sprinter","transit"],
  hermosillo: ["freightliner","isuzu","sprinter"],
  magdalena: ["freightliner","peugeot"],
  la_paz: ["freightliner","sprinter"],
  los_mochis: ["freightliner","peugeot","sprinter"],
  monterrey: ["freightliner","peugeot","sprinter"],
  ciudad_juarez: ["sprinter"],
  tuxtla: ["freightliner","sprinter"],
  merida: ["freightliner","peugeot","sprinter"],
  chihuahua: ["freightliner"],
  veracruz: ["freightliner"]
};

const KNOWN_UNITS = {
  international: "International",
  freightliner: "Freightliner",
  kenworth: "Kenworth",
  isuzu: "Isuzu",
  sprinter: "Sprinter",
  transit: "Transit",
  peugeot: "Peugeot"
};

const defaults = {
  units: Object.keys(KNOWN_UNITS).map(id=>({ id, name: KNOWN_UNITS[id] })),
  reports: []
};

let state = load();

const drivers = [
  "Jorge Gomez",
  "Francisco Vargas",
  "Martin Chan",
  "Filiberto Vega",
  "Jose Ramon Lopez",
  "Osvaldo Rivas",
  "Ernesto García",
  "Luis García",
  "Edgar Sanchez"
];

/*
  Centralized modules definition so the same checklist structure is used everywhere
  (UI and PDF generation) and ensures items that were not reviewed are reported as "no verificado".
*/
const MODULES = [
  {
    title: "Módulo 1 — Documentación de la Unidad",
    items: [
      "Tarjeta de circulación vigente",
      "Verificación vehicular",
      "Seguro vigente",
      "Placas en buen estado",
      "Permiso federal vigente",
      "Permiso estatal vigente"
    ]
  },
  {
    title: "Módulo 2 — Documentación del Chofer",
    items: [
      "Licencia vigente",
      "Tipo de licencia correcta para la unidad",
      "Identificación oficial",
      "Carta responsiva / asignación de unidad"
    ]
  },
  {
    title: "Módulo 3 — Seguridad Crítica (Alta Prioridad)",
    items: [
      "Llantas en buen estado",
      "Luces de freno",
      "Luces delanteras",
      "Intermitentes",
      "Claxon",
      "Espejos completos"
    ]
  },
  {
    title: "Módulo 4 — Niveles y Motor (Básico Operativo)",
    items: [
      "Nivel de aceite",
      "Nivel anticongelante",
      "Nivel líquido de frenos",
      "Sin fugas visibles",
      "Sin testigos de falla en tablero"
    ]
  },
  {
    title: "Módulo 5 — Cabina y Operación",
    items: [
      "Cinturón de seguridad",
      "Tablero funcional",
      "Limpiaparabrisas",
      "Agua limpia parabrisas",
      "Vidrios completos",
      "Puertas cierran correctamente"
    ]
  },
  {
    title: "Módulo 6 — Equipo de Seguridad Obligatorio",
    items: [
      "Extintor vigente",
      "Triángulos reflejantes",
      "Botiquín",
      "Chaleco reflejante",
      "Linterna"
    ]
  },
  {
    title: "Módulo 7 — Implementos y Herramientas",
    items: [
      "Gato",
      "Llave de ruedas",
      "Herramienta básica",
      "Refacción disponible"
    ]
  },
  {
    title: "Módulo 8 — Condición General Exterior",
    items: [
      "Golpes estructurales",
      "Fugas visibles debajo unidad"
    ]
  },
  {
    title: "Módulo 9 — Termo Refrigerado / Congelación",
    items: [
      "¿La unidad cuenta con Termo ?",
      "¿El equipo Thermo enciende correctamente?",
      "¿Está enfriando / congelando según lo requerido?",
      "¿La temperatura marcada coincide con la programada?",
      "¿No se escuchan ruidos anormales?",
      "¿El display / control funciona correctamente?"
    ]
  }
];

const unitButtonsEl = document.getElementById("unitButtons");
const unitListEl = document.getElementById("unitList"); // kept for legacy but not used for buttons
const listContainer = document.getElementById("listContainer");

const newReportBtn = document.getElementById("newReportBtn");
const exportPdfTopBtn = document.getElementById("exportPdfTopBtn");
const exportExcelTopBtn = document.getElementById("exportExcelTopBtn");

 // Make bottom-panel "Nuevo" open the branch selection modal (instead of delegating to the top New button)
const newReportBtnBottom = document.getElementById("newReportBtnBottom");
if (newReportBtnBottom) {
  newReportBtnBottom.addEventListener("click", () => {
    // show the blocking "Selecciona Sucursal" modal so user picks branch
    // ensure modal uses the no-card transparent variant as used at startup
    document.querySelector(".modal")?.classList.add("no-card");
    modalOverlay.classList.add("no-scroll");
    showBranchModal();
  });
}

let currentUnitId = null;
let currentPlate = null;
let currentSupervisor = null;

/*
  Topbar "Exportar PDF" button now generates an organizational PDF report:
  - collects all reports for the current unit that have incidentsCount > 0
  - for each such report, adds a PDF page with an image for the unit view and report metadata
  - uses the same representative images as the viewer (freight images for freightliner, default background otherwise)
*/
if(exportPdfTopBtn){
  exportPdfTopBtn.addEventListener("click", ()=> {
    (async ()=> {
      // prefer explicit selection, fall back to visible select value, then first unit
      const unitId = currentUnitId || (document.getElementById("unitList")?.value) || (state.units[0] && state.units[0].id);
      if(!unitId) return alert("Selecciona una unidad primero");
      const unit = state.units.find(u=>u.id === unitId) || {};

      // consider reports that have explicit incidents OR contain any checklist item marked "no"
      const reports = (state.reports || []).filter(r => r.unitId === unitId).sort((a,b)=>b.createdAt - a.createdAt);
      const reportsWithIncidents = reports.filter(r => {
        if((r.incidentsCount || 0) > 0) return true;
        if(Array.isArray(r.checks)) {
          return r.checks.some(c => String(c.status).toLowerCase() === "no");
        }
        return false;
      });

      // if none found, offer to include all reports for the unit (user choice)
      if(reportsWithIncidents.length === 0){
        if(reports.length === 0) return alert("No hay reportes para esta unidad.");
        const includeAll = confirm("No se encontraron reportes con incidencias. ¿Deseas exportar todos los reportes de la unidad?");
        if(!includeAll) return;
      }

      // choose representative images for the unit (used only if a report lacks its own image)
      const freightImages = [
        "/freight_front.png",
        "/freight_right.png",
        "/freight_right.png",
        "/freight_rear.png"
      ];
      // Isuzu-specific images: trasera, lateral derecho, lateral izquierdo (flipped), frontal
      const isuzuImages = [
        "/Captura de pantalla 2026-02-09 135855.png",
        "/Captura de pantalla 2026-02-09 135848.png",
        "/Captura de pantalla 2026-02-09 135844.png",
        "/Captura de pantalla 2026-02-09 135852.png"
      ];
      // International-specific images (rear, side, front, corner)
      const internationalImages = [
        "/Captura de pantalla 2026-02-09 141257.png",
        "/Captura de pantalla 2026-02-09 141251.png",
        "/Captura de pantalla 2026-02-09 141301.png",
        "/Captura de pantalla 2026-02-09 141307.png"
      ];
      // Kenworth-specific images (frontal, close/detail, side, branded side)
      const kenworthImages = [
        "/Captura de pantalla 2026-02-09 151119.png",
        "/Captura de pantalla 2026-02-09 151124.png",
        "/Captura de pantalla 2026-02-09 151133.png",
        "/Captura de pantalla 2026-02-09 151845.png"
      ];
      // Mercedes / Sprinter images (front - passenger side, rear, front three-quarter, front studio)
      const mercedesImages = [
        "/Captura de pantalla 2026-02-09 161015.png", // front — passenger side
        "/Captura de pantalla 2026-02-09 161011.png", // rear view
        "/Captura de pantalla 2026-02-09 161022.png", // front three-quarter
        "/Captura de pantalla 2026-02-09 161004.png"  // front studio (center)
      ];
      const defaultImg = "/ChatGPT Image 5 feb 2026, 14_35_47.png";
      let imgs = [defaultImg, defaultImg, defaultImg, defaultImg];
      if(unitId === "freightliner") imgs = freightImages;
      if(unitId === "isuzu") imgs = isuzuImages;
      if(unitId === "international") imgs = internationalImages;
      if(unitId === "kenworth") imgs = kenworthImages;
      if(unitId === "sprinter") imgs = mercedesImages;

      try {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({ unit: "pt", format: "a4" });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        // Add a cover page with unit summary
        pdf.setFontSize(18);
        // show branch in the cover title (fallback to generic if no branch selected)
        const BRANCH_LABELS = {
          tijuana: "Tijuana",
          mexicali: "Méxicali",
          ensenada: "Ensenada",
          la_paz: "La Paz",
          magdalena: "Magdalena",
          hermosillo: "Hermosillo",
          los_mochis: "Los Mochis",
          guadalajara: "Guadalajara",
          mexico: "México",
          monterrey: "Monterrey",
          ciudad_juarez: "Ciudad Juárez",
          veracruz_xalapa: "Veracruz (Xalapa)",
          veracruz: "Veracruz",
          tuxtla: "Tuxtla",
          merida: "Mérida"
        };
        const branchDisplay = BRANCH_LABELS[currentBranch] || (currentBranch ? currentBranch.charAt(0).toUpperCase() + currentBranch.slice(1) : "");
        const titleBranch = branchDisplay ? `Reporte de Unidades ${branchDisplay}` : "Reporte de Unidades";
        // include plate in title when available (prefer explicit currentPlate, then most recent report plate)
        const plateLabel = currentPlate || (reports[0] && reports[0].plate) || "";
        const titleWithPlate = plateLabel ? `${titleBranch} — ${unit.name || "Unidad"} — Placa ${plateLabel}` : `${titleBranch} — ${unit.name || "Unidad"}`;
        pdf.text(titleWithPlate, 40, 60);
        pdf.setFontSize(12);
        pdf.text(`Fecha: ${new Date().toLocaleString()}`, 40, 86);
        // include driver and supervisor when available (prefer explicit currentPlate report info, then unit-level)
        const coverDriver = (reports[0] && reports[0].driver) || unit.driver || currentSupervisor ? ((reports[0] && reports[0].driver) || "") : ((reports[0] && reports[0].driver) || "");
        const coverSupervisor = (reports[0] && reports[0].supervisor) || currentSupervisor || unit.supervisor || "";
        if(coverDriver) pdf.text(`Chofer: ${coverDriver}`, 40, 104);
        if(coverSupervisor) pdf.text(`Supervisor: ${coverSupervisor}`, 40, 122);
        pdf.text(`Reportes considerados: ${reportsWithIncidents.length > 0 ? reportsWithIncidents.length : reports.length}`, 40, (coverSupervisor || coverDriver) ? 140 : 106);

        // --- Checklist / resultados summary section on cover ---
        // Elaborate formatted checklist summary grouped by module, using boxes and symbols.
        pdf.setFontSize(11);
        const coverMargin = 40;
        let curY = 126;
        const sectionGap = 8;
        const itemLineH = 12;
        const boxPadding = 6;
        const boxW = pageW - coverMargin * 2;

        // small helper to advance to next page when needed
        const ensureSpace = (need) => {
          if(curY + need > pageH - 60) {
            pdf.addPage();
            curY = 60;
          }
        };

        // draw a labeled pill for section headers
        const drawSectionTitle = (text) => {
          ensureSpace(28);
          pdf.setDrawColor(30, 70, 140);
          pdf.setFillColor(18, 58, 147);
          pdf.setTextColor(255,255,255);
          pdf.setFontSize(12);
          const h = 20;
          pdf.roundedRect(coverMargin, curY, boxW, h, 6, 6, 'F');
          pdf.text(text, coverMargin + 10, curY + 14);
          curY += h + 6;
          pdf.setTextColor(0,0,0);
        };

        // determine importance and periodicity from label text
        const importanceForLabel = (lbl) => {
          const s = String(lbl).toLowerCase();
          const mechanical = ["llanta","llantas","fugas","aceite","anticongelante","freno","claxon","motor","niveles","luces","luces de freno","intermitentes","espejos","bomba","bater","batería","nivel de aceite","sin fugas","testigos"];
          const governmental = ["tarjeta de circulación","verificación","seguro","placa","placas","licencia","identificación","identificacion","carta responsiva"];
          const aesthetic = ["golpe","golpes","estético","estetico","golpes estructurales","esteticos","rajo","abolladura","pintura","raspon","raspón","vidrio dañado","vidrios","vidrios completos","estético"];
          if(governmental.some(k => s.includes(k))) return "Alta";
          if(mechanical.some(k => s.includes(k))) return "Alta";
          if(aesthetic.some(k => s.includes(k))) return "Baja";
          return "Media";
        };
        const periodicityForLabel = (lbl) => {
          const s = String(lbl).toLowerCase();
          const governmental = ["tarjeta de circulación","verificación","verificacion","seguro","placa","placas","licencia"];
          const mechanical = ["llanta","llantas","aceite","anticongelante","freno","motor","niveles","fugas","testigos","claxon","luces","intermitentes"];
          if(governmental.some(k => s.includes(k))) return "Mensual";
          if(mechanical.some(k => s.includes(k))) return "Diaria";
          return "Mensual";
        };

        // draw a single checklist item row with columns: Estatus | Ítem | Periodicidad | Observación
        const drawCheckItem = (label, status, observation = "") => {
          ensureSpace(itemLineH + boxPadding);
          const bandH = itemLineH + 6;
          const isOdd = Math.floor(curY / bandH) % 2 === 0;
          if(isOdd) {
            pdf.setFillColor(234, 239, 248); // soft blue
          } else {
            pdf.setFillColor(242, 242, 242); // light gray
          }
          pdf.rect(coverMargin, curY, boxW, bandH, 'F');

          // badge / estatus column
          const badgeX = coverMargin + 18;
          const badgeY = curY + Math.round(bandH / 2);
          const badgeR = 8;
          let badgeColor = [140,140,140];
          // Use textual labels in Spanish with consistent coloring: "Si" = green, "No" = red, "N/A" = orange
          let symbol = "N/A";
          if(status === "yes") { badgeColor = [38,139,64]; symbol = "Si"; }
          else if(status === "no") { badgeColor = [178,10,10]; symbol = "No"; }
          else { badgeColor = [212,140,20]; symbol = "N/A"; }

          pdf.setDrawColor(0);
          pdf.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
          try { pdf.circle(badgeX, badgeY, badgeR, 'F'); } catch(e){ pdf.roundedRect(badgeX - badgeR, badgeY - badgeR, badgeR*2, badgeR*2, badgeR, badgeR, 'F'); }
          pdf.setFontSize(10);
          pdf.setTextColor(255,255,255);
          // center the short text label
          pdf.text(symbol, badgeX - (pdf.getTextWidth(String(symbol))/2), badgeY + 3);

          // column positions - make ITEM wider by moving periodicity and observation to the right
          const colItemX = badgeX + badgeR + 14;
          const colPeriodicX = coverMargin + boxW - 260; // moved right to give more width to ITEM
          const colObsX = coverMargin + boxW - 140; // observation column starts further right

          // item text
          pdf.setFontSize(10);
          pdf.setTextColor(11,43,43);
          const availableW = colPeriodicX - colItemX - 12;
          const wrapped = pdf.splitTextToSize(label, availableW);
          pdf.text(wrapped, colItemX, badgeY + 3);

          // periodicity
          const periodic = periodicityForLabel(label);
          pdf.setFontSize(9);
          pdf.setTextColor(50,50,50);
          pdf.text(periodic, colPeriodicX, badgeY + 3);

          // observation column should display a human-readable result based on status:
          // "Cumple" for yes, "No Cumple" for no, "No Verificado" otherwise
          pdf.setFontSize(9);
          pdf.setTextColor(60,60,60);
          const obsAvailableW = (coverMargin + boxW) - colObsX - 8;
          let obsText = "";
          if(status === "yes") obsText = "Cumple";
          else if(status === "no") obsText = "No Cumple";
          else obsText = "No Verificado";
          const obsWrapped = pdf.splitTextToSize(obsText, obsAvailableW);
          pdf.text(obsWrapped, colObsX, badgeY + 3);

          curY += bandH;
        };

        // Aggregate checks across the chosen reports (if none matched incidents, aggregate all)
        const chosenReports = (reportsWithIncidents.length > 0) ? reportsWithIncidents : reports;
        const aggregateByLabel = {};
        chosenReports.forEach(r => {
          if(Array.isArray(r.checks)){
            r.checks.forEach(c => {
              const lbl = (c.label || "").toString().trim() || "Ítem";
              const st = (c.status === "yes") ? "yes" : (c.status === "no") ? "no" : "unverified";
              const obs = (c.observation || c.obs || "").toString().trim();
              if(!aggregateByLabel[lbl]) aggregateByLabel[lbl] = { label: lbl, status: st, count: 1, observation: obs || "" };
              else {
                aggregateByLabel[lbl].count++;
                const cur = aggregateByLabel[lbl].status;
                if(cur === "no" || st === "no") aggregateByLabel[lbl].status = "no";
                else if(cur === "unverified" || st === "unverified") aggregateByLabel[lbl].status = "unverified";
                else aggregateByLabel[lbl].status = "yes";
                // merge observations (avoid duplicates and keep semicolon separated)
                if(obs){
                  const existing = aggregateByLabel[lbl].observation || "";
                  const parts = existing.split(';').map(s=>s.trim()).filter(Boolean);
                  if(!parts.includes(obs)){
                    aggregateByLabel[lbl].observation = existing ? `${existing}; ${obs}` : obs;
                  }
                }
              }
            });
          }
        });

        // Build an ordered list of items from MODULES; ensure items never reviewed become 'unverified'
        const aggItems = [];
        MODULES.forEach(mod => {
          mod.items.forEach(lbl => {
            const entry = aggregateByLabel[lbl] || { label: lbl, status: "unverified", count: 0 };
            aggItems.push({ label: lbl, status: entry.status, count: entry.count || 0 });
          });
        });
        if(aggItems.length > 0){
          // Print a short cover heading and legend
          ensureSpace(20);
          // draw table header row for clarity: Estatus | Ítem | Periodicidad | Importancia
          (function drawTableHeader(){
            const headerH = 18;
            // header background
            pdf.setFillColor(18,58,147);
            pdf.setTextColor(255,255,255);
            pdf.setFontSize(11);
            pdf.rect(coverMargin, curY, boxW, headerH, 'F');
            // columns: Estatus | Ítem | Periodicidad | Observación
            pdf.text('Estatus', coverMargin + 18, curY + 13);
            pdf.text('Ítem', coverMargin + 80, curY + 13);
            // move periodicity and observation more to the right to widen ITEM
            pdf.text('Periodicidad', coverMargin + boxW - 260, curY + 13);
            pdf.text('Observación', coverMargin + boxW - 140, curY + 13);
            // (Importancia column removed)
            curY += headerH + 6;
            pdf.setTextColor(0,0,0);
            pdf.setFontSize(9);
          })();
          ensureSpace(8);
          pdf.setFontSize(9);
          pdf.setTextColor(0,0,0);
          curY += 18;

          // Print grouped by MODULES: show each module title then its items with aggregated status
          MODULES.forEach(mod => {
            // module header
            ensureSpace(28);
            pdf.setFontSize(11);
            pdf.setTextColor(18,58,147);
            // draw a subtle header bar for the module
            const modH = 18;
            pdf.setFillColor(230,235,250);
            pdf.rect(coverMargin, curY, boxW, modH, 'F');
            pdf.setTextColor(11,43,43);
            pdf.setFontSize(11);
            pdf.text(mod.title, coverMargin + 8, curY + 13);
            curY += modH + 6;

            // each item in the module (preserve module order)
            mod.items.forEach(lbl => {
              const entry = aggregateByLabel[lbl] || { label: lbl, status: "unverified", count: 0, observation: "" };
              drawCheckItem(`${entry.label}`, entry.status, entry.observation || "");
            });
          });
        } else {
          // fallback: no structured checks found; list report titles and short observations
          drawSectionTitle('Reportes considerados (sin checklist estructurado)');
          chosenReports.slice(0, 10).forEach(r =>{
            ensureSpace(28);
            pdf.setFontSize(11);
            pdf.setTextColor(11,43,43);
            const header = `${new Date(r.createdAt).toLocaleString()} — ${r.title || 'Reporte'}`;
            const wrapped = pdf.splitTextToSize(header, boxW);
            pdf.text(wrapped, coverMargin, curY);
            curY += (wrapped.length * 12) + 4;
            const obs = (r.observation || r.notes || '').toString();
            if(obs){
              const obsWrapped = pdf.splitTextToSize(`Observación: ${obs}`, boxW - 12);
              pdf.setFontSize(10);
              pdf.setTextColor(90,90,90);
              pdf.text(obsWrapped, coverMargin + 6, curY);
              curY += (obsWrapped.length * 11) + 8;
            } else {
              curY += 6;
            }
          });
          if(chosenReports.length > 10){
            ensureSpace(16);
            pdf.setFontSize(10);
            pdf.text(`...Mostrar ${chosenReports.length} reportes (se muestran los primeros 10)`, coverMargin, curY);
            curY += 16;
          }
        }

        // footer on cover page: ensure there's space, otherwise add a new page for footer
        pdf.setFontSize(9);
        if(curY + 30 < pageH - 40){
          pdf.setTextColor(100,100,100);
          pdf.text(`Generar reporte y enviar por correo a Freddy Valenzuela (fvalenzuela@distribucionessantacruz.com)`, 40, pageH - 40);
        } else {
          pdf.addPage();
          pdf.setTextColor(100,100,100);
          pdf.text(`Generar reporte y enviar por correo a Freddy Valenzuela (fvalenzuela@distribucionessantacruz.com)`, 40, pageH - 40);
        }

        // helper to load image element
        const loadImage = (src) => new Promise((res, rej)=>{
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = ()=> res(img);
          img.onerror = ()=> rej(new Error("img load error"));
          img.src = src;
        });

        // iterate over chosenReports (those we'll render pages for)
        // Strategy: render reports that contain annotated markers as full-page items (preserve marker detail).
        // For simple/static images (no markers) pack up to 4 images per page in a 2x2 grid with per-image metadata.
        // If there are no chosen reports, force both lists empty so no image pages are generated.
        let annotated = chosenReports.filter(r => r.imageSrc && Array.isArray(r.markers) && r.markers.length > 0);
        let simple = chosenReports.filter(r => !(r.imageSrc && Array.isArray(r.markers) && r.markers.length > 0));
        if (chosenReports.length === 0) {
          annotated = [];
          simple = [];
        }

        // Render annotated reports (one per page) — preserve previous behaviour
        for (let i = 0; i < annotated.length; i++) {
          const r = annotated[i];
          pdf.addPage();
          try {
            const img = await loadImage(r.imageSrc);
            const tmp = document.createElement("canvas");
            const iw = img.naturalWidth || img.width || 1000;
            const ih = img.naturalHeight || img.height || 800;
            tmp.width = iw;
            tmp.height = ih;
            const tctx = tmp.getContext("2d");
            tctx.drawImage(img, 0, 0, iw, ih);
            r.markers.forEach((m, idx) => {
              const x = (m.pos && typeof m.pos.x === "number") ? m.pos.x * iw : 0;
              const y = (m.pos && typeof m.pos.y === "number") ? m.pos.y * ih : 0;
              const radius = Math.max(8, iw / 80);
              tctx.beginPath();
              tctx.fillStyle = "rgba(220,30,30,0.95)";
              tctx.strokeStyle = "#fff";
              tctx.lineWidth = Math.max(2, iw / 200);
              tctx.arc(x, y, radius, 0, Math.PI * 2);
              tctx.fill();
              tctx.stroke();
              tctx.font = `bold ${Math.max(12, iw / 80)}px sans-serif`;
              tctx.fillStyle = "rgba(180,10,10,0.98)";
              const label = (m.label || "").trim() || (idx + 1).toString();
              tctx.fillText(label, x + (iw / 200), y + (iw / 200));
            });

            const margin = 40;
            const maxW = pageW - margin * 2;
            const maxH = pageH * 0.55;
            const ratio = Math.min(maxW / tmp.width, maxH / tmp.height, 1);
            const dw = Math.round(tmp.width * ratio);
            const dh = Math.round(tmp.height * ratio);
            const dataUrl = tmp.toDataURL("image/png");
            const x = (pageW - dw) / 2;
            const y = 70;
            pdf.addImage(dataUrl, "PNG", x, y, dw, dh);

            // metadata under image
            pdf.setFontSize(12);
            const metaY = y + dh + 20;
            pdf.text(`Reporte: ${r.title || "Reporte"}`, 40, metaY);
            pdf.setFontSize(10);
            pdf.text(`Fecha: ${new Date(r.createdAt).toLocaleString()}`, 40, metaY + 16);
            if (r.supervisor) pdf.text(`Supervisor: ${r.supervisor}`, 40, metaY + 32);
            if (r.driver) pdf.text(`Chofer: ${r.driver}`, 40, metaY + 48);
            if (r.plate) pdf.text(`Placa: ${r.plate}`, 40, metaY + 64);
            pdf.text(`Incidencias registradas: ${r.incidentsCount || 0}`, 40, metaY + 80);
            if (r.imageAlt) pdf.text(`Parte: ${r.imageAlt}`, 40, metaY + 100);
            const observationText = r.observation || r.notes || "";
            if (observationText) {
              const obsSplit = pdf.splitTextToSize(`Observación: ${String(observationText)}`, pageW - 80);
              pdf.text(obsSplit, 40, metaY + 104);
            }

            // Imprimir títulos de los módulos (cada apartado) para este reporte
            try {
              if (Array.isArray(MODULES) && MODULES.length > 0) {
                let modulesY = metaY + 140;
                pdf.setFontSize(10);
                pdf.setTextColor(18,58,147);
                pdf.text('Módulos:', 40, modulesY);
                modulesY += 14;
                MODULES.forEach(mod => {
                  const lines = pdf.splitTextToSize(mod.title, pageW - 80);
                  pdf.setFontSize(9);
                  pdf.setTextColor(11,43,43);
                  pdf.text(lines, 40, modulesY);
                  modulesY += (lines.length * 12) + 4;
                });
                // advance global cursor if present
                if (typeof curY === "number") curY = Math.max(curY, modulesY);
              }
            } catch(e){
              /* no-op if modules printing fails */
            }

          } catch (err) {
            console.warn("Fallo al procesar imagen anotada, usando imagen de respaldo", err);
          }
        }

        // Render simple reports in 2x2 grid, up to 4 per page
        const batchSize = 4;
        for (let b = 0; b < simple.length; b += batchSize) {
          const pageItems = simple.slice(b, b + batchSize);
          pdf.addPage();
          const margin = 40;
          const gap = 12;
          const cols = 2;
          const rows = 2;
          const gridW = pageW - margin * 2 - gap;
          const gridH = pageH * 0.55; // allocate upper area for images
          const cellW = Math.floor(gridW / cols);
          const cellH = Math.floor(gridH / rows);

          // For each item place it in 2x2 cell with image scaled to fit within cell minus small padding
          for (let idx = 0; idx < pageItems.length; idx++) {
            const r = pageItems[idx];
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            const xCell = margin + col * (cellW + gap / cols);
            const yCell = 70 + row * (cellH + 8);

            // choose image path (fallbacks)
            const imgPath = (r.imageSrc && typeof r.imageSrc === "string") ? r.imageSrc : imgs[(b + idx) % imgs.length];

            // load and draw scaled into cell
            try {
              // eslint-disable-next-line no-await-in-loop
              const img = await loadImage(imgPath);
              // compute draw size to fit inside cell while preserving aspect
              const iw = img.naturalWidth || img.width || 800;
              const ih = img.naturalHeight || img.height || 600;
              const pad = 8;
              const maxWCell = cellW - pad * 2;
              const maxHCell = cellH - pad * 2;
              const ratio = Math.min(maxWCell / iw, maxHCell / ih, 1);
              const dw = Math.round(iw * ratio);
              const dh = Math.round(ih * ratio);

              // draw to temporary canvas to ensure proper encoding
              const tmp = document.createElement("canvas");
              tmp.width = dw;
              tmp.height = dh;
              const tctx = tmp.getContext("2d");
              tctx.drawImage(img, 0, 0, dw, dh);
              const dataUrl = tmp.toDataURL("image/png");
              const drawX = xCell + Math.round((cellW - dw) / 2);
              const drawY = yCell + Math.round((cellH - dh) / 2);
              pdf.addImage(dataUrl, "PNG", drawX, drawY, dw, dh);

              // metadata below each cell image (small)
              const metaX = xCell + 4;
              const metaY = yCell + cellH + 6;
              pdf.setFontSize(9);
              pdf.setTextColor(20, 20, 20);
              pdf.text(`${r.title || 'Reporte'}`, metaX, metaY);
              pdf.setFontSize(8);
              pdf.setTextColor(90, 90, 90);
              pdf.text(`${new Date(r.createdAt).toLocaleString()}`, metaX, metaY + 10);
              if (r.plate) pdf.text(`Placa: ${r.plate}`, metaX, metaY + 20);
              if (r.driver) pdf.text(`Chofer: ${r.driver}`, metaX, metaY + 30);
              if (r.supervisor) pdf.text(`Supervisor: ${r.supervisor}`, metaX, metaY + 40);
              if (r.incidentsCount) pdf.text(`Incid: ${r.incidentsCount}`, metaX + 60, metaY + 20);
            } catch (err) {
              // if image load fails, leave cell blank and write basic metadata
              const metaX = xCell + 4;
              const metaY = yCell + 12;
              pdf.setFontSize(10);
              pdf.setTextColor(90, 90, 90);
              pdf.text(`${r.title || 'Reporte'} (imagen no disponible)`, metaX, metaY);
            }
          }
          // small footer note for the page
          pdf.setFontSize(9);
          pdf.setTextColor(100, 100, 100);
          pdf.text(`Página con hasta 4 imágenes — ${new Date().toLocaleString()}`, margin, pageH - 40);
        }

        const filename = `informe_${(unit.name||unitId).replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.pdf`;
        pdf.save(filename);
      } catch(err){
        console.error("Error generando PDF", err);
        alert("Ocurrió un error al generar el PDF.");
      }
    })();
  });

}

/* Exportar Excel (CSV) for selected unit: builds a CSV of reports and basic checklist summary */
if (typeof exportExcelTopBtn !== "undefined" && exportExcelTopBtn) {
  exportExcelTopBtn.addEventListener("click", () => {
    (async () => {
      const unitId = currentUnitId || (document.getElementById("unitList")?.value) || (state.units[0] && state.units[0].id);
      if (!unitId) return alert("Selecciona una unidad primero");
      const unit = state.units.find(u => u.id === unitId) || {};
      const reports = (state.reports || []).filter(r => r.unitId === unitId).sort((a,b)=>b.createdAt - a.createdAt);
      if (reports.length === 0) return alert("No hay reportes para esta unidad.");

      const VALID_RESPONSIBLES = [
        "Jefe de Sucursal",
        "Encargado de Unidades",
        "Gerencia General"
      ];

      // Do not prompt the user during export; keep existing responsables as-is.
      let chosenGlobalResponsable = null;

      // Build the rows according to the requested structure
      const rows = [];
      // Ensure each row has six cells so Excel columns A..F align; keep unused cells empty when not needed
      rows.push(["DISTRIBUCIONES SANTA CRUZ S.A DE C.V", "", "", "", "", ""]);
      rows.push(["INFORME DE HALLAZGOS EN VEHICULOS DE REPARTO", "", "", "", "", ""]);
      const branchLabel = currentBranch ? (String(currentBranch).replace(/_/g,' ').replace(/\b\w/g,ch=>ch.toUpperCase())) : "";
      rows.push(["Sucursal:", branchLabel, "", "", "", ""]);
      const plateLabel = (currentPlate && currentPlate.trim()) || (reports[0] && reports[0].plate) || (unit.plate && unit.plate.trim()) || "no especifica";
      // Row 4 (index 3) is the small header row with Tipo de Unidad / Unidad / Placas / Número de Placa (pad to 6 cols)
      rows.push(["Tipo de Unidad", unit.name || unitId, "Placas", plateLabel, "Fecha", ""]);
      // Row 5 (index 4) is the main column headers (we will apply background color to cells on this row only where there's data)
      // Added "Prioridad" as the F column for manual fill
      rows.push([
        "No. de Item",
        "Unidad",
        "Descripción del Item",
        "Estatus",
        "Responsable",
        "Prioridad"
      ]);

      let itemNo = 1;
      reports.forEach(r => {
        if (!Array.isArray(r.checks)) return;
        r.checks.forEach(c => {
          const status = (c.status || "unverified").toString().toLowerCase();
          if (status === "no") {
            let responsable = (r.supervisor || "").toString().trim();
            if (!VALID_RESPONSIBLES.includes(responsable)) {
              if (chosenGlobalResponsable) responsable = chosenGlobalResponsable;
              else responsable = "";
            }
            rows.push([
              String(itemNo++),
              unit.name || unitId,
              (c.label || "").replace(/;/g,','),
              "No cumple",
              responsable,
              "" // Prioridad (col F) left empty for manual filling in Excel
            ]);
          }
        });
      });

      if (rows.length === 5 && rows.slice(5).length === 0) {
        if (!confirm("No se encontraron ítems 'No cumple' para esta unidad. ¿Deseas descargar un archivo con la cabecera?")) return;
      }

      // Build an HTML table so Excel can open it and we can style the 5th row cells
      // We will set inline style background:#153D64;color:#fff only for cells in row index 5 (1-based row 5 -> zero-based index 4)
      const tableRowsHtml = rows.map((r, rowIndex) => {
        // determine if this row has any content in columns A..D (indexes 0..3)
        const rowHasLeft = r.slice(0,4).some(c => {
          const t = c === null || c === undefined ? "" : String(c);
          return t.replace(/\s/g,'') !== "";
        });

        const cells = r.map((cell, colIndex) => {
          const text = cell === null || cell === undefined ? "" : String(cell);
          // determine if the cell actually has visible text (non-whitespace)
          const hasText = text.replace(/\s/g,'') !== "";
          // apply background only to rowIndex === 4 (which is row 5 in Excel), and only when the cell has any non-empty text
          const applyBg = (rowIndex === 4) && hasText;
          // disable text wrap for rows 1 and 2 (rowIndex 0 and 1) by adding white-space:nowrap
          const nowrapStyle = (rowIndex === 0 || rowIndex === 1) ? 'white-space:nowrap;' : '';
          // apply border rules:
          // - normally border only when the cell itself has text
          // - but force border for columns E (colIndex 4) and F (colIndex 5) if any of columns A..D have content in this row
          // - also enforce a border specifically on cell F4 (excel row 4 => zero-based rowIndex 3, colIndex 5)
          let borderStyle = hasText ? 'border:1px solid #ccc;' : 'border:none;';
          // remove borders in columns E and F for rows 1..3 (zero-based rowIndex 0..2)
          if ((colIndex === 4 || colIndex === 5) && rowIndex >= 0 && rowIndex <= 2) {
            borderStyle = 'border:none;';
          }
          // apply border for columns E/F only when the row has left-side content and not in rows 1..3
          if ((colIndex === 4 || colIndex === 5) && rowHasLeft && !(rowIndex >= 0 && rowIndex <= 2)) {
            borderStyle = 'border:1px solid #ccc;';
          }
          if (rowIndex === 3 && colIndex === 5) {
            borderStyle = 'border:2px solid #153D64;'; // slightly stronger border for F4
          }
          // apply font override for rows 1 and 2 (rowIndex 0 and 1) to be bold and 16pt
          const fontOverride = (rowIndex === 0 || rowIndex === 1) ? 'font-weight:700;font-size:16pt;' : 'font-size:12pt;';
          const baseStyles = `font-family:Arial;${fontOverride}padding:6px;${borderStyle}${nowrapStyle}`;
          const style = applyBg ? `style="${baseStyles}background:#153D64;color:#ffffff;"` : `style="${baseStyles}background:transparent;color:#000;"`;
          return `<td ${style}>${escapeHtml(text)}</td>`;
        }).join("");
        return `<tr>${cells}</tr>`;
      }).join("");

      const html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head>
          <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Reporte</x:Name><x:WorksheetOptions><x:DoNotDisplayGridlines/><x:Print><x:ValidPrinterInfo/></x:Print></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
          <meta charset="UTF-8">
          <style>
            /* Force Arial at 12pt for Excel rendering across the whole sheet */
            html, body, table, tbody, thead, tfoot, tr, th, td { font-family: Arial; font-size:12pt; }
            table { border-collapse:collapse; }
            td, th { vertical-align:middle; padding:6px; border:1px solid #ccc; }
          </style>
        </head>
        <body>
          <!-- Define column widths for Excel: B=15, C=45, D=12, E=18 (approximate px values) -->
          <table>
            <colgroup>
              <col style="width:80px" />    <!-- Col A (No. de Item) -->
              <col style="width:115px" />   <!-- Col B — 15.00 (approx converted to px) -->
              <col style="width:345px" />   <!-- Col C — 45.00 -->
              <col style="width:120px" />   <!-- Col D — 12.00 -->
              <col style="width:155px" />   <!-- Col E — 18.00 -->
              <col style="width:90px" />    <!-- Col F — Prioridad (manual fill) -->
            </colgroup>
            ${tableRowsHtml}
          </table>
        </body>
        </html>
      `;

      // Create a blob and download as .xls so Excel will open it with formatting
      const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      // build filename including: Sucursal (branch), tipo de Unidad (unit name) y fecha de descarga (YYYY-MM-DD)
      const branchForFile = currentBranch ? String(currentBranch).replace(/_/g,' ') : 'Sucursal';
      const unitForFile = (unit.name || unitId).toString();
      const dateForFile = new Date().toISOString().slice(0,10);
      const safe = s => String(s).replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_\-]/g,'');
      const filename = `reportes_${ safe(branchForFile) }_${ safe(unitForFile) }_${ dateForFile }.xls`;

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    })();
  });
}

/*
  Reusable PDF generator used by both the top "Exportar PDF" (unit-level)
  and individual report Exportar buttons so the formats match.
  Accepts an array of reports and a unit object (may be empty) and builds
  the same styled PDF used by the top-level exporter.
*/
async function generatePdfForReports(chosenReports, unit = {}, opts = {}) {
  try {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    // Cover / summary
    pdf.setFontSize(18);
    // include selected branch name in the title
    const BRANCH_LABELS = {
      tijuana: "Tijuana",
      mexicali: "Méxicali",
      ensenada: "Ensenada",
      la_paz: "La Paz",
      magdalena: "Magdalena",
      hermosillo: "Hermosillo",
      los_mochis: "Los Mochis",
      guadalajara: "Guadalajara",
      mexico: "México",
      monterrey: "Monterrey",
      ciudad_juarez: "Ciudad Juárez",
      veracruz_xalapa: "Veracruz (Xalapa)",
      veracruz: "Veracruz",
      tuxtla: "Tuxtla",
      merida: "Mérida"
    };
    const branchDisplay = BRANCH_LABELS[currentBranch] || (currentBranch ? currentBranch.charAt(0).toUpperCase() + currentBranch.slice(1) : "");
    const titleBranch = branchDisplay ? `Reporte de Unidades ${branchDisplay}` : "Reporte de Unidades";
    // include plate in title when available (prefer plate from first chosen report, then unit or global currentPlate)
    const plateLabel = (chosenReports && chosenReports[0] && chosenReports[0].plate) || unit.plate || currentPlate || "";
    const titleWithPlate = plateLabel ? `${titleBranch} — ${unit.name || "Unidad"} — Placa ${plateLabel}` : `${titleBranch} — ${unit.name || "Unidad"}`;
    pdf.text(titleWithPlate, 40, 60);
    pdf.setFontSize(12);
    pdf.text(`Fecha: ${new Date().toLocaleString()}`, 40, 86);
    // include driver and supervisor on the cover when present (prefer chosenReports[0] fields, then unit, then globals)
    const coverDriver = (chosenReports && chosenReports[0] && chosenReports[0].driver) || unit.driver || currentSupervisor || "";
    const coverSupervisor = (chosenReports && chosenReports[0] && chosenReports[0].supervisor) || currentSupervisor || unit.supervisor || "";
    if(coverDriver) pdf.text(`Chofer: ${coverDriver}`, 40, 104);
    if(coverSupervisor) pdf.text(`Supervisor: ${coverSupervisor}`, 40, 122);
    pdf.text(`Reportes considerados: ${chosenReports.length}`, 40, (coverSupervisor || coverDriver) ? 140 : 106);

    // Small helper for pagination during content rendering
    let curY = 126;
    const coverMargin = 40;
    const sectionGap = 8;
    const itemLineH = 12;
    const boxW = pageW - coverMargin * 2;

    const ensureSpace = (need) => {
      if (curY + need > pageH - 60) {
        pdf.addPage();
        curY = 60;
      }
    };

    const drawSectionTitle = (text) => {
      ensureSpace(28);
      pdf.setDrawColor(30, 70, 140);
      pdf.setFillColor(18, 58, 147);
      pdf.setTextColor(255,255,255);
      pdf.setFontSize(12);
      const h = 20;
      pdf.roundedRect(coverMargin, curY, boxW, h, 6, 6, 'F');
      pdf.text(text, coverMargin + 10, curY + 14);
      curY += h + 6;
      pdf.setTextColor(0,0,0);
    };

    // determine importance and periodicity from label text (same helpers from top exporter)
    const importanceForLabel = (lbl) => {
      const s = String(lbl).toLowerCase();
      const mechanical = ["llanta","llantas","fugas","aceite","anticongelante","freno","claxon","motor","niveles","luces","luces de freno","intermitentes","espejos","bomba","bater","batería","nivel de aceite","sin fugas","testigos"];
      const governmental = ["tarjeta de circulación","verificación","verificacion","seguro","placa","placas","licencia","identificación","identificacion","carta responsiva"];
      const aesthetic = ["golpe","golpes","estético","estetico","golpes estructurales","esteticos","abolladura","pintura","raspon","raspón","vidrio dañado","vidrios","vidrios completos"];
      if(governmental.some(k => s.includes(k))) return "Alta";
      if(mechanical.some(k => s.includes(k))) return "Alta";
      if(aesthetic.some(k => s.includes(k))) return "Baja";
      return "Media";
    };
    const periodicityForLabel = (lbl) => {
      const s = String(lbl).toLowerCase();
      const governmental = ["tarjeta de circulación","verificación","verificacion","seguro","placa","placas","licencia"];
      const mechanical = ["llanta","llantas","aceite","anticongelante","freno","motor","niveles","fugas","testigos","claxon","luces","intermitentes"];
      if(governmental.some(k => s.includes(k))) return "Mensual";
      if(mechanical.some(k => s.includes(k))) return "Diaria";
      return "Mensual";
    };

    // Draw aggregated checklist table rows (columns: Estatus | Ítem | Periodicidad | Observación)
    const drawCheckItem = (label, status) => {
      ensureSpace(itemLineH + 8);
      const bandH = itemLineH + 6;
      const isOdd = Math.floor(curY / bandH) % 2 === 0;
      if(isOdd) pdf.setFillColor(234, 239, 248);
      else pdf.setFillColor(242, 242, 242);
      pdf.rect(coverMargin, curY, boxW, bandH, 'F');

      // badge / status
      const badgeX = coverMargin + 18;
      const badgeY = curY + Math.round(bandH / 2);
      const badgeR = 8;
      let badgeColor = [140,140,140];
      // use Spanish labels: "Si" / "No" / "N/A" with corresponding colors
      let symbol = "N/A";
      if(status === "yes") { badgeColor = [38,139,64]; symbol = "Si"; }
      else if(status === "no") { badgeColor = [178,10,10]; symbol = "No"; }
      pdf.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
      try { pdf.circle(badgeX, badgeY, badgeR, 'F'); } catch(e){ pdf.roundedRect(badgeX - badgeR, badgeY - badgeR, badgeR*2, badgeR*2, badgeR, badgeR, 'F'); }
      pdf.setFontSize(10);
      pdf.setTextColor(255,255,255);
      pdf.text(symbol, badgeX - (pdf.getTextWidth(String(symbol))/2), badgeY + 3);

      // columns - make ITEM wider by shifting periodicity right and removing importance column
      const colItemX = badgeX + badgeR + 14;
      const colPeriodicX = coverMargin + boxW - 200; // moved right to widen ITEM
      const colObsX = coverMargin + boxW - 100;

      pdf.setFontSize(10);
      pdf.setTextColor(11,43,43);
      const availableW = colPeriodicX - colItemX - 12;
      const wrapped = pdf.splitTextToSize(label, availableW);
      pdf.text(wrapped, colItemX, badgeY + 3);

      pdf.setFontSize(9);
      pdf.setTextColor(50,50,50);
      pdf.text(periodicityForLabel(label), colPeriodicX, badgeY + 3);

      // observation column shows result text: "Cumple" / "No Cumple" / "No Verificado"
      pdf.setFontSize(9);
      pdf.setTextColor(60,60,60);
      let obsText = "";
      if(status === "yes") obsText = "Cumple";
      else if(status === "no") obsText = "No Cumple";
      else obsText = "No Verificado";
      const obsAvailableW = (coverMargin + boxW) - colObsX - 8;
      const obsWrapped = pdf.splitTextToSize(obsText, obsAvailableW);
      pdf.text(obsWrapped, colObsX, badgeY + 3);

      curY += bandH;
    };

    // Aggregate checks across chosenReports
    const aggregateByLabel = {};
    chosenReports.forEach(r => {
      if(Array.isArray(r.checks)){
        r.checks.forEach(c => {
          const lbl = (c.label || "").toString().trim() || "Ítem";
          const st = (c.status === "yes") ? "yes" : (c.status === "no") ? "no" : "unverified";
          const obs = (c.observation || c.obs || "").toString().trim();
          if(!aggregateByLabel[lbl]) aggregateByLabel[lbl] = { label: lbl, status: st, count: 1, observation: obs || "" };
          else {
            aggregateByLabel[lbl].count++;
            const cur = aggregateByLabel[lbl].status;
            if(cur === "no" || st === "no") aggregateByLabel[lbl].status = "no";
            else if(cur === "unverified" || st === "unverified") aggregateByLabel[lbl].status = "unverified";
            else aggregateByLabel[lbl].status = "yes";
            if(obs){
              const existing = aggregateByLabel[lbl].observation || "";
              const parts = existing.split(';').map(s=>s.trim()).filter(Boolean);
              if(!parts.includes(obs)){
                aggregateByLabel[lbl].observation = existing ? `${existing}; ${obs}` : obs;
              }
            }
          }
        });
      }
    });

    // Build ordered list from MODULES to preserve structure and mark unverified if missing
    const aggItems = [];
    if (Array.isArray(window.MODULES)) {
      window.MODULES.forEach(mod => {
        mod.items.forEach(lbl => {
          const entry = aggregateByLabel[lbl] || { label: lbl, status: "unverified", count: 0 };
          aggItems.push({ label: lbl, status: entry.status, count: entry.count || 0 });
        });
      });
    } else {
      // fallback: use all labels from aggregateByLabel
      Object.keys(aggregateByLabel).forEach(k => aggItems.push({ label: k, status: aggregateByLabel[k].status }));
    }

    if(aggItems.length > 0){
      drawSectionTitle('Resumen consolidado de checklist (primer hoja)');
      ensureSpace(20);
      // draw table header row for clarity: Estatus | Ítem | Periodicidad | Importancia
      (function drawTableHeader(){
        const headerH = 18;
        pdf.setFillColor(18,58,147);
        pdf.setTextColor(255,255,255);
        pdf.setFontSize(11);
        pdf.rect(coverMargin, curY, boxW, headerH, 'F');
        pdf.text('Estatus', coverMargin + 18, curY + 13);
        pdf.text('Ítem', coverMargin + 80, curY + 13);
        // moved periodicity right to give more space to ITEM; removed the 'Importancia' header
        pdf.text('Periodicidad', coverMargin + boxW - 200, curY + 13);
        // (Importancia header removed)
        curY += headerH + 6;
        pdf.setTextColor(0,0,0);
        pdf.setFontSize(9);
      })();
      ensureSpace(8);
      pdf.setFontSize(9);
      pdf.setTextColor(0,0,0);
      curY += 18;

      // Group by modules for printed organization
      if (Array.isArray(window.MODULES)) {
        window.MODULES.forEach(mod => {
          ensureSpace(28);
          pdf.setFontSize(11);
          pdf.setTextColor(18,58,147);
          const modH = 18;
          pdf.setFillColor(230,235,250);
          pdf.rect(coverMargin, curY, boxW, modH, 'F');
          pdf.setTextColor(11,43,43);
          pdf.setFontSize(11);
          pdf.text(mod.title, coverMargin + 8, curY + 13);
          curY += modH + 6;
          mod.items.forEach(lbl => {
            const entry = aggregateByLabel[lbl] || { label: lbl, status: "unverified", count: 0 };
            drawCheckItem(`${entry.label}`, entry.status);
          });
        });
      } else {
        aggItems.forEach(it => drawCheckItem(it.label, it.status));
      }
    } else {
      drawSectionTitle('Reportes considerados (sin checklist estructurado)');
      chosenReports.slice(0, 10).forEach(r =>{
        ensureSpace(28);
        pdf.setFontSize(11);
        pdf.setTextColor(11,43,43);
        const header = `${new Date(r.createdAt).toLocaleString()} — ${r.title || 'Reporte'}`;
        const wrapped = pdf.splitTextToSize(header, boxW);
        pdf.text(wrapped, coverMargin, curY);
        curY += (wrapped.length * 12) + 4;
        const obs = (r.observation || r.notes || '').toString();
        if(obs){
          const obsWrapped = pdf.splitTextToSize(`Observación: ${obs}`, boxW - 12);
          pdf.setFontSize(10);
          pdf.setTextColor(90,90,90);
          pdf.text(obsWrapped, coverMargin + 6, curY);
          curY += (obsWrapped.length * 11) + 8;
        } else {
          curY += 6;
        }
      });
      if(chosenReports.length > 10){
        ensureSpace(16);
        pdf.setFontSize(10);
        pdf.text(`...Mostrar ${chosenReports.length} reportes (se muestran los primeros 10)`, coverMargin, curY);
        curY += 16;
      }
    }

    // Footer on last page
    pdf.setFontSize(9);
    if(curY + 30 < pageH - 40){
      pdf.setTextColor(100,100,100);
      pdf.text(`Generar reporte y enviar por correo a Freddy Valenzuela (fvalenzuela@distribucionessantacruz.com)`, 40, pageH - 40);
    } else {
      pdf.addPage();
      pdf.setTextColor(100,100,100);
      pdf.text(`Generar reporte y enviar por correo a Freddy Valenzuela (fvalenzuela@distribucionessantacruz.com)`, 40, pageH - 40);
    }

    // Helper to load image
    const loadImage = (src) => new Promise((res, rej)=>{
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = ()=> res(img);
      img.onerror = ()=> rej(new Error("img load error"));
      img.src = src;
    });

    // For each report: if annotated -> one full page preserving markers; else will be collected in 2x2 pages
    // Use mutable lists and if there are no chosenReports, keep them empty to avoid printing image pages.
    let annotated = chosenReports.filter(r => r.imageSrc && Array.isArray(r.markers) && r.markers.length > 0);
    let simple = chosenReports.filter(r => !(r.imageSrc && Array.isArray(r.markers) && r.markers.length > 0));
    if (chosenReports.length === 0) {
      annotated = [];
      simple = [];
    }

    for (let i = 0; i < annotated.length; i++) {
      const r = annotated[i];
      pdf.addPage();
      try {
        const img = await loadImage(r.imageSrc);
        const tmp = document.createElement("canvas");
        const iw = img.naturalWidth || img.width || 1000;
        const ih = img.naturalHeight || img.height || 800;
        tmp.width = iw;
        tmp.height = ih;
        const tctx = tmp.getContext("2d");
        tctx.drawImage(img, 0, 0, iw, ih);
        r.markers.forEach((m, idx) => {
          const x = (m.pos && typeof m.pos.x === "number") ? m.pos.x * iw : 0;
          const y = (m.pos && typeof m.pos.y === "number") ? m.pos.y * ih : 0;
          const radius = Math.max(8, iw / 80);
          tctx.beginPath();
          tctx.fillStyle = "rgba(220,30,30,0.95)";
          tctx.strokeStyle = "#fff";
          tctx.lineWidth = Math.max(2, iw / 200);
          tctx.arc(x, y, radius, 0, Math.PI * 2);
          tctx.fill();
          tctx.stroke();
          tctx.font = `bold ${Math.max(12, iw / 80)}px sans-serif`;
          tctx.fillStyle = "rgba(180,10,10,0.98)";
          const label = (m.label || "").trim() || (idx + 1).toString();
          tctx.fillText(label, x + (iw / 200), y + (iw / 200));
        });

        const margin = 40;
        const maxW = pageW - margin * 2;
        const maxH = pageH * 0.55;
        const ratio = Math.min(maxW / tmp.width, maxH / tmp.height, 1);
        const dw = Math.round(tmp.width * ratio);
        const dh = Math.round(tmp.height * ratio);
        const dataUrl = tmp.toDataURL("image/png");
        const x = (pageW - dw) / 2;
        const y = 70;
        pdf.addImage(dataUrl, "PNG", x, y, dw, dh);

        // metadata under image
        pdf.setFontSize(12);
        const metaY = y + dh + 20;
        pdf.text(`Reporte: ${r.title || "Reporte"}`, 40, metaY);
        pdf.setFontSize(10);
        pdf.text(`Fecha: ${new Date(r.createdAt).toLocaleString()}`, 40, metaY + 16);
        if (r.supervisor) pdf.text(`Supervisor: ${r.supervisor}`, 40, metaY + 32);
        if (r.driver) pdf.text(`Chofer: ${r.driver}`, 40, metaY + 48);
        if (r.plate) pdf.text(`Placa: ${r.plate}`, 40, metaY + 64);
        pdf.text(`Incidencias registradas: ${r.incidentsCount || 0}`, 40, metaY + 80);
        if (r.imageAlt) pdf.text(`Parte: ${r.imageAlt}`, 40, metaY + 100);
        const observationText = r.observation || r.notes || "";
        if (observationText) {
          const obsSplit = pdf.splitTextToSize(`Observación: ${String(observationText)}`, pageW - 80);
          pdf.text(obsSplit, 40, metaY + 104);
        }

        // Imprimir títulos de los módulos (cada apartado) para este reporte
        try {
          if (Array.isArray(MODULES) && MODULES.length > 0) {
            let modulesY = metaY + 140;
            pdf.setFontSize(10);
            pdf.setTextColor(18,58,147);
            pdf.text('Módulos:', 40, modulesY);
            modulesY += 14;
            MODULES.forEach(mod => {
              const lines = pdf.splitTextToSize(mod.title, pageW - 80);
              pdf.setFontSize(9);
              pdf.setTextColor(11,43,43);
              pdf.text(lines, 40, modulesY);
              modulesY += (lines.length * 12) + 4;
            });
            if (typeof curY === "number") curY = Math.max(curY, modulesY);
          }
        } catch(e){
          /* ignore module printing errors */
        }

      } catch (err) {
        console.warn("Fallo al procesar imagen anotada, usando imagen de respaldo", err);
      }
    }

    // Simple reports: pack 4 per page 2x2
    const batchSize = 4;
    for (let b = 0; b < simple.length; b += batchSize) {
      const pageItems = simple.slice(b, b + batchSize);
      pdf.addPage();
      const margin = 40;
      const gap = 12;
      const cols = 2;
      const rows = 2;
      const gridW = pageW - margin * 2 - gap;
      const gridH = pageH * 0.55;
      const cellW = Math.floor(gridW / cols);
      const cellH = Math.floor(gridH / rows);

      for (let idx = 0; idx < pageItems.length; idx++) {
        const r = pageItems[idx];
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const xCell = margin + col * (cellW + gap / cols);
        const yCell = 70 + row * (cellH + 8);

        const imgPath = (r.imageSrc && typeof r.imageSrc === "string") ? r.imageSrc : (opts.fallbackImages && opts.fallbackImages[(b + idx) % opts.fallbackImages.length]) || "/ChatGPT Image 5 feb 2026, 14_35_47.png";

        try {
          const img = await loadImage(imgPath);
          const iw = img.naturalWidth || img.width || 800;
          const ih = img.naturalHeight || img.height || 600;
          const pad = 8;
          const maxWCell = cellW - pad * 2;
          const maxHCell = cellH - pad * 2;
          const ratio = Math.min(maxWCell / iw, maxHCell / ih, 1);
          const dw = Math.round(iw * ratio);
          const dh = Math.round(ih * ratio);

          const tmp = document.createElement("canvas");
          tmp.width = dw;
          tmp.height = dh;
          const tctx = tmp.getContext("2d");
          tctx.drawImage(img, 0, 0, dw, dh);
          const dataUrl = tmp.toDataURL("image/png");
          const drawX = xCell + Math.round((cellW - dw) / 2);
          const drawY = yCell + Math.round((cellH - dh) / 2);
          pdf.addImage(dataUrl, "PNG", drawX, drawY, dw, dh);

          const metaX = xCell + 4;
          const metaY = yCell + cellH + 6;
          pdf.setFontSize(9);
          pdf.setTextColor(20, 20, 20);
          pdf.text(`${r.title || 'Reporte'}`, metaX, metaY);
          pdf.setFontSize(8);
          pdf.setTextColor(90, 90, 90);
          pdf.text(`${new Date(r.createdAt).toLocaleString()}`, metaX, metaY + 10);
          if (r.plate) pdf.text(`Placa: ${r.plate}`, metaX, metaY + 20);
          if (r.driver) pdf.text(`Chofer: ${r.driver}`, metaX, metaY + 30);
          if (r.supervisor) pdf.text(`Supervisor: ${r.supervisor}`, metaX, metaY + 40);
          if (r.incidentsCount) pdf.text(`Incid: ${r.incidentsCount}`, metaX + 60, metaY + 20);
        } catch (err) {
          const metaX = xCell + 4;
          const metaY = yCell + 12;
          pdf.setFontSize(10);
          pdf.setTextColor(90, 90, 90);
          pdf.text(`${r.title || 'Reporte'} (imagen no disponible)`, metaX, metaY);
        }
      }
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Página con hasta 4 imágenes — ${new Date().toLocaleString()}`, margin, pageH - 40);
    }

    const filename = opts.filename || `informe_${(unit.name||"unidad").replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.pdf`;
    pdf.save(filename);
  } catch(err){
    console.error("Error generando PDF", err);
    alert("Ocurrió un error al generar el PDF.");
  }
}

const modalOverlay = document.getElementById("modalOverlay");
const modalContent = document.getElementById("modalContent");
const closeModalBtn = document.getElementById("closeModal");

function id(){ return Math.random().toString(36).slice(2,9); }

function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaults;
    return JSON.parse(raw);
  }catch(e){
    console.warn("Error loading state", e);
    return defaults;
  }
}

function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* UI population */
function renderUnits(){
  // populate dropdown select with units
  if(!unitListEl) return;
  unitListEl.innerHTML = "";
  // add placeholder first option
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Seleccionar unidad";
  placeholder.selected = !currentUnitId;
  placeholder.disabled = false;
  unitListEl.appendChild(placeholder);

  state.units.forEach(u=>{
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.textContent = u.name;
    unitListEl.appendChild(opt);
  });
  // set current selection if one exists
  if(currentUnitId) unitListEl.value = currentUnitId;
  else unitListEl.value = ""; // keep placeholder selected until user chooses
  // change handler: when user selects a unit, trigger plate selection or open checklist
  unitListEl.onchange = ()=>{
    const selId = unitListEl.value;
    // if placeholder (empty) selected, do nothing
    if(!selId) {
      currentUnitId = null;
      renderList();
      return;
    }
    const unit = state.units.find(u=>u.id === selId);
    if(unit){
      // use existing flow to handle plates / open checklist
      onUnitButtonClick(unit.id, unit.name);
    } else {
      currentUnitId = selId;
      renderList();
    }
  };
}

function renderList(){
  listContainer.innerHTML = "";
  // ensure topbar is visible by default; it may be hidden when there are no reports
  const topbarEl = document.querySelector('.topbar');
  if(topbarEl) topbarEl.style.display = 'flex';
  const unitId = currentUnitId || (state.units[0] && state.units[0].id);
  const reports = state.reports.filter(r=>r.unitId === unitId).sort((a,b)=>b.createdAt - a.createdAt);

  if(reports.length === 0){
    // Hide the topbar and show centered company logo + label, keep bottom control panel visible.
    const topbar = document.querySelector('.topbar');
    if(topbar) topbar.style.display = 'none';

    listContainer.innerHTML = `
      <div style="height:100%;display:flex;align-items:center;justify-content:center;">
        <div style="text-align:center;max-width:560px;padding:12px;box-sizing:border-box;">
          <img src="/LOGO DSC MARCA REGISTRADA (1).png" alt="Distribuciones Santa Cruz" style="max-width:240px;width:48%;height:auto;object-fit:contain;display:block;margin:0 auto 12px;"/>
          <div style="font-weight:900;color:#ffffff;letter-spacing:0.6px;font-size:20px;line-height:1.02;margin-bottom:6px;">
            UNIDADES DE REPARTO
          </div>
          <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-top:6px">
            <div style="width:60px;height:4px;background:#FFD400;border-radius:2px"></div>
            <div style="font-weight:700;color:#ffffff;letter-spacing:0.3px;font-size:13px;line-height:1.05;">
              DISTRIBUCIONES SANTA CRUZ
            </div>
            <div style="width:60px;height:4px;background:#FFD400;border-radius:2px"></div>
          </div>
          <div style="margin-top:10px;color:#ffffff;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="flex:0 0 auto">
              <path d="M9 2H15V4H20V22H4V4H9V2Z" fill="#FFFFFF" />
              <path d="M7 8H17V10H7V8Z" fill="#FFFFFF" />
              <path d="M7 12H17V14H7V12Z" fill="#FFFFFF" />
            </svg>
            Chechlist de Revisión de Unidades
          </div>
        </div>
      </div>
    `;
    return;
  }

  // Create a single summary card that groups all movements/reports for the selected unit
  const totalReports = reports.length;
  const totalIncidents = reports.reduce((acc,r)=> acc + (r.incidentsCount || 0), 0);
  const checksTotal = reports.reduce((acc,r)=> acc + ((r.checks && r.checks.length) || 0), 0);
  const checksOk = reports.reduce((acc,r)=> acc + ((r.checks && r.checks.filter(c=>c.checked).length) || 0), 0);
  const lastReport = reports[0];
  const lastDate = lastReport ? new Date(lastReport.createdAt).toLocaleString() : '—';

  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class="meta">
      <div class="title">Movimientos / Reportes (${totalReports})</div>
      <div class="small">Último: ${lastDate} • Incidencias: <span style="color:#b20a0a;font-weight:700">${totalIncidents}</span> • Checks: ${checksOk}/${checksTotal} OK</div>
    </div>
    <div class="controls" style="flex-direction:column;align-items:flex-end">
      <div style="display:flex;flex-direction:column;gap:6px;">
        <button id="viewAllReports" class="btn">Ver reportes</button>
        <button id="deleteAllReports" class="btn">Borrar todos</button>
      </div>
    </div>
  `;
  listContainer.appendChild(card);

  // view all opens a modal listing the reports (each with Ver / Borrar)
  document.getElementById("viewAllReports").onclick = ()=>{
    const rows = reports.map(r=>{
      const date = new Date(r.createdAt).toLocaleString();
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-radius:8px;background:rgba(250,250,250,0.7);margin-bottom:6px">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600">${escapeHtml(r.title || "Reporte")}</div>
          <div class="small">${date}${r.driver ? " • " + escapeHtml(r.driver) : ""}${r.plate ? ' • <span style="color:#b20a0a;font-weight:700">' + escapeHtml(r.plate) + '</span>' : ""} ${r.incidentsCount ? ' • <span style="color:#b20a0a;font-weight:700">' + r.incidentsCount + ' incid.' + '</span>' : ''}</div>
        </div>
        <div style="display:flex;gap:6px;margin-left:8px">
          <button class="btn view-single" data-id="${r.id}">Ver</button>
          <button class="btn" data-id="${r.id}" data-action="export-pdf">Exportar PDF</button>
          <button class="btn del-single" data-id="${r.id}">Borrar</button>
        </div>
      </div>`;
    }).join("");

    openModal(`
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:700">Reportes — ${escapeHtml((state.units.find(u=>u.id===unitId)||{}).name || "Unidad")}</div>
          <div style="display:flex;gap:8px">
            <button id="closeListModal" class="btn">Cerrar</button>
          </div>
        </div>
        <div style="max-height:56vh;overflow:auto;padding-right:6px">${rows}</div>
      </div>
    `);

    document.getElementById("closeListModal").onclick = closeModal;

    // attach delegated handlers inside modalContent
    const modalRoot = modalContent;
    modalRoot.querySelectorAll(".view-single").forEach(b=>{
      b.onclick = (ev)=>{
        const idr = ev.currentTarget.dataset.id;
        const rpt = state.reports.find(x=>x.id===idr);
        if(!rpt) return alert("Reporte no encontrado");
        closeModal();
        openReportModuleOptions(rpt);
      };
    });
    modalRoot.querySelectorAll("[data-action='export-pdf']").forEach(b=>{
      b.onclick = async (ev)=>{
        const idr = ev.currentTarget.dataset.id;
        const rpt = state.reports.find(x=>x.id===idr);
        if(!rpt) return alert("Reporte no encontrado");
        const unit = state.units.find(u=>u.id === rpt.unitId) || {};
        // call the unified PDF generator so per-report export matches the general format
        await generatePdfForReports([rpt], unit, { filename: `reporte_${(rpt.title||idr).replace(/\s+/g,'_')}_${new Date(rpt.createdAt).toISOString().slice(0,10)}.pdf` });
      };
    });
    modalRoot.querySelectorAll(".del-single").forEach(b=>{
      b.onclick = (ev)=>{
        const idr = ev.currentTarget.dataset.id;
        if(!confirm("Borrar este reporte?")) return;
        state.reports = state.reports.filter(x=>x.id!==idr);
        save();
        closeModal();
        renderList();
      };
    });
  };

  // delete all reports button
  document.getElementById("deleteAllReports").onclick = ()=>{
    if(!confirm("Borrar todos los reportes de esta unidad?")) return;
    state.reports = state.reports.filter(r=>r.unitId !== unitId);
    save();
    renderList();
  };
}

/* Modal helpers */
function openModal(contentHTML){
  modalContent.innerHTML = contentHTML;
  modalOverlay.classList.remove("hidden");
  // attach close button if present (closeModalBtn exists globally)
}

function closeModal(){
  // hide overlay and clear content
  modalOverlay.classList.add("hidden");
  modalContent.innerHTML = "";
  // remove transient helper classes used for the initial blocking modal
  document.querySelector(".modal")?.classList.remove("no-card");
  modalOverlay.classList.remove("no-scroll");
  // ensure the bottom control panel is restored when any modal closes
  const bott = document.querySelector('.bottombar');
  if (bott) bott.style.display = 'flex';
}

/* Open a dedicated modal to view vehicle images larger with annotator */
function openImagesModal(unitId, unitName){
  const freightImages = [
    "/freight_front.png",
    "/freight_right.png",
    "/freight_right.png", // will be flipped horizontally to act as "Izquierda"
    "/freight_rear.png"
  ];
  // Isuzu-specific images: trasera, lateral derecho, lateral izquierdo (we'll flip), frontal
  const isuzuImages = [
    "/Captura de pantalla 2026-02-09 135855.png",
    "/Captura de pantalla 2026-02-09 135848.png",
    "/Captura de pantalla 2026-02-09 135844.png",
    "/Captura de pantalla 2026-02-09 135852.png"
  ];
  // International-specific images (rear, side, front, corner)
  const internationalImages = [
    "/Captura de pantalla 2026-02-09 141257.png",
    "/Captura de pantalla 2026-02-09 141251.png",
    "/Captura de pantalla 2026-02-09 141301.png",
    "/Captura de pantalla 2026-02-09 141307.png"
  ];
  // Kenworth-specific images
  const kenworthImages = [
    "/Captura de pantalla 2026-02-09 151119.png",
    "/Captura de pantalla 2026-02-09 151124.png",
    "/Captura de pantalla 2026-02-09 151133.png",
    "/Captura de pantalla 2026-02-09 151845.png"
  ];
  // Mercedes / Sprinter images (ordered and annotated to match asset views)
  const mercedesImages = [
    "/Captura de pantalla 2026-02-09 161015.png", // front — passenger side
    "/Captura de pantalla 2026-02-09 161011.png", // rear view
    "/Captura de pantalla 2026-02-09 161022.png", // front three-quarter
    "/Captura de pantalla 2026-02-09 161004.png"  // front studio (center)
  ];
  const defaultImg = "/ChatGPT Image 5 feb 2026, 14_35_47.png";
  let imgs = [defaultImg, defaultImg, defaultImg, defaultImg];
  if(unitId === "freightliner") imgs = freightImages;
  if(unitId === "isuzu") imgs = isuzuImages;
  if(unitId === "international") imgs = internationalImages;
  if(unitId === "kenworth") imgs = kenworthImages;
  if(unitId === "sprinter") imgs = mercedesImages;

  // human-readable labels that match each Sprinter asset's actual view
  let alts = ["Trasera", "Derecha", "Frontal", "Izquierda"];
  // For Kenworth the "Frontal" and "Derecha" labels should be swapped (second -> Frontal, third -> Derecha)
  if(unitId === "kenworth"){
    alts = ["Trasera", "Frontal", "Derecha", "Izquierda"];
  }
  // For International unit the front/left labels were swapped — correct here so the third image shows as Izquierda and fourth as Frontal
  if(unitId === "international"){
    alts = ["Trasera", "Derecha", "Izquierda", "Frontal"];
  }
  // For Sprinter (Mercedes) use descriptive labels aligned with the image assets:
  if(unitId === "sprinter"){
    alts = [
      "Lado izquerdo",   // 161015.png
      "Trasera",         // 161011.png
      "Lado derecho",    // 161022.png
      "Frente — estudio" // 161004.png
    ];
  }

  // images modal now includes metadata inputs for PDF (chofer, fecha, kilometraje, quien revisó)
  openModal(`
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <div style="font-weight:700">${escapeHtml(unitName || "")} — Imágenes</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button id="closeImages" class="btn">Cerrar</button>
        </div>
      </div>
      <div id="imagesGrid" style="display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between"></div>
    </div>
  `);

  // hide bottom control panel while viewing images
  (function hideBottomPanel(){
    const bott = document.querySelector('.bottombar');
    if (bott) bott.style.display = 'none';
  })();

  // pre-fill driver/date fields if there is recent report info
  (function prefill(){
    const recent = (state.reports || []).filter(r => r.unitId === unitId).sort((a,b)=>b.createdAt - a.createdAt)[0];
    if(recent){
      try {
        if(recent.driver) document.getElementById('pdfDriver').value = recent.driver;
        if(recent.createdAt) {
          const d = new Date(recent.createdAt);
          document.getElementById('pdfDate').value = d.toISOString().slice(0,10);
        }
        // km and inspectedBy are not stored elsewhere; left empty
      } catch(e){}
    }
  })();

  const imagesGrid = document.getElementById("imagesGrid");
  imgs.forEach((src,i)=>{
    const card = document.createElement("div");
    card.style.width = "49%";
    card.style.borderRadius = "10px";
    card.style.overflow = "hidden";
    card.style.background = "rgba(255,255,255,0.95)";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.alignItems = "stretch";
    card.style.justifyContent = "center";
    card.style.height = "200px";

    const imgWrap = document.createElement("div");
    imgWrap.style.flex = "1";
    imgWrap.style.display = "flex";
    imgWrap.style.alignItems = "center";
    imgWrap.style.justifyContent = "center";
    imgWrap.style.overflow = "hidden";
    imgWrap.style.position = "relative";

    const img = document.createElement("img");
    img.src = src;
    img.alt = alts[i] || "";
    img.style.maxWidth = "100%";
    img.style.maxHeight = "100%";
    img.style.objectFit = "cover";
    img.style.cursor = "zoom-in";
    // if this is the third image (index 2) treat it as the left-side view by flipping horizontally
    if(i === 2){
      img.style.transform = "scaleX(-1)";
      img.style.webkitTransform = "scaleX(-1)";
      img.dataset.flipped = "true";
    }

    imgWrap.appendChild(img);

    const caption = document.createElement("div");
    caption.textContent = alts[i] || "";
    caption.style.padding = "6px 8px";
    caption.style.fontSize = "13px";
    caption.style.color = "#0b2b2b";
    caption.style.background = "rgba(0,0,0,0.03)";
    caption.style.textAlign = "center";

    card.appendChild(imgWrap);
    card.appendChild(caption);
    imagesGrid.appendChild(card);

    // click to open annotator for this image
    img.addEventListener("click", ()=> openImageAnnotator(src, alts[i] || ""));
  });

  document.getElementById("closeImages").onclick = () => {
    // Simply close the images modal — do not auto-create a minimal report to avoid duplicate rows
    closeModal();
  };



  // Annotator modal: click to add labeled markers
  function openImageAnnotator(src, alt){
    openModal(`
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:700">Anotar — ${escapeHtml(alt)}</div>
          <div style="display:flex;gap:8px;align-items:center">
            <button id="markToggle" class="btn">Señalar</button>
            <button id="exportAnnot" class="btn">Exportar</button>
            <button id="saveAnnot" class="btn primary">Guardar</button>
            <button id="closeAnnot" class="btn">Cerrar</button>
          </div>
        </div>
        <div id="annotContainer" style="position:relative;border-radius:10px;overflow:hidden;background:rgba(255,255,255,0.95);display:flex;align-items:center;justify-content:center">
          <img id="annotImg" src="${src}" alt="${escapeHtml(alt)}" style="max-width:100%;max-height:60vh;display:block;object-fit:contain" />
          <canvas id="annotCanvas" style="position:absolute;left:0;top:0;width:100%;height:100%"></canvas>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="clearMarks" class="btn">Limpiar marcas</button>
        </div>
        <div style="font-size:12px;color:#173a39;opacity:0.9">Consejo: activa "Señalar" y toca sobre la imagen donde hay golpes para agregar etiquetas.</div>
      </div>
    `);

    const imgEl = document.getElementById("annotImg");
    const canvas = document.getElementById("annotCanvas");
    const ctx = canvas.getContext("2d");
    let markers = [];
    let markingEnabled = false;

    const markToggle = document.getElementById("markToggle");
    function updateMarkToggleUI(){
      if(markingEnabled){
        markToggle.textContent = "Señalar: ON";
        markToggle.style.background = "linear-gradient(180deg,#144987,#163f7f)";
        markToggle.style.color = "#fff";
      }else{
        markToggle.textContent = "Señalar";
        markToggle.style.background = "";
        markToggle.style.color = "";
      }
    }
    markToggle.addEventListener("click", ()=> {
      markingEnabled = !markingEnabled;
      updateMarkToggleUI();
    });

    // ensure canvas matches rendered image size
    function resizeCanvas(){
      const rect = imgEl.getBoundingClientRect();
      // size canvas to displayed image pixel size for accurate coords
      canvas.width = Math.max(1, Math.round(rect.width));
      canvas.height = Math.max(1, Math.round(rect.height));
      // position canvas within container
      canvas.style.left = rect.left - canvas.parentElement.getBoundingClientRect().left + "px";
      canvas.style.top = rect.top - canvas.parentElement.getBoundingClientRect().top + "px";
      canvas.style.position = "absolute";
      renderMarkers();
    }

    function clientToImageCoords(clientX, clientY){
      const imgRect = imgEl.getBoundingClientRect();
      const x = clientX - imgRect.left;
      const y = clientY - imgRect.top;
      // normalize 0..1
      return { x: x / imgRect.width, y: y / imgRect.height };
    }

    function imageToCanvasCoords(norm){
      return { x: norm.x * canvas.width, y: norm.y * canvas.height };
    }

    function renderMarkers(){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      markers.forEach((m, idx)=>{
        const p = imageToCanvasCoords(m.pos);
        // circle
        ctx.beginPath();
        ctx.fillStyle = "rgba(220,30,30,0.9)";
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = Math.max(2, canvas.width/200);
        ctx.arc(p.x, p.y, Math.max(6, canvas.width/80), 0, Math.PI*2);
        ctx.fill();
        ctx.stroke();
        // label (bold red)
        ctx.font = `bold ${Math.max(12, canvas.width/80)}px sans-serif`;
        ctx.fillStyle = "rgba(180,10,10,0.98)";
        const label = m.label || (idx+1).toString();
        ctx.fillText(label, p.x + (canvas.width/120), p.y + (canvas.width/200));
      });
    }

    function addMarkerAt(clientX, clientY){
      const pos = clientToImageCoords(clientX, clientY);
      if(pos.x < 0 || pos.x > 1 || pos.y < 0 || pos.y > 1) return;
      const label = prompt("Etiqueta para la marca (dejar vacío para número):", "");
      markers.push({ pos, label: label ? label.trim() : "" });
      renderMarkers();
    }

    // attach events: only add when marking is enabled
    canvas.addEventListener("click", (ev)=> {
      if(!markingEnabled) {
        // quick hint when not enabled
        // small visual flash on markToggle to indicate user should enable
        markToggle.animate([{transform:"scale(1)"},{transform:"scale(1.04)"},{transform:"scale(1)"}],{duration:200});
        return;
      }
      addMarkerAt(ev.clientX, ev.clientY);
    });

    // export image with annotations as PNG
    document.getElementById("exportAnnot").onclick = ()=>{
      // create temp canvas sized to image's natural size for better export
      const tmp = document.createElement("canvas");
      const iw = imgEl.naturalWidth || canvas.width, ih = imgEl.naturalHeight || canvas.height;
      tmp.width = iw; tmp.height = ih;
      const tctx = tmp.getContext("2d");
      // draw original image
      tctx.drawImage(imgEl, 0, 0, iw, ih);
      // draw markers scaled
      markers.forEach((m, idx)=>{
        const x = m.pos.x * iw;
        const y = m.pos.y * ih;
        tctx.beginPath();
        tctx.fillStyle = "rgba(220,30,30,0.95)";
        tctx.strokeStyle = "#fff";
        tctx.lineWidth = Math.max(2, iw/400);
        tctx.arc(x, y, Math.max(6, iw/80), 0, Math.PI*2);
        tctx.fill();
        tctx.stroke();
        // label on export (bold red)
        tctx.font = `bold ${Math.max(12, iw/80)}px sans-serif`;
        tctx.fillStyle = "rgba(180,10,10,0.98)";
        const label = m.label || (idx+1).toString();
        tctx.fillText(label, x + (iw/200), y + (iw/200));
      });
      tmp.toBlob(blob=>{
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `anotacion_${alt || "imagen"}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }, "image/png");
    };

    // Save annotations as a minimal report with incidentsCount and persist marker data + image source
    // If there's an existing recent checklist/report for same unit+plate, merge annotations into it so
    // images/checks live in a single report; otherwise create a new one.
    document.getElementById("saveAnnot").onclick = ()=>{
      const count = markers.length;
      if(count === 0){
        if(!confirm("No hay marcas. ¿Deseas guardar igualmente?")) return;
      }
      // derive a human-readable observation from marker labels
      const obsLabels = markers.map(m => (m.label || "").trim()).filter(s => s);
      const observation = obsLabels.length ? obsLabels.join("; ") : `Anotaciones guardadas: ${count}`;

      const now = Date.now();

      // try to find a recent report for this unit & plate to merge into (within last 10 minutes)
      const TEN_MIN = 10 * 60 * 1000;
      const existingIdx = state.reports.findIndex(r=>{
        return r.unitId === (currentUnitId || null)
          && (r.plate || null) === (currentPlate || null)
          && (now - (r.createdAt || 0)) <= TEN_MIN;
      });

      if(existingIdx !== -1){
        // merge into existing report
        const target = state.reports[existingIdx];

        // ensure markers array exists and append
        target.markers = Array.isArray(target.markers) ? target.markers.concat(markers.map(m=>({ pos:{x:m.pos.x,y:m.pos.y}, label: m.label || "" }))) : markers.map(m=>({ pos:{x:m.pos.x,y:m.pos.y}, label: m.label || "" }));

        // set/replace imageSrc & imageAlt (store last annotated image)
        target.imageSrc = src;
        target.imageAlt = alt || target.imageAlt || "";

        // ensure supervisor is recorded if missing
        target.supervisor = target.supervisor || currentSupervisor || target.supervisor || null;

        // increment incidentsCount
        target.incidentsCount = (target.incidentsCount || 0) + count;

        // enforce module assignment (all info recorded under "Reparto")
        target.module = currentModule || "Reparto";

        // append observation summary into notes (preserve previous notes)
        const previousNotes = (target.notes || target.observation || "") || "";
        const mergedNotes = previousNotes ? `${previousNotes} • ${observation}` : observation;
        target.notes = mergedNotes;
        target.observation = mergedNotes;

        // update timestamp to keep newest ordering (optional: keep original createdAt; here we keep original)
        // save and refresh
        save();
        renderList();
        alert(`Anotaciones agregadas al reporte existente (${count} marca(s))`);
      } else {
        // create a new report
        const title = `Anotaciones — ${alt || "imagen"}`;
        const rpt = {
          id: id(),
          unitId: currentUnitId || null,
          plate: currentPlate || null,
          driver: null,
          supervisor: currentSupervisor || null,
          title,
          notes: observation, // store observation in notes for compatibility
          checks: [],
          incidentsCount: count,
          // persist markers normalized to image coordinates and the image src used for annotation
          markers: markers.map(m => ({ pos: { x: m.pos.x, y: m.pos.y }, label: m.label || "" })),
          imageSrc: src,
          imageAlt: alt || "",
          observation: observation,
          module: currentModule || "Reparto",
          createdAt: now
        };
        state.reports.push(rpt);
        save();
        renderList();
        alert(`Guardado: ${count} marca(s)`);
      }

      // close annotator modal and return to the images gallery so user can annotate other views
      closeModal();
      // reopen the images modal for the same unit/name (uses outer scope unitId/unitName)
      openImagesModal(currentUnitId || unitId, unitName);
    };

    document.getElementById("clearMarks").onclick = ()=>{
      if(!confirm("Limpiar todas las marcas?")) return;
      markers = [];
      renderMarkers();
    };

    document.getElementById("closeAnnot").onclick = closeModal;

    // keep canvas sized to image; use ResizeObserver
    const ro = new ResizeObserver(()=> resizeCanvas());
    ro.observe(imgEl);
    // initial resize when image loads (if cached)
    if(imgEl.complete) resizeCanvas();
    imgEl.onload = resizeCanvas;

    // initialize toggle UI state
    updateMarkToggleUI();
  }
}

/* Helper to open the new-report / checklist modal for a given unit (and optional plate) */
function openNewReportForSelection(unitId, unitName, plate, driver, supervisor){
  // use the shared MODULES so the PDF and UI refer to the exact same checklist structure
  const modules = MODULES;

  // initial modal shows two module buttons: Checklist and Ver imágenes
  openModal(`
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="font-weight:700">${escapeHtml(unitName || "")}${plate ? ' — <span style="color:#b20a0a;font-weight:700">' + escapeHtml(plate) + '</span>' : ""}${driver ? " — " + escapeHtml(driver) : ""}</div>
      <div class="small-muted">Elige una acción para esta unidad</div>

      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="openChecklist" class="btn primary" style="flex:1;min-width:140px;padding:14px">Checklist</button>
        <button id="openImages" class="btn" style="flex:1;min-width:140px;padding:14px">Ver imágenes</button>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px">
        <button id="closeModule" class="btn">Cerrar</button>
      </div>
    </div>
  `);

  document.getElementById("closeModule").onclick = closeModal;

  // clicking "Ver imágenes" opens the existing images modal
  document.getElementById("openImages").onclick = () => {
    closeModal();
    openImagesModal(unitId, unitName);
  };

  // clicking "Checklist" will replace modal content with the checklist UI (keeps same save/cancel behavior)
  document.getElementById("openChecklist").onclick = () => {
    openModal(`
      <div>
        <div style="display:flex;gap:8px;flex-direction:column">
          <div style="font-weight:700">${escapeHtml(unitName || "")}${plate ? ' — <span style="color:#b20a0a;font-weight:700">' + escapeHtml(plate) + '</span>' : ""}${driver ? " — " + escapeHtml(driver) : ""}</div>

          <div class="small-muted" style="margin-top:6px">Checklist</div>
          <div class="small-muted" style="margin-top:6px;font-size:13px">Leyenda: ✅ Cumple • ✖️ No cumple • ⚠️ No verificado</div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <input id="checkKm" class="input" placeholder="Kilometraje" style="min-width:140px" />
            <button id="checkPlateBtn" class="btn" style="min-width:120px">Placa</button>
            <input id="checkPlate" class="input" placeholder="Número de placa" style="min-width:140px;display:none" />
            <!-- Moved Cancel/Guardar buttons to the top row beside placa as requested -->
            <div style="display:flex;gap:8px;margin-left:auto;align-items:center">
              <button id="cancel" class="btn">Cancelar</button>
              <button id="save" class="btn primary">Guardar</button>
            </div>
          </div>

          <div id="checklistArea" style="display:flex;flex-direction:column;gap:10px;max-height:333px;overflow:auto;padding-right:6px;margin-top:6px"></div>

          <div style="display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:8px">
            <button id="addCheck" class="btn">+ Ítem (agrega al final)</button>
          </div>
        </div>
      </div>
    `);

    const checklistArea = document.getElementById("checklistArea");
    // hide bottom control panel while filling the checklist
    const bott = document.querySelector('.bottombar');
    if (bott) bott.style.display = 'none';

    // Plate capture button logic: prompt and display chosen plate on the button
    const checkPlateBtn = document.getElementById("checkPlateBtn");
    const checkPlateInput = document.getElementById("checkPlate");
    if(checkPlateBtn && checkPlateInput){
      // initialize from provided plate param if present
      if(plate){
        checkPlateInput.value = plate;
        checkPlateBtn.textContent = `Placa: ${plate}`;
      }
      checkPlateBtn.addEventListener("click", ()=>{
        const current = (checkPlateInput.value || "").trim();
        const val = prompt("Capturar número de placa:", current) || "";
        // if user pressed Cancel, prompt returns null; we keep current value in that case
        if(val === null) return;
        const cleaned = val.trim();
        checkPlateInput.value = cleaned;
        checkPlateBtn.textContent = cleaned ? `Placa: ${cleaned}` : "Placa";
      });
    }

    // helper to create a non-editable check row with three-state controls (yes/no/unverified)
    const makeCheckRow = (label = "", status = "unverified") => {
      const row = document.createElement("div");
      row.className = "check-item";
      row.dataset.status = status; // "yes" | "no" | "unverified"
      row.dataset.obs = ""; // per-item observation
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "8px";
      row.innerHTML = `
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn status-btn" data-status="yes" title="Cumple">✅</button>
          <button class="btn status-btn" data-status="no" title="No cumple">✖️</button>
          <button class="btn status-btn" data-status="unverified" title="No verificado">⚠️</button>
        </div>
        <div class="check-label" style="flex:1;padding:6px 8px;background:transparent">${escapeHtml(label)}</div>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn" data-role="obs" title="Agregar observación">+</button>
        </div>
      `;
      // set visual state according to status
      const applyStatusUI = () => {
        const s = row.dataset.status || "unverified";
        row.querySelectorAll(".status-btn").forEach(b=>{
          const bs = b.dataset.status;
          if(bs === s){
            b.classList.add("selected");
            b.style.opacity = "1";
          } else {
            b.classList.remove("selected");
            b.style.opacity = "0.6";
          }
        });
      };
      // update check-label to show observation if present
      const updateLabelWithObs = () => {
        const lblEl = row.querySelector('.check-label');
        const base = (label || "").toString();
        const obs = row.dataset.obs || "";
        if(obs) lblEl.innerHTML = `${escapeHtml(base)}<div style="font-size:12px;color:#6b6b6b;margin-top:4px">Obs: ${escapeHtml(obs)}</div>`;
        else lblEl.innerHTML = escapeHtml(base);
      };
      row.querySelectorAll(".status-btn").forEach(b=>{
        b.onclick = (ev)=>{
          const s = ev.currentTarget.dataset.status;
          // toggle: if already set to this, switch back to unverified
          row.dataset.status = (row.dataset.status === s) ? "unverified" : s;
          applyStatusUI();
        };
      });
      // removed the "remove" button per request; keep only observation control
      row.querySelector("[data-role=obs]").onclick = () => {
        const current = row.dataset.obs || "";
        const val = prompt("Observación para este ítem:", current) || "";
        row.dataset.obs = val.trim();
        updateLabelWithObs();
      };
      // initialize
      applyStatusUI();
      updateLabelWithObs();
      return row;
    };

    // populate modules into checklistArea
    modules.forEach(mod => {
      const modWrap = document.createElement("div");
      modWrap.style.display = "flex";
      modWrap.style.flexDirection = "column";
      modWrap.style.gap = "6px";
      modWrap.style.padding = "8px";
      modWrap.style.borderRadius = "10px";
      modWrap.style.background = "rgba(250,250,250,0.6)";

      const title = document.createElement("div");
      title.className = "module-title";
      title.style.fontWeight = "700";
      title.style.fontSize = "13px";
      title.textContent = mod.title;
      modWrap.appendChild(title);

      const itemsWrap = document.createElement("div");
      itemsWrap.style.display = "flex";
      itemsWrap.style.flexDirection = "column";
      itemsWrap.style.gap = "6px";
      mod.items.forEach(it => itemsWrap.appendChild(makeCheckRow(it, "unverified")));

      modWrap.appendChild(itemsWrap);
      checklistArea.appendChild(modWrap);
    });

    // addCheck will append a new custom item at the end
    document.getElementById("addCheck").onclick = () => {
      checklistArea.appendChild(makeCheckRow("Nuevo ítem"));
    };

    document.getElementById("cancel").onclick = closeModal;

    document.getElementById("save").onclick = () => {
      // determine final plate: prefer captured input, then initial plate param
      const capturedPlate = (document.getElementById("checkPlate")?.value || "").trim();
      const finalPlate = capturedPlate || plate || null;
      const title = `${unitName || "Reporte"}${finalPlate ? " — " + finalPlate : ""}`;
      const notes = "";
      // read kilometraje
      const kmVal = (document.getElementById("checkKm")?.value || "").trim() || null;

      // Validation: require placa before allowing save
      if (!finalPlate) {
        alert("Debes capturar la placa antes de guardar.");
        // focus the plate capture button/input for convenience
        const plateBtn = document.getElementById("checkPlateBtn");
        const plateInput = document.getElementById("checkPlate");
        if (plateInput) {
          // show input if hidden and focus it to prompt entry
          if (plateInput.style.display === "none") {
            plateInput.style.display = "inline-block";
            plateBtn.style.display = "none";
          }
          plateInput.focus();
        } else if (plateBtn) {
          plateBtn.focus();
        }
        return;
      }

      // Validation: require kilometraje before allowing save
      if (!kmVal) {
        alert("Debes capturar el kilometraje antes de guardar.");
        // focus the kilometraje input for convenience
        const kmEl = document.getElementById("checkKm");
        if (kmEl) kmEl.focus();
        return;
      }

      // flatten all check-items (preserve order as presented)
      const items = Array.from(checklistArea.querySelectorAll(".check-item")).map(el=>{
        const lbl = el.querySelector('.check-label');
        const status = el.dataset.status || "unverified";
        const obs = el.dataset.obs || "";
        // strip potential appended observation from .check-label text (we store obs separately)
        return { label: (lbl ? (lbl.textContent || "").split('Obs:')[0].trim() : "Ítem") || "Ítem", status, observation: obs };
      });
      const r = {
        id: id(),
        unitId,
        plate: finalPlate,
        driver: driver || null,
        supervisor: supervisor || currentSupervisor || null,
        title,
        notes,
        checks: items,
        kilometraje: kmVal,
        module: currentModule || "Reparto",
        createdAt: Date.now()
      };
      state.reports.push(r);
      save();
      renderList();
      // close the checklist modal first, then open the report-action modal for the newly created report
      closeModal();
      // small timeout to ensure modal DOM state settled before opening the next modal
      setTimeout(() => {
        try { openReportModuleOptions(r); } catch(e){ console.warn("No se pudo abrir opciones del reporte inmediatamente", e); }
      }, 120);
    };
  };
}


/* Unit button click -> show plates then open checklist on plate select */
function onUnitButtonClick(unitId, unitName, supervisor = null){
  // persist supervisor choice for subsequent report creation/annotations
  currentSupervisor = supervisor || null;
  // first ask for driver selection
  openModal(`
    <div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="font-weight:700">${escapeHtml(unitName)}</div>
        <div class="small-muted">Selecciona chofer responsable</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <select id="driverSelect" class="input" style="min-width:140px"></select>
          <input id="driverManual" class="input" placeholder="O escribe nombre del chofer (manual)" style="min-width:180px" />
        </div>
        <div style="margin-top:6px" class="small-muted">Supervisor asignado: <strong id="supervisorLabel">${escapeHtml(supervisor || "—")}</strong></div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
          <button id="cancelDriver" class="btn">Cancelar</button>
          <button id="continueDriver" class="btn primary">Continuar</button>
        </div>
      </div>
    </div>
  `);
  const sel = document.getElementById("driverSelect");
  const manualInput = document.getElementById("driverManual");
  // Only show actual driver names for Tijuana; for other branches provide a disabled placeholder but still allow manual input
  if (currentBranch === "tijuana") {
    drivers.forEach(d=>{
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      sel.appendChild(opt);
    });
    // add a blank option so user can choose to type manually
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "— Escribir nombre —";
    sel.insertBefore(blank, sel.firstChild);
    sel.value = "";
  } else {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "— No disponible —";
    opt.disabled = true;
    opt.selected = true;
    sel.appendChild(opt);
  }
  // when user selects a driver from the list, autofill manual input (but allow overwrite)
  sel.addEventListener("change", ()=>{
    try {
      if(sel.value) manualInput.value = sel.value;
    } catch(e){}
  });
  document.getElementById("cancelDriver").onclick = closeModal;
  document.getElementById("continueDriver").onclick = ()=>{
    // prefer manual typed name if provided, otherwise use select value, otherwise null
    const typed = (manualInput.value || "").trim();
    const chosenDriver = typed || sel.value || null;
    closeModal();

    // plates for specific unit(s) - respect branch-specific override for Freightliner in Magdalena
    let plates = [];
    if(unitId === "freightliner"){
      if(currentBranch === "magdalena"){
        // For Magdalena keep only the two specified plates
        plates = ["AM7230A","AM-------"];
      } else {
        plates = ["AN4293A","AN4706A","AW7043A","AM7230A","AM-------"];
      }
    } else {
      const platesFor = {
        international: ["AV-SDR-22","AV-SDE-23","AV-SDE-24"],
        isuzu: ["6AHB54A","AH7305A","3AHB93A"]
        // other units could be added here
      };
      plates = platesFor[unitId] || [];
    }

    if(plates.length === 0){
      currentUnitId = unitId;
      currentPlate = null;
      openNewReportForSelection(unitId, unitName, null, chosenDriver, supervisor);
      return;
    }
    // show plates modal
    openModal(`
      <div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <div style="font-weight:700">${escapeHtml(unitName)}</div>
          <div class="small-muted">Selecciona número de placa</div>
          <div id="plateList" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"></div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">
            <button id="manualPlateBtn" class="btn">Agregar manual</button>
            <button id="cancelPlates" class="btn">Cerrar</button>
          </div>
        </div>
      </div>
    `);
    const plateList = document.getElementById("plateList");
    plates.forEach(p=>{
      const b = document.createElement("button");
      b.className = "btn";
      b.textContent = p;
      b.onclick = ()=>{
        currentUnitId = unitId;
        currentPlate = p;
        closeModal();
        openNewReportForSelection(unitId, unitName, p, chosenDriver, supervisor);
      };
      plateList.appendChild(b);
    });

    // Manual plate entry support: prompt user to add a custom plate and continue the same flow
    const manualBtn = document.getElementById("manualPlateBtn");
    if(manualBtn){
      manualBtn.onclick = () => {
        const val = prompt("Capturar número de placa manualmente:", "");
        if(val === null) return; // user cancelled
        const cleaned = (val || "").trim();
        if(!cleaned){
          alert("Placa vacía. Intenta de nuevo.");
          return;
        }
        currentUnitId = unitId;
        currentPlate = cleaned;
        closeModal();
        openNewReportForSelection(unitId, unitName, cleaned, chosenDriver, supervisor);
      };
    }

    document.getElementById("cancelPlates").onclick = closeModal;
  };
}

/* New report flow (triggered from topbar button) */
/* Opens a small dialog allowing selection of unit and editing its displayed name before continuing */
newReportBtn.addEventListener("click", ()=> {
  if(!state.units || state.units.length === 0) return alert("Crea una unidad primero");

  // build select + editable name input modal + supervisor select
  openModal(`
    <div style="display:flex;flex-direction:column;gap:8px">
      <div style="font-weight:700">Nuevo reporte — Seleccionar unidad</div>
      <div class="small-muted">Selecciona la unidad y el supervisor.</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <select id="selectUnitForReport" class="input" style="min-width:140px"></select>
        <select id="selectSupervisorForReport" class="input" style="min-width:160px">
          <option value="">Seleccionar supervisor</option>
        </select>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-start;margin-top:8px">
        <button id="manualAddUnit" class="btn">Agregar manual</button>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
        <button id="cancelUnitSelect" class="btn">Cancelar</button>
        <button id="continueUnitSelect" class="btn primary">Continuar</button>
      </div>
    </div>
  `);

  const sel = document.getElementById("selectUnitForReport");
  const supSelect = document.getElementById("selectSupervisorForReport");
  const nameInput = document.getElementById("unitNameEdit");

  // supervisors mapped by branch (sucursal) codes used in branch selector
  const supervisorsByBranch = {
    tijuana: ["Seleccionar supervisor"],
    mexicali: ["Joel Eguino"],
    ensenada: ["Arturo Flores"],
    la_paz: ["Oscar Valderrama"],
    magdalena: ["Janeth Grijalva","Francisco Eguino"],
    hermosillo: ["Victor Rosas"],
    los_mochis: ["Yuniva Eguino"],
    guadalajara: ["Alfredo Moreno"],
    mexico: ["Carmina Cota","Benjamin Jimenez"],
    monterrey: ["Oscar Rangel"],
    ciudad_juarez: ["Francisco Miranda"],
    veracruz_xalapa: ["Enrique Hernandez"],
    veracruz: ["Enrique Hernandez"],
    tuxtla: ["Madelayne Goméz"],
    merida: ["Esdras Roblero"]
  };

  // Populate supervisor select based on currentBranch (fallback to a short default list)
  function populateSupervisorSelect(branchKey){
    supSelect.innerHTML = "";
    const addOption = (val, label) => {
      const o = document.createElement("option");
      o.value = val;
      o.textContent = label;
      supSelect.appendChild(o);
    };
    // default placeholder
    addOption("", "Seleccionar supervisor");
    // add explicit "Chofer asignado" option as requested
    addOption("chofer_asignado", "Chofer asignado");
    const list = supervisorsByBranch[branchKey] || ["Liborio Alvarez", "Jorge Gámez", "Luis Callejas", "Ivan Solis"];
    list.forEach(s => {
      // skip placeholder duplicate
      if(!s) return;
      // if the value is "Seleccionar supervisor" keep empty value
      // avoid adding another "Chofer asignado" entry if present in list
      if(String(s).toLowerCase().includes("chofer asignado")) {
        // ensure value is consistent
        addOption("chofer_asignado", s);
        return;
      }
      addOption(s === "Seleccionar supervisor" ? "" : s, s);
    });
  }

  // initial population using persisted branch or null
  populateSupervisorSelect(currentBranch);

  // populate select
  state.units.forEach(u=>{
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.textContent = u.name;
    sel.appendChild(opt);
  });

  // set initial selection (prefer currentUnitId)
  if(currentUnitId && state.units.find(u=>u.id===currentUnitId)) sel.value = currentUnitId;
  else sel.value = state.units[0].id;

  // dropdown selection is authoritative (no editable name input)

  // update behavior on unit selection change if needed in future
  sel.addEventListener("change", ()=> { /* no editable name field to sync */ });

  // Manual add unit behavior: prompt for a unit name/id, persist and immediately continue new-report flow for it
  const manualAddBtn = document.getElementById("manualAddUnit");
  if (manualAddBtn) {
    manualAddBtn.addEventListener("click", () => {
      const name = prompt("Nombre de la unidad (ej. 'Sprinter 01' o 'Mi unidad'):", "");
      if (name === null) return; // cancelled
      const cleanedName = name.trim();
      if (!cleanedName) {
        alert("Nombre inválido.");
        return;
      }
      // build a safe id
      let newId = cleanedName.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
      // ensure uniqueness
      let suffix = 1;
      const baseId = newId || "unidad";
      while (state.units.find(u => u.id === newId)) {
        suffix += 1;
        newId = `${baseId}_${suffix}`;
      }
      // persist new unit
      state.units.push({ id: newId, name: cleanedName });
      save();
      // set selection to new unit and proceed
      sel.value = newId;
      // auto-close modal and continue flow with chosen supervisor
      const chosenSupervisor = (supSelect.value || "").trim() || null;
      closeModal();
      currentUnitId = newId;
      onUnitButtonClick(newId, cleanedName, chosenSupervisor);
    });
  }

  document.getElementById("cancelUnitSelect").onclick = closeModal;

  document.getElementById("continueUnitSelect").onclick = () => {
    const chosenUnitId = sel.value;
    const chosenSupervisor = (supSelect.value || "").trim() || null;

    // close and continue to existing new-report flow using the unit's stored name (no edits persisted)
    closeModal();
    const unit = state.units.find(u=>u.id === chosenUnitId) || {};
    // set currentUnitId so list rendering and other flows know the chosen unit
    currentUnitId = chosenUnitId;
    // pass chosenSupervisor into the unit flow
    onUnitButtonClick(chosenUnitId, unit.name || "Unidad", chosenSupervisor);
  };
});

/* List actions (view, delete) */
listContainer.addEventListener("click", (e)=>{
  const btn = e.target.closest("button");
  if(!btn) return;
  const action = btn.dataset.action;
  const rid = btn.dataset.id;
  if(action === "view"){
    const r = state.reports.find(x=>x.id===rid);
    if(!r) return;
    openReportModuleOptions(r);
  }else if(action === "delete"){
    if(!confirm("Borrar este reporte?")) return;
    state.reports = state.reports.filter(x=>x.id!==rid);
    save();
    renderList();
  }
});

function renderReportView(r){
  const date = new Date(r.createdAt).toLocaleString();
  const incidentsHtml = r.incidentsCount ? ` • <span style="color:#b20a0a;font-weight:700">${r.incidentsCount} incid.</span>` : "";
  const kmHtml = r.kilometraje ? ` • Km: ${escapeHtml(r.kilometraje)}` : "";

  // group checks by status
  const checks = Array.isArray(r.checks) ? r.checks : [];
  const groups = { yes: [], no: [], unverified: [] };
  checks.forEach(c => {
    const status = (c.status === "yes" || c.status === "no") ? c.status : "unverified";
    groups[status].push(escapeHtml(c.label || "Ítem"));
  });

  // helper to render column
  const renderCol = (title, items, emptyText, color) => {
    const rows = items.length ? items.map(it => `<div class="check-item" style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:6px;background:transparent"><div style="min-width:28px;text-align:center;font-weight:700;color:${color}">${ title === '✅' ? '✅' : (title === '✖️' ? '✖️' : '⚠️') }</div><div style="flex:1;padding-left:8px">${it}</div></div>`).join("") : `<div style="padding:8px;color:#6b6b6b">${emptyText}</div>`;
    return `<div style="flex:1;min-width:120px;border-radius:8px;padding:6px;background:rgba(255,255,255,0.92)"><div style="font-weight:700;margin-bottom:6px">${title}</div>${rows}</div>`;
  };

  const colsHtml = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
      ${renderCol('✅', groups.yes, '— Ninguno', '#268b40')}
      ${renderCol('✖️', groups.no, '— Ninguno', '#b20a0a')}
      ${renderCol('⚠️', groups.unverified, '— Ninguno', '#777')}
    </div>
  `;

  return `
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:700;font-size:16px">${escapeHtml(r.title)}</div>
          <div class="small-muted">${date}${r.driver ? " • " + escapeHtml(r.driver) : ""}${r.plate ? ' • <span style="color:#b20a0a;font-weight:700">' + escapeHtml(r.plate) + '</span>' : ""}${kmHtml}${incidentsHtml}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button id="editReport" class="btn">Editar</button>
          <button id="closeView" class="btn">Cerrar</button>
        </div>
      </div>

      <div style="margin-top:10px">
        <div class="small-muted">Notas</div>
        <div style="padding:8px;border-radius:8px;background:rgba(255,255,255,0.9);margin-top:6px">${escapeHtml(r.notes || "—")}</div>
      </div>

      <div style="margin-top:10px">
        <div class="small-muted">Checklist</div>
        ${colsHtml}
      </div>
    </div>
  `;
}



closeModalBtn.addEventListener("click", closeModal);

/* Edit from view - attach via event delegation inside modalContent */
modalContent.addEventListener("click", (e)=>{
  const el = e.target;
  if(el.id === "closeView") return closeModal();
  if(el.id === "editReport"){
    // read current report id by locating title and timestamp (inelegant but works)
    const title = modalContent.querySelector(".title, div[style*='font-weight:700']")?.textContent || "";
    // find report by title and recent date - safer: match title + any report with same title in state (pick newest)
    const candidates = state.reports.filter(r=>r.title === title);
    const r = candidates.sort((a,b)=>b.createdAt - a.createdAt)[0];
    if(!r) return alert("No se puede editar");
    openEditReport(r);
  }
});

function openEditReport(r){
  openModal(`
    <div>
      <div style="display:flex;gap:8px;flex-direction:column">
        <input id="reportTitle" class="input" value="${escapeHtml(r.title)}" />
        <textarea id="reportNotes" class="input">${escapeHtml(r.notes || "")}</textarea>
        <div class="small-muted" style="margin-top:6px;font-size:13px">Leyenda: ✅ Cumple • ✖️ No cumple • ⚠️ No verificado</div>

        <div class="small-muted">Checklist</div>
        <div class="checklist" id="checklistArea"></div>

        <div style="display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:8px">
          <button id="addCheck" class="btn">+ Ítem</button>
          <div style="display:flex;gap:8px">
            <button id="cancel" class="btn">Cancelar</button>
            <button id="save" class="btn primary">Guardar</button>
          </div>
        </div>
      </div>
    </div>
  `);
  // hide bottom control panel while editing a report/checklist
  const bott = document.querySelector('.bottombar');
  if (bott) bott.style.display = 'none';

  const checklistArea = document.getElementById("checklistArea");
  const makeCheckRow = (item)=>{
    const status = (item && item.status) ? item.status : "unverified";
    const row = document.createElement("div");
    row.className = "check-item";
    row.dataset.status = status;
    row.dataset.obs = (item && item.observation) ? (item.observation || "") : "";
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "8px";
    row.innerHTML = `
      <div style="display:flex;gap:6px;align-items:center">
        <button class="btn status-btn" data-status="yes" title="Cumple">✅ Cumple</button>
        <button class="btn status-btn" data-status="no" title="No cumple">✖️ No cumple</button>
        <button class="btn status-btn" data-status="unverified" title="No verificado">⚠️ No verificado</button>
      </div>
      <div class="check-label" style="flex:1;padding:6px 8px;background:transparent">${escapeHtml(item.label || "")}</div>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="btn" data-role="obs" title="Agregar observación">+</button>
      </div>
    `;
    const applyStatusUI = () => {
      const s = row.dataset.status || "unverified";
      row.querySelectorAll(".status-btn").forEach(b=>{
        const bs = b.dataset.status;
        if(bs === s){
          b.classList.add("selected");
          b.style.opacity = "1";
        } else {
          b.classList.remove("selected");
          b.style.opacity = "0.6";
        }
      });
    };
    const updateLabelWithObs = () => {
      const lblEl = row.querySelector('.check-label');
      const base = (item && item.label) ? item.label : "";
      const obs = row.dataset.obs || "";
      if(obs) lblEl.innerHTML = `${escapeHtml(base)}<div style="font-size:12px;color:#6b6b6b;margin-top:4px">Obs: ${escapeHtml(obs)}</div>`;
      else lblEl.innerHTML = escapeHtml(base);
    };
    row.querySelectorAll(".status-btn").forEach(b=>{
      b.onclick = (ev)=>{
        const s = ev.currentTarget.dataset.status;
        row.dataset.status = (row.dataset.status === s) ? "unverified" : s;
        applyStatusUI();
      };
    });
    // removed the remove button; preserve only observation action
    row.querySelector("[data-role=obs]").onclick = () => {
      const current = row.dataset.obs || "";
      const val = prompt("Observación para este ítem:", current) || "";
      row.dataset.obs = val.trim();
      updateLabelWithObs();
    };
    applyStatusUI();
    updateLabelWithObs();
    return row;
  };

  r.checks.forEach(item => checklistArea.appendChild(makeCheckRow(item)));
  document.getElementById("addCheck").onclick = ()=> checklistArea.appendChild(makeCheckRow({label:"",status:"unverified"}));
  document.getElementById("cancel").onclick = closeModal;
  document.getElementById("save").onclick = ()=>{
    const title = document.getElementById("reportTitle").value.trim() || "Reporte";
    const notes = document.getElementById("reportNotes").value.trim();
    const items = Array.from(checklistArea.querySelectorAll(".check-item")).map(el=>{
      const lbl = el.querySelector('.check-label');
      const status = el.dataset.status || "unverified";
      const obs = el.dataset.obs || "";
      return { label: (lbl ? (lbl.textContent || "").split('Obs:')[0].trim() : "Ítem") || "Ítem", status, observation: obs };
    });
    // update
    const idx = state.reports.findIndex(x=>x.id===r.id);
    if(idx === -1) return alert("Error guardando");
    state.reports[idx].title = title;
    state.reports[idx].notes = notes;
    state.reports[idx].checks = items;
    save();
    renderList();
    closeModal();
  };
}

/* When viewing a report, show module options (Checklist / Ver imágenes) that route to edit or images */
function openReportModuleOptions(report){
  const unit = state.units.find(u=>u.id === report.unitId) || {};
  const unitName = unit.name || report.title || "Unidad";

  openModal(`
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="font-weight:700">${escapeHtml(unitName)}</div>
      <div class="small-muted">Elige una acción para este reporte</div>

      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="openChecklistForReport" class="btn primary" style="flex:1;min-width:140px;padding:14px">Checklist</button>
        <button id="openImagesForReport" class="btn" style="flex:1;min-width:140px;padding:14px">Ver imágenes</button>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px">
        <button id="closeModuleReport" class="btn">Cerrar</button>
      </div>
    </div>
  `);

  document.getElementById("closeModuleReport").onclick = closeModal;

  document.getElementById("openImagesForReport").onclick = () => {
    closeModal();
    openImagesModal(report.unitId, unitName);
  };

  document.getElementById("openChecklistForReport").onclick = () => {
    // Open edit view for this specific report
    closeModal();
    openEditReport(report);
  };
}

/* Export button removed: JSON export via 'Exportar' was deleted to keep only 'Exportar PDF' */

/* Utility */
function escapeHtml(str){
  return String(str).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

/* Branch handling: persist selection and expose currentBranch */
function loadBranch(){
  try {
    const b = localStorage.getItem(BRANCH_STORAGE_KEY);
    if(b) currentBranch = b;
  } catch(e){}
}
function saveBranch(){
  try {
    if(currentBranch) localStorage.setItem(BRANCH_STORAGE_KEY, currentBranch);
    else localStorage.removeItem(BRANCH_STORAGE_KEY);
  } catch(e){}
}
function renderBranches(){
  const sel = document.getElementById("branchSelect");
  if(!sel) return;
  // set selection to stored branch if present
  if(currentBranch) sel.value = currentBranch;
  sel.onchange = () => {
    currentBranch = sel.value || null;
    saveBranch();
    // small visual feedback: update document title snippet
    if(currentBranch){
      const label = sel.options[sel.selectedIndex]?.text || "";
      document.title = `Bitácora Unidades — ${label}`;
    } else {
      document.title = "Bitácora Unidades";
    }
    // re-render list in case you later want to filter by branch
    renderList();
  };
}

/* Show a blocking "Selecciona Sucursal" modal on first view so user chooses branch before using the app.
   It will prefill from saved branch when available and persist the selection. */
function showBranchModal(){
  // build options (same list used in index.html topbar)
  const options = [
    ["", "Seleccionar sucursal"],
    ["tijuana","Tijuana"],
    ["mexicali","Méxicali"],
    ["ensenada","Ensenada"],
    ["la_paz","La Paz"],
    ["magdalena","Magdalena"],
    ["hermosillo","Hermosillo"],
    ["los_mochis","Los Mochis"],
    ["guadalajara","Guadalajara"],
    ["mexico","México"],
    ["monterrey","Monterrey"],
    ["ciudad_juarez","Ciudad Juárez"],
    ["veracruz_xalapa","Veracruz (Xalapa)"],
    ["veracruz","Veracruz"],
    ["tuxtla","Tuxtla"],
    ["merida","Mérida"]
  ];

  // open a modal forcing user to pick a branch
  // add a temporary class to the modal element so the white card box is removed for this initial window
  document.querySelector(".modal")?.classList.add("no-card");
  // prevent page/overlay scrolling while the initial blocking modal is shown
  modalOverlay.classList.add("no-scroll");
  openModal(`
    <div style="display:flex;flex-direction:column;gap:12px;
                width:100%;max-width:520px;margin:0 auto;
                padding:14px;border-radius:12px;
                /* royal-blue satin (opaque) */
                background: linear-gradient(180deg, #123a93 0%, #144987 40%, #163f7f 100%);
                color: #ffffff;
                box-shadow: 0 18px 48px rgba(2,6,7,0.24);
                text-align:left;">
      <div style="font-weight:700">Selecciona Sucursal</div>
      <div class="small-muted" style="color: rgba(255,255,255,0.9)">Selecciona la sucursal para trabajar (se guardará en este dispositivo).</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px">
        <select id="startupBranchSelect" class="input" style="min-width:180px"></select>
        <input id="startupBranchPassword" class="input" type="password" placeholder="Contraseña (nombre de la sucursal)" style="min-width:180px;display:none" />
      </div>
      <div id="branchError" style="color: #ffdddd; font-size:13px; display:none">Contraseña inválida</div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px">
        <button id="confirmBranch" class="btn primary" style="background: linear-gradient(180deg, #123a93 0%, #144987 40%, #163f7f 100%);">Continuar</button>
      </div>
    </div>
  `);

  const sel = document.getElementById("startupBranchSelect");
  const pwd = document.getElementById("startupBranchPassword");
  const err = document.getElementById("branchError");

  // populate
  options.forEach(([val,label])=>{
    const o = document.createElement("option");
    o.value = val;
    o.textContent = label;
    sel.appendChild(o);
  });
  // preselect saved branch when available
  try { loadBranch(); if(currentBranch) sel.value = currentBranch; } catch(e){}

  // toggle password input visibility depending on selection (tijuana exempt)
  const updatePasswordVisibility = () => {
    const v = sel.value || "";
    if(!v || v === "tijuana"){
      pwd.style.display = "none";
      pwd.value = "";
      err.style.display = "none";
    } else {
      pwd.style.display = "block";
      pwd.placeholder = `Contraseña: ${v}`;
      pwd.value = "";
      err.style.display = "none";
      // focus for convenience
      setTimeout(()=> pwd.focus(), 50);
    }
  };
  sel.addEventListener("change", updatePasswordVisibility);
  // initial visibility
  updatePasswordVisibility();

  document.getElementById("confirmBranch").onclick = ()=>{
    const val = sel.value || null;

    // Block empty selection: require a non-empty branch to proceed
    if(!val){
      err.textContent = "Selecciona una sucursal antes de continuar.";
      err.style.display = "block";
      return;
    }

    // require password for all branches except tijuana
    if(val !== "tijuana"){
      const entered = (pwd.value || "").trim();
      if(!entered){
        err.textContent = "Ingresa la contraseña (el nombre de la sucursal).";
        err.style.display = "block";
        return;
      }
      if(entered.toLowerCase() !== String(val).toLowerCase()){
        err.textContent = "Contraseña inválida";
        err.style.display = "block";
        return;
      }
    }

    // clear any previous error and continue
    err.style.display = "none";
    currentBranch = val;
    saveBranch();

    // Populate state.units from branch mapping (replace unit list for chosen branch)
    try {
      const key = (val || "").toString();
      const ids = BRANCH_UNITS[key] || [];
      if(ids.length > 0){
        // map known ids to {id,name}, preserving known display names
        state.units = ids.map(id => ({ id, name: KNOWN_UNITS[id] || id }));
      } else {
        // fallback: keep all known units (no branch-specific restriction)
        state.units = Object.keys(KNOWN_UNITS).map(id=>({ id, name: KNOWN_UNITS[id] }));
      }
      save();
    } catch(e){
      console.warn("Error applying branch units", e);
    }

    // reflect into topbar select if present
    const topSel = document.getElementById("branchSelect");
    if(topSel) topSel.value = val || "";
    // ensure the upcoming "Selecciona módulo" modal uses the transparent/no-card variant
    document.querySelector(".modal")?.classList.add("no-card");

    // After selecting branch, request module choice (Reparto / Utilitarios).
    // All information will be stored in "Reparto" regardless of selection (per requirement).
    openModal(`
      <div style="display:flex;flex-direction:column;gap:12px;
                  width:100%;max-width:520px;margin:0 auto;
                  padding:12px;border-radius:12px;
                  /* royal-blue satin tab background (opaque) */
                  background: linear-gradient(180deg, #123a93 0%, #144987 40%, #163f7f 100%);
                  color: #ffffff;
                  box-shadow: 0 18px 48px rgba(2,6,7,0.24);
                  text-align:left;">
        <div style="font-weight:700">Selecciona módulo</div>
        <div class="small-muted" style="color: rgba(255,255,255,0.95)">Elige el módulo que usarás.</div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button id="chooseReparto" class="btn primary" style="flex:1;background: linear-gradient(180deg, #123a93 0%, #144987 40%, #163f7f 100%);color:#fff">Reparto</button>
          <button id="chooseUtilitarios" class="btn" style="flex:1;background: linear-gradient(180deg, rgba(18,58,147,0.6) 0%, rgba(20,73,135,0.6) 40%, rgba(22,63,127,0.6) 100%);color:#fff;border: 1px solid rgba(255,255,255,0.08)">Utilitarios</button>
        </div>
      </div>
    `);
    document.getElementById("chooseReparto").onclick = ()=>{
      currentModule = "Reparto";
      closeModal();
      // remove no-card so following modals show the regular white card again
      document.querySelector(".modal")?.classList.remove("no-card");

      // ensure topbar and key action buttons are visible after module selection
      try {
        const topbarEl = document.querySelector('.topbar');
        if(topbarEl) topbarEl.style.display = 'flex';
        if (typeof newReportBtn !== 'undefined' && newReportBtn) newReportBtn.style.display = 'inline-block';
        if (typeof exportPdfTopBtn !== 'undefined' && exportPdfTopBtn) exportPdfTopBtn.style.display = 'inline-block';
      } catch(e){ /* no-op */ }

      // finalize startup
      renderUnits();
      renderBranches();
      renderList();

      // immediately open the Nuevo reporte flow so the user can start (simulate click)
      try {
        if (typeof newReportBtn !== 'undefined' && newReportBtn) {
          // small timeout so UI updates (renderList / modal close) complete before opening
          setTimeout(()=> newReportBtn.click(), 120);
        }
      } catch(e){}
    };
    document.getElementById("chooseUtilitarios").onclick = ()=>{
      // keep selection visible but per requirement all info goes to "Reparto"
      // still record that user pressed Utilitarios by storing a transient value, but assign module "Reparto"
      currentModule = "Reparto";
      closeModal();
      // remove no-card so following modals show the regular white card again
      document.querySelector(".modal")?.classList.remove("no-card");

      // ensure topbar and key action buttons are visible after module selection
      try {
        const topbarEl = document.querySelector('.topbar');
        if(topbarEl) topbarEl.style.display = 'flex';
        if (typeof newReportBtn !== 'undefined' && newReportBtn) newReportBtn.style.display = 'inline-block';
        if (typeof exportPdfTopBtn !== 'undefined' && exportPdfTopBtn) exportPdfTopBtn.style.display = 'inline-block';
      } catch(e){ /* no-op */ }

      renderUnits();
      renderBranches();
      renderList();
    };
  };


}

/* Attach handler for the new "Cerrar sesión" button: clears the stored branch and re-opens the branch selector */
const logoutBtn = document.getElementById("logoutBtn");
if(logoutBtn){
  logoutBtn.addEventListener("click", ()=> {
    try {
      // close any open modal, clear persisted branch, then force the branch selection modal
      closeModal();
      currentBranch = null;
      saveBranch();
      // ensure initial modal uses transparent/no-card style
      document.querySelector(".modal")?.classList.add("no-card");
      showBranchModal();
    } catch(e){
      console.warn("Error during logout flow", e);
    }
  });
}

/* New global clear-all-records button: removes all reports from storage across branches */
const clearAllBtn = document.getElementById("clearAllBtn");
if (clearAllBtn) {
  clearAllBtn.addEventListener("click", () => {
    if (!confirm("Eliminar todos los registros (todos los reportes) de todas las sucursales? Esta acción no se puede deshacer.")) return;
    try {
      // Clear only reports and persist the change, preserving units and branch selection
      state.reports = [];
      save();
      // Do not remove STORAGE_KEY or reload state (preserve configured units and branch)
      renderList();
      alert("Todos los registros (reportes) fueron eliminados.");
    } catch (e) {
      console.error("Error al borrar registros", e);
      alert("Ocurrió un error al eliminar los registros.");
    }
  });
}

/* ensure branch is loaded from storage, but do NOT auto-open the branch selector on startup.
   The user can still open it via the "Cerrar sesión" / logout button or other UI flows. */
loadBranch();
// initialize UI so the app is ready without forcing the branch modal
renderUnits();
renderBranches();
renderList();