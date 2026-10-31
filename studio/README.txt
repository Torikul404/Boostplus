boostplus সার্ভিস স্টুডিও (আলাদা PWA)
১) service-studio/ ফোল্ডারটা সাইটে নতুন জায়গায় (যেমন /studio/) আপলোড করুন।
২) Apps Script-এ PtServices.gs নতুন ফাইল হিসেবে যোগ করুন।
৩) Code.gs-এর doPost-এ, অন্য অ্যাকশনের আগে, এই লাইন বসান:
     if (String(data.action || "").indexOf("svc_") === 0) return jsonOut_(ptSvcRoute_(data));
৪) Script Properties: USD_BDT_RATE (যেমন 122), PRICING_TIERS_FILE_ID (pricing-tiers.csv-র Drive ID)।
৫) Deploy → নতুন সংস্করণ।
লগইন: অ্যাডমিনের টোকেনই। API key ব্রাউজারে যায় না; প্রভাইডারের নাম লগইনের আগে HTML-এ নেই।
