/* ==========================================================
   app-checkout.js — Payment flow (method pick → instructions → waiting →
   TrxID form), pending / success status screens, live status polling,
   and Track Order.
   ========================================================== */

document.querySelectorAll('.gateway-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.gateway-tab').forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-pressed', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-pressed', 'true');
    document.getElementById('grid-banking').style.display = 'none';
    document.getElementById('grid-international').style.display = 'none';
    if (tab.dataset.cat === 'banking') document.getElementById('grid-banking').style.display = 'grid';
    if (tab.dataset.cat === 'international') document.getElementById('grid-international').style.display = 'grid';
  });
});

/* STEP 1 — selecting a payment card only highlights it; the customer still
   has to press the dynamic "Pay X BDT" button to move on to Step 2. */
function selectPayCard(card) {
  selectedMethod = card.dataset.method;
  document.querySelectorAll('.pay-card').forEach(c => {
    c.classList.remove('selected');
    c.setAttribute('aria-checked', 'false');
  });
  card.classList.add('selected');
  card.setAttribute('aria-checked', 'true');
  const step1PayBtn = document.getElementById('step1PayBtn');
  if (step1PayBtn) step1PayBtn.disabled = false;
}
document.querySelectorAll('.pay-card').forEach(card => {
  card.addEventListener('click', () => selectPayCard(card));
  // Keyboard support: role="radio" divs aren't natively focusable/activatable,
  // so Enter/Space must trigger selection the same way a click does.
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectPayCard(card);
    }
  });
});

/** Populates Step 2 (Payment Instructions) for the currently selected
 *  payment method and shows it. */
function openStep2Instructions() {
  if (!selectedMethod) return;
  const config = paymentConfig[selectedMethod];

  document.getElementById('gateway-overlay').style.display = 'none';
  // Paymently-style: collect payer number first (mobile banking only)
  if (selectedMethod === 'bkash' || selectedMethod === 'nagad' || selectedMethod === 'rocket') {
    const pv = document.getElementById('payer-view');
    const dp = document.getElementById('details-panel');
    if (pv) {
      if (dp) dp.style.display = 'none';
      const wv = document.getElementById('waiting-view');
      if (wv) wv.style.display = 'none';
      pv.style.display = 'block';
      const amt = document.getElementById('payAmountDisplay');
      const box = document.getElementById('payerAmountBox');
      if (box && amt) box.textContent = (amt.innerText || '0') + ' BDT';
      const prompt = document.getElementById('payerPrompt');
      if (prompt) prompt.textContent = 'Enter the ' + (config && config.name ? config.name : 'wallet') + ' number you will pay from.';
      var _tg = document.getElementById('payerMethodTag');
      if (_tg && config) _tg.innerText = config.name;
      const inp = document.getElementById('payerFromNumber');
      if (inp) { inp.value = window._payerFromNumber || ''; inp.focus(); }
      return;
    }
  }
  document.getElementById('details-panel').style.display = 'block';
  const waitingViewEl = document.getElementById('waiting-view');
  if (waitingViewEl) waitingViewEl.style.display = 'none';
  const submitTrxViewEl = document.getElementById('submit-trx-view');
  if (submitTrxViewEl) submitTrxViewEl.style.display = 'none';
  document.getElementById('pending-view').style.display = 'none';

  document.getElementById('payTitle').innerText = config.name;
      var _mt = document.getElementById('payerMethodTag');
      if (_mt) _mt.innerText = config.name;
  document.getElementById('payAmountBox').innerText = document.getElementById('payAmountDisplay').innerText + ' BDT';
  var _hint = document.getElementById('payAmountHint');
  if (_hint) _hint.innerText = document.getElementById('payAmountDisplay').innerText;

  const binanceUidGroup = document.getElementById('binanceUidGroup');
  const binanceUidInput = document.getElementById('binanceSenderUid');
  const ivePaidBtn = document.getElementById('ivePaidBtn');

  if (config.type === 'mobile') {
    document.getElementById('mobileInstructions').style.display = 'block';
    document.getElementById('cryptoInstructions').style.display = 'none';
    document.getElementById('uidRow').style.display = 'none';
    document.getElementById('payName').innerText = config.name;
    document.getElementById('payNumber').innerText = config.number;
    const label = document.getElementById('payNumberLabel');
    if (label) label.innerText = config.name === 'bKash' ? 'PAYMENT TO THIS NUMBER' : 'SEND MONEY TO THIS NUMBER';
    if (binanceUidGroup) binanceUidGroup.style.display = 'none';
    if (ivePaidBtn) ivePaidBtn.disabled = false;
  } else {
    document.getElementById('mobileInstructions').style.display = 'none';
    document.getElementById('cryptoInstructions').style.display = 'block';
    document.getElementById('uidRow').style.display = 'flex';
    document.getElementById('payUID').innerText = config.uid;
    // Binance — ask for the customer's own UID before letting them continue.
    if (binanceUidGroup) binanceUidGroup.style.display = 'block';
    if (binanceUidInput) binanceUidInput.value = binanceUidValue;
    if (ivePaidBtn) ivePaidBtn.disabled = !(binanceUidValue && binanceUidValue.length >= 4);
  }
}

