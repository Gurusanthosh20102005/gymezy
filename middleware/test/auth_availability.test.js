import test from 'node:test';
import assert from 'node:assert';
import authRoutes from '../src/routes/auth.routes.js';
import {
  normalizePhoneNumber,
  checkPhoneAvailability,
  checkEmailAvailability,
} from '../src/controllers/auth.controller.js';
import User from '../src/models/user.model.js';
import Gym from '../src/models/gym.model.js';

test('Onboarding Mobile & Email Availability Verification Tests', async (t) => {
  await t.test('1. Auth routes expose /check-email and /check-phone endpoints', () => {
    const routeStack = authRoutes.stack || [];
    const registeredPaths = routeStack
      .filter((layer) => layer.route)
      .map((layer) => layer.route.path);

    assert.ok(
      registeredPaths.includes('/check-email'),
      '/check-email must be registered in authRoutes'
    );
    assert.ok(
      registeredPaths.includes('/check-phone'),
      '/check-phone must be registered in authRoutes'
    );
  });

  await t.test('2. normalizePhoneNumber correctly extracts 10 digits across phone formats', () => {
    assert.strictEqual(normalizePhoneNumber('9876543210'), '9876543210');
    assert.strictEqual(normalizePhoneNumber('+91 98765 43210'), '9876543210');
    assert.strictEqual(normalizePhoneNumber('919876543210'), '9876543210');
    assert.strictEqual(normalizePhoneNumber('09876543210'), '9876543210');
    assert.strictEqual(normalizePhoneNumber(''), '');
    assert.strictEqual(normalizePhoneNumber(null), '');
  });

  await t.test('3. checkPhoneAvailability validates presence and length', async () => {
    const reqEmpty = { query: {}, body: {} };
    let capturedErr = null;
    try {
      await checkPhoneAvailability(reqEmpty, {}, (err) => {
        capturedErr = err;
      });
    } catch (e) {
      capturedErr = e;
    }
    assert.ok(capturedErr, 'Should throw error when phone is missing');
    assert.strictEqual(capturedErr.statusCode, 400);

    const reqShort = { query: { phone: '12345' }, body: {} };
    capturedErr = null;
    try {
      await checkPhoneAvailability(reqShort, {}, (err) => {
        capturedErr = err;
      });
    } catch (e) {
      capturedErr = e;
    }
    assert.ok(capturedErr, 'Should throw error when phone is not 10 digits');
    assert.strictEqual(capturedErr.statusCode, 400);
  });

  await t.test('4. checkPhoneAvailability queries User and Gym collections and returns availability status', async () => {
    const origUserFindOne = User.findOne;
    const origGymFindOne = Gym.findOne;

    const invokeController = (fn, req) =>
      new Promise((resolve, reject) => {
        const res = {
          status: (code) => {
            assert.strictEqual(code, 200);
            return {
              json: (payload) => {
                resolve(payload);
                return payload;
              },
            };
          },
        };
        fn(req, res, (err) => {
          if (err) reject(err);
        });
      });

    try {
      // Mock: Neither exists (available)
      User.findOne = async () => null;
      Gym.findOne = async () => null;

      let resJson = await invokeController(checkPhoneAvailability, {
        query: { phone: '9876543210' },
        body: {},
      });
      assert.ok(resJson, 'Response should not be null');
      assert.strictEqual(resJson.data.isAvailable, true);
      assert.strictEqual(resJson.data.isExisting, false);
      assert.strictEqual(resJson.data.phone, '9876543210');

      // Mock: Exists in Gym
      Gym.findOne = async () => ({ _id: 'gym123', phone: '9876543210' });
      resJson = await invokeController(checkPhoneAvailability, {
        query: { phone: '9876543210' },
        body: {},
      });
      assert.strictEqual(resJson.data.isAvailable, false);
      assert.strictEqual(resJson.data.isExisting, true);

      // Mock: Exists in User
      Gym.findOne = async () => null;
      User.findOne = async () => ({ _id: 'user123', phone: '9876543210' });
      resJson = await invokeController(checkPhoneAvailability, {
        query: { phone: '9876543210' },
        body: {},
      });
      assert.strictEqual(resJson.data.isAvailable, false);
      assert.strictEqual(resJson.data.isExisting, true);
    } finally {
      User.findOne = origUserFindOne;
      Gym.findOne = origGymFindOne;
    }
  });

  await t.test('5. checkEmailAvailability queries User and Gym collections and returns availability status', async () => {
    const origUserFindOne = User.findOne;
    const origGymFindOne = Gym.findOne;

    const invokeController = (fn, req) =>
      new Promise((resolve, reject) => {
        const res = {
          status: (code) => {
            assert.strictEqual(code, 200);
            return {
              json: (payload) => {
                resolve(payload);
              },
            };
          },
        };
        fn(req, res, (err) => {
          if (err) reject(err);
        });
      });

    try {
      // Mock: Exists in User
      User.findOne = async () => ({ _id: 'user123', email: 'owner@fitzone.com' });
      Gym.findOne = async () => null;

      const resJson = await invokeController(checkEmailAvailability, {
        query: { email: 'owner@fitzone.com' },
        body: {},
      });
      assert.strictEqual(resJson.data.isAvailable, false);
      assert.strictEqual(resJson.data.isExisting, true);
    } finally {
      User.findOne = origUserFindOne;
      Gym.findOne = origGymFindOne;
    }
  });
});
