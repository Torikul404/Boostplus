#!/usr/bin/env python3
"""build-css.py — index.html-এর ১৬টি CSS ফাইল একটি design/site.css-এ জোড়ে (একই ক্রমে)।

ব্যবহার:  python3 build-css.py        (সাইটের রুট ফোল্ডার থেকে)
কখন চালাবেন: নিচের তালিকার যেকোনো ফাইল বদলালে বা নতুন CSS যোগ করলে।
নতুন CSS ফাইল যোগ করতে ORDER তালিকায় ঠিক জায়গায় লিখুন (ক্রমই cascade ঠিক করে)।
তারপর index.html-এ design/site.css?v=... সংখ্যা বদলান, নইলে ব্রাউজার পুরোনো ক্যাশ দেখাবে।
login/speed/refund/terms/privacy পাতা আগের মতো আলাদা ফাইল লোড করে, এগুলো এই বিল্ডে নেই।
শুধু /* ... */ মন্তব্য ও ফাঁকা লাইন বাদ যায়; নিয়ম ও ক্রম অপরিবর্তিত। url() পথ design/ থেকে ঠিক থাকে (../fonts/...)।
"""
import re, sys, os
ORDER = [
    "design/fonts.css", "design/tokens.css", "styles.css", "support.css",
    "design/theme.css", "design/picker.css", "design/home.css", "design/bottomnav.css",
    "design/svclist.css", "design/sidebar.css", "design/account.css",
    "design/orders.css", "design/currency.css", "design/a11y.css",
    "design/topup.css", "design/inline-moved.css",
]
OUT = "design/site.css"
os.chdir(os.path.dirname(os.path.abspath(__file__)))
parts = []
for f in ORDER:
    s = open(f, encoding="utf-8").read()
    if f != "design/fonts.css" and f.startswith("styles") is False and "url(" in s and "data:" not in s:
        print("সতর্কতা: url() আছে, পথ যাচাই করুন:", f, file=sys.stderr)
    s = re.sub(r"/\*.*?\*/", "", s, flags=re.S)
    s = "\n".join(l.rstrip() for l in s.split("\n") if l.strip())
    parts.append(s)
out = "/* design/site.css — স্বয়ংক্রিয়ভাবে বানানো (build-css.py)। হাতে বদলাবেন না; উৎস ফাইল বদলে আবার চালান। */\n" + "\n".join(parts) + "\n"
open(OUT, "w", encoding="utf-8").write(out)
print("লেখা হয়েছে", OUT, len(out.encode("utf-8")), "bytes; উৎস মোট", sum(os.path.getsize(f) for f in ORDER), "bytes")