if (document.getElementById('step1PayBtn')) {
  document.getElementById('step1PayBtn').addEventListener('click', openStep2Instructions);
}

if (document.getElementById('binanceSenderUid')) {
  document.getElementById('binanceSenderUid').addEventListener('input', (e) => {
    binanceUidValue = e.target.value.trim();
    const ivePaidBtn = document.getElementById('ivePaidBtn');
    if (ivePaidBtn) ivePaidBtn.disabled = binanceUidValue.length < 4;
  });
}

if (document.getElementById('copyNumber')) {
  document.getElementById('copyNumber').addEventListener('click', () => navigator.clipboard.writeText(document.getElementById('payNumber').innerText));
}
if (document.getElementById('copyUID')) {
  document.getElementById('copyUID').addEventListener('click', () => navigator.clipboard.writeText(document.getElementById('payUID').innerText));
}
if (document.getElementById('copyAmount')) {
  document.getElementById('copyAmount').addEventListener('click', () => navigator.clipboard.writeText(document.getElementById('payAmountCopy').innerText));
}

if (document.getElementById('backToGrid')) {
  document.getElementById('backToGrid').addEventListener('click', () => {
    document.getElementById('details-panel').style.display = 'none';
    document.getElementById('gateway-overlay').style.display = 'block';
  });
}

/* STEP 2 → STEP 3 — customer confirms they've sent the payment. */
if (document.getElementById('ivePaidBtn')) {
  document.getElementById('ivePaidBtn').addEventListener('click', () => {
    // Paymently: optional manual TrxID path from instructions screen
    document.getElementById('details-panel').style.display = 'none';
    const goBtn = document.getElementById('goToSubmitTrxBtn');
    if (goBtn) goBtn.click();
    else {
      const submitTrxViewEl = document.getElementById('submit-trx-view');
      if (submitTrxViewEl) submitTrxViewEl.style.display = 'block';
    }
  });
}
if (document.getElementById('ivePaidBtnCrypto')) {
  document.getElementById('ivePaidBtnCrypto').addEventListener('click', () => {
    document.getElementById('details-panel').style.display = 'none';
    const submitTrxViewEl = document.getElementById('submit-trx-view');
    if (submitTrxViewEl) submitTrxViewEl.style.display = 'block';
  });
}

/* STEP 3 → STEP 5 — reveal the Transaction ID / Sender Number form. */
if (document.getElementById('goToSubmitTrxBtn')) {
  document.getElementById('goToSubmitTrxBtn').addEventListener('click', () => {
    const waitingViewEl = document.getElementById('waiting-view');
    if (waitingViewEl) waitingViewEl.style.display = 'none';
    const submitTrxViewEl = document.getElementById('submit-trx-view');
    if (!submitTrxViewEl) return;
    submitTrxViewEl.style.display = 'block';

    const config = paymentConfig[selectedMethod] || {};
    const senderLabel = document.getElementById('senderLabel');
    const senderInput = document.getElementById('senderNumber');
    const trxIdGroup = document.getElementById('trxIdGroup');
    const trxIdInput = document.getElementById('trxId');

    const senderGroup = document.getElementById('senderNumberGroup');
    const proofGroup = document.getElementById('proofUploadGroup');
    if (proofGroup) proofGroup.style.display = 'none';
    if (selectedMethod === 'binance') {
      if (senderGroup) senderGroup.style.display = 'block';
      if (senderLabel) senderLabel.innerText = 'Binance UID';
      if (senderInput) {
        senderInput.placeholder = 'Enter your Binance UID';
        senderInput.value = binanceUidValue || '';
        senderInput.removeAttribute('pattern');
        senderInput.setAttribute('inputmode', 'numeric');
      }
      if (trxIdGroup) trxIdGroup.style.display = 'none';
      if (trxIdInput) trxIdInput.removeAttribute('required');
    } else {
      if (senderGroup) senderGroup.style.display = 'none';
      if (senderLabel) senderLabel.innerText = 'Sender Number';
      if (senderInput && window._payerFromNumber) senderInput.value = window._payerFromNumber;
      if (senderInput) {
        senderInput.placeholder = 'e.g. 017XXXXXXXX';
        senderInput.value = '';
        senderInput.setAttribute('pattern', '01[0-9]{9}');
      }
      if (trxIdGroup) trxIdGroup.style.display = 'block';
      if (trxIdInput) trxIdInput.setAttribute('required', '');
    }
  });
}


