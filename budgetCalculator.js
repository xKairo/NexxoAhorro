/**
 * Core business logic for NexxoAhorroWS Simulator v5
 */

class BudgetCalculator {
    constructor() {
        this.baseIncome = 0;
        this.incomeFrequency = 'monthly';
        this.budgetNum = 1;
        this.budgetType = 'months';
        this.expenses = []; // {id, name, amount, color, frequency, type, specificDays}
        this.creditCards = []; // {id, name, amount, cutOffDay}
        this.nextExpenseId = 1;
        this.startDate = new Date(); // Referencia para conteo de días específicos

        this.freqDays = {
            daily: 1,
            weekly: 7,
            biweekly: 15,
            monthly: 30.4166,
            days: 1,
            weeks: 7,
            biweeks: 15,
            months: 30.4166
        };
    }

    setIncome(amount, frequency, budgetNum, budgetType) {
        this.baseIncome = parseFloat(amount) || 0;
        this.incomeFrequency = frequency;
        this.budgetNum = parseInt(budgetNum) || 1;
        this.budgetType = budgetType || 'months';
    }

    addExpense(name, amount, color, frequency = 'monthly', type = 'variable', specificDays = null) {
        const parsedAmount = parseFloat(amount);
        const validatedAmount = isNaN(parsedAmount) || parsedAmount < 0 ? 0 : parsedAmount;

        const expense = {
            id: this.nextExpenseId++,
            name: name,
            amount: validatedAmount,
            color: color,
            frequency: frequency,
            type: type, // 'variable' o 'fixed_monthly'
            specificDays: specificDays // Array de indices [1, 3, 5] (1=Lun)
        };
        this.expenses.push(expense);
        return expense;
    }

    setCreditCards(cards) {
        this.creditCards = cards;
    }

    getBudgetDays() {
        return this.budgetNum * this.freqDays[this.budgetType];
    }

    getTotalIncome() {
        const incomePerDay = this.baseIncome / this.freqDays[this.incomeFrequency];
        return incomePerDay * this.getBudgetDays();
    }

    /**
     * Calcula cuántas veces ocurre un conjunto de días de la semana en el periodo actual
     */
    countDayOccurrences(daysToMatch) {
        if (!daysToMatch || daysToMatch.length === 0) return 0;
        let count = 0;
        let tempDate = new Date(this.startDate);
        const totalDays = Math.ceil(this.getBudgetDays());

        for (let i = 0; i < totalDays; i++) {
            let dayOfWeek = tempDate.getDay(); // 0=Dom, 1=Lun...
            if (daysToMatch.includes(dayOfWeek)) {
                count++;
            }
            tempDate.setDate(tempDate.getDate() + 1);
        }
        return count;
    }

    calculateItemAmount(item) {
        const totalDays = this.getBudgetDays();
        const itemAmount = isNaN(item.amount) || item.amount === undefined ? 0 : item.amount;

        // Regla: Gastos fijos no se escalan proporcionalmente
        if (item.type === 'fixed_monthly') {
            const monthsCovered = Math.max(1, Math.ceil(this.getBudgetDays() / 30));
            return itemAmount * monthsCovered;
        }

        // REGLA 2: Nuevas Frecuencias
        if (item.frequency === 'workdays') {
            const occurrences = this.countDayOccurrences([1, 2, 3, 4, 5]);
            return itemAmount * occurrences;
        }

        if (item.frequency === 'specific_days' && item.specificDays) {
            const occurrences = this.countDayOccurrences(item.specificDays);
            return itemAmount * occurrences;
        }

        // Lógica estándar para gastos variables (proporcional)
        const freq = item.type === 'fixed_monthly' ? 'monthly' : (item.frequency || 'monthly');
        const freqDays = this.freqDays[freq] || 30.4166; // Fallback to monthly
        const expensePerDay = itemAmount / freqDays;
        return expensePerDay * totalDays;
    }

    getTotalExpenses() {
        return this.expenses.reduce((sum, item) => sum + this.calculateItemAmount(item), 0);
    }

    getRemainingBudget() {
        return this.getTotalIncome() - this.getTotalExpenses();
    }

    getExpenses() {
        return this.expenses.map(e => ({
            ...e,
            calculatedAmount: this.calculateItemAmount(e)
        }));
    }
}
