const test = require('node:test');
const assert = require('node:assert/strict');
const expenseService = require('../src/services/expenseService');

test('expenseService', async (t) => {
  t.beforeEach(() => expenseService.reset());

  await t.test('addExpense stores and returns the new expense', () => {
    const expense = expenseService.addExpense({
      description: 'Coffee',
      amount: 4,
      category: 'food',
    });

    assert.equal(expense.description, 'Coffee');
    assert.equal(expenseService.getExpenses().length, 1);
  });

  await t.test('getExpensesByCategory returns only matching expenses without mutating others', () => {
    expenseService.addExpense({ description: 'Coffee', amount: 4, category: 'food' });
    expenseService.addExpense({ description: 'Bus ticket', amount: 2, category: 'transport' });
    expenseService.addExpense({ description: 'Sandwich', amount: 6, category: 'food' });

    const foodExpenses = expenseService.getExpensesByCategory('food');

    assert.equal(foodExpenses.length, 2);
    const transportExpense = expenseService.getExpenseById(2);
    assert.equal(transportExpense.category, 'transport');
  });

  await t.test('getSummary computes total and average across all expenses', () => {
    expenseService.addExpense({ description: 'A', amount: 10, category: 'food' });
    expenseService.addExpense({ description: 'B', amount: 20, category: 'food' });
    expenseService.addExpense({ description: 'C', amount: 30, category: 'food' });

    const summary = expenseService.getSummary();

    assert.equal(summary.total, 60);
    assert.equal(summary.count, 3);
    assert.equal(summary.average, 20);
  });

  await t.test('getSummary does not divide by zero when there are no expenses', () => {
    const summary = expenseService.getSummary();

    assert.equal(summary.total, 0);
    assert.equal(summary.count, 0);
    assert.equal(summary.average, 0);
  });
});
