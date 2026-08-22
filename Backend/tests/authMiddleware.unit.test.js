import { jest } from "@jest/globals";
import jwt from "jsonwebtoken";
import authMiddleware from "../middleware/auth.js";

// A true UNIT test: no Express app, no HTTP, no database. We call the
// middleware function directly with fake req/res/next objects and check
// exactly what it does with them. This isolates the middleware's own
// logic from everything around it.

function buildMockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("authMiddleware (unit)", () => {
  test("calls next() and attaches decoded user when the token is valid", () => {
    const payload = { id: "user123", email: "user@example.com" };
    const token = jwt.sign(payload, process.env.JWT_SECRET);

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = buildMockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject(payload);
    expect(res.status).not.toHaveBeenCalled();
  });

  test("returns 401 and does not call next() when no Authorization header is present", () => {
    const req = { headers: {} };
    const res = buildMockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringMatching(/no token/i) })
    );
  });

  test("returns 403 and does not call next() when the token is malformed", () => {
    const req = { headers: { authorization: "Bearer not-a-valid-jwt" } };
    const res = buildMockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("returns 403 when the token is expired", () => {
    const expiredToken = jwt.sign(
      { id: "user123" },
      process.env.JWT_SECRET,
      { expiresIn: -10 } // already expired 10 seconds ago
    );

    const req = { headers: { authorization: `Bearer ${expiredToken}` } };
    const res = buildMockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("returns 403 when the token was signed with a different secret", () => {
    const tokenFromWrongSecret = jwt.sign({ id: "user123" }, "some-other-secret");

    const req = { headers: { authorization: `Bearer ${tokenFromWrongSecret}` } };
    const res = buildMockRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
