import request from "supertest";
import app from "../app.js";

// Integration tests hit the REAL Express app (routes, middleware, Mongoose
// models) end-to-end through Supertest, the same way a real HTTP client
// would - the only thing swapped out is the database, which points at the
// in-memory MongoDB started in tests/setup.js.

const validUser = {
  name: "Test User",
  email: "testuser@example.com",
  password: "password123"
};

describe("POST /api/auth/signup", () => {
  test("creates a new user and returns a token", async () => {
    const res = await request(app).post("/api/auth/signup").send(validUser);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user).toMatchObject({
      name: validUser.name,
      email: validUser.email
    });
    // Password must never be echoed back to the client.
    expect(res.body.user.password).toBeUndefined();
  });

  test("rejects signup when a required field is missing", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "missing-fields@example.com", password: "password123" }); // no name

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  test("rejects a password shorter than 6 characters", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ ...validUser, email: "shortpw@example.com", password: "123" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least 6 characters/i);
  });

  test("rejects a duplicate email with 409 Conflict", async () => {
    await request(app).post("/api/auth/signup").send(validUser); // first signup succeeds

    const res = await request(app).post("/api/auth/signup").send(validUser); // second attempt, same email

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  test("stores the password hashed, not in plain text", async () => {
    await request(app).post("/api/auth/signup").send(validUser);

    const User = (await import("../models/User.js")).default;
    const stored = await User.findOne({ email: validUser.email });

    expect(stored.password).not.toBe(validUser.password);
    expect(stored.password.length).toBeGreaterThan(20); // bcrypt hashes are long
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/api/auth/signup").send(validUser);
  });

  test("logs in with correct credentials and returns a token", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: validUser.email, password: validUser.password });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user.email).toBe(validUser.email);
  });

  test("rejects an unknown email with 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: validUser.password });

    expect(res.status).toBe(401);
  });

  test("rejects a wrong password with 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: validUser.email, password: "wrongpassword" });

    expect(res.status).toBe(401);
  });

  test("does not leak whether it was the email or password that was wrong", async () => {
    // Security check: both failure cases should return the exact same
    // generic message, so an attacker can't use the error to enumerate
    // which emails are registered.
    const wrongEmail = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: validUser.password });
    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: validUser.email, password: "wrongpassword" });

    expect(wrongEmail.body.error).toBe(wrongPassword.body.error);
  });
});

describe("GET /api/auth/me", () => {
  let token;

  beforeEach(async () => {
    const res = await request(app).post("/api/auth/signup").send(validUser);
    token = res.body.token;
  });

  test("returns the logged-in user's profile when given a valid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(validUser.email);
    expect(res.body.password).toBeUndefined(); // .select("-password") should strip it
  });

  test("rejects the request with 401 when no token is provided", async () => {
    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
  });

  test("rejects the request with 403 when the token is invalid", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer not-a-real-token");

    expect(res.status).toBe(403);
  });
});
