/* R20: the drawer's own focus() call runs while the panel is still hidden, so focus stayed on the menu button.
   Move focus into the drawer once it is visible. No other behaviour changes. */
(function () {
  "use strict";
  document.addEventListener("pb:sidebar-open", function () {
    var sb = document.getElementById("pbSidebar"); if (!sb) return;
    setTimeout(function () {
      if (!sb.classList.contains("open") || sb.contains(document.activeElement)) return;
      var first = sb.querySelector(".pb-side-item"); if (first) first.focus({ preventScroll: true });
    }, 300);
  });
})();
