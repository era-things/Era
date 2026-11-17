const mode = process.env.ERA_VERIFY_MODE;

export const usesDevServer = mode === 'browser' || mode === 'scenario';
export const productionOrigins = ['http://127.0.0.1:41689', 'http://127.0.0.1:41692'];