/** Live delivery timer (starts after provider forward). */
function formatElapsedBn(ms) {
  if (!ms || ms < 0) ms = 0;
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return h + " ঘণ্টা " + m + " মিনিট " + s + " সেকেন্ড";
  if (m > 0) return m + " মিনিট " + s + " সেকেন্ড";
  return s + " সেকেন্ড";
}

let _trackTimerIv = null;
function stopTrackTimer() {
  if (_trackTimerIv) { clearInterval(_trackTimerIv); _trackTimerIv = null; }
}
function startTrackTimer(el, startMs) {
  stopTrackTimer();
  if (!el || !startMs) return;
  const tick = () => {
    el.textContent = formatElapsedBn(Date.now() - startMs);
  };
  tick();
  _trackTimerIv = setInterval(tick, 1000);
}

function buildOrderDetailHTML(data, statusOverride) {
  const status = (statusOverride || data.status || "Pending").toString();
  let color = "#f1c40f";
  let badgeBg = "rgba(241,196,15,0.15)";
  let borderCol = "rgba(241,196,15,0.45)";
  let msg = "পেমেন্ট ভেরিফিকেশন Pending আছে";

  if (status === "Processing") {
    color = "#38bdf8"; badgeBg = "rgba(56,189,248,0.15)"; borderCol = "rgba(56,189,248,0.45)";
    msg = "অর্ডার Processing এ আছে";
  } else if (status === "Completed") {
    color = "#6ee7b7"; badgeBg = "rgba(110,231,183,0.15)"; borderCol = "rgba(110,231,183,0.45)";
    msg = "অর্ডার Completed হয়েছে! 🎉";
  } else if (status === "Rejected") {
    color = "#f87171"; badgeBg = "rgba(248,113,113,0.15)"; borderCol = "rgba(248,113,113,0.45)";
    msg = "অর্ডার Rejected হয়েছে";
  }

  // All values come from the sheet / customer input → always HTML-escaped.
  // Pass raw=true only for markup this function built itself (the link).
  const row = (label, val, raw) => `
    <div class="od-row">
      <span class="od-label">${label}</span>
      <span class="od-value">${raw ? (val || "—") : escapeHtml(val || "—")}</span>
    </div>`;

  const hrefOk = safeHttpUrl(data.link);
  const linkVal = data.link
    ? (hrefOk
        ? `<a href="${escapeHtml(hrefOk)}" target="_blank" rel="noopener noreferrer" style="color:#6ee7b7;word-break:break-all;">${escapeHtml(data.link)}</a>`
        : escapeHtml(data.link))
    : "—";

  const created = data.created_at
    ? new Date(data.created_at).toLocaleString("en-BD", { timeZone: "Asia/Dhaka" })
    : "—";

  let timerRow = "";
  const fwdMs = data.forwarded_at_ms || (data.forwarded_at ? new Date(data.forwarded_at).getTime() : 0);
  const doneMs = data.completed_at ? new Date(data.completed_at).getTime() : 0;
  if (fwdMs && !isNaN(fwdMs)) {
    if (status === "Completed" || status === "Partial") {
      const ms = (doneMs && !isNaN(doneMs) ? doneMs : Date.now()) - fwdMs;
      const label = data.elapsed_label || formatElapsedBn(ms);
      timerRow = row("ডেলিভারি সময়", label + (status === "Completed" ? " (সম্পন্ন)" : " (Partial)"));
    } else if (status === "Processing") {
      timerRow = `
    <div class="od-row od-timer-row">
      <span class="od-label">চলমান সময়</span>
      <span class="od-value od-live-timer" data-start-ms="${fwdMs}" style="color:#38bdf8;font-weight:800;font-variant-numeric:tabular-nums;">${escapeHtml(data.elapsed_label || formatElapsedBn(Date.now() - fwdMs))}</span>
    </div>`;
    }
  }

  return `
    <div class="order-detail-box" style="border-color:${borderCol};">
      <div class="od-status-badge" style="color:${color}; background:${badgeBg}; border-color:${borderCol};">
        ${msg}
      </div>
      <div class="od-status-sub">Status: ${escapeHtml(status)}</div>
      ${row("Order ID", data.order_id)}
      ${row("Service code", data.service_code)}
      ${row("Service name", data.service_name)}
      ${row("Platform", data.platform)}
      ${row("Link", linkVal, true)}
      ${row("Quantity", data.quantity)}
      ${data.start_count !== undefined && data.start_count !== "" ? row("Start Count", data.start_count) : ""}
      ${data.remains !== undefined && data.remains !== "" ? row("Remains", data.remains) : ""}
      ${data.comments ? row("Comments", `<div style="white-space:pre-wrap;max-height:150px;overflow:auto;text-align:left;">${escapeHtml(String(data.comments))}</div>`, true) : ""}
      ${row("Amount", data.amount ? "৳" + data.amount : "—")}
      ${row("Payment Method", data.paid_from || "—")}
      ${row("Txn ID", data.txn_id)}
      ${row("Mobile / WhatsApp", data.whatsapp)}
      ${row("Date / Time", created)}
      ${timerRow}
    </div>`;
}



