import { createContainer, asClass, asValue, InjectionMode } from 'awilix';
import { registerRepositories } from '#repositories/index';
import { registerServices } from '#services/index';
import { registerControllers } from '#controllers/index';

export function buildContainer() {
  const container = createContainer({ injectionMode: InjectionMode.PROXY });

  container.registerSingleton = (key, Class) => container.register({ [key]: asClass(Class).singleton() });
  container.register({ container: asValue(container) });

  registerRepositories(container);
  registerServices(container);
  registerControllers(container);

  return container;
}
