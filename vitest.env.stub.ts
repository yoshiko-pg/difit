const env = {
  MODE: process.env.MODE ?? 'test',
  DEV: false,
  PROD: true,
  SSR: false,
  BASE_URL: '/',
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith('VITE_'))),
};

export const __vite_env__ = env;

export default env;
