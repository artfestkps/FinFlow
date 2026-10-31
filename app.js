/**
 * FinFlow - Personal Finance, Liquid Assets & Shared Ledger
 * Core Application Engine & Reactive Store
 */

// Storage Keys
const STORAGE_KEY = 'finflow_data_v3';
const SETTINGS_KEY = 'finflow_settings_v1';

// Pre-configured Firebase Web Configuration
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDES1SNammHEE5eCqhCIJAipmb_82XlmDY",
  authDomain: "finflow-f314f.firebaseapp.com",
  projectId: "finflow-f314f",
  storageBucket: "finflow-f314f.firebasestorage.app",
  messagingSenderId: "386604019594",
  appId: "1:386604019594:web:70947bea8472da5fea6273",
  measurementId: "G-210EZMWFSF"
};

// Clean Real-Life Starter Accounts (Zero balances, ready for real tracking)
const DEFAULT_ACCOUNTS = [
  { id: 'acc_1', name: 'Primary Bank Account', type: 'BANK', balance: 0.00, isLiquid: true, icon: 'landmark' },
  { id: 'acc_2', name: 'Cash in Hand', type: 'CASH', balance: 0.00, isLiquid: true, icon: 'banknote' },
  { id: 'acc_3', name: 'UPI / Digital Wallet', type: 'WALLET', balance: 0.00, isLiquid: true, icon: 'smartphone' }
];

// Clean Zero State - No sample transactions or debts
const DEFAULT_TRANSACTIONS = [];

const DEFAULT_MEMBERS = [
  { id: 'm_you', name: 'You (Me)', email: 'you@self.app', isSelf: true }
];

const DEFAULT_SPLITS = [];

const DEFAULT_DEBTS = [];

const DEFAULT_CATEGORIES = {
  EXPENSE: ['Food & Dining', 'Fuel & Commute', 'Groceries', 'Rent & Housing', 'Utilities', 'Shopping', 'Entertainment', 'Healthcare', 'Subscriptions', 'Donation / Charity', 'Miscellaneous'],
  INCOME: ['Salary', 'Freelance / Projects', 'Cashback & Rewards', 'Investments / Dividend', 'Rental Income', 'Gifts', 'Refunds', 'Miscellaneous']
};

class FinFlowApp {
  constructor() {
    this.currentTab = 'dashboard';
    this.debtFilter = 'ALL';
    this.settings = this.loadSettings();
    this.data = this.loadData();
    this.chartInstance = null;
    this.deferredPrompt = null;
    this.currentUser = null;
    this.firestoreRulesValid = null;

    this.init();
  }

