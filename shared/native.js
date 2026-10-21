/* Native (Capacitor) bridge shared by Khata & Hisaab. Safe no-op on the plain web. */
(function(){
"use strict";
const cap = window.Capacitor;
const isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
const P = n => (cap && cap.Plugins && cap.Plugins[n]) || null;

function toast(m){ try { window.toast && window.toast(m); } catch(e){} }

function webDownload(name, blob){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
}
async function shareNative(name, data, isBase64, title){
  const FS = P("Filesystem"), SH = P("Share");
  if (!FS || !SH) throw new Error("native file plugins missing");
  const w = await FS.writeFile(isBase64 ? { path: name, data, directory: "CACHE", recursive: true }
                                        : { path: name, data, directory: "CACHE", encoding: "utf8", recursive: true });
  await SH.share({ title: title || name, text: name, url: w.uri, dialogTitle: "Save or send " + name });
}
const Native = {
  isNative,
  inviteBase: () => isNative ? "" : location.origin + location.pathname,
  /* text file (JSON backup) */
  async saveText(name, text, mime){
    if (!isNative) return webDownload(name, new Blob([text], { type: mime || "application/json" }));
    try { await shareNative(name, text, false); } catch(e){ toast("Could not export: " + (e.message||e)); }
  },
  /* SheetJS workbook */
  async saveWorkbook(wb, name){
    if (!isNative) return XLSX.writeFile(wb, name);
    try {
      const b64 = XLSX.write(wb, { bookType: "xlsx", type: "base64" });
      await shareNative(name, b64, true);
    } catch(e){ toast("Could not export: " + (e.message||e)); }
  }
};
window.Native = Native;

if (!isNative) return;

document.documentElement.classList.add("native");

window.addEventListener("load", () => {
  const SB = P("StatusBar");
  if (SB) { try { SB.setStyle({ style: "DARK" }); } catch(e){} }
  const SS = P("SplashScreen");
  if (SS) setTimeout(() => { try { SS.hide(); } catch(e){} }, 300);

  /* Android back button: sheet -> home tab -> exit */
  const App = P("App");
  if (App) App.addListener("backButton", () => {
    const pf = document.getElementById("pf");
    if (pf && pf.classList.contains("open")) return;               // picker/PIN screen: ignore
    const m = document.getElementById("pfMenu");
    if (m && m.classList.contains("open")) return m.classList.remove("open");
    const sheet = document.getElementById("sheet");
    if (sheet && sheet.classList.contains("open") && typeof closeSheet === "function") return closeSheet();
    const home = document.querySelector('nav button[data-view="home"]');
    if (home && !home.classList.contains("on") && typeof showView === "function") return showView("home");
    App.exitApp();
  });
});
})();
