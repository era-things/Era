import { createServer } from 'vite';

const { ERA_VERIFY_URL, ERA_VERIFY_HEALTH } = process.env;
if (!ERA_VERIFY_URL || !ERA_VERIFY_HEALTH)
	throw new Error('Start this server with the verify script.');

const url = new URL(ERA_VERIFY_URL);
process.env.ERA_DB = ':memory:';
process.env.ERA_VERIFY_TIMELINE = '1';
const server = await createServer({
	server: { host: '127.0.0.1', port: Number(url.port), strictPort: true },
	plugins: [
		{
			name: 'era-verification-server',
			configureServer(server) {
				server.middlewares.use((request, response, next) => {
					if (request.url !== ERA_VERIFY_HEALTH) return next();
					response.end('Era verification server');
				});
			}
		}
	]
});
await server.listen();
server.printUrls();