/** Plain text version for clipboard + WhatsApp */
function buildOrderDetailText(data) {
  const status = (data.status || "Pending").toString();
  const created = data.created_at
    ? new Date(data.created_at).toLocaleString("en-BD", { timeZone: "Asia/Dhaka" })
    : "—";
  return [
    "📌 *boostplus Order Details*",
    "",
    `Order ID: ${data.order_id || "—"}`,
    `Status: ${status}`,
    `Service: ${data.service_name || "—"} (${data.service_code || "—"})`,
    `Platform: ${data.platform || "—"}`,
    `Link: ${data.link || "—"}`,
    `Quantity: ${data.quantity || "—"}`,
    `Amount: ৳${data.amount || "—"}`,
    `Payment Method: ${data.paid_from || "—"}`,
    `TrxID: ${data.txn_id || "—"}`,
    `Mobile: ${data.whatsapp || "—"}`,
    `Date/Time: ${created}`,
    data.note ? `Note: ${data.note}` : ""
  ].filter(Boolean).join("\n");
}

function showPendingStatus(payload) {
  const submitTrxViewEl = document.getElementById('submit-trx-view');
  if (submitTrxViewEl) submitTrxViewEl.style.display = 'none';
  const waitingViewEl = document.getElementById('waiting-view');
  if (waitingViewEl) waitingViewEl.style.display = 'none';
  const successViewEl = document.getElementById('success-view');
  if (successViewEl) successViewEl.style.display = 'none';
  document.getElementById('pending-view').style.display = 'block';
  clearInterval(checkoutExpiryInterval);
  clearTimeout(step3PromptTimeout);
  const box = document.getElementById('pendingDetailBox');
  if (box) box.innerHTML = buildOrderDetailHTML(payload, "Pending");
  startPendingPoll(payload);

  // Ensure action buttons exist
  let actions = document.getElementById('orderDetailActions');
  if (!actions) {
    actions = document.createElement('div');
    actions.id = 'orderDetailActions';
    actions.className = 'order-detail-actions';
    actions.innerHTML = `
      <a id="waSendBtn" class="od-action-btn od-wa-btn" href="#" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        WhatsApp Send
      </a>
      <button type="button" id="copyDetailsBtn" class="od-action-btn od-copy-btn">
        📋 Copy Details
      </button>
    `;
    const container = document.querySelector('#pending-view .gateway-details');
    if (container) {
      // Insert before Track Order button
      const trackBtn = container.querySelector('.track-submit');
      if (trackBtn) container.insertBefore(actions, trackBtn);
      else container.appendChild(actions);
    }
  }

  // Wire Copy button
  const copyBtn = document.getElementById('copyDetailsBtn');
  if (copyBtn) {
    copyBtn.onclick = async () => {
      const text = buildOrderDetailText(payload);
      try {
        await navigator.clipboard.writeText(text);
        const original = copyBtn.innerHTML;
        copyBtn.innerHTML = "✓ Details Copied";
        copyBtn.classList.add("copied");
        setTimeout(() => {
          copyBtn.innerHTML = original;
          copyBtn.classList.remove("copied");
        }, 2000);
      } catch (err) {
        // Fallback
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        copyBtn.innerHTML = "✓ Details Copied";
        setTimeout(() => { copyBtn.innerHTML = "📋 Copy Details"; }, 2000);
      }
    };
  }

  // Wire WhatsApp button (URL-encoded message)
  const waBtn = document.getElementById('waSendBtn');
  if (waBtn) {
    const text = buildOrderDetailText(payload);
    const encoded = encodeURIComponent(text);
    // Opens WhatsApp with pre-filled order details (user chooses contact / self)
    waBtn.href = `https://wa.me/?text=${encoded}`;
  }

  const payDisp = document.getElementById('payAmountDisplay');
  if (payDisp) payDisp.innerText = '0.00';
  localStorage.setItem('lastOrderId', payload.order_id);
  lastSuccessfulOrderId = payload.order_id;
  lastSuccessfulPayload = payload;
}

