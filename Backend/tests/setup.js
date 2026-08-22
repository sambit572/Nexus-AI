import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

// This file runs once before every test file (see jest.config.js
// `setupFilesAfterEnv`). It boots a real, temporary, in-memory MongoDB
// instance for the whole test run - so integration tests exercise the
// actual Mongoose models and queries, but never touch your real
// database or need a running `mongod` on your machine.

// Fixed test secrets so auth/JWT tests are deterministic. Set BEFORE any
// app code (which reads these from process.env) is imported.
process.env.JWT_SECRET = "test-jwt-secret-do-not-use-in-production";
process.env.GEMINI_API_KEY = "test-gemini-key";

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterEach(async () => {
  // Wipe all collections between individual tests so one test's data
  // (e.g. a signed-up user) never leaks into and affects the next test.
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
});
