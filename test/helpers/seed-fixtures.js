import { sequelize } from '#models/index';

export async function seedWithTransaction(fixtures) {
  const transaction = await sequelize.transaction();

  for (const { table, rows } of fixtures) {
    await sequelize.getQueryInterface().bulkInsert(table, rows, { transaction });
  }

  return {
    transaction,
    run: (fn) => fn(transaction),
    rollback: () => transaction.rollback(),
  };
}
