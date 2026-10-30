# FinFlow 💸 - Personal Finance, Liquid Assets & Shared Ledger

> **Smart, Installable PWA for Personal Finance Tracking, Real-time Liquid Money, Debt Ledger, and Group Bill Splitting.**

![FinFlow Logo](./public/icons/logo.svg)

---

## 🌟 Key Features

1. **💧 Real-time Liquid Money Tracking**
   - Distinguish between total net worth and **immediately spendable liquid cash** (Pocket Cash + Checking/Savings accounts).
   - Instant visual health alerts for your liquidity ratio.

2. **💳 Multi-Account & Credit Liability Engine**
   - Support for Bank Accounts, Cash Wallets, Credit Cards (debt liabilities), and Digital UPI Wallets.
   - Live balance adjustment and automated debit/credit synchronization.

3. **📊 Rich Transaction Categorization**
   - **Expense Tracking:** Food & Dining, Fuel & Commute, Groceries, Rent, Utilities, Shopping, Entertainment, Subscriptions, and Charity.
   - **Income & Credits:** Monthly Corporate Salary, Freelance / Gigs, Cashback & Rewards, Investment Returns, Refunds, and Gifts.
   - **Account-to-Account Transfers:** Moving cash to/from ATMs or between bank accounts without distorting monthly expense stats.

4. **🤝 Debt & Loan Ledger ("Money to Give & Money to Get")**
   - **Owed to Me (Receivables):** Keep tabs on friends, loans, and shared bills due back to you.
   - **I Owe (Payables):** Log borrowed amounts and repayment deadlines.
   - **Partial Repayment & Auto-Settlement:** Record partial payments with progress bars and auto-adjust your liquid accounts when settled!

5. **📱 Progressive Web App (PWA) & 100% Offline Capable**
   - Installable with native app icons on **Android**, **iOS**, and **Desktop** (Chrome / Edge / Safari).
   - Works fully offline with service worker caching and local storage persistence.

6. **👥 Group Bill Splitting (Upcoming Multi-User Sync)**
   - Pre-built split calculator with net-debt simplification algorithm (minimizing the number of repayments between groups of friends).

---

## 🚀 Free Hosting on Firebase or GitHub Pages

### Why Firebase Hosting is Best for Google Sign-In
Firebase Hosting provides:
* Free live SSL domain: `https://finflow-f314f.web.app`
* Both `finflow-f314f.web.app` and `finflow-f314f.firebaseapp.com` are **pre-approved by Google** for Google OAuth out-of-the-box!
* Global CDN with zero costs on Firebase Free Spark Plan.

---

## 💻 How to Test Locally Right Now

Browsers do not permit Google Sign-In on `file:///` URLs due to browser security restrictions. You need `http://localhost`.

We included a 1-click local server:
1. Double-click [**`start-server.bat`**](./start-server.bat).
2. It automatically serves FinFlow at **`http://localhost:5000`** and opens your browser.
3. Google Sign-In works **instantly** because `localhost` is authorized by default!

---

## 🌐 Deploy to Firebase Hosting (100% Free)

You already have the Firebase configuration files in this repository:
- `firebase.json`
- `.firebaserc` (project: `finflow-f314f`)

### Option A: Using Firebase CLI
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only hosting
```
Your app will be live at:
**`https://finflow-f314f.web.app`**

### Option B: Automated via GitHub Actions
Push this repository to GitHub. The included workflow `.github/workflows/firebase-hosting.yml` will automatically build and publish to Firebase Hosting!

---

## 📲 How to Install as an App on Mobile

* **On Android (Chrome / Brave / Edge):**
  Open your GitHub Pages URL, tap the **"Install App"** banner at the top, or tap the three dots $\rightarrow$ **"Add to Home screen"** / **"Install app"**.
* **On iOS (Safari):**
  Open the URL in Safari, tap the **Share** button $\rightarrow$ tap **"Add to Home Screen"**.

---

## 📁 Project Structure

```text
finflow/
├── .github/
│   └── workflows/
│       └── deploy.yml      # Automated GitHub Pages Deployment
├── public/
│   └── icons/
│       ├── logo.svg        # Scalable Vector Brand Logo
│       ├── icon-192.png    # PWA Mobile Icon (192x192)
│       └── icon-512.png    # PWA High-Res Icon (512x512)
├── index.html              # Main responsive web application
├── app.js                  # Core reactive financial engine & state store
├── style.css               # Modern glassmorphism & slate styling
├── manifest.json           # Web App Manifest for PWA installation
├── sw.js                   # Service Worker for offline performance
└── README.md
```
