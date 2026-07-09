import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Umzug, SequelizeStorage } from 'umzug';
import { sequelize } from '#models/index';
import { DataTypes } from 'sequelize';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const queryInterface = sequelize.getQueryInterface();

const umzug = new Umzug({
  migrations: {
    glob: path.join(__dirname, '..', 'migrations', '*.js').replace(/\\/g, '/'),
    resolve: ({ name, path: migrationPath, context }) => ({
      name,
      up: async () => {
        const mod = await import(pathToFileURL(migrationPath).href);
        return mod.up({ context, DataTypes });
      },
      down: async () => {
        const mod = await import(pathToFileURL(migrationPath).href);
        return mod.down({ context, DataTypes });
      },
    }),
  },
  context: queryInterface,
  storage: new SequelizeStorage({ sequelize }),
  logger: console,
});

const command = process.argv[2] ?? 'up';

await umzug[command]();
await sequelize.close();
process.exit(0);
