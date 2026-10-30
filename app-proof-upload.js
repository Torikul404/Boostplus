/* ==========================================================
   app-proof-upload.js — Payment screenshot handling (preview,
   compression) and the final order submission to the Google Sheet.
   ========================================================== */

/** Read file as raw base64 (no canvas). Used as fallback when compress fails (HEIC, odd MIME, etc.). */
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read_failed"));
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const parts = dataUrl.split(",");
      const base64 = parts[1] || "";
      if (!base64 || base64.length < 100) {
        reject(new Error("empty_result"));
        return;
      }
      // Cap ~2.5MB base64 (~1.8MB binary) so Apps Script POST stays reliable
      if (base64.length > 3.2 * 1024 * 1024) {
        reject(new Error("too_large"));
        return;
      }
      const mimeMatch = /^data:([^;]+);/i.exec(parts[0] || "");
      const mime = (mimeMatch && mimeMatch[1]) || file.type || "image/jpeg";
      resolve({ dataUrl, base64, mime });
    };
    reader.readAsDataURL(file);
  });
}

/** Compress / resize a proof screenshot to JPEG base64 (max ~900px wide).
 *  Falls back to original base64 if canvas/decode fails (common with some gallery apps). */
function compressProofImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("invalid_image"));
      return;
    }
    // Some Android galleries send empty type — still try if name looks like an image
    const type = (file.type || "").toLowerCase();
    const name = (file.name || "").toLowerCase();
    const looksImage =
      type.startsWith("image/") ||
      /\.(jpe?g|png|webp|gif|heic|heif|bmp)$/i.test(name) ||
      !type;
    if (!looksImage) {
      reject(new Error("invalid_image"));
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      reject(new Error("too_large"));
      return;
    }

    const finishFromBitmap = (bitmapOrImg, width, height) => {
      try {
        const maxW = 900;
        let w = width;
        let h = height;
        if (!w || !h) throw new Error("bad_dimensions");
        if (w > maxW) {
          h = Math.round((h * maxW) / w);
          w = maxW;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no_ctx");
        ctx.drawImage(bitmapOrImg, 0, 0, w, h);
        if (bitmapOrImg.close) {
          try { bitmapOrImg.close(); } catch (_) {}
        }
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        const base64 = dataUrl.split(",")[1] || "";
        if (!base64 || base64.length < 100) throw new Error("empty_result");
        resolve({ dataUrl, base64, mime: "image/jpeg" });
      } catch (err) {
        // Canvas path failed — fall back to raw file bytes
        readFileAsBase64(file).then(resolve).catch(reject);
      }
    };

    // Prefer createImageBitmap (more reliable on mobile than Image + data URL)
    if (typeof createImageBitmap === "function") {
      createImageBitmap(file)
        .then((bmp) => finishFromBitmap(bmp, bmp.width, bmp.height))
        .catch(() => {
          // Bitmap failed (e.g. HEIC) — try raw base64 upload
          readFileAsBase64(file).then(resolve).catch(reject);
        });
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      readFileAsBase64(file).then(resolve).catch(reject);
    };
    reader.onload = () => {
      const img = new Image();
      img.onload = () => finishFromBitmap(img, img.naturalWidth || img.width, img.naturalHeight || img.height);
      img.onerror = () => {
        readFileAsBase64(file).then(resolve).catch(reject);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Proof screenshot preview + clear
// NOTE: input must NOT use capture="environment" — that forces camera-only on mobile.
// Hidden file input + custom button lets the OS show Gallery / Files / Camera.
(function setupProofUpload() {
  const input = document.getElementById("proofScreenshot");
  const pickBtn = document.getElementById("proofPickBtn");
  const preview = document.getElementById("proofPreview");
  const previewImg = document.getElementById("proofPreviewImg");
  const removeBtn = document.getElementById("proofRemoveBtn");
  if (!input) return;

  if (pickBtn) {
    pickBtn.addEventListener("click", () => input.click());
  }

  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    if (!file) {
      if (preview) preview.style.display = "none";
      if (pickBtn) pickBtn.classList.remove("has-file");
      return;
    }
    const url = URL.createObjectURL(file);
    if (previewImg) {
      previewImg.src = url;
      previewImg.onload = () => URL.revokeObjectURL(url);
    }
    if (preview) preview.style.display = "inline-block";
    if (pickBtn) {
      pickBtn.classList.add("has-file");
      const label = pickBtn.querySelector("strong");
      if (label) label.textContent = file.name || "স্ক্রিনশট সিলেক্ট করা হয়েছে";
    }
  });

  if (removeBtn) {
    removeBtn.addEventListener("click", () => {
      input.value = "";
      if (previewImg) previewImg.removeAttribute("src");
      if (preview) preview.style.display = "none";
      if (pickBtn) {
        pickBtn.classList.remove("has-file");
        const label = pickBtn.querySelector("strong");
        if (label) label.textContent = "গ্যালারি / ফাইল থেকে বেছে নিন";
      }
    });
  }
})();

if (document.getElementById('finalOrderForm')) {
  document.getElementById('finalOrderForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // ধাপ ৭: সরাসরি TrxID দিয়ে অর্ডার বন্ধ — অর্ডার শুধু ওয়ালেট ব্যালেন্স থেকে (app-wallet.js walletInstantOrder)।
    // ফিরিয়ে আনতে হলে এই ফ্ল্যাগ false করুন (ব্যাকএন্ডও আলাদাভাবে বন্ধ না করা থাকলে)।
    const DIRECT_PAY_DISABLED = true;
    if (DIRECT_PAY_DISABLED) return;

    // Hard guard against multi-click / double submit
    if (orderSubmissionInProgress) {
      return;
    }
    // If we already successfully created an order in this form session, just re-show it
    if (lastSuccessfulOrderId && lastSuccessfulPayload) {
      showPendingStatus(lastSuccessfulPayload);
      return;
    }

    const link = document.getElementById('orderLink').value.trim();
    const qty = document.getElementById('orderQuantity').value;
    let sender = (document.getElementById('senderNumber') && document.getElementById('senderNumber').value.trim()) || '';
    if (!sender && window._payerFromNumber) sender = String(window._payerFromNumber).trim();
    if (document.getElementById('senderNumber') && sender) document.getElementById('senderNumber').value = sender;
    const trxEl = document.getElementById('trxId');
    const trx = (trxEl ? trxEl.value : "").trim();
    const submitBtn = e.target.querySelector('button[type="submit"]');

    if (!selectedPackage) {
      alert("সার্ভিস সিলেক্ট করুন");
      return;
    }

    // Quantity must respect the package's min/max — checked here for instant
    // feedback; the server (Apps Script) re-checks this again independently.
    const qtyNum = Number(qty);
    if (!qty || isNaN(qtyNum) || qtyNum <= 0) {
      alert("সঠিক Quantity দিন।");
      return;
    }
    if (qtyNum < selectedPackage.min || qtyNum > selectedPackage.max) {
      alert(`Quantity অবশ্যই ${selectedPackage.min} থেকে ${selectedPackage.max} এর মধ্যে হতে হবে।`);
      return;
    }

    // Mobile validation — exactly 11 digits
    if (selectedMethod !== "binance") {
      if (!isValidMobile(sender)) {
        alert("মোবাইল নম্বর অবশ্যই ঠিক ১১ ডিজিটের হতে হবে (01XXXXXXXXX)। অক্ষর বা স্পেস গ্রহণযোগ্য নয়।");
        return;
      }
    } else {
      if (!sender || sender.length < 4) {
        alert("সঠিক Binance UID দিন");
        return;
      }
    }

    // TrxID validation
    if (selectedMethod !== "binance") {
      if (!isValidTrxId(trx, selectedMethod)) {
        alert("সঠিক Transaction ID দিন। ভুল ফরম্যাট গ্রহণ করা হবে না।");
        return;
      }
    } else {
      // For Binance, TrxID field may be hidden; still allow optional
      if (trx && !isValidTrxId(trx, "binance")) {
        alert("সঠিক Transaction ID দিন।");
        return;
      }
    }

    // Screenshot optional — payer number already collected; only TrxID required
    const proofInput = document.getElementById("proofScreenshot");
    const proofFile = proofInput && proofInput.files && proofInput.files[0];

    const price = getFinalPrice(selectedPackage);
    const total = ((price * qty) / 1000).toFixed(2);
    const api = sheetApi();

    const orderId = generateOrderId();

    orderSubmissionInProgress = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = "যাচাই হচ্ছে...";
    }

    let proofBase64 = "";
    let proofMime = "image/jpeg";
    if (proofFile) {
      try {
        const compressed = await compressProofImage(proofFile);
        proofBase64 = compressed.base64;
        proofMime = compressed.mime || "image/jpeg";
      } catch (err) {
        console.log("Proof compress error", err);
        // optional — continue without screenshot
      }
    }

    // Local browser-level block first (fast feedback)
    try {
      const used = JSON.parse(localStorage.getItem("usedTxnIds") || "[]");
      if (trx && used.includes(trx.toUpperCase())) {
        alert("এই Transaction ID আগেই ব্যবহার করা হয়েছে। অন্য Txn ID দিন।");
        orderSubmissionInProgress = false;
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = "Submit"; }
        return;
      }
    } catch (_) {}

    // Server-side uniqueness check
    if (api && trx) {
      try {
        const checkRes = await fetch(api + "?check_txn=" + encodeURIComponent(trx));
        const checkData = await checkRes.json();
        if (checkData && checkData.exists) {
          alert("This TrxID has already been used.");
          orderSubmissionInProgress = false;
          if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = "Submit"; }
          return;
        }
      } catch (err) {
        console.log("Txn check error", err);
        // Continue — server will still block on POST via LockService
      }
    }

    const payload = {
      order_id: orderId,
      service_code: selectedPackage.code,
      service_name: selectedPackage.name,
      platform: selectedPackage.platform || "",
      link: link,
      quantity: qty,
      comments: orderComments || "",
      amount: total,
      txn_id: trx || "N/A",
      paid_from: selectedMethod || "",
      whatsapp: sender || "",
      status: "Pending",
      created_at: new Date().toISOString(),
      note: "",
      proof_base64: proofBase64,
      proof_mime: proofMime
    };

    let serverOk = true;
    let serverMsg = "";

    if (api) {
      try {
        // Try with cors first so we can read the response
        const res = await fetch(api, {
          method: "POST",
          mode: "cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload)
        });
        // If CORS allows reading
        try {
          const result = await res.json();
          if (result && result.ok && result.order_id) payload.order_id = String(result.order_id); // server-assigned final ID
          if (result && result.ok === false) {
            serverOk = false;
            serverMsg = result.message || result.error || "Server rejected the order.";
            if (result.error === "txn_used") {
              serverMsg = "This TrxID has already been used.";
            }
          }
        } catch (_) {
          // Response body not readable (common with Apps Script) — assume ok if no network error
        }
      } catch (err) {
        // Fallback to no-cors (fire-and-forget)
        try {
          await fetch(api, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
        } catch (err2) {
          console.log("Sheet save error", err2);
        }
      }
    }

    if (!serverOk) {
      alert(serverMsg || "অর্ডার সাবমিট করা যায়নি। আবার চেষ্টা করুন।");
      orderSubmissionInProgress = false;
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = "Submit"; }
      return;
    }

    // Mark TrxID used locally
    try {
      if (trx) {
        const used = JSON.parse(localStorage.getItem("usedTxnIds") || "[]");
        if (!used.includes(trx.toUpperCase())) {
          used.push(trx.toUpperCase());
          localStorage.setItem("usedTxnIds", JSON.stringify(used.slice(-200)));
        }
      }
    } catch (_) {}

    // Success — show details once. Further VERIFY clicks will re-show same order.
    showPendingStatus(payload);

    // Keep button disabled permanently for this session to prevent new Order IDs
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = "✓ Verified";
    }
    // Do NOT reset orderSubmissionInProgress — keep the guard active
  });
}
