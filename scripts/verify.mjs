import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const usage = `Usage:
  node scripts/verify.mjs unit [tests/file.test.ts ...]
  node scripts/verify.mjs browser [--warm] <spec> [Playwright options]
  node scripts/verify.mjs scenario [--warm] <name>
  node scripts/verify.mjs serve
  node scripts/verify.mjs full`;

const root = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
const vite = 'node_modules/vite/bin/vite.js';
const playwright = 'node_modules/@playwright/test/cli.js';
const warmUrl = 'http://127.0.0.1:41690';
const focusedUrl = 'http://127.0.0.1:41691';
const productionUrl = 'http://127.0.0.1:41689';
const healthPath = '/__era_verify/' + createHash('sha256').update(root).digest('hex');

function findBun() {
	const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
	const version = manifest.packageManager.slice('bun@'.length);
	const local = resolve(
		root,
		'node_modules/bun/bin',
		process.platform === 'win32' ? 'bun.exe' : 'bun'
	);
	for (const candidate of [local, 'bun']) {
		const result = spawnSync(candidate, ['--version'], { cwd: root, encoding: 'utf8' });
		if (result.status === 0 && result.stdout.trim() === version) return candidate;
	}
	throw new Error(
		`Bun ${version} is required. Put it on PATH or install it locally, then run bun install --frozen-lockfile.`
	);
}

function run(label, command, args, env = process.env) {
	const start = performance.now();
	console.log(`\n${label}`);
	const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
	if (result.error) throw result.error;
	console.log(
		`${label} ${result.status === 0 ? 'passed' : 'failed'} in ${((performance.now() - start) / 1000).toFixed(1)}s.`
	);
	return result.status ?? 1;
}

function unit(bun, files) {
	const temp = resolve(root, 'test-results/unit-tmp');
	mkdirSync(temp, { recursive: true });
	const inputs = files.length
		? files
		: readdirSync(resolve(root, 'tests'))
				.filter((file) => file.endsWith('.test.ts'))
				.map((file) => `tests/${file}`);
	return run('Bun tests', bun, ['test', '--only-failures', ...inputs], {
		...process.env,
		TMP: temp,
		TEMP: temp,
		TMPDIR: temp
	});
}

async function probeServer(url) {
	try {
		return await fetch(url + healthPath, { redirect: 'error', signal: AbortSignal.timeout(2000) });
	} catch (error) {
		if (['EACCES', 'EPERM'].includes(error.cause?.code)) {
			throw new Error(
				`Loopback access to ${url} is blocked (${error.cause.code}). Browser verification needs permission to connect to the local test server.`
			);
		}
	}
}

async function main([mode, ...args]) {
	if (!mode || mode === '--help' || mode === '-h') {
		console.log(usage);
		return 0;
	}
	if (!['unit', 'browser', 'scenario', 'serve', 'full'].includes(mode)) throw new Error(usage);
	const warm = args[0] === '--warm';
	if (warm && (mode === 'browser' || mode === 'scenario')) args.shift();
	if (
		(mode === 'browser' && (!args.length || args[0].startsWith('-'))) ||
		((mode === 'full' || mode === 'serve') && args.length)
	) {
		throw new Error(usage);
	}
	if (mode === 'scenario') {
		const [name] = args;
		if (
			args.length !== 1 ||
			!/^[a-z][a-z0-9-]*$/.test(name) ||
			!existsSync(resolve(root, `tests/scenarios/${name}.spec.ts`))
		) {
			const names = readdirSync(resolve(root, 'tests/scenarios'))
				.filter((file) => file.endsWith('.spec.ts'))
				.map((file) => file.slice(0, -'.spec.ts'.length));
			throw new Error(`Choose a scenario: ${names.join(', ')}`);
		}
		args = [`${name}.spec.ts`];
	}

	const bun = findBun();
	if (mode === 'unit') return unit(bun, args);

	const browserUrl =
		mode === 'full' ? productionUrl : warm || mode === 'serve' ? warmUrl : focusedUrl;
	const env = {
		...process.env,
		ERA_VERIFY_BUN: bun,
		ERA_VERIFY_URL: browserUrl,
		ERA_VERIFY_HEALTH: healthPath,
		ERA_VERIFY_WARM: warm ? '1' : '',
		ERA_VERIFY_MODE: mode
	};
	if (mode === 'serve') {
		await probeServer(browserUrl);
		return run('Verification server', bun, ['--bun', 'scripts/verify-server.ts'], env);
	}
	if (mode === 'full') {
		const result =
			unit(bun, []) ||
			run('SvelteKit sync', process.execPath, [
				'node_modules/@sveltejs/kit/svelte-kit.js',
				'sync'
			]) ||
			run('Svelte and TypeScript checks', process.execPath, [
				'node_modules/svelte-check/bin/svelte-check',
				'--tsconfig',
				'tsconfig.json'
			]) ||
			run('Production build', bun, ['--bun', vite, 'build', '--logLevel', 'warn']);
		if (result) return result;
		await probeServer(browserUrl);
		return run('Production browser suite', process.execPath, [playwright, 'test'], env);
	}
	if (!args.includes('--list')) {
		const response = await probeServer(browserUrl);
		if (warm && (!response?.ok || (await response.text()) !== 'Era verification server')) {
			throw new Error(
				`Cannot reach this checkout's verification server at ${browserUrl}. Start it with node scripts/verify.mjs serve, or omit --warm for a disposable server.`
			);
		}
	}
	return run(
		mode === 'scenario' ? 'Capture scenario' : 'Focused browser tests',
		process.execPath,
		[playwright, 'test', ...args],
		env
	);
}

try {
	process.exitCode = await main(process.argv.slice(2));
} catch (error) {
	console.error(error.message);
	process.exitCode = 1;
}
