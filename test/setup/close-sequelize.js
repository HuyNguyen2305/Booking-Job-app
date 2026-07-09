import { afterAll } from '@jest/globals';
import { sequelize } from '#models/index';

afterAll(async () => {
  await sequelize.close();
});