  loadSettings() {
    const saved = localStorage.getItem(SETTINGS_KEY);
    let settings = saved ? JSON.parse(saved) : null;
    if (!settings || settings.currency === '$') {
      settings = {
        currency: '₹',
        currencyCode: 'INR',
        theme: 'dark',
        firebaseConfig: null
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
    return settings;
  }

  saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
  }

  loadData() {
    let saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.groupMembers) parsed.groupMembers = DEFAULT_MEMBERS;
        if (!parsed.splits) parsed.splits = DEFAULT_SPLITS;
        if (!parsed.settlements) parsed.settlements = [];
        if (!parsed.debts) parsed.debts = DEFAULT_DEBTS;
        if (!parsed.accounts || parsed.accounts.length === 0) parsed.accounts = DEFAULT_ACCOUNTS;
        if (!parsed.transactions) parsed.transactions = DEFAULT_TRANSACTIONS;
        if (!parsed.categories) parsed.categories = DEFAULT_CATEGORIES;
        return parsed;
      } catch (e) {
        console.error('Failed to parse local data, falling back to defaults', e);
      }
    }

    const initial = {
      accounts: DEFAULT_ACCOUNTS,
      transactions: DEFAULT_TRANSACTIONS,
      debts: DEFAULT_DEBTS,
      groupMembers: DEFAULT_MEMBERS,
      splits: DEFAULT_SPLITS,
      settlements: [],
      categories: DEFAULT_CATEGORIES
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }

  saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    this.render();

    // Automatically backup private personal accounts/debts/tx to Cloud Firestore
    if (this.currentUser && window.firebase) {
      try {
        const db = firebase.firestore();
        db.collection('users').doc(this.currentUser.uid).set(this.data, { merge: true })
          .catch(err => console.warn('Private user data cloud write notice:', err));
      } catch (err) {
        console.warn('Cloud sync error:', err);
      }
    }
  }

  init() {
    this.setupEventListeners();
    this.setupPWA();
    this.initFirebase();
    this.render();
  }

  setupEventListeners() {
    // Navigation Tabs
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // PWA Install Banner trigger
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      const installBtn = document.getElementById('pwa-install-btn');
      if (installBtn) installBtn.classList.remove('hidden');
    });

    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (this.deferredPrompt) {
          this.deferredPrompt.prompt();
          const { outcome } = await this.deferredPrompt.userChoice;
          if (outcome === 'accepted') {
            installBtn.classList.add('hidden');
          }
          this.deferredPrompt = null;
        }
      });
    }

    // Modal Background Close
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeAllModals();
      });
    });
  }

  setupPWA() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('FinFlow Service Worker registered', reg))
        .catch(err => console.warn('Service Worker registration error', err));
    }
  }

  switchTab(tabName) {
    this.currentTab = tabName;
    document.querySelectorAll('.tab-view').forEach(view => view.classList.add('hidden'));
    const target = document.getElementById(`view-${tabName}`);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('[data-tab]').forEach(btn => {
      const active = btn.getAttribute('data-tab') === tabName;
      if (active) {
        btn.classList.add('text-emerald-400', 'bg-slate-800/80', 'font-semibold');
        btn.classList.remove('text-slate-400');
      } else {
        btn.classList.remove('text-emerald-400', 'bg-slate-800/80', 'font-semibold');
        btn.classList.add('text-slate-400');
      }
    });

    this.render();
    if (window.lucide) window.lucide.createIcons();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  formatMoney(amount) {
    const sym = this.settings.currency || '₹';
    const isNegative = amount < 0;
    const locale = sym === '₹' ? 'en-IN' : 'en-US';
    const abs = Math.abs(amount).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return isNegative ? `-${sym}${abs}` : `${sym}${abs}`;
  }

  // Financial Metrics Calculations
  getCalculations() {
    let totalAssets = 0;
    let totalLiabilities = 0;
    let liquidMoney = 0;

    this.data.accounts.forEach(acc => {
      const b = Number(acc.balance) || 0;
      if (b >= 0) {
        totalAssets += b;
      } else {
        totalLiabilities += Math.abs(b);
      }
      if (acc.isLiquid && b > 0) {
        liquidMoney += b;
      }
    });

    const netWorth = totalAssets - totalLiabilities;

    // Debts
    let owedToMe = 0; // Money to get
    let iOwe = 0;     // Money to give

    this.data.debts.forEach(d => {
      if (d.status === 'ACTIVE') {
        const rem = Number(d.remainingAmount) || 0;
        if (d.direction === 'OWED_TO_ME') {
          owedToMe += rem;
        } else {
          iOwe += rem;
        }
      }
    });

    // Monthly Flow (Current Month)
    const currentYearMonth = new Date().toISOString().slice(0, 7);
    let monthIncome = 0;
    let monthExpense = 0;

    this.data.transactions.forEach(t => {
      if (t.date && t.date.startsWith(currentYearMonth)) {
        if (t.type === 'INCOME') monthIncome += Number(t.amount);
        if (t.type === 'EXPENSE') monthExpense += Number(t.amount);
      }
    });

    return {
      netWorth,
      totalAssets,
      totalLiabilities,
      liquidMoney,
      owedToMe,
      iOwe,
      monthIncome,
      monthExpense,
      monthNet: monthIncome - monthExpense
    };
  }

  render() {
    if (this.currentTab === 'dashboard') this.renderDashboard();
    if (this.currentTab === 'accounts') this.renderAccountsView();
    if (this.currentTab === 'transactions') this.renderTransactionsView();
    if (this.currentTab === 'debts') this.renderDebtsView();
    if (this.currentTab === 'split') this.renderSplitView();
    if (this.currentTab === 'settings') this.renderSettingsView();

    if (window.lucide) window.lucide.createIcons();
  }

  renderDashboard() {
    const calc = this.getCalculations();

    const elNetWorth = document.getElementById('dash-networth');
    const elLiquid = document.getElementById('dash-liquid');
    const elOwedToMe = document.getElementById('dash-owed-to-me');
    const elIOwe = document.getElementById('dash-i-owe');
    const elMonthIncome = document.getElementById('dash-month-income');
    const elMonthExpense = document.getElementById('dash-month-expense');

    if (elNetWorth) elNetWorth.textContent = this.formatMoney(calc.netWorth);
    if (elLiquid) elLiquid.textContent = this.formatMoney(calc.liquidMoney);
    if (elOwedToMe) elOwedToMe.textContent = this.formatMoney(calc.owedToMe);
    if (elIOwe) elIOwe.textContent = this.formatMoney(calc.iOwe);
    if (elMonthIncome) elMonthIncome.textContent = this.formatMoney(calc.monthIncome);
    if (elMonthExpense) elMonthExpense.textContent = this.formatMoney(calc.monthExpense);

    // Quick Accounts List
    const accList = document.getElementById('dash-quick-accounts');
    if (accList) {
      accList.innerHTML = this.data.accounts.map(acc => `
        <div class="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:border-emerald-500/30 transition">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center ${acc.isLiquid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400'}">
              <i data-lucide="${acc.icon || 'wallet'}" class="w-5 h-5"></i>
            </div>
            <div>
              <p class="font-medium text-slate-200 text-sm">${acc.name}</p>
              <div class="flex items-center space-x-1.5 mt-0.5">
                <span class="text-xs ${acc.isLiquid ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 bg-slate-700/50'} px-1.5 py-0.5 rounded text-[10px]">
                  ${acc.isLiquid ? '💧 Liquid' : acc.type}
                </span>
              </div>
            </div>
          </div>
          <span class="mono-num font-bold text-base ${acc.balance >= 0 ? 'text-slate-100' : 'text-rose-400'}">
            ${this.formatMoney(acc.balance)}
          </span>
        </div>
      `).join('');
    }

    // Recent Transactions (Strictly newest first)
    const recentTx = document.getElementById('dash-recent-transactions');
    if (recentTx) {
      const sorted = [...this.data.transactions].sort((a, b) => {
        const timeA = a.createdAt ? Number(a.createdAt) : new Date(a.date).getTime();
        const timeB = b.createdAt ? Number(b.createdAt) : new Date(b.date).getTime();
        return timeB - timeA;
      }).slice(0, 5);

      if (sorted.length === 0) {
        recentTx.innerHTML = `<div class="p-6 text-center text-slate-500 text-sm">No transactions logged yet.</div>`;
      } else {
        recentTx.innerHTML = sorted.map(tx => {
          const acc = this.data.accounts.find(a => a.id === tx.accountId);
          const isExpense = tx.type === 'EXPENSE';
          const isIncome = tx.type === 'INCOME';
          return `
            <div class="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/40 hover:border-slate-600 transition">
              <div class="flex items-center space-x-3">
                <div class="w-9 h-9 rounded-lg flex items-center justify-center ${isIncome ? 'bg-emerald-500/15 text-emerald-400' : isExpense ? 'bg-rose-500/15 text-rose-400' : 'bg-blue-500/15 text-blue-400'}">
                  <i data-lucide="${isIncome ? 'arrow-down-left' : isExpense ? 'arrow-up-right' : 'repeat'}" class="w-4 h-4"></i>
                </div>
                <div>
                  <p class="font-medium text-slate-200 text-sm">${tx.category}</p>
                  <p class="text-xs text-slate-400">${tx.notes || (acc ? acc.name : 'Unknown Account')} • ${tx.date}</p>
                </div>
              </div>
              <span class="mono-num font-bold text-base ${isIncome ? 'text-emerald-400' : isExpense ? 'text-rose-400' : 'text-blue-400'}">
                ${isIncome ? '+' : isExpense ? '-' : ''}${this.formatMoney(tx.amount)}
              </span>
            </div>
          `;
        }).join('');
      }
    }

    this.renderCharts();
  }

  renderCharts() {
    const expenseCtx = document.getElementById('expenseChart');
    if (expenseCtx && window.Chart) {
      const categoryMap = {};
      this.data.transactions.forEach(t => {
        if (t.type === 'EXPENSE') {
          categoryMap[t.category] = (categoryMap[t.category] || 0) + Number(t.amount);
        }
      });

      const labels = Object.keys(categoryMap);
      const data = Object.values(categoryMap);

      if (this.chartInstance) {
        this.chartInstance.destroy();
      }

      if (labels.length > 0) {
        this.chartInstance = new Chart(expenseCtx, {
          type: 'doughnut',
          data: {
            labels: labels,
            datasets: [{
              data: data,
              backgroundColor: [
                '#10B981', '#6366F1', '#F59E0B', '#F43F5E',
                '#06B6D4', '#8B5CF6', '#EC4899', '#3B82F6'
              ],
              borderColor: '#0F172A',
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'right',
                labels: { color: '#94A3B8', boxWidth: 12, font: { family: 'Plus Jakarta Sans', size: 11 } }
              }
            },
            cutout: '68%'
          }
        });
      }
    }
  }

  // --- ACCOUNTS VIEW ---
  renderAccountsView() {
    const container = document.getElementById('accounts-list');
    if (!container) return;

    container.innerHTML = this.data.accounts.map(acc => `
      <div class="glass-panel glass-panel-hover p-5 rounded-2xl relative overflow-hidden group">
        <div class="flex items-start justify-between">
          <div class="flex items-center space-x-3.5">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center ${acc.isLiquid ? 'bg-emerald-500/15 text-emerald-400' : 'bg-indigo-500/15 text-indigo-400'}">
              <i data-lucide="${acc.icon || 'landmark'}" class="w-6 h-6"></i>
            </div>
            <div>
              <h4 class="font-bold text-slate-100 text-base">${acc.name}</h4>
              <div class="flex items-center space-x-2 mt-1">
                <span class="text-xs px-2 py-0.5 rounded-full font-medium ${acc.isLiquid ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'}">
                  ${acc.isLiquid ? '💧 Liquid Cash' : acc.type}
                </span>
                <span class="text-xs text-slate-400">${acc.type}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center space-x-1 opacity-80 group-hover:opacity-100">
            <button onclick="app.deleteAccount('${acc.id}')" class="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition" title="Delete Account">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <div class="mt-6 pt-4 border-t border-slate-700/50 flex items-end justify-between">
          <div>
            <p class="text-xs text-slate-400">Current Balance</p>
            <p class="mono-num text-2xl font-bold mt-0.5 ${acc.balance >= 0 ? 'text-slate-100' : 'text-rose-400'}">
              ${this.formatMoney(acc.balance)}
            </p>
          </div>
          <button onclick="app.openQuickAdjustModal('${acc.id}')" class="text-xs text-emerald-400 hover:underline flex items-center space-x-1">
            <span>Adjust</span>
            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  // --- TRANSACTIONS VIEW ---
  renderTransactionsView() {
    const list = document.getElementById('transactions-full-list');
    if (!list) return;

    const filterType = document.getElementById('tx-filter-type')?.value || 'ALL';
    const searchQuery = document.getElementById('tx-search-input')?.value?.toLowerCase() || '';

    // Strictly newest first (highest timestamp at top)
    let filtered = [...this.data.transactions].sort((a, b) => {
      const timeA = a.createdAt ? Number(a.createdAt) : new Date(a.date).getTime();
      const timeB = b.createdAt ? Number(b.createdAt) : new Date(b.date).getTime();
      return timeB - timeA;
    });

    if (filterType !== 'ALL') {
      filtered = filtered.filter(t => t.type === filterType);
    }
    if (searchQuery) {
      filtered = filtered.filter(t => 
        (t.category && t.category.toLowerCase().includes(searchQuery)) ||
        (t.notes && t.notes.toLowerCase().includes(searchQuery))
      );
    }

    if (filtered.length === 0) {
      list.innerHTML = `
        <div class="p-12 text-center text-slate-500">
          <i data-lucide="inbox" class="w-10 h-10 mx-auto mb-2 opacity-50"></i>
          <p class="text-sm">No transactions match your filter.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = filtered.map(tx => {
      const acc = this.data.accounts.find(a => a.id === tx.accountId);
      const toAcc = tx.toAccountId ? this.data.accounts.find(a => a.id === tx.toAccountId) : null;
      const isExpense = tx.type === 'EXPENSE';
      const isIncome = tx.type === 'INCOME';

      return `
        <div class="flex items-center justify-between p-4 rounded-xl bg-slate-800/40 border border-slate-700/40 hover:border-slate-600 transition">
          <div class="flex items-center space-x-3.5">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center ${isIncome ? 'bg-emerald-500/15 text-emerald-400' : isExpense ? 'bg-rose-500/15 text-rose-400' : 'bg-blue-500/15 text-blue-400'}">
              <i data-lucide="${isIncome ? 'arrow-down-left' : isExpense ? 'arrow-up-right' : 'repeat'}" class="w-5 h-5"></i>
            </div>
            <div>
              <div class="flex items-center space-x-2">
                <span class="font-semibold text-slate-100 text-sm">${tx.category}</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded font-medium ${isIncome ? 'bg-emerald-500/20 text-emerald-400' : isExpense ? 'bg-rose-500/20 text-rose-400' : 'bg-blue-500/20 text-blue-400'}">
                  ${tx.type}
                </span>
              </div>
              <p class="text-xs text-slate-400 mt-0.5">
                ${acc ? acc.name : 'Unknown Account'} ${toAcc ? `➔ ${toAcc.name}` : ''} • ${tx.date}
                ${tx.notes ? ` • <span class="italic text-slate-300">"${tx.notes}"</span>` : ''}
              </p>
            </div>
          </div>
          <div class="flex items-center space-x-3">
            <span class="mono-num font-bold text-base ${isIncome ? 'text-emerald-400' : isExpense ? 'text-rose-400' : 'text-blue-400'}">
              ${isIncome ? '+' : isExpense ? '-' : ''}${this.formatMoney(tx.amount)}
            </span>
            <button onclick="app.deleteTransaction('${tx.id}')" class="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg transition" title="Delete">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // --- DEBTS & LOANS VIEW ---
  setDebtFilter(filter) {
    this.debtFilter = filter;
    ['ALL', 'PERSONAL', 'SPLIT'].forEach(f => {
      const btn = document.getElementById(`debt-filter-btn-${f}`);
      if (btn) {
        if (f === filter) {
          btn.className = 'flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
        } else {
          btn.className = 'flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-400 hover:text-white transition';
        }
      }
    });
    this.renderDebtsView();
    if (window.lucide) window.lucide.createIcons();
  }

  renderDebtsView() {
    const listOwedToMe = document.getElementById('debts-owed-to-me');
    const listIOwe = document.getElementById('debts-i-owe');
    if (!listOwedToMe || !listIOwe) return;

    let owedToMe = this.data.debts.filter(d => d.direction === 'OWED_TO_ME');
    let iOwe = this.data.debts.filter(d => d.direction === 'I_OWE');

    if (this.debtFilter === 'PERSONAL') {
      owedToMe = owedToMe.filter(d => !d.isSplit);
      iOwe = iOwe.filter(d => !d.isSplit);
    } else if (this.debtFilter === 'SPLIT') {
      owedToMe = owedToMe.filter(d => d.isSplit);
      iOwe = iOwe.filter(d => d.isSplit);
    }

    // Render "Owed to Me" (Receivables)
    if (owedToMe.length === 0) {
      listOwedToMe.innerHTML = `<div class="p-6 text-center text-slate-500 text-sm">No debts in this category currently.</div>`;
    } else {
      listOwedToMe.innerHTML = owedToMe.map(debt => this.renderDebtCard(debt)).join('');
    }

    // Render "I Owe" (Payables)
    if (iOwe.length === 0) {
      listIOwe.innerHTML = `<div class="p-6 text-center text-slate-500 text-sm">You are completely debt free here! Great job.</div>`;
    } else {
      listIOwe.innerHTML = iOwe.map(debt => this.renderDebtCard(debt)).join('');
    }
  }

  renderDebtCard(debt) {
    const isSettled = debt.status === 'SETTLED' || debt.remainingAmount <= 0;
    const progress = Math.min(100, Math.round(((debt.paidAmount || 0) / debt.totalAmount) * 100));
    const isSplit = Boolean(debt.isSplit);

    // Permission Rule:
    // If it's a split debt and you owe money (I_OWE), YOU cannot mark it settled! Only the person who paid can mark it paid.
    const canSettle = !isSplit || (debt.direction === 'OWED_TO_ME');

    return `
      <div class="glass-panel p-5 rounded-2xl relative border ${isSettled ? 'border-slate-800 opacity-60' : 'border-slate-700/60'}">
        <div class="flex items-start justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center ${debt.direction === 'OWED_TO_ME' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}">
              <i data-lucide="${debt.direction === 'OWED_TO_ME' ? 'hand-coins' : 'receipt'}" class="w-5 h-5"></i>
            </div>
            <div>
              <div class="flex items-center space-x-2">
                <h4 class="font-bold text-slate-100 text-base">${debt.personName}</h4>
                <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold ${isSettled ? 'bg-slate-700 text-slate-300' : debt.direction === 'OWED_TO_ME' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}">
                  ${isSettled ? 'SETTLED' : debt.direction === 'OWED_TO_ME' ? 'GET BACK' : 'TO GIVE'}
                </span>
                ${isSplit ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">SPLIT</span>` : ''}
              </div>
              <p class="text-xs text-slate-400 mt-0.5">${debt.reason || 'Personal debt'}</p>
            </div>
          </div>
          <button onclick="app.deleteDebt('${debt.id}')" class="text-slate-500 hover:text-rose-400 p-1.5 transition">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>

        <div class="mt-4 flex items-baseline justify-between">
          <div>
            <p class="text-xs text-slate-400">Remaining Balance</p>
            <p class="mono-num text-2xl font-extrabold ${debt.direction === 'OWED_TO_ME' ? 'text-emerald-400' : 'text-rose-400'}">
              ${this.formatMoney(debt.remainingAmount)}
            </p>
          </div>
          <div class="text-right">
            <p class="text-xs text-slate-400">Total Borrowed</p>
            <p class="mono-num text-sm text-slate-300">${this.formatMoney(debt.totalAmount)}</p>
          </div>
        </div>

        <!-- Progress Bar for Partial Payments -->
        <div class="mt-3">
          <div class="flex justify-between text-[11px] text-slate-400 mb-1">
            <span>Repaid: ${this.formatMoney(debt.paidAmount || 0)} (${progress}%)</span>
            <span>Due: ${debt.dueDate || 'No date'}</span>
          </div>
          <div class="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div class="h-full ${debt.direction === 'OWED_TO_ME' ? 'bg-emerald-400' : 'bg-rose-400'}" style="width: ${progress}%"></div>
          </div>
        </div>

        ${!isSettled ? (canSettle ? `
          <div class="mt-4 pt-3 border-t border-slate-700/50 flex space-x-2">
            <button onclick="app.openSettleModal('${debt.id}')" class="flex-1 py-2 px-3 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 font-semibold text-xs flex items-center justify-center space-x-1.5 transition">
              <i data-lucide="check-circle-2" class="w-4 h-4"></i>
              <span>${debt.direction === 'OWED_TO_ME' ? 'Mark as Paid / Received' : 'Record Payment Made'}</span>
            </button>
          </div>
        ` : `
          <div class="mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-between text-xs text-amber-400/90 bg-amber-500/10 px-3 py-2 rounded-xl border border-amber-500/20">
            <span class="flex items-center space-x-1.5 font-medium">
              <i data-lucide="lock" class="w-3.5 h-3.5"></i>
              <span>From Split: Only <strong>${debt.personName}</strong> can mark this as settled</span>
            </span>
          </div>
        `) : ''}
      </div>
    `;
  }

  // --- SPLIT VIEW & NET SETTLEMENT ENGINE ---
  calculateGroupNetBalances() {
    const members = this.data.groupMembers || [];
    const splits = this.data.splits || [];
    const settlements = this.data.settlements || [];
    const myMember = members.find(m => m.isSelf || (this.currentUser && m.email && m.email.toLowerCase() === this.currentUser.email.toLowerCase())) || members[0];
    const myId = myMember ? myMember.id : 'm_you';

    // Directed matrix: matrix[A][B] = how much A owes B
    const matrix = {};
    members.forEach(m1 => {
      matrix[m1.id] = {};
      members.forEach(m2 => {
        matrix[m1.id][m2.id] = 0;
      });
    });

    // 1. Accumulate split debts
    splits.forEach(sp => {
      const payerId = sp.paidById;
      const included = sp.includedMemberIds || [];
      const share = Number(sp.perPersonShare) || 0;

      included.forEach(memId => {
        if (memId !== payerId && matrix[memId] && matrix[memId][payerId] !== undefined) {
          matrix[memId][payerId] += share;
        }
      });
    });

    // 2. Subtract settlements (direct payments made)
    settlements.forEach(st => {
      const fromId = st.fromMemberId;
      const toId = st.toMemberId;
      const amount = Number(st.amount) || 0;
      if (matrix[fromId] && matrix[fromId][toId] !== undefined) {
        matrix[fromId][toId] -= amount;
      }
    });

    // 3. Pairwise Netting (canceling out mutual balances)
    const pairwiseNet = [];
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const m1 = members[i];
        const m2 = members[j];
        const m1OwesM2 = matrix[m1.id][m2.id] || 0;
        const m2OwesM1 = matrix[m2.id][m1.id] || 0;
        const net = Number((m1OwesM2 - m2OwesM1).toFixed(2));

        if (net > 0.009) {
          pairwiseNet.push({
            debtor: m1,
            creditor: m2,
            amount: net,
            isYouDebtor: (m1.id === myId),
            isYouCreditor: (m2.id === myId)
          });
        } else if (net < -0.009) {
          pairwiseNet.push({
            debtor: m2,
            creditor: m1,
            amount: Math.abs(net),
            isYouDebtor: (m2.id === myId),
            isYouCreditor: (m1.id === myId)
          });
        }
      }
    }

    return { pairwiseNet, myId, myMember };
  }

  settleGroupNet(debtorId, creditorId, amount, debtorName) {
    if (!confirm(`Confirm that ${debtorName} has paid you ${this.formatMoney(amount)}? This will settle their balance in the group.`)) return;

    const settlementId = 'set_' + Date.now();
    const settlement = {
      id: settlementId,
      fromMemberId: debtorId,   // who paid
      toMemberId: creditorId,   // who received (the payer who clicks this button)
      amount: Number(amount),
      date: new Date().toISOString().split('T')[0],
      settledByName: (this.data.groupMembers.find(m => m.id === creditorId) || {}).name || 'You',
      createdAt: Date.now()
    };

    if (!this.data.settlements) this.data.settlements = [];
    this.data.settlements.push(settlement);

    // Mark ALL split debts between these two people as SETTLED in local Debt ledger
    this.data.debts.forEach(d => {
      if (d.isSplit) {
        const isBetween =
          (d.direction === 'OWED_TO_ME' && (d.personId === debtorId || d.personName.toLowerCase().includes(debtorName.toLowerCase()))) ||
          (d.direction === 'I_OWE'      && d.personId === creditorId);
        if (isBetween) {
          d.status = 'SETTLED';
          d.remainingAmount = 0.00;
          d.paidAmount = d.totalAmount;
        }
      }
    });

    this.saveData();
    this.render();

    // Write to Firestore shared settlements subcollection!
    if (this.currentUser && window.firebase) {
      try {
        const db = firebase.firestore();
        db.collection('shared_groups').doc('default_group').collection('settlements').doc(settlementId).set(settlement)
          .catch(err => this.handleFirestoreError(err));
      } catch (err) {
        this.handleFirestoreError(err);
      }
    }

    this.showToast(`✅ Marked ${debtorName}'s balance as settled! Their app will update automatically.`, 'success');
  }

  renderSplitView() {
    const list = document.getElementById('splits-history-list');
    const membersBadge = document.getElementById('split-members-count');
    const chipsContainer = document.getElementById('split-members-chips');
    const netContainer = document.getElementById('split-net-balances-container');

    // Update Firestore rules sync banner
    if (this.firestoreRulesValid !== null) {
      this.renderFirestoreAlert(!this.firestoreRulesValid);
    }

    const members = this.data.groupMembers || [];
    if (membersBadge) membersBadge.textContent = `${members.length} Members`;

    // Render member chips preview
    if (chipsContainer) {
      chipsContainer.innerHTML = members.map(m => `
        <span class="text-xs px-2.5 py-1 rounded-xl bg-slate-800 text-slate-300 border border-slate-700/70 flex items-center space-x-1.5 font-medium">
          <i data-lucide="${m.isSelf ? 'user' : 'user-check'}" class="w-3.5 h-3.5 ${m.isSelf ? 'text-emerald-400' : 'text-indigo-400'}"></i>
          <span>${m.name} ${m.isSelf ? '(You)' : ''}</span>
          ${m.email ? `<span class="text-[10px] text-slate-500 hidden sm:inline">(${m.email})</span>` : ''}
        </span>
      `).join('');
    }

    // Render Net Balances (Who Owes Whom Table/Cards)
    if (netContainer) {
      const { pairwiseNet } = this.calculateGroupNetBalances();

      if (pairwiseNet.length === 0) {
        netContainer.innerHTML = `
          <div class="glass-panel p-5 rounded-2xl text-center border border-emerald-500/20 bg-emerald-500/5">
            <div class="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2">
              <i data-lucide="check-check" class="w-5 h-5"></i>
            </div>
            <p class="font-bold text-slate-100 text-sm">All Group Balances Are Settled!</p>
            <p class="text-xs text-slate-400 mt-1">Everyone is squared away. No one owes money to anyone in this group.</p>
          </div>
        `;
      } else {
        netContainer.innerHTML = pairwiseNet.map(item => {
          if (item.isYouCreditor) {
            // Case 1: Someone owes YOU money (You are the creditor and CAN mark paid!)
            return `
              <div class="glass-panel p-4 sm:p-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="flex items-center space-x-3">
                  <div class="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <i data-lucide="arrow-down-left" class="w-5 h-5"></i>
                  </div>
                  <div>
                    <div class="flex items-center space-x-2">
                      <span class="font-bold text-slate-100 text-sm sm:text-base">${item.debtor.name}</span>
                      <span class="text-xs text-emerald-400 font-semibold">owes you</span>
                    </div>
                    <p class="mono-num font-black text-xl text-emerald-400">${this.formatMoney(item.amount)}</p>
                  </div>
                </div>

                <button onclick="app.settleGroupNet('${item.debtor.id}', '${item.creditor.id}', ${item.amount}, '${item.debtor.name}')" 
                  class="py-2 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center space-x-1.5 shadow-lg shadow-emerald-500/20 transition active:scale-95">
                  <i data-lucide="check" class="w-4 h-4 stroke-[3]"></i>
                  <span>Mark as Paid</span>
                </button>
              </div>
            `;
          } else if (item.isYouDebtor) {
            // Case 2: YOU owe someone money (You are the debtor - LOCKED, only creditor can confirm)
            return `
              <div class="glass-panel p-4 sm:p-5 rounded-2xl border border-rose-500/30 bg-rose-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="flex items-center space-x-3">
                  <div class="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                    <i data-lucide="arrow-up-right" class="w-5 h-5"></i>
                  </div>
                  <div>
                    <div class="flex items-center space-x-2">
                      <span class="text-xs text-rose-300 font-semibold">You owe</span>
                      <span class="font-bold text-slate-100 text-sm sm:text-base">${item.creditor.name}</span>
                    </div>
                    <p class="mono-num font-black text-xl text-rose-400">${this.formatMoney(item.amount)}</p>
                  </div>
                </div>

                <div class="text-xs text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20 flex items-center space-x-1 font-medium">
                  <i data-lucide="clock" class="w-3.5 h-3.5"></i>
                  <span>Waiting for ${item.creditor.name} to confirm payment</span>
                </div>
              </div>
            `;
          } else {
            // Case 3: Balance between other two members
            return `
              <div class="glass-panel p-3.5 sm:p-4 rounded-2xl border border-slate-700/60 bg-slate-800/30 flex items-center justify-between text-xs sm:text-sm">
                <div class="flex items-center space-x-2">
                  <span class="font-semibold text-slate-200">${item.debtor.name}</span>
                  <span class="text-slate-400">owes</span>
                  <span class="font-semibold text-slate-200">${item.creditor.name}</span>
                </div>
                <span class="mono-num font-bold text-indigo-300 text-sm sm:text-base">${this.formatMoney(item.amount)}</span>
              </div>
            `;
          }
        }).join('');
      }
    }

    // Render Split History List
    if (!list) return;

    if (!this.data.splits || this.data.splits.length === 0) {
      list.innerHTML = `
        <div class="p-10 text-center text-slate-500 border border-dashed border-slate-700 rounded-2xl">
          <i data-lucide="receipt" class="w-10 h-10 mx-auto mb-2 opacity-40 text-indigo-400"></i>
          <p class="text-sm font-semibold text-slate-300">No split transactions recorded yet</p>
          <p class="text-xs text-slate-500 mt-0.5">Tap the "+ Record New Split" button to split dinner, petrol, or groceries!</p>
        </div>
      `;
      return;
    }

    list.innerHTML = this.data.splits.map(sp => {
      const isPaidByMe = sp.paidById === 'm_you' || sp.paidBy.includes('You');
      const includedNames = (sp.includedMemberIds || []).map(id => {
        const m = this.data.groupMembers.find(mem => mem.id === id);
        return m ? m.name : id;
      });

      return `
        <div class="glass-panel p-4 sm:p-5 rounded-2xl border border-slate-700/70 hover:border-indigo-500/40 transition relative group">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div class="flex items-center space-x-2">
                <h4 class="font-bold text-slate-100 text-base sm:text-lg">${sp.title}</h4>
                <span class="text-xs px-2.5 py-0.5 rounded-full font-bold ${isPaidByMe ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'}">
                  ${isPaidByMe ? '✓ Paid by You' : `Paid by ${sp.paidBy}`}
                </span>
              </div>
              <p class="text-xs text-slate-400 mt-1">${sp.category || 'General Expense'} • ${sp.date}</p>
            </div>
            
            <div class="flex items-center space-x-4">
              <div class="text-right">
                <span class="text-xs text-slate-400">Total Bill</span>
                <p class="mono-num text-xl sm:text-2xl font-black text-white">${this.formatMoney(sp.totalAmount)}</p>
              </div>
              <button onclick="app.deleteSplit('${sp.id}')" class="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition" title="Delete Split">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </div>

          <!-- Included Members Chips -->
          <div class="mt-3.5 pt-3 border-t border-slate-700/50">
            <span class="text-xs font-semibold text-slate-400">Split between (${includedNames.length}):</span>
            <div class="flex flex-wrap gap-1.5 mt-1.5">
              ${includedNames.map(name => `
                <span class="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700/60 font-medium flex items-center space-x-1">
                  <span>${name}</span>
                  <span class="text-emerald-400 font-semibold mono-num ml-1">${this.formatMoney(sp.perPersonShare)}</span>
                </span>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // --- ACTIONS & MODAL CONTROLLERS ---

  // 1. TRANSACTION LOGGING
  openAddTransactionModal(type = 'EXPENSE') {
    const modal = document.getElementById('modal-transaction');
    const selectAcc = document.getElementById('tx-account-select');
    const selectToAcc = document.getElementById('tx-to-account-select');
    const typeSelect = document.getElementById('tx-type');
    const amountInput = document.getElementById('tx-amount');
    const notesInput = document.getElementById('tx-notes');
    const dateInput = document.getElementById('tx-date');

    if (typeSelect) typeSelect.value = type;
    if (amountInput) amountInput.value = '';
    if (notesInput) notesInput.value = '';
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    // Populate Accounts
    if (selectAcc) {
      selectAcc.innerHTML = this.data.accounts.map(a => 
        `<option value="${a.id}">${a.name} (${this.formatMoney(a.balance)})</option>`
      ).join('');
    }
    if (selectToAcc) {
      selectToAcc.innerHTML = this.data.accounts.map(a => 
        `<option value="${a.id}">${a.name} (${this.formatMoney(a.balance)})</option>`
      ).join('');
    }

    this.updateCategoryOptions(type);
    this.toggleTransferField(type === 'TRANSFER');

    if (modal) modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  updateCategoryOptions(type) {
    const selectCat = document.getElementById('tx-category-select');
    if (!selectCat) return;
    const cats = this.data.categories[type] || this.data.categories.EXPENSE;
    selectCat.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  toggleTransferField(isTransfer) {
    const group = document.getElementById('tx-to-account-group');
    if (group) {
      if (isTransfer) group.classList.remove('hidden');
      else group.classList.add('hidden');
    }
  }

  saveTransactionFromForm(e) {
    e.preventDefault();
    const type = document.getElementById('tx-type').value;
    const rawAmount = document.getElementById('tx-amount').value;
    const amount = Math.abs(parseFloat(rawAmount));
    const category = document.getElementById('tx-category-select').value;
    const accountId = document.getElementById('tx-account-select').value;
    const toAccountId = document.getElementById('tx-to-account-select').value;
    const notes = document.getElementById('tx-notes').value;
    const dateInput = document.getElementById('tx-date').value;
    const date = dateInput || new Date().toISOString().split('T')[0];

    if (!amount || isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    if (!accountId) {
      alert('Please select an account.');
      return;
    }

    const tx = {
      id: 'tx_' + Date.now(),
      type,
      amount,
      category,
      accountId,
      toAccountId: type === 'TRANSFER' ? toAccountId : null,
      notes,
      date,
      createdAt: Date.now()
    };

    // Update Account Balances cleanly with explicit Number conversion
    const sourceAcc = this.data.accounts.find(a => a.id === accountId);
    if (sourceAcc) {
      const curBal = Number(sourceAcc.balance) || 0;
      if (type === 'EXPENSE') sourceAcc.balance = curBal - amount;
      if (type === 'INCOME') sourceAcc.balance = curBal + amount;
      if (type === 'TRANSFER') {
        sourceAcc.balance = curBal - amount;
        const targetAcc = this.data.accounts.find(a => a.id === toAccountId);
        if (targetAcc) {
          targetAcc.balance = (Number(targetAcc.balance) || 0) + amount;
        }
      }
    }

    // Newest is unshifted directly to the top
    this.data.transactions.unshift(tx);
    this.saveData();
    this.closeAllModals();
  }

  deleteTransaction(id) {
    const tx = this.data.transactions.find(t => t.id === id);
    if (!tx) return;

    // If this transaction was generated by a split, ask user to cancel the entire split cleanly!
    if (tx.splitId) {
      const sp = this.data.splits.find(s => s.id === tx.splitId);
      if (sp) {
        if (confirm(`This transaction was created from group split "${sp.title}".\n\nDeleting it will cancel the entire split, refund the full bill (${this.formatMoney(sp.totalAmount)}) back to your account, and clear all related debts.\n\nProceed?`)) {
          this.deleteSplit(sp.id);
          return;
        } else {
          return;
        }
      }
    }

    if (!confirm('Delete this transaction? The account balance will be fully reversed.')) return;

    // ── Reverse the account balance impact ──────────────────────────────────
    const sourceAcc = this.data.accounts.find(a => a.id === tx.accountId);
    if (sourceAcc) {
      const amount = Number(tx.amount) || 0;
      const curBal = Number(sourceAcc.balance) || 0;
      if (tx.type === 'EXPENSE') {
        // Was subtracted → add back
        sourceAcc.balance = Number((curBal + amount).toFixed(2));
      } else if (tx.type === 'INCOME') {
        // Was added → subtract back
        sourceAcc.balance = Number((curBal - amount).toFixed(2));
      } else if (tx.type === 'TRANSFER') {
        // Source lost money → give it back
        sourceAcc.balance = Number((curBal + amount).toFixed(2));
        // Destination gained money → take it back
        const targetAcc = this.data.accounts.find(a => a.id === tx.toAccountId);
        if (targetAcc) {
          targetAcc.balance = Number(((Number(targetAcc.balance) || 0) - amount).toFixed(2));
        }
      }
    }

    this.data.transactions = this.data.transactions.filter(t => t.id !== id);
    this.saveData();
    this.showToast('Transaction deleted & account balance reversed ✓', 'success');
  }

  // 2. GROUP SPLIT ENGINE
  openAddSplitModal() {
    const modal = document.getElementById('modal-split');
    const payerSelect = document.getElementById('split-payer-select');
    const accSelect = document.getElementById('split-account-select');
    const membersContainer = document.getElementById('split-members-checklist');
    const totalInput = document.getElementById('split-total-input');
    const titleInput = document.getElementById('split-title-input');

    if (totalInput) totalInput.value = '';
    if (titleInput) titleInput.value = '';

    // Populate Payers
    if (payerSelect) {
      payerSelect.innerHTML = this.data.groupMembers.map(m => 
        `<option value="${m.id}">${m.name} ${m.isSelf ? '(You)' : ''}</option>`
      ).join('');
      payerSelect.value = 'm_you';
    }

    // Populate Accounts for "You"
    if (accSelect) {
      accSelect.innerHTML = this.data.accounts.map(a => 
        `<option value="${a.id}">${a.name} (${this.formatMoney(a.balance)})</option>`
      ).join('');
    }

    // Populate Member Checkboxes
    if (membersContainer) {
      membersContainer.innerHTML = this.data.groupMembers.map(m => `
        <label class="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 hover:border-indigo-500/40 cursor-pointer transition">
          <div class="flex items-center space-x-2.5">
            <input type="checkbox" name="split-member" value="${m.id}" checked onchange="app.recalculateSplitPreview()" class="w-4 h-4 text-emerald-500 rounded bg-slate-900 border-slate-700">
            <span class="text-sm font-semibold text-slate-200">${m.name}</span>
          </div>
          <span class="text-xs text-slate-400">${m.email || ''}</span>
        </label>
      `).join('');
    }

    this.recalculateSplitPreview();
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  toggleSplitAccountRow(payerId) {
    const row = document.getElementById('split-account-row');
    if (row) {
      if (payerId === 'm_you') row.classList.remove('hidden');
      else row.classList.add('hidden');
    }
  }

  recalculateSplitPreview() {
    const total = Math.abs(parseFloat(document.getElementById('split-total-input')?.value)) || 0;
    const checked = Array.from(document.querySelectorAll('input[name="split-member"]:checked'));
    const count = checked.length;
    const previewText = document.getElementById('split-calc-preview');

    if (previewText) {
      if (count === 0 || total === 0) {
        previewText.textContent = 'Enter bill amount & select members';
      } else {
        const perPerson = (total / count);
        previewText.textContent = `${count} members included ➔ ${this.formatMoney(perPerson)} per person`;
      }
    }
  }

  saveSplitFromForm(e) {
    e.preventDefault();
    const title = document.getElementById('split-title-input').value.trim();
    const totalAmount = Math.abs(parseFloat(document.getElementById('split-total-input').value));
    const payerId = document.getElementById('split-payer-select').value;
    const accountId = document.getElementById('split-account-select')?.value;
    const category = document.getElementById('split-category-select')?.value || 'Food & Dining';
    const checkedBoxes = Array.from(document.querySelectorAll('input[name="split-member"]:checked'));
    const includedMemberIds = checkedBoxes.map(cb => cb.value);

    if (!title || isNaN(totalAmount) || totalAmount <= 0) {
      alert('Please enter a valid title and total amount.');
      return;
    }

    if (includedMemberIds.length === 0) {
      alert('Please select at least 1 member in the split.');
      return;
    }

    const perPersonShare = Number((totalAmount / includedMemberIds.length).toFixed(2));
    const isPayerYou = (payerId === 'm_you');
    const isYouIncluded = includedMemberIds.includes('m_you');
    const payerMember = this.data.groupMembers.find(m => m.id === payerId) || { name: 'Unknown' };

    const splitId = 'split_' + Date.now();

    // 1. Process Accounts & Personal Expense
    if (isPayerYou) {
      const sourceAcc = this.data.accounts.find(a => a.id === accountId);
      if (sourceAcc) {
        // You paid the total bill from your account
        sourceAcc.balance = (Number(sourceAcc.balance) || 0) - totalAmount;
      }

      // Log your personal share as an EXPENSE transaction
      if (isYouIncluded) {
        this.data.transactions.unshift({
          id: 'tx_' + Date.now(),
          type: 'EXPENSE',
          amount: perPersonShare,
          category: category,
          accountId: accountId,
          splitId: splitId,
          isSplit: true,
          notes: `Split Share: ${title}`,
          date: new Date().toISOString().split('T')[0],
          createdAt: Date.now()
        });
      }

      // 2. Automatically create DEBTS under "Owed to Me (Money to Get)" for each other friend!
      includedMemberIds.forEach(memId => {
        if (memId !== 'm_you') {
          const friend = this.data.groupMembers.find(m => m.id === memId);
          this.data.debts.unshift({
            id: 'debt_split_' + Date.now() + '_' + memId,
            direction: 'OWED_TO_ME',
            personName: friend ? friend.name : 'Friend',
            personId: memId,
            totalAmount: perPersonShare,
            paidAmount: 0.00,
            remainingAmount: perPersonShare,
            reason: `Split: ${title}`,
            splitId: splitId,
            isSplit: true,
            paidById: 'm_you',
            canSettleByPayer: true, // Only YOU (the person who paid) can mark settled!
            dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
            status: 'ACTIVE',
            createdAt: Date.now()
          });
        }
      });
    } else {
      // Another friend paid the bill!
      if (isYouIncluded) {
        // Automatically create a DEBT under "I Owe (Money to Give)" to the payer!
        this.data.debts.unshift({
          id: 'debt_split_' + Date.now() + '_me',
          direction: 'I_OWE',
          personName: payerMember.name,
          personId: payerId,
          totalAmount: perPersonShare,
          paidAmount: 0.00,
          remainingAmount: perPersonShare,
          reason: `Split: ${title}`,
          splitId: splitId,
          isSplit: true,
          paidById: payerId,
          canSettleByPayer: false,
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          status: 'ACTIVE',
          createdAt: Date.now()
        });
      }
    }

    // Save Split record
    const newSplit = {
      id: splitId,
      title,
      totalAmount,
      paidBy: payerMember.name,
      paidById: payerId,
      payerAccountId: isPayerYou ? accountId : null,
      category,
      date: new Date().toISOString().split('T')[0],
      includedMemberIds,
      perPersonShare,
      yourShare: isYouIncluded ? perPersonShare : 0,
      status: 'ACTIVE',
      createdByUid: this.currentUser?.uid || 'local',
      createdByEmail: (this.currentUser?.email || '').toLowerCase(),
      createdAt: Date.now()
    };

    this.data.splits.unshift(newSplit);
    this.saveData();

    // Write directly to shared splits subcollection for instant cross-device sync!
    if (this.currentUser && window.firebase) {
      try {
        const db = firebase.firestore();
        db.collection('shared_groups').doc('default_group').collection('splits').doc(splitId).set(newSplit)
          .catch(err => this.handleFirestoreError(err));
      } catch (err) {
        this.handleFirestoreError(err);
      }
    }

    this.closeAllModals();
    this.showToast(`Split "${title}" recorded! Debts and accounts updated ✓`, 'success');
  }

  deleteSplit(splitId) {
    const sp = this.data.splits.find(s => s.id === splitId);
    if (!sp) return;
    if (!confirm(`Delete split "${sp.title}"?\n\nThis will cancel all related debts, remove the expense log, and refund ${this.formatMoney(sp.totalAmount)} back to your account.`)) return;

    // 1. If YOU paid the split, refund the full totalAmount back to the payer account!
    if (sp.payerAccountId) {
      const acc = this.data.accounts.find(a => a.id === sp.payerAccountId);
      if (acc) {
        acc.balance = Number(((Number(acc.balance) || 0) + Number(sp.totalAmount)).toFixed(2));
      }
    }

    // 2. Remove all transactions linked to this split
    this.data.transactions = this.data.transactions.filter(t => t.splitId !== splitId);

    // 3. Remove all debts linked to this split
    this.data.debts = this.data.debts.filter(d => d.splitId !== splitId);

    // 4. Remove the split record itself
    this.data.splits = this.data.splits.filter(s => s.id !== splitId);

    this.saveData();

    // 5. Delete from Firestore shared splits subcollection!
    if (this.currentUser && window.firebase) {
      try {
        const db = firebase.firestore();
        db.collection('shared_groups').doc('default_group').collection('splits').doc(splitId).delete()
          .catch(err => this.handleFirestoreError(err));
      } catch (err) {
        this.handleFirestoreError(err);
      }
    }

    this.showToast(`Split "${sp.title}" deleted. Account refunded and debts cleared ✓`, 'success');
  }

  // 3. MEMBER MANAGEMENT
  openAddMemberModal() {
    const modal = document.getElementById('modal-add-member');
    if (modal) modal.classList.remove('hidden');
  }

  saveMemberFromForm(e) {
    e.preventDefault();
    const name = document.getElementById('member-name-input').value.trim();
    const email = document.getElementById('member-email-input').value.trim().toLowerCase();

    if (!name) {
      alert('Please enter a name');
      return;
    }

    const memberId = 'm_' + Date.now();
    const newMember = {
      id: memberId,
      name,
      email: email || '',
      isSelf: false,
      addedAt: Date.now()
    };

    this.data.groupMembers.push(newMember);
    this.saveData();

    // Direct write to shared members subcollection so all connected friends get it immediately!
    if (this.currentUser && window.firebase) {
      try {
        const db = firebase.firestore();
        db.collection('shared_groups').doc('default_group').collection('members').doc(memberId).set(newMember)
          .catch(err => this.handleFirestoreError(err));
      } catch (err) {
        this.handleFirestoreError(err);
      }
    }

    this.closeAllModals();
    this.showToast(`Added ${name} to group friends!`, 'success');
  }

  // 4. ACCOUNTS LOGIC
  openAddAccountModal() {
    const modal = document.getElementById('modal-account');
    if (modal) modal.classList.remove('hidden');
  }

  saveAccountFromForm(e) {
    e.preventDefault();
    const name = document.getElementById('acc-name').value;
    const type = document.getElementById('acc-type').value;
    const balance = parseFloat(document.getElementById('acc-balance').value) || 0;
    const isLiquid = document.getElementById('acc-is-liquid').checked;

    let icon = 'landmark';
    if (type === 'CASH') icon = 'banknote';
    if (type === 'CREDIT_CARD') icon = 'credit-card';
    if (type === 'WALLET') icon = 'smartphone';
    if (type === 'INVESTMENT') icon = 'trending-up';

    const newAcc = {
      id: 'acc_' + Date.now(),
      name,
      type,
      balance,
      isLiquid,
      icon
    };

    this.data.accounts.push(newAcc);
    this.saveData();
    this.closeAllModals();
  }

  deleteAccount(id) {
    if (this.data.accounts.length <= 1) {
      alert('You must have at least one account.');
      return;
    }
    if (confirm('Delete this account? (Existing transactions will remain in logs)')) {
      this.data.accounts = this.data.accounts.filter(a => a.id !== id);
      this.saveData();
    }
  }

  openQuickAdjustModal(accId) {
    const acc = this.data.accounts.find(a => a.id === accId);
    if (!acc) return;
    const newBal = prompt(`Enter new verified balance for "${acc.name}":`, acc.balance);
    if (newBal !== null && !isNaN(parseFloat(newBal))) {
      acc.balance = parseFloat(newBal);
      this.saveData();
    }
  }

  // 5. DEBTS LOGIC
  openAddDebtModal(direction = 'OWED_TO_ME') {
    const modal = document.getElementById('modal-debt');
    const dirSelect = document.getElementById('debt-direction');
    if (dirSelect) dirSelect.value = direction;
    if (modal) modal.classList.remove('hidden');
  }

  saveDebtFromForm(e) {
    e.preventDefault();
    const direction = document.getElementById('debt-direction').value;
    const personName = document.getElementById('debt-person').value.trim();
    const totalAmount = parseFloat(document.getElementById('debt-amount').value);
    const reason = document.getElementById('debt-reason').value;
    const dueDate = document.getElementById('debt-due-date').value;

    if (!personName || !totalAmount || totalAmount <= 0) {
      alert('Please fill the person name and valid amount.');
      return;
    }

    const newDebt = {
      id: 'debt_' + Date.now(),
      direction,
      personName,
      totalAmount,
      paidAmount: 0,
      remainingAmount: totalAmount,
      reason,
      dueDate,
      status: 'ACTIVE',
      isSplit: false,
      createdAt: Date.now()
    };

    this.data.debts.unshift(newDebt);
    this.saveData();
    this.closeAllModals();
  }

  openSettleModal(debtId) {
    const debt = this.data.debts.find(d => d.id === debtId);
    if (!debt) return;

    const modal = document.getElementById('modal-settle-debt');
    const info = document.getElementById('settle-debt-info');
    const amountInput = document.getElementById('settle-amount');
    const accSelect = document.getElementById('settle-account-select');
    document.getElementById('settle-debt-id').value = debt.id;

    if (info) {
      info.textContent = `${debt.direction === 'OWED_TO_ME' ? 'Receiving payment from' : 'Paying out to'} ${debt.personName} (Remaining: ${this.formatMoney(debt.remainingAmount)})`;
    }
    if (amountInput) {
      amountInput.value = debt.remainingAmount;
      amountInput.max = debt.remainingAmount;
    }
    if (accSelect) {
      accSelect.innerHTML = this.data.accounts.map(a => `<option value="${a.id}">${a.name} (${this.formatMoney(a.balance)})</option>`).join('');
    }

    if (modal) modal.classList.remove('hidden');
  }

  recordDebtPayment(e) {
    e.preventDefault();
    const debtId = document.getElementById('settle-debt-id').value;
    const payAmount = parseFloat(document.getElementById('settle-amount').value);
    const accId = document.getElementById('settle-account-select').value;
    const debt = this.data.debts.find(d => d.id === debtId);

    if (!debt || isNaN(payAmount) || payAmount <= 0) {
      alert('Invalid payment amount');
      return;
    }

    debt.paidAmount = (Number(debt.paidAmount) || 0) + payAmount;
    debt.remainingAmount = Math.max(0, debt.totalAmount - debt.paidAmount);
    if (debt.remainingAmount <= 0.01) {
      debt.status = 'SETTLED';
      debt.remainingAmount = 0;
    }

    // Auto-log linked transaction if an account was selected
    const acc = this.data.accounts.find(a => a.id === accId);
    if (acc) {
      const isOwedToMe = debt.direction === 'OWED_TO_ME';
      if (isOwedToMe) {
        acc.balance = (Number(acc.balance) || 0) + payAmount; // Received cash
        this.data.transactions.unshift({
          id: 'tx_' + Date.now(),
          type: 'INCOME',
          amount: payAmount,
          category: 'Debt Repayment Received',
          accountId: acc.id,
          notes: `Debt settlement from ${debt.personName} (${debt.reason})`,
          date: new Date().toISOString().split('T')[0],
          createdAt: Date.now()
        });
      } else {
        acc.balance = (Number(acc.balance) || 0) - payAmount; // Paid out debt
        this.data.transactions.unshift({
          id: 'tx_' + Date.now(),
          type: 'EXPENSE',
          amount: payAmount,
          category: 'Debt Repaid',
          accountId: acc.id,
          notes: `Debt repayment to ${debt.personName} (${debt.reason})`,
          date: new Date().toISOString().split('T')[0],
          createdAt: Date.now()
        });
      }
    }

    this.saveData();
    this.closeAllModals();
    alert('Payment recorded and balances updated!');
  }

  deleteDebt(id) {
    const debt = this.data.debts.find(d => d.id === id);
    if (!debt) return;

    if (debt.isSplit) {
      alert(`This debt was created from a group split ("${debt.reason}").\n\nTo cancel or remove it, please delete or settle the split in the Split Bill tab.`);
      return;
    }

    if (confirm(`Delete debt record with ${debt.personName}?`)) {
      this.data.debts = this.data.debts.filter(d => d.id !== id);
      this.saveData();
      this.showToast('Debt record deleted ✓', 'success');
    }
  }

  // 6. BACKUP & PREFERENCES
  renderSettingsView() {
    const curSelect = document.getElementById('setting-currency');
    if (curSelect) curSelect.value = this.settings.currency;

    const authCard = document.getElementById('firebase-auth-status');
    if (authCard) {
      if (this.currentUser) {
        authCard.innerHTML = `
          <div class="flex items-center space-x-3">
            <img src="${this.currentUser.photoURL || './public/icons/icon-192.png'}" class="w-10 h-10 rounded-full border border-emerald-400">
            <div>
              <p class="font-bold text-sm text-white">${this.currentUser.displayName || 'Google User'}</p>
              <p class="text-xs text-slate-400">${this.currentUser.email}</p>
            </div>
          </div>
          <button onclick="app.signOutFirebase()" class="mt-3 px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-400 text-xs font-bold hover:bg-rose-500/30">Sign Out</button>
        `;
      } else {
        authCard.innerHTML = `
          <p class="text-xs text-slate-400">Not connected to Google Account.</p>
          <button onclick="app.signInWithGoogle()" class="mt-3 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-extrabold flex items-center space-x-2 shadow-lg shadow-emerald-500/20">
            <svg class="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg>
            <span>Sign in with Google</span>
          </button>
        `;
      }
    }
  }

  exportBackup() {
    const exportData = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      settings: this.settings,
      data: this.data
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finflow-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importBackup(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.data && parsed.data.accounts) {
          this.data = parsed.data;
          if (parsed.settings) this.settings = parsed.settings;
          this.saveData();
          this.saveSettings();
          alert('Backup restored successfully!');
        } else {
          alert('Invalid backup file format.');
        }
      } catch (err) {
        alert('Failed to parse backup file: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  resetDemoData() {
    if (confirm('Clear all data and start completely fresh with zero balances (₹0.00)?')) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('finflow_data_v1');
      localStorage.removeItem('finflow_data_v2');
      this.data = {
        accounts: [
          { id: 'acc_1', name: 'Primary Bank Account', type: 'BANK', balance: 0.00, isLiquid: true, icon: 'landmark' },
          { id: 'acc_2', name: 'Cash in Hand', type: 'CASH', balance: 0.00, isLiquid: true, icon: 'banknote' },
          { id: 'acc_3', name: 'UPI / Digital Wallet', type: 'WALLET', balance: 0.00, isLiquid: true, icon: 'smartphone' }
        ],
        transactions: [],
        debts: [],
        groupMembers: [{ id: 'm_you', name: (this.currentUser && this.currentUser.displayName) ? this.currentUser.displayName : 'You (Me)', email: (this.currentUser && this.currentUser.email) ? this.currentUser.email : 'you@self.app', isSelf: true }],
        splits: []
      };
      this.saveData();
      this.render();
      this.showToast('All data has been cleared to a clean slate.', 'success');
    }
  }

  changeCurrency(newCurr) {
    this.settings.currency = newCurr;
    this.saveSettings();
    this.render();
  }

  // 7. FIREBASE AUTH & PERSISTENT GOOGLE SIGN-IN
  initFirebase() {
    if (window.firebase) {
      try {
        if (!firebase.apps.length) {
          firebase.initializeApp(FIREBASE_CONFIG);
        }

        // Enable Local Persistence: always keeps user signed in across browser restarts/PWA launches
        firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
          .catch(err => console.warn('Auth persistence notice:', err));

        // Listen for persistent auth state changes
        firebase.auth().onAuthStateChanged(async (user) => {
          this.currentUser = user;
          const authGate = document.getElementById('auth-gate-screen');
          const userPill = document.getElementById('header-user-pill');
          const userAvatar = document.getElementById('header-user-avatar');
          const userName = document.getElementById('header-user-name');

          if (user) {
            console.log('Firebase user logged in & persistent:', user.email);

            // Hide the Welcome Auth Gate
            if (authGate) authGate.classList.add('hidden');

            // Show Header Profile Pill
            if (userPill) userPill.classList.remove('hidden');
            if (userAvatar) userAvatar.src = user.photoURL || './public/icons/icon-192.png';
            if (userName) userName.textContent = user.displayName ? user.displayName.split(' ')[0] : 'User';

            // Auto-update member 'm_you' with Google Profile
            const youMember = this.data.groupMembers.find(m => m.id === 'm_you');
            if (youMember) {
              if (user.displayName) youMember.name = user.displayName;
              if (user.email) youMember.email = user.email;
            }

            // Sync from Cloud Firestore
            this.syncFromFirebase(user.uid);
          } else {
            // Unauthenticated state
            if (userPill) userPill.classList.add('hidden');
            const isGuest = sessionStorage.getItem('finflow_guest_mode') === 'true';
            if (isGuest) {
              if (authGate) authGate.classList.add('hidden');
            } else {
              if (authGate) authGate.classList.remove('hidden');
            }
          }
          this.render();
          if (window.lucide) window.lucide.createIcons();
        });
      } catch (err) {
        console.warn('Firebase init notice:', err);
      }
    }
  }

  async signInWithGoogle() {
    if (!window.firebase) {
      alert('Firebase is initializing. Please tap again in a moment.');
      return;
    }
    const customName = document.getElementById('auth-custom-name')?.value?.trim();
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      const result = await firebase.auth().signInWithPopup(provider);
      this.currentUser = result.user;

      if (customName && customName !== result.user.displayName) {
        try {
          await result.user.updateProfile({ displayName: customName });
        } catch(e) {}
      }

      const displayName = customName || result.user.displayName || 'Me';
      const userEmail   = (result.user.email || '').toLowerCase();

      // Update local self-member record with real Google email + name
      const youMember = this.data.groupMembers.find(m => m.id === 'm_you');
      if (youMember) {
        youMember.name  = displayName;
        youMember.email = userEmail;
        youMember.uid   = result.user.uid;
      }

      // ── CRITICAL: Register this user's email+uid in the shared group memberMap ──
      // This allows friends to match this person when syncing splits even if
      // they were added with a slightly different name.
      if (window.firebase) {
        try {
          const db = firebase.firestore();
          db.collection('shared_groups').doc('default_group').set({
            [`memberMap.${result.user.uid}`]: {
              id: 'm_you',           // their self-member id
              name: displayName,
              email: userEmail,
              uid: result.user.uid,
              registeredAt: Date.now()
            }
          }, { merge: true }).catch(() => {});
        } catch(e) {}
      }

      const authGate = document.getElementById('auth-gate-screen');
      if (authGate) authGate.classList.add('hidden');

      this.syncFromFirebase(result.user.uid);
      this.saveData();
    } catch (err) {
      console.error('Sign-in error:', err);
      if (err.code === 'auth/unauthorized-domain') {
        alert("This domain is not authorized yet in Firebase Console!\n\nPlease add your domain (e.g. localhost or your GitHub username.github.io) in:\nFirebase Console ➔ Authentication ➔ Settings ➔ Authorized Domains.");
      } else if (err.code !== 'auth/popup-closed-by-user') {
        alert('Google Sign-in: ' + err.message);
      }
    }
  }

  continueAsGuest() {
    sessionStorage.setItem('finflow_guest_mode', 'true');
    const authGate = document.getElementById('auth-gate-screen');
    if (authGate) authGate.classList.add('hidden');
    this.render();
  }

  signOutFirebase() {
    if (confirm('Sign out of your Google account on this device?')) {
      sessionStorage.removeItem('finflow_guest_mode');
      if (window.firebase && firebase.auth()) {
        firebase.auth().signOut().then(() => {
          this.currentUser = null;
          const authGate = document.getElementById('auth-gate-screen');
          if (authGate) authGate.classList.remove('hidden');
          const userPill = document.getElementById('header-user-pill');
          if (userPill) userPill.classList.add('hidden');
          this.render();
        });
      }
    }
  }

  syncFromFirebase(uid) {
    if (!window.firebase) return;
    const db = firebase.firestore();
    db.collection('users').doc(uid).get().then(doc => {
      if (doc.exists) {
        const cloudData = doc.data();
        if (cloudData && cloudData.accounts) {
          this.data = cloudData;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
          this.render();
        }
      } else {
        // First time cloud sync for new user: save current data
        db.collection('users').doc(uid).set(this.data, { merge: true })
          .catch(e => console.warn('Initial cloud sync notice:', e));
      }
      this.syncSharedGroupsWithFirestore();
    }).catch(err => {
      console.warn('Cloud sync read notice:', err);
      this.syncSharedGroupsWithFirestore();
    });
  }

  syncSharedGroupsWithFirestore() {
    if (!window.firebase || !this.currentUser) return;
    const db = firebase.firestore();

    const myEmail = (this.currentUser.email || '').toLowerCase();
    const myUid = this.currentUser.uid;
    const myName = this.currentUser.displayName || this.data.groupMembers.find(m => m.isSelf)?.name || 'Me';

    // ── 1. Register my Google user in the shared group members ──────────────
    const myProfile = {
      id: myUid,
      name: myName,
      email: myEmail,
      isSelf: false,
      updatedAt: Date.now()
    };
    db.collection('shared_groups').doc('default_group').collection('members').doc(myUid).set(myProfile, { merge: true })
      .catch(err => this.handleFirestoreError(err));

    // ── 2. Real-time listener for MEMBERS ──────────────────────────────────
    db.collection('shared_groups').doc('default_group').collection('members').onSnapshot(snapshot => {
      let changed = false;
      snapshot.forEach(doc => {
        const m = doc.data();
        if (!m || !m.email) return;
        const exists = this.data.groupMembers.find(localM =>
          localM.id === m.id ||
          (localM.email && localM.email.toLowerCase() === m.email.toLowerCase())
        );
        if (!exists) {
          this.data.groupMembers.push({
            id: m.id || ('m_' + Date.now()),
            name: m.name || 'Friend',
            email: m.email.toLowerCase(),
            isSelf: (m.email.toLowerCase() === myEmail)
          });
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        this.render();
      }
    }, err => this.handleFirestoreError(err));

    // ── 3. Real-time listener for SPLITS ───────────────────────────────────
    db.collection('shared_groups').doc('default_group').collection('splits').onSnapshot(snapshot => {
      let changed = false;
      const remoteSplits = [];
      const remoteIds = new Set();

      snapshot.forEach(doc => {
        const sp = doc.data();
        if (sp && sp.id) {
          remoteSplits.push(sp);
          remoteIds.add(sp.id);
        }
      });

      // Newest first
      remoteSplits.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      if (JSON.stringify(remoteSplits) !== JSON.stringify(this.data.splits)) {
        // Handle remotely deleted splits: remove corresponding debts and transactions!
        const deletedSplits = (this.data.splits || []).filter(s => !remoteIds.has(s.id));
        deletedSplits.forEach(delSp => {
          this.data.debts = this.data.debts.filter(d => d.splitId !== delSp.id);
          this.data.transactions = this.data.transactions.filter(t => t.splitId !== delSp.id);
        });

        // Detect brand-new splits to auto-create matching Debts
        const localIds = new Set((this.data.splits || []).map(s => s.id));
        const newSplits = remoteSplits.filter(s => !localIds.has(s.id));

        const meMember = this.data.groupMembers.find(m =>
          m.isSelf || (m.email && m.email.toLowerCase() === myEmail)
        );
        const myId = meMember ? meMember.id : 'm_you';

        newSplits.forEach(sp => {
          const payerId = sp.paidById;
          const payerEmail = (sp.createdByEmail || '').toLowerCase();
          const included = sp.includedMemberIds || [];
          const share = Number(sp.perPersonShare) || 0;
          const splitId = sp.id;

          const isIncluded = included.includes(myId) ||
                             included.includes('m_you') ||
                             included.includes(myUid);

          const iAmPayer = (payerId === myId) ||
                           (payerId === 'm_you') ||
                           (payerId === myUid) ||
                           (payerEmail === myEmail);

          const debtAlreadyExists = otherId =>
            this.data.debts.some(d => d.splitId === splitId && (d.personId === otherId || d.personName === otherId));

          if (isIncluded && !iAmPayer) {
            // I owe the payer
            if (!debtAlreadyExists(payerId)) {
              this.data.debts.unshift({
                id: 'debt_split_sync_' + Date.now() + '_' + splitId,
                direction: 'I_OWE',
                personName: sp.paidBy || 'Friend',
                personId: payerId,
                totalAmount: share,
                paidAmount: 0.00,
                remainingAmount: share,
                reason: `Split: ${sp.title}`,
                splitId: splitId,
                isSplit: true,
                paidById: payerId,
                canSettleByPayer: false,
                dueDate: sp.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
                status: 'ACTIVE',
                createdAt: sp.createdAt || Date.now()
              });
            }
          } else if (iAmPayer) {
            // Friends owe me
            included.forEach(memId => {
              if (memId !== myId && memId !== 'm_you' && memId !== myUid) {
                const mem = this.data.groupMembers.find(m => m.id === memId);
                const memName = mem ? mem.name : 'Friend';
                if (!debtAlreadyExists(memId)) {
                  this.data.debts.unshift({
                    id: 'debt_split_sync_' + Date.now() + '_' + splitId + '_' + memId,
                    direction: 'OWED_TO_ME',
                    personName: memName,
                    personId: memId,
                    totalAmount: share,
                    paidAmount: 0.00,
                    remainingAmount: share,
                    reason: `Split: ${sp.title}`,
                    splitId: splitId,
                    isSplit: true,
                    paidById: myId,
                    canSettleByPayer: true,
                    dueDate: sp.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
                    status: 'ACTIVE',
                    createdAt: sp.createdAt || Date.now()
                  });
                }
              }
            });
          }
        });

        this.data.splits = remoteSplits;
        changed = true;
      }

      if (changed) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        this.render();
      }
    }, err => this.handleFirestoreError(err));

    // ── 4. Real-time listener for SETTLEMENTS ──────────────────────────────
    db.collection('shared_groups').doc('default_group').collection('settlements').onSnapshot(snapshot => {
      let changed = false;
      const remoteSettlements = [];
      snapshot.forEach(doc => {
        const st = doc.data();
        if (st && st.id) remoteSettlements.push(st);
      });

      if (JSON.stringify(remoteSettlements) !== JSON.stringify(this.data.settlements || [])) {
        remoteSettlements.forEach(st => {
          this.data.debts.forEach(d => {
            if (d.isSplit) {
              const isMatch =
                (d.direction === 'I_OWE' && (d.personId === st.toMemberId || d.personId === 'm_you')) ||
                (d.direction === 'OWED_TO_ME' && (d.personId === st.fromMemberId));
              if (isMatch) {
                d.status = 'SETTLED';
                d.remainingAmount = 0.00;
                d.paidAmount = d.totalAmount;
              }
            }
          });
        });
        this.data.settlements = remoteSettlements;
        changed = true;
      }

      if (changed) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        this.render();
      }
    }, err => this.handleFirestoreError(err));

    // Proactively probe Firestore rules so user knows if rules are missing!
    this.testFirestoreRules(false);
  }

  handleFirestoreError(err) {
    if (!err) return;
    console.warn('Firestore sync status:', err);
    const msg = (err.message || err.code || '').toLowerCase();
    if (msg.includes('permission') || msg.includes('denied') || err.code === 'permission-denied') {
      this.firestoreRulesValid = false;
      this.renderFirestoreAlert(true);
    }
  }

  async testFirestoreRules(showAlert = true) {
    if (!window.firebase || !this.currentUser) {
      if (showAlert) alert('Please sign in with Google first to test multi-device cloud sync.');
      return;
    }
    const db = firebase.firestore();
    try {
      // Test read/write to shared group
      await db.collection('shared_groups').doc('default_group').set({
        lastSyncPing: Date.now(),
        verifiedBy: this.currentUser.email
      }, { merge: true });

      this.firestoreRulesValid = true;
      this.renderFirestoreAlert(false);
      if (showAlert) this.showToast('🟢 Cloud Sync verified! Real-time multi-device sync is 100% active.', 'success');
    } catch (err) {
      this.handleFirestoreError(err);
      if (showAlert) {
        alert("⚠️ Cloud Sync Blocked by Firebase Rules!\n\nPlease open Firebase Console ➔ Firestore Database ➔ Rules tab and paste the security rule shown on your screen.");
      }
    }
  }

  renderFirestoreAlert(isError) {
    const errorBanner = document.getElementById('firestore-rules-banner');
    const onlineBanner = document.getElementById('firestore-online-banner');
    if (isError) {
      if (errorBanner) errorBanner.classList.remove('hidden');
      if (onlineBanner) onlineBanner.classList.add('hidden');
    } else {
      if (errorBanner) errorBanner.classList.add('hidden');
      if (onlineBanner) onlineBanner.classList.remove('hidden');
    }
    if (window.lucide) window.lucide.createIcons();
  }

  closeAllModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
  }
}

// Global App Instance
let app;
window.addEventListener('DOMContentLoaded', () => {
  app = new FinFlowApp();
  window.app = app;
});
