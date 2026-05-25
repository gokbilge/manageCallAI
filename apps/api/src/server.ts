import { buildApp } from './app.js';
import { config } from './config/env.js';

const app = buildApp();

app.listen({ port: config.port, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
