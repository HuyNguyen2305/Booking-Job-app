import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Fastify from 'fastify';
import AutoLoad from '@fastify/autoload';
import Swagger from '@fastify/swagger';
import SwaggerUI from '@fastify/swagger-ui';
import { buildContainer } from '#src/container';
import { CustomError } from '#configs/error';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function buildApp(opts = {}) {
  const fastify = Fastify({ logger: true, ...opts });

  fastify.decorate('container', buildContainer());

  fastify.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      return reply.status(400).send({ success: false, message: 'Validation error', errors: error.validation });
    }
    if (error instanceof CustomError) {
      return reply.status(error.statusCode).send({ success: false, message: error.message, errors: error.errors });
    }
    request.log.error(error);
    return reply.status(500).send({ success: false, message: 'Internal server error' });
  });

  await fastify.register(Swagger, {
    openapi: {
      info: {
        title: 'Booking Job API',
        description: 'RESTful API for booking a worker for a job.',
        version: '1.0.0',
      },
      tags: [{ name: 'Bookings', description: 'Booking scheduling endpoints' }],
    },
  });

  await fastify.register(SwaggerUI, {
    routePrefix: '/documentation',
  });

  await fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routers'),
    maxDepth: 1,
    matchFilter: (filePath) => filePath.endsWith('.router.js'),
  });

  return fastify;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = await buildApp();
  await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });
}
