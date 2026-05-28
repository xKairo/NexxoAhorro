document.addEventListener('DOMContentLoaded', () => {
    // ---- SPA ROUTER (Navegación Intuitiva de Vistas) ----
    const navLinks = document.querySelectorAll('.nav-link');
    const viewSections = document.querySelectorAll('.view-section');

    const switchView = (targetId) => {
        viewSections.forEach(section => {
            if (section.id === targetId) {
                section.classList.remove('hidden');
                section.classList.add('opacity-0');
                setTimeout(() => section.classList.remove('opacity-0'), 10);
            } else {
                section.classList.add('hidden');
            }
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const target = e.currentTarget.getAttribute('data-target');
            if (target) {
                switchView(target);
            }
        });
    });

    // Selector de días específicos UI
    const expenseFrequency = document.getElementById('expenseFrequency');
    const specificDaysSelector = document.getElementById('specificDaysSelector');

    expenseFrequency.addEventListener('change', () => {
        if (expenseFrequency.value === 'specific_days') {
            specificDaysSelector.classList.remove('hidden');
        } else {
            specificDaysSelector.classList.add('hidden');
        }
    });

    // ---- CORE APP ----
    // Initialize Core instances
    const calc = new BudgetCalculator();
    let chartMgr;
    let creditCards = []; // Memory for cards

    try {
        chartMgr = new ChartManager('budgetChart');
    } catch (e) {
        console.error("Chart initialization failed:", e);
    }

    // DOM Elements
    const incomeInput = document.getElementById('incomeInput');
    const frequencySelect = document.getElementById('frequencySelect');
    const budgetPeriodNum = document.getElementById('budgetPeriodNum');
    const budgetPeriodType = document.getElementById('budgetPeriodType');

    // Limits Updater handler
    const updateBudgetLimits = () => {
        const type = budgetPeriodType.value;
        if (type === 'days') budgetPeriodNum.max = 365;
        else if (type === 'weeks') budgetPeriodNum.max = 52;
        else if (type === 'biweeks') budgetPeriodNum.max = 24;
        else if (type === 'months') budgetPeriodNum.max = 12;

        if (parseInt(budgetPeriodNum.value) > parseInt(budgetPeriodNum.max)) {
            budgetPeriodNum.value = budgetPeriodNum.max;
        }
        if (parseInt(budgetPeriodNum.value) < 1 || isNaN(budgetPeriodNum.value)) {
            budgetPeriodNum.value = 1;
        }
        updateUI();
    };

    const addExpenseForm = document.getElementById('addExpenseForm');
    const expensesList = document.getElementById('expensesList');
    const emptyExpenses = document.getElementById('emptyExpenses');
    const expensesCount = document.getElementById('expensesCount');

    // Summary Texts
    const totalBudgetText = document.getElementById('totalBudgetText');
    const totalSpentText = document.getElementById('totalSpentText');
    const remainingText = document.getElementById('remainingText');

    // Sync Indicator
    const syncIndicator = document.getElementById('cloudSyncIndicator');

    // UI Toast System
    const showToast = (message, type = 'success') => {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-6 right-6 z-[60] px-6 py-4 rounded-2xl shadow-2xl transform transition-all duration-500 translate-y-32 flex items-center gap-3 font-bold text-sm border backdrop-blur-md ${type === 'success'
            ? 'bg-emerald-500/90 text-white border-emerald-400'
            : 'bg-rose-500/90 text-white border-rose-400'
            }`;

        const icon = type === 'success' ? 'ph-fill ph-check-circle' : 'ph-fill ph-warning-circle';
        toast.innerHTML = `<i class="${icon} text-xl"></i> <span>${message}</span>`;

        document.body.appendChild(toast);

        // Entrar
        requestAnimationFrame(() => {
            toast.classList.replace('translate-y-32', 'translate-y-0');
        });

        // Salir
        setTimeout(() => {
            toast.classList.replace('translate-y-0', 'translate-y-32');
            toast.classList.add('opacity-0');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    };

    // Utility to format currency
    const formatCurrency = (amount) => {
        if (amount === undefined || amount === null || isNaN(amount)) {
            return "$0.00";
        }
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
    };

    // Main update loop
    const updateUI = () => {
        // 1. Get Income State
        calc.setIncome(incomeInput.value, frequencySelect.value, budgetPeriodNum.value, budgetPeriodType.value);

        // 2. Set Cards for cut-off logic
        calc.setCreditCards(creditCards);

        // 3. Fetch computed totals
        const totalIncome = calc.getTotalIncome();
        const expenses = calc.getExpenses();

        // --- Integración de Tarjetas como Gastos Dinámicos ---
        const activeCardsInSim = creditCards.filter(c => c.is_active_in_sim);
        const cardExpenses = [];

        activeCardsInSim.forEach(card => {
            const budgetDays = calc.getBudgetDays();
            let included = false;

            if (budgetDays >= 30) {
                included = true;
            } else {
                for (let d = 0; d < budgetDays; d++) {
                    const checkDate = new Date(calc.startDate);
                    checkDate.setDate(checkDate.getDate() + d);
                    if (checkDate.getDate() === card.cut_off_day) {
                        included = true;
                        break;
                    }
                }
            }

            if (included) {
                cardExpenses.push({
                    id: `card-${card.name}`,
                    name: `Tarjeta: ${card.name}`,
                    amount: card.amount,
                    calculatedAmount: card.amount,
                    color: '#6366f1', // Indigo standard
                    type: 'credit_card',
                    frequency: 'monthly',
                    isVirtual: true
                });
            }
        });

        const allVisibleExpenses = [...expenses, ...cardExpenses];
        const totalExpenses = allVisibleExpenses.reduce((sum, e) => {
            const amount = isNaN(e.calculatedAmount) ? 0 : e.calculatedAmount;
            return sum + amount;
        }, 0);
        const remaining = totalIncome - totalExpenses;

        // 4. Update Summary text
        totalBudgetText.textContent = formatCurrency(totalIncome);
        totalSpentText.textContent = formatCurrency(totalExpenses);
        remainingText.textContent = formatCurrency(remaining);

        // Warning indicators
        if (remaining < 0) {
            remainingText.classList.replace('text-brand-mint', 'text-red-400');
        } else {
            remainingText.classList.replace('text-red-400', 'text-brand-mint');
        }

        if (typeof calculateSavingsGoal === 'function') {
            calculateSavingsGoal(remaining);
        }

        // 5. Update Chart
        if (chartMgr) {
            chartMgr.updateChart(totalIncome, allVisibleExpenses.map(e => ({ ...e, amount: e.calculatedAmount })), remaining);
        }

        // 6. Refresh List
        expensesCount.textContent = `${allVisibleExpenses.length} registrado${allVisibleExpenses.length !== 1 ? 's' : ''}`;

        // Re-render list efficiently
        expensesList.querySelectorAll('li').forEach(li => li.remove());
        if (allVisibleExpenses.length === 0) {
            emptyExpenses.style.display = 'flex';
        } else {
            emptyExpenses.style.display = 'none';
            allVisibleExpenses.forEach(e => renderExpenseItem(e));
        }

        // Auto-save to cloud
        if (typeof window.triggerCloudSync === 'function') {
            window.triggerCloudSync();
        }
    };

    const renderExpenseItem = (expense) => {
        const li = document.createElement('li');
        li.className = 'expense-item-enter bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 p-3 rounded-xl shadow-sm hover:border-gray-200 dark:hover:border-slate-600 transition-colors group';
        li.dataset.id = expense.id;

        const renderViewMode = () => {
            const isVirtual = expense.isVirtual;
            const freqLabels = {
                daily: 'Diario', weekly: 'Sem', biweekly: 'Qna', monthly: 'Mes',
                workdays: 'Lun-Vie', specific_days: 'Pers'
            };
            const typeLabel = expense.type === 'fixed_monthly' ? 'Fijo' : (expense.type === 'credit_card' ? 'Tarjeta' : 'Var');

            // Usar el valor que ya viene calculado desde updateUI
            const displayAmount = isNaN(expense.calculatedAmount) ? 0 : expense.calculatedAmount;

            li.innerHTML = `
                <div class="flex items-center justify-between w-full">
                    <div class="flex items-center gap-3 overflow-hidden flex-grow">
                        <span class="w-4 h-4 rounded-full flex-shrink-0" style="background-color: ${expense.color};"></span>
                        <div class="flex flex-col">
                            <span class="font-medium text-slate-700 dark:text-gray-200 truncate" title="${expense.name}">${expense.name}</span>
                            <span class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tighter">${typeLabel} | ${freqLabels[expense.frequency] || expense.frequency}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0 pl-2">
                        <span class="text-slate-900 dark:text-gray-100 font-bold expense-amount-display">${formatCurrency(displayAmount)}</span>
                        <div class="flex items-center gap-1 ${isVirtual ? 'hidden' : ''}">
                            <button type="button" class="edit-btn text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 p-2 rounded-lg transition-colors">
                                <i class="ph-bold ph-pencil-line"></i>
                            </button>
                            <button type="button" class="delete-btn text-gray-400 hover:text-red-500 p-2 rounded-lg transition-colors">
                                <i class="ph-bold ph-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            if (!isVirtual) {
                li.querySelector('.edit-btn').addEventListener('click', renderEditMode);
                li.querySelector('.delete-btn').addEventListener('click', () => {
                    calc.expenses = calc.expenses.filter(e => e.id !== expense.id);
                    updateUI();
                });
            }
        };

        const renderEditMode = () => {
            const currentExp = calc.expenses.find(e => e.id === expense.id);
            li.innerHTML = `
                <div class="flex flex-col gap-3 w-full animate-fade-in p-1">
                    <div class="flex items-center gap-2">
                        <input type="color" class="edit-color w-8 h-8 rounded cursor-pointer bg-transparent border-0" value="${currentExp.color}">
                        <input type="text" class="edit-name flex-grow px-2 py-1 text-sm border dark:bg-slate-900 dark:border-slate-600 dark:text-white rounded outline-none focus:ring-1 focus:ring-brand-accent" value="${currentExp.name}">
                    </div>
                    <div class="grid grid-cols-3 gap-2">
                        <input type="number" step="any" class="edit-amount px-2 py-1 text-sm border dark:bg-slate-900 dark:border-slate-600 dark:text-white rounded" value="${currentExp.amount}">
                        <select class="edit-type px-1 py-1 text-[10px] font-bold border dark:bg-slate-900 dark:border-slate-600 dark:text-white rounded">
                            <option value="variable" ${currentExp.type === 'variable' ? 'selected' : ''}>Variable</option>
                            <option value="fixed_monthly" ${currentExp.type === 'fixed_monthly' ? 'selected' : ''}>Fijo</option>
                        </select>
                        <select class="edit-freq px-1 py-1 text-[10px] font-bold border dark:bg-slate-900 dark:border-slate-600 dark:text-white rounded">
                            <option value="daily" ${currentExp.frequency === 'daily' ? 'selected' : ''}>Diario</option>
                            <option value="weekly" ${currentExp.frequency === 'weekly' ? 'selected' : ''}>Semanal</option>
                            <option value="biweekly" ${currentExp.frequency === 'biweekly' ? 'selected' : ''}>Quincenal</option>
                            <option value="monthly" ${currentExp.frequency === 'monthly' ? 'selected' : ''}>Mensual</option>
                            <option value="workdays" ${currentExp.frequency === 'workdays' ? 'selected' : ''}>Lun-Vie</option>
                            <option value="specific_days" ${currentExp.frequency === 'specific_days' ? 'selected' : ''}>Días Esp.</option>
                        </select>
                    </div>
                    <div id="editSpecificDaysSelector" class="${currentExp.frequency === 'specific_days' ? '' : 'hidden'} animate-fade-in flex flex-col gap-2 p-3 bg-white dark:bg-slate-800 rounded-lg border border-brand-accent/30">
                        <label class="text-xs font-bold text-brand-accent">Selecciona los días:</label>
                        <div class="flex flex-wrap gap-2">
                            <label class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-brand-accent/20 cursor-pointer transition-colors text-xs">
                                <input type="checkbox" value="1" class="edit-day-check" ${currentExp.specificDays && currentExp.specificDays.includes(1) ? 'checked' : ''}> Lun
                            </label>
                            <label class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-brand-accent/20 cursor-pointer transition-colors text-xs">
                                <input type="checkbox" value="2" class="edit-day-check" ${currentExp.specificDays && currentExp.specificDays.includes(2) ? 'checked' : ''}> Mar
                            </label>
                            <label class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-brand-accent/20 cursor-pointer transition-colors text-xs">
                                <input type="checkbox" value="3" class="edit-day-check" ${currentExp.specificDays && currentExp.specificDays.includes(3) ? 'checked' : ''}> Mié
                            </label>
                            <label class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-brand-accent/20 cursor-pointer transition-colors text-xs">
                                <input type="checkbox" value="4" class="edit-day-check" ${currentExp.specificDays && currentExp.specificDays.includes(4) ? 'checked' : ''}> Jue
                            </label>
                            <label class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-brand-accent/20 cursor-pointer transition-colors text-xs">
                                <input type="checkbox" value="5" class="edit-day-check" ${currentExp.specificDays && currentExp.specificDays.includes(5) ? 'checked' : ''}> Vie
                            </label>
                            <label class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-brand-accent/20 cursor-pointer transition-colors text-xs">
                                <input type="checkbox" value="6" class="edit-day-check" ${currentExp.specificDays && currentExp.specificDays.includes(6) ? 'checked' : ''}> Sáb
                            </label>
                            <label class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-brand-accent/20 cursor-pointer transition-colors text-xs">
                                <input type="checkbox" value="0" class="edit-day-check" ${currentExp.specificDays && currentExp.specificDays.includes(0) ? 'checked' : ''}> Dom
                            </label>
                        </div>
                    </div>
                    <div class="flex justify-end gap-2">
                        <button type="button" class="cancel-edit text-[10px] font-bold text-gray-400 hover:text-red-500 uppercase">Cancelar</button>
                        <button type="button" class="save-edit px-3 py-1 bg-brand-mint text-brand-slate rounded text-xs font-bold">Guardar</button>
                    </div>
                </div>
            `;

            li.querySelector('.cancel-edit').addEventListener('click', renderViewMode);

            // Toggle specific days selector visibility in edit mode
            const editFreqSelect = li.querySelector('.edit-freq');
            const editDaysSelector = li.querySelector('#editSpecificDaysSelector');
            editFreqSelect.addEventListener('change', () => {
                if (editFreqSelect.value === 'specific_days') {
                    editDaysSelector.classList.remove('hidden');
                } else {
                    editDaysSelector.classList.add('hidden');
                }
            });

            li.querySelector('.save-edit').addEventListener('click', () => {
                currentExp.name = li.querySelector('.edit-name').value.trim();
                let editAmount = parseFloat(li.querySelector('.edit-amount').value);
                currentExp.amount = isNaN(editAmount) || editAmount < 0 ? 0 : editAmount;
                currentExp.color = li.querySelector('.edit-color').value;
                currentExp.type = li.querySelector('.edit-type').value;
                currentExp.frequency = li.querySelector('.edit-freq').value;

                // Collect specific days if frequency is specific_days
                if (currentExp.frequency === 'specific_days') {
                    const specificDays = [];
                    li.querySelectorAll('.edit-day-check:checked').forEach(chk => {
                        specificDays.push(parseInt(chk.value));
                    });
                    if (specificDays.length === 0) {
                        alert("Selecciona al menos un día para la frecuencia específica.");
                        return;
                    }
                    currentExp.specificDays = specificDays;
                } else {
                    currentExp.specificDays = null;
                }

                renderViewMode();
                updateUI();
            });
        };

        renderViewMode();
        expensesList.appendChild(li);
    };

    // Event Listeners for Simulator v5
    incomeInput.addEventListener('input', updateUI);
    frequencySelect.addEventListener('change', updateUI);
    budgetPeriodNum.addEventListener('input', updateBudgetLimits);
    budgetPeriodType.addEventListener('change', updateBudgetLimits);

    addExpenseForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const typeInput = document.getElementById('expenseType');
        const colorInput = document.getElementById('expenseColor');
        const nameInput = document.getElementById('expenseName');
        const amountInput = document.getElementById('expenseAmount');
        const freqInput = document.getElementById('expenseFrequency');

        // Validate amount before processing
        let amount = parseFloat(amountInput.value);
        if (isNaN(amount) || amount < 0) {
            console.warn("[app.js] Invalid amount entered:", amountInput.value, "- forcing to 0");
            amount = 0;
        }

        // Specific days
        const specificDays = [];
        if (freqInput.value === 'specific_days') {
            document.querySelectorAll('.day-check:checked').forEach(chk => {
                specificDays.push(parseInt(chk.value));
            });
            if (specificDays.length === 0) {
                alert("Selecciona al menos un día para la frecuencia específica.");
                return;
            }
        }

        const name = nameInput.value.trim();

        if (!name) {
            console.warn("[app.js] Expense name is empty, skipping");
            return;
        }

        const newExpense = calc.addExpense(name, amount, colorInput.value, freqInput.value, typeInput.value, specificDays);

        // IMPORTANT: Don't render the expense directly - let updateUI() handle it
        // The raw expense from addExpense() doesn't have calculatedAmount yet
        // updateUI() calls calc.getExpenses() which adds calculatedAmount to each expense

        nameInput.value = '';
        amountInput.value = '';
        specificDaysSelector.classList.add('hidden');
        document.querySelectorAll('.day-check').forEach(chk => chk.checked = false);

        const palette = ['#f87171', '#fb923c', '#fbbf24', '#34d399', '#2dd4bf', '#38bdf8', '#818cf8', '#a78bfa', '#e879f9', '#f472b6'];
        colorInput.value = palette[Math.floor(Math.random() * palette.length)];

        nameInput.focus();

        // Call updateUI which will fetch expenses with calculatedAmount via calc.getExpenses()
        updateUI();
    });

    // ---- TARJETAS DE CRÉDITO SYSTEM ----
    const addCardForm = document.getElementById('addCardForm');
    const cardsList = document.getElementById('cardsList');
    const emptyCards = document.getElementById('emptyCards');

    const renderCardItem = (card) => {
        const div = document.createElement('div');
        div.className = "bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm flex items-center justify-between";
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-brand-accent rounded-lg flex items-center justify-center">
                    <i class="ph-fill ph-credit-card text-xl"></i>
                </div>
                <div>
                    <h4 class="font-bold text-slate-800 dark:text-white text-sm">${card.name}</h4>
                    <p class="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold tracking-wider">Corte: Día ${card.cut_off_day} | Deuda: ${formatCurrency(card.amount)}</p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button class="toggle-card text-xs font-bold px-2 py-1 rounded transition ${card.is_active_in_sim ? 'bg-brand-mint text-brand-slate' : 'bg-gray-200 text-gray-500'}">
                    ${card.is_active_in_sim ? 'Activa' : 'Pausar'}
                </button>
                <button class="delete-card text-gray-400 hover:text-red-500 p-2 transition-colors"><i class="ph-bold ph-trash"></i></button>
            </div>
        `;

        div.querySelector('.delete-card').addEventListener('click', () => {
            creditCards = creditCards.filter(c => c !== card);
            div.remove();
            if (creditCards.length === 0) emptyCards.classList.remove('hidden');
            updateUI();
        });

        div.querySelector('.toggle-card').addEventListener('click', () => {
            card.is_active_in_sim = !card.is_active_in_sim;
            renderCardItem_UpdateInPlace(div, card);
            updateUI();
        });

        emptyCards.classList.add('hidden');
        cardsList.appendChild(div);
    };

    const renderCardItem_UpdateInPlace = (div, card) => {
        const btn = div.querySelector('.toggle-card');
        btn.textContent = card.is_active_in_sim ? 'Activa' : 'Pausar';
        btn.className = `toggle-card text-xs font-bold px-2 py-1 rounded transition ${card.is_active_in_sim ? 'bg-brand-mint text-brand-slate' : 'bg-gray-200 dark:bg-slate-700 text-gray-500'}`;
    };

    addCardForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const card = {
            name: document.getElementById('cardName').value,
            cut_off_day: parseInt(document.getElementById('cardCutOff').value),
            payment_day: parseInt(document.getElementById('cardPayment').value),
            amount: parseFloat(document.getElementById('cardAmount').value),
            is_active_in_sim: true
        };
        creditCards.push(card);
        renderCardItem(card);
        addCardForm.reset();
        updateUI();
        showToast('Tarjeta añadida y sincronizada');
    });

    // ---- AUTH & CLOUD SYNC SYSTEM ----
    let currentUser = null;
    let autoSyncTimeout = null;
    let isFetchingCloudData = false;

    const authModal = document.getElementById('authModal');
    const closeAuthBtn = document.getElementById('closeAuthBtn');
    const authForm = document.getElementById('authForm');
    const authMode = document.getElementById('authMode');
    const authTitle = document.getElementById('authTitle');
    const authSubmitText = document.getElementById('authSubmitText');
    const authToggleBtn = document.getElementById('authToggleBtn');
    const authToggleText = document.getElementById('authToggleText');
    const authErrorMsg = document.getElementById('authErrorMsg');
    const loginTriggerBtn = document.getElementById('loginTriggerBtn');

    // Profile Elements
    const profileModal = document.getElementById('profileModal');
    const closeProfileBtn = document.getElementById('closeProfileBtn');
    const profileLogoutBtn = document.getElementById('profileLogoutBtn');
    const profileForm = document.getElementById('profileForm');
    const profileSubmitBtn = document.getElementById('profileSubmitBtn');
    const profileAvatarInput = document.getElementById('profileAvatarInput');
    const profileAvatarPreview = document.getElementById('profileAvatarPreview');
    const profileAvatarPlaceholder = document.getElementById('profileAvatarPlaceholder');
    const profileErrorMsg = document.getElementById('profileErrorMsg');

    const updateAuthUI = (username, firstName = '', avatarPath = '') => {
        currentUser = username;

        const textInfo = document.getElementById('headerTextInfo');
        const headerName = document.getElementById('headerName');
        const avatarCircle = document.getElementById('headerAvatarCircle');
        const defaultIcon = document.getElementById('defaultUserIcon');
        const avatarImg = document.getElementById('headerAvatarImg');

        if (username) {
            textInfo.classList.remove('hidden');
            textInfo.querySelector('p:first-child').textContent = 'Bienvenido';
            headerName.textContent = firstName ? firstName : username;

            avatarCircle.className = "flex items-center justify-center bg-white group-hover:bg-gray-50 rounded-full transition-all shadow-md group-hover:shadow-lg w-10 h-10 sm:w-11 sm:h-11 overflow-hidden border border-emerald-400 z-10";

            if (avatarPath) {
                defaultIcon.classList.add('hidden');
                avatarImg.src = `${avatarPath}?cb=${new Date().getTime()}`;
                avatarImg.classList.remove('hidden');
            } else {
                defaultIcon.classList.remove('hidden');
                defaultIcon.className = "ph-fill ph-user-circle text-emerald-500 text-3xl";
                avatarImg.classList.add('hidden');
            }
        } else {
            textInfo.classList.remove('hidden');
            textInfo.querySelector('p:first-child').textContent = 'Nube Segura';
            headerName.textContent = 'Iniciar Sesión';

            avatarCircle.className = "flex items-center justify-center bg-brand-accent group-hover:bg-indigo-500 text-white rounded-full transition-all shadow-md group-hover:shadow-lg w-10 h-10 sm:w-11 sm:h-11 overflow-hidden border-2 border-transparent z-10";

            defaultIcon.classList.remove('hidden');
            defaultIcon.className = "ph-bold ph-user text-xl";
            avatarImg.classList.add('hidden');
        }
    };

    // Sincronización Blindada
    let dataLoaded = false;

    // Auto-save to cloud ☁️
    window.triggerCloudSync = () => {
        if (!currentUser || isFetchingCloudData) return;

        if (!dataLoaded) {
            console.warn("⚠️ NexxoSync: Bloqueando guardado automático porque los datos aún no se han cargado inicialmente.");
            return;
        }

        clearTimeout(autoSyncTimeout);
        autoSyncTimeout = setTimeout(async () => {
            try {
                const payload = {
                    income: incomeInput.value,
                    frequency: frequencySelect.value,
                    periodValue: budgetPeriodNum.value + budgetPeriodType.value.charAt(0),
                    expenses: calc.expenses.map(e => ({
                        id: e.id,
                        name: e.name,
                        amount: e.amount,
                        color: e.color,
                        type: e.type,
                        frequency: e.frequency,
                        specific_days: e.specificDays
                    })),
                    credit_cards: creditCards
                };
                console.log("📤 Sincronizando con la nube:", payload);
                if (syncIndicator) {
                    syncIndicator.classList.add('animate-spin', 'text-indigo-500');
                    syncIndicator.classList.replace('ph-cloud-check', 'ph-arrows-clockwise');
                }

                const res = await fetch('api/data.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const responseData = await res.json();
                console.log("✅ Servidor respondió:", responseData);

                if (responseData.success) {
                    showToast('Progreso guardado en la nube');
                }

                if (syncIndicator) {
                    syncIndicator.classList.remove('animate-spin', 'text-indigo-500');
                    syncIndicator.classList.replace('ph-arrows-clockwise', 'ph-cloud-check');
                    syncIndicator.classList.add('text-emerald-500');
                    setTimeout(() => syncIndicator.classList.remove('text-emerald-500'), 2000);
                }
            } catch (e) {
                console.error("Cloud sync err: ", e);
                if (syncIndicator) {
                    syncIndicator.classList.remove('animate-spin');
                    syncIndicator.classList.replace('ph-arrows-clockwise', 'ph-cloud-warning');
                    syncIndicator.classList.add('text-rose-500');
                }
                showToast('Error de sincronización', 'error');
            }
        }, 1500);
    };

    const fetchCloudData = async () => {
        try {
            isFetchingCloudData = true;
            const res = await fetch('api/data.php');

            // Si el servidor retorna error o no es JSON
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            console.log("📥 Datos recuperados de la nube:", data);

            if (data.success && data.data) {
                incomeInput.value = data.data.income || '';
                frequencySelect.value = data.data.frequency || 'monthly';

                // Parse periodValue (e.g. "1m")
                const pv = data.data.periodValue || '1m';
                budgetPeriodNum.value = parseInt(pv);
                const pt = pv.slice(-1);
                if (pt === 'd') budgetPeriodType.value = 'days';
                else if (pt === 'w') budgetPeriodType.value = 'weeks';
                else if (pt === 'b') budgetPeriodType.value = 'biweeks';
                else budgetPeriodType.value = 'months';

                calc.expenses = [];
                emptyExpenses.style.display = 'none';
                document.querySelectorAll('.expense-item-enter').forEach(el => el.remove());

                if (data.data.expenses) {
                    data.data.expenses.forEach(e => {
                        const added = calc.addExpense(e.name, e.amount, e.color, e.frequency, e.type, e.specific_days);
                        added.id = e.id;
                        calc.nextExpenseId = Math.max(calc.nextExpenseId, e.id + 1);
                        renderExpenseItem(added);
                    });
                }

                creditCards = data.data.credit_cards || [];
                cardsList.querySelectorAll('.bg-white').forEach(el => el.remove());
                creditCards.forEach(c => renderCardItem(c));

                // DATA LOADED SUCCESSFULLY
                dataLoaded = true;
                console.log("🚀 NexxoSync: Datos cargados y sincronización habilitada.");
            }
        } catch (e) {
            console.error("Error cargando datos:", e);
            dataLoaded = false;
        } finally {
            isFetchingCloudData = false;
            updateUI();
        }
    };

    fetch('api/auth.php?action=check')
        .then(r => r.json())
        .then(d => {
            if (d.success) {
                updateAuthUI(d.data.username, d.data.first_name, d.data.avatar);
                fetchCloudData();
            }
        });

    // Profile Upload Logic
    let cropperInstance = null;
    let croppedAvatarBlob = null;

    const cropperModal = document.getElementById('cropperModal');
    const cropperImage = document.getElementById('cropperImage');
    const closeCropperBtn = document.getElementById('closeCropperBtn');
    const cancelCropperBtn = document.getElementById('cancelCropperBtn');
    const applyCropBtn = document.getElementById('applyCropBtn');

    const destroyCropper = () => {
        if (cropperInstance) {
            cropperInstance.destroy();
            cropperInstance = null;
        }
        cropperModal.classList.add('hidden');
        profileAvatarInput.value = '';
    };

    closeCropperBtn.addEventListener('click', destroyCropper);
    cancelCropperBtn.addEventListener('click', destroyCropper);

    document.getElementById('avatarUploadContainer').addEventListener('click', () => profileAvatarInput.click());

    profileAvatarInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                cropperImage.src = e.target.result;
                cropperModal.classList.remove('hidden');
                if (cropperInstance) cropperInstance.destroy();
                cropperInstance = new Cropper(cropperImage, {
                    aspectRatio: 1,
                    viewMode: 1,
                    autoCropArea: 1,
                    background: false
                });
            };
            reader.readAsDataURL(file);
        }
    });

    applyCropBtn.addEventListener('click', () => {
        if (!cropperInstance) return;
        applyCropBtn.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i> Cortando...';
        const canvas = cropperInstance.getCroppedCanvas({ width: 400, height: 400 });
        canvas.toBlob((blob) => {
            croppedAvatarBlob = blob;
            const croppedUrl = URL.createObjectURL(blob);
            profileAvatarPlaceholder.classList.add('hidden');
            profileAvatarPreview.classList.remove('hidden');
            profileAvatarPreview.src = croppedUrl;
            applyCropBtn.innerHTML = '<i class="ph-bold ph-crop"></i> Aplicar';
            destroyCropper();
        }, 'image/jpeg', 0.9);
    });

    loginTriggerBtn.addEventListener('click', async () => {
        if (currentUser) {
            profileModal.classList.remove('hidden');
            profileErrorMsg.classList.add('hidden');
            profileSubmitBtn.querySelector('span').textContent = 'Guardar Perfil';
            croppedAvatarBlob = null;
            const res = await fetch('api/profile.php');
            const data = await res.json();
            if (data.success && data.data) {
                document.getElementById('profileFirst').value = data.data.first_name || '';
                document.getElementById('profileLast').value = data.data.last_name || '';
                document.getElementById('profileEmail').value = data.data.email || '';
                document.getElementById('profilePhone').value = data.data.phone || '';
                if (data.data.avatar) {
                    profileAvatarPlaceholder.classList.add('hidden');
                    profileAvatarPreview.classList.remove('hidden');
                    profileAvatarPreview.src = `${data.data.avatar}?cb=${new Date().getTime()}`;
                } else {
                    profileAvatarPlaceholder.classList.remove('hidden');
                    profileAvatarPreview.classList.add('hidden');
                    profileAvatarPreview.src = '';
                }
            }
        } else {
            authModal.classList.remove('hidden');
        }
    });

    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        profileErrorMsg.classList.add('hidden');
        profileSubmitBtn.querySelector('span').textContent = 'Subiendo...';
        const fd = new FormData();
        fd.append('first_name', document.getElementById('profileFirst').value);
        fd.append('last_name', document.getElementById('profileLast').value);
        fd.append('email', document.getElementById('profileEmail').value);
        fd.append('phone', document.getElementById('profilePhone').value);
        if (croppedAvatarBlob) fd.append('avatar_file', croppedAvatarBlob, 'avatar.jpg');
        try {
            const res = await fetch('api/profile.php', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.success) {
                updateAuthUI(currentUser, document.getElementById('profileFirst').value, data.data.avatar);
                profileErrorMsg.className = "text-emerald-600 text-sm font-medium bg-emerald-50 border border-emerald-100 p-3 rounded-lg flex items-center gap-2";
                profileErrorMsg.querySelector('span').textContent = "¡Perfil actualizado con éxito!";
                profileErrorMsg.classList.remove('hidden');
                setTimeout(() => profileModal.classList.add('hidden'), 1500);
            }
        } catch (e) {
            console.error(e);
        } finally {
            profileSubmitBtn.querySelector('span').textContent = 'Guardar Perfil';
        }
    });

    profileLogoutBtn.addEventListener('click', () => {
        fetch('api/auth.php?action=logout').then(() => {
            profileModal.classList.add('hidden');
            updateAuthUI(null);
            calc.expenses = [];
            creditCards = [];
            document.querySelectorAll('.expense-item-enter').forEach(el => el.remove());
            incomeInput.value = '';
            emptyExpenses.style.display = 'flex';
            updateUI();
            showToast('Sesión cerrada correctamente');
            switchView('inicioView');
        });
    });

    closeProfileBtn.addEventListener('click', () => profileModal.classList.add('hidden'));
    closeAuthBtn.addEventListener('click', () => authModal.classList.add('hidden'));

    authToggleBtn.addEventListener('click', () => {
        if (authMode.value === 'login') {
            authMode.value = 'register';
            authTitle.textContent = "Crea una Cuenta";
            authSubmitText.textContent = "Registrarme";
            authToggleText.textContent = "¿Ya tienes cuenta?";
            authToggleBtn.textContent = "Inicia Sesión";
            document.getElementById('authEmailContainer').classList.remove('hidden');
            document.getElementById('authEmail').setAttribute('required', 'true');
        } else {
            authMode.value = 'login';
            authTitle.textContent = "Iniciar Sesión";
            authSubmitText.textContent = "Entrar";
            authToggleText.textContent = "¿No tienes cuenta?";
            authToggleBtn.textContent = "Regístrate gratis";
            document.getElementById('authEmailContainer').classList.add('hidden');
            document.getElementById('authEmail').removeAttribute('required');
        }
        authErrorMsg.classList.add('hidden');
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('authUsername').value;
        const password = document.getElementById('authPassword').value;
        const action = authMode.value;
        let email = '';
        if (action === 'register') {
            email = document.getElementById('authEmail').value.trim();
        }

        authErrorMsg.classList.add('hidden');
        authSubmitText.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i> Procesando...';

        try {
            const res = await fetch(`api/auth.php?action=${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, email })
            });

            if (!res.ok) throw new Error("Servidor no respondió correctamente");

            const data = await res.json();
            if (data.success) {
                authModal.classList.add('hidden');
                updateAuthUI(data.data.username, data.data.first_name, data.data.avatar);

                if (action === 'login') {
                    fetchCloudData();
                } else {
                    calc.expenses = [];
                    creditCards = [];
                    updateUI();
                    document.getElementById('profileModal').classList.remove('hidden');
                    showToast('¡Cuenta creada! Completa tu perfil.');
                }
                switchView('calculatorView');
                authForm.reset();
            } else {
                authErrorMsg.querySelector('span').textContent = data.error || "Ocurrió un error inesperado";
                authErrorMsg.classList.remove('hidden');
            }
        } catch (e) {
            console.error("Auth err:", e);
            authErrorMsg.querySelector('span').textContent = "Error de conexión o base de datos. Asegúrate de que MySQL esté activo y hayas corrido /api/setup.php";
            authErrorMsg.classList.remove('hidden');
        } finally {
            authSubmitText.textContent = action === 'login' ? "Entrar" : "Registrarme";
        }
    });

    // --- DARK MODE TOGGLE ---
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const themeToggleIcon = document.getElementById('themeToggleIcon');
    const htmlEl = document.documentElement;
    const applyDarkTheme = (isDark) => {
        if (isDark) {
            htmlEl.classList.add('dark');
            if (themeToggleIcon) themeToggleIcon.classList.replace('ph-moon', 'ph-sun');
        } else {
            htmlEl.classList.remove('dark');
            if (themeToggleIcon) themeToggleIcon.classList.replace('ph-sun', 'ph-moon');
        }
    };
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) applyDarkTheme(true);
    else applyDarkTheme(false);
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            if (htmlEl.classList.contains('dark')) {
                applyDarkTheme(false);
                localStorage.setItem('theme', 'light');
            } else {
                applyDarkTheme(true);
                localStorage.setItem('theme', 'dark');
            }
        });
    }

    // --- SAVINGS GOAL LOGIC ---
    const goalNameInput = document.getElementById('goalName');
    const goalAmountInput = document.getElementById('goalAmount');
    const goalProgressBar = document.getElementById('goalProgressBar');
    const goalPredictionText = document.getElementById('goalPredictionText');
    const calculateSavingsGoal = (remainingBudget) => {
        if (!goalAmountInput) return;
        const cost = parseFloat(goalAmountInput.value);
        if (isNaN(cost) || cost <= 0 || remainingBudget <= 0) {
            goalProgressBar.style.width = '0%';
            goalPredictionText.textContent = remainingBudget <= 0 ? "Presupuesto agotado." : "Configura tu meta.";
            return;
        }
        const budgetDays = calc.getBudgetDays();
        const surplusPerDay = remainingBudget / budgetDays;
        const daysToGoal = cost / surplusPerDay;
        const totalMonths = Math.floor(daysToGoal / 30.41);
        const totalDaysRem = Math.floor(daysToGoal % 30.41);
        goalPredictionText.textContent = `¡Meta lista en aprox. ${totalMonths} meses y ${totalDaysRem} días!`;
        goalProgressBar.className = "bg-brand-accent h-2 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all duration-1000 w-full";
    };
    if (goalNameInput) goalNameInput.addEventListener('input', () => calculateSavingsGoal(calc.getRemainingBudget()));
    if (goalAmountInput) goalAmountInput.addEventListener('input', () => calculateSavingsGoal(calc.getRemainingBudget()));

    updateUI();
});
