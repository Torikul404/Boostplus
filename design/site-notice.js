/* boostplus কাস্টমার সাইটের নোটিশ ব্যানার (P৪)
 * ব্যবহার: প্রতিটি পাতায় </body>-এর আগে
 *   <script src="design/site-notice.js" data-api="https://script.google.com/macros/s/XXXX/exec" defer></script>
 * data-api না দিলে window.BOOSTPLUS_SHEET_API (app-core.js) নেয়।
 * অ্যাডমিন "নোটিশ ব্যানার" থেকে চালু করলে পাতার ওপরে দেখায়। কাস্টমার ✕ চাপলে এই সেশনে লুকায়,
 * লেখা বদলালে আবার আসে। লেখা সবসময় textContent দিয়ে বসে (HTML চলে না)। ব্যর্থ হলে চুপচাপ কিছু দেখায় না। */
(function () {
  "use strict";
  var me = document.currentScript;
  var api = (me && me.getAttribute("data-api")) || window.BOOSTPLUS_SHEET_API || "";
  if (!api || document.getElementById("pbNotice")) return;
  var COL = { info: ["59,130,246", "ℹ️"], warn: ["245,158,11", "⚠️"], bad: ["239,68,68", "🚫"] };
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); }
  function seen(k) { try { return sessionStorage.getItem("pb_notice_x") === k; } catch (e) { return false; } }
  function mark(k) { try { sessionStorage.setItem("pb_notice_x", k); } catch (e) {} }
  function show(n) {
    var key = hash(n.level + "|" + n.text); if (seen(key)) return;
    var c = COL[n.level] || COL.info;
    var st = document.createElement("style");
    st.textContent = "#pbNotice{display:flex;gap:10px;align-items:flex-start;padding:10px 14px;font:500 14px/1.5 inherit;font-family:inherit;color:inherit;border-bottom:1px solid rgba(" + c[0] + ",.6);background:rgba(" + c[0] + ",.16);position:relative;z-index:60;overflow-wrap:anywhere}" +
      "#pbNotice .t{flex:1;min-width:0}#pbNotice button{flex:none;min-width:44px;min-height:44px;margin:-10px -10px -10px 0;border:0;background:none;color:inherit;font-size:18px;cursor:pointer;opacity:.7}#pbNotice button:hover{opacity:1}";
    var d = document.createElement("div"); d.id = "pbNotice"; d.setAttribute("role", "status");
    var t = document.createElement("span"); t.className = "t"; t.textContent = c[1] + " " + n.text;
    var b = document.createElement("button"); b.type = "button"; b.setAttribute("aria-label", "বন্ধ করুন"); b.textContent = "✕";
    b.onclick = function () { mark(key); d.remove(); };
    d.appendChild(t); d.appendChild(b);
    document.head.appendChild(st); document.body.insertBefore(d, document.body.firstChild);
  }
  try {
    fetch(api + (api.indexOf("?") === -1 ? "?" : "&") + "action=notice_get", { method: "GET", mode: "cors", cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.ok && d.on && d.text) show({ text: String(d.text), level: String(d.level || "info") }); })
      .catch(function () {});
  } catch (e) {}
})();