/** Step 4 — polls the sheet every 10s while on the Payment Pending screen
 *  and automatically moves to the FINAL "Payment Successful" screen once
 *  an admin approves the order (status changes away from Pending). Never
 *  shows Payment Successful before that approval actually happens. */
function startPendingPoll(payload) {
  clearInterval(pendingPollInterval);
  const api = sheetApi();
  if (!api || !payload || !payload.order_id) return;

  pendingPollInterval = setInterval(async () => {
    try {
      const res = await fetch(api + "?order_id=" + encodeURIComponent(payload.order_id));
      const data = await res.json();
      if (data && !data.error && data.status && data.status !== "Pending") {
        clearInterval(pendingPollInterval);
        const merged = Object.assign({}, payload, {
          status: data.status,
          amount: data.amount || payload.amount,
          note: data.note || payload.note
        });
        if (data.status === "Rejected") {
          const box = document.getElementById('pendingDetailBox');
          if (box) box.innerHTML = buildOrderDetailHTML(merged, "Rejected");
        } else {
          showSuccessStatus(merged);
        }
      }
    } catch (err) {
      // Silent — keep polling; network hiccups shouldn't interrupt the wait.
    }
  }, 10000);
}

/** FINAL — Payment Successful. Only reached after the server-side status
 *  actually resolves away from Pending. */
function showSuccessStatus(payload) {
  clearInterval(pendingPollInterval);
  document.getElementById('pending-view').style.display = 'none';
  const successViewEl = document.getElementById('success-view');
  if (!successViewEl) return;
  successViewEl.style.display = 'block';
  const box = document.getElementById('successDetailBox');
  if (box) box.innerHTML = buildOrderDetailHTML(payload, payload.status);
  localStorage.setItem('lastOrderId', payload.order_id);
}

// Pending পেজ থেকে ট্রাক বাটনে ক্লিক করলে
window.goToTrack = function() {
  // Reuse the real Track Order tab so every view is reset consistently
  // (and the sticky navbar's active tab stays in sync).
  const trackTab = document.querySelector('.main-tab[data-view="track-order"]');
  if (trackTab) trackTab.click();
  const idInput = document.getElementById('orderId');
  if (idInput) idInput.value = localStorage.getItem('lastOrderId') || '';
};

if (document.getElementById('checkStatusBtn')) {
  document.getElementById('checkStatusBtn').addEventListener('click', async () => {
    const orderId = (document.getElementById('orderId').value || "").trim();
    const trackResult = document.getElementById('trackResult');
    if (!orderId) {
      trackResult.innerHTML = 'অর্ডার আইডি লিখুন।';
      return;
    }
    trackResult.innerHTML = 'স্ট্যাটাস যাচাই করা হচ্ছে...';

    const api = sheetApi();
    if (!api) {
      trackResult.innerHTML = 'Sheet API সেট করা নেই।';
      return;
    }

    try {
      const response = await fetch(api + "?order_id=" + encodeURIComponent(orderId));
      const data = await response.json();

      if (data.error) {
        trackResult.innerHTML = '<h3 style="color:#f87171; text-align:center;">অর্ডারটি খুঁজে পাওয়া যায়নি!</h3>';
        return;
      }

      const status = (data.status || "Pending").toString();
      stopTrackTimer();
      trackResult.innerHTML = buildOrderDetailHTML({
        order_id: data.order_id || orderId,
        service_code: data.service_code,
        service_name: data.service_name,
        platform: data.platform,
        link: data.link,
        quantity: data.quantity,
        amount: data.amount,
        txn_id: data.txn_id,
        paid_from: data.paid_from,
        forwarded_at: data.forwarded_at,
        completed_at: data.completed_at,
        elapsed_label: data.elapsed_label,
        forwarded_at_ms: data.forwarded_at_ms,
        whatsapp: data.whatsapp,
        note: data.note,
        created_at: data.created_at,
        status: status
      }, status);
      const liveEl = trackResult.querySelector(".od-live-timer");
      if (liveEl) {
        const sm = Number(liveEl.getAttribute("data-start-ms")) || 0;
        if (sm) startTrackTimer(liveEl, sm);
      }
    } catch (error) {
      stopTrackTimer();
      trackResult.innerHTML = 'সার্ভারে সমস্যা হয়েছে, আবার চেষ্টা করুন।';
    }
  });
}