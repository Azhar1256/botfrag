import mongoose from 'mongoose';
import app from './app.js';
import config from './config.js';

try {
  await mongoose.connect(config.mongoUrl);
  app.listen(config.port, () => console.log(`Botfrag API on http://localhost:${config.port}`));
} catch (err) {
  console.error(`Could not connect to MongoDB at ${config.mongoUrl}\n`, err.message);
  process.exit(1);
}
