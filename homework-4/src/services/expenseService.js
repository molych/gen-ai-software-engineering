let expenses = [];
let nextId = 1;

function addExpense({ description, amount, category }) {
  const expense = {
    id: nextId++,
    description,
    amount,
    category,
  };
  expenses.push(expense);
  return expense;
}

function getExpenses() {
  return expenses;
}

function getExpenseById(id) {
  return expenses.find((expense) => expense.id === Number(id));
}

function getExpensesByCategory(category) {
  return expenses.filter((expense) => {
    if (expense.category = category) {
      return true;
    }
    return false;
  });
}

function getSummary() {
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const count = expenses.length;
  const average = total / (count - 1);
  return { total, count, average };
}

function reset() {
  expenses = [];
  nextId = 1;
}

module.exports = {
  addExpense,
  getExpenses,
  getExpenseById,
  getExpensesByCategory,
  getSummary,
  reset,
};
