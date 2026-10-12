import mongoose from 'mongoose';
import app from './app.js';
import config from './config.js';

try {
  await mongoose.connect(config.mongoUrl);
  // Brings indexes in line with the models (e.g. after the email index became sparse).
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  app.listen(config.port, () => console.log(`Botfrag API on http://localhost:${config.port}`));
} catch (err) {
  console.error(`Could not connect to MongoDB at ${config.mongoUrl}\n`, err.message);
  process.exit(1);
}
