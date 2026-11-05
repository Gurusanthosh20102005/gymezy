import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('User Body Metrics & Target Architecture (SSOT)', () => {
  it('1. Calculates BMI correctly from height in cm and weight in kg', () => {
    const heightCm = 180;
    const weightKg = 75;
    const hM = heightCm / 100;
    const bmi = Number((weightKg / (hM * hM)).toFixed(1));
    assert.strictEqual(bmi, 23.1);
  });

  it('2. Normalizes body metrics and target weight payloads into customerProfile schema format', () => {
    const reqBody = {
      customerProfile: {
        heightCm: '175',
        weightKg: '70.5',
        targetWeightKg: '68.0',
        fitnessGoal: 'Muscle Building & Hypertrophy',
      },
    };

    const incomingProfile = reqBody.customerProfile || {};
    const profileUpdates = {
      heightCm: Math.max(0, Number(incomingProfile.heightCm) || 0),
      weightKg: Math.max(0, Number(incomingProfile.weightKg) || 0),
      targetWeightKg: Math.max(0, Number(incomingProfile.targetWeightKg) || 0),
      fitnessGoal: String(incomingProfile.fitnessGoal).trim(),
    };

    if (profileUpdates.heightCm > 0 && profileUpdates.weightKg > 0) {
      const hM = profileUpdates.heightCm / 100;
      profileUpdates.bmi = Number((profileUpdates.weightKg / (hM * hM)).toFixed(1));
    }

    assert.strictEqual(profileUpdates.heightCm, 175);
    assert.strictEqual(profileUpdates.weightKg, 70.5);
    assert.strictEqual(profileUpdates.targetWeightKg, 68);
    assert.strictEqual(profileUpdates.fitnessGoal, 'Muscle Building & Hypertrophy');
    assert.strictEqual(profileUpdates.bmi, 23.0);
  });

  it('3. Flattens updates to customerProfile dot notation to preserve existing fields', () => {
    const profileUpdates = {
      targetWeightKg: 65,
    };
    const updates = {};
    for (const [k, v] of Object.entries(profileUpdates)) {
      updates[`customerProfile.${k}`] = v;
    }

    assert.deepStrictEqual(updates, {
      'customerProfile.targetWeightKg': 65,
    });
  });
});

