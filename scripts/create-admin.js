import { sequelize } from '#models/index';
import { buildContainer } from '#src/container';
import { SERVICE_KEYS } from '#constants/singleton';

const [name, email, password] = process.argv.slice(2);

if (!name || !email || !password) {
  console.error('Usage: node scripts/create-admin.js "Name" "email@example.com" "password"');
  process.exit(1);
}

const adminService = buildContainer().resolve(SERVICE_KEYS.ADMIN);
const admin = await adminService.create({ name, email, password });
console.log(`Admin created: id=${admin.id} email=${admin.email}`);

await sequelize.close();
process.exit(0);
