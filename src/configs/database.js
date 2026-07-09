import { Sequelize } from 'sequelize';

export function createSequelizeInstance() {
  return new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
  });
}
