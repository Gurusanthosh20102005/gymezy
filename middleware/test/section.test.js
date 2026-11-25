import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  Section,
  SECTION_CATEGORIES,
  DAYS_OF_WEEK,
  getSectionLifecycle,
  checkTrainerSectionConflict,
  isTrainerAvailableForSchedule,
} from '../src/models/section.model.js';

describe('Section Model Schema & Validation Tests', () => {
  it('should expose standard SECTION_CATEGORIES and DAYS_OF_WEEK', () => {
    assert.ok(Array.isArray(SECTION_CATEGORIES));
    assert.ok(SECTION_CATEGORIES.includes('yoga'));
    assert.ok(SECTION_CATEGORIES.includes('gym'));
    assert.ok(SECTION_CATEGORIES.includes('zumba'));

    assert.ok(Array.isArray(DAYS_OF_WEEK));
    assert.strictEqual(DAYS_OF_WEEK.length, 7);
    assert.deepStrictEqual(DAYS_OF_WEEK, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('should fail validation if gymId or trainerId is missing (strict ID requirement)', () => {
    const invalidSection = new Section({
      title: 'Basic Yoga 20 Days',
      category: 'yoga',
      cost: 1500,
      startDate: new Date(),
      startTime: '06:00 AM',
      endTime: '07:00 AM',
    });

    const error = invalidSection.validateSync();
    assert.ok(error);
    assert.ok(error.errors.gymId, 'gymId is required');
    assert.ok(error.errors.trainerId, 'trainerId is required');
  });

  it('should instantiate a valid Section referencing gymId and trainerId by ObjectId', () => {
    const fakeGymId = new mongoose.Types.ObjectId();
    const fakeTrainerId = new mongoose.Types.ObjectId();

    const validSection = new Section({
      gymId: fakeGymId,
      trainerId: fakeTrainerId,
      title: 'Basic Yoga 20 Days',
      category: 'yoga',
      cost: 1500,
      startDate: new Date('2026-11-01'),
      durationDays: 20,
      startTime: '06:00 AM',
      endTime: '07:00 AM',
      activeDays: ['Mon', 'Wed', 'Fri'],
      maxCapacity: 25,
      description: 'Introductory 20-day yoga program covering postures and breathing.',
    });

    const error = validSection.validateSync();
    assert.strictEqual(error, undefined, 'Validation should pass without errors');
    assert.strictEqual(validSection.gymId.toString(), fakeGymId.toString());
    assert.strictEqual(validSection.trainerId.toString(), fakeTrainerId.toString());
    assert.strictEqual(validSection.cost, 1500);
    assert.strictEqual(validSection.durationDays, 20);
    assert.deepStrictEqual(validSection.activeDays, ['Mon', 'Wed', 'Fri']);
    assert.strictEqual(validSection.isActive, true);
  });

  it('should correctly calculate section lifecycle status and booking eligibility', () => {
    const referenceNow = new Date('2026-11-10T14:00:00.000Z');

    // 1. Future section -> UPCOMING & isBookable
    const futureSection = {
      startDate: new Date('2026-11-15'),
      endDate: new Date('2026-11-30'),
      startTime: '06:00 AM',
      endTime: '07:00 AM',
      isActive: true,
      enrolledCount: 5,
      maxCapacity: 20,
    };
    const futureLife = getSectionLifecycle(futureSection, referenceNow);
    assert.strictEqual(futureLife.status, 'UPCOMING');
    assert.strictEqual(futureLife.isBookable, true);
    assert.strictEqual(futureLife.isStarted, false);
    assert.strictEqual(futureLife.isCompleted, false);

    // 2. Ongoing section (started Nov 1, ends Nov 20) -> ONGOING & NOT bookable (strict start cut-off)
    const ongoingSection = {
      startDate: new Date('2026-11-01'),
      endDate: new Date('2026-11-20'),
      startTime: '06:00 AM',
      endTime: '07:00 AM',
      isActive: true,
      enrolledCount: 5,
      maxCapacity: 20,
    };
    const ongoingLife = getSectionLifecycle(ongoingSection, referenceNow);
    assert.strictEqual(ongoingLife.status, 'ONGOING');
    assert.strictEqual(ongoingLife.isBookable, false);
    assert.strictEqual(ongoingLife.isStarted, true);
    assert.strictEqual(ongoingLife.isCompleted, false);

    // 3. Completed section (ended Nov 5) -> COMPLETED & NOT bookable
    const completedSection = {
      startDate: new Date('2026-10-01'),
      endDate: new Date('2026-11-05'),
      startTime: '06:00 AM',
      endTime: '07:00 AM',
      isActive: true,
      enrolledCount: 10,
      maxCapacity: 20,
    };
    const completedLife = getSectionLifecycle(completedSection, referenceNow);
    assert.strictEqual(completedLife.status, 'COMPLETED');
    assert.strictEqual(completedLife.isBookable, false);
    assert.strictEqual(completedLife.isStarted, true);
    assert.strictEqual(completedLife.isCompleted, true);

    // 4. Paused future section -> PAUSED & NOT bookable
    const pausedSection = {
      startDate: new Date('2026-11-20'),
      endDate: new Date('2026-12-05'),
      startTime: '06:00 AM',
      endTime: '07:00 AM',
      isActive: false,
      enrolledCount: 2,
      maxCapacity: 20,
    };
    const pausedLife = getSectionLifecycle(pausedSection, referenceNow);
    assert.strictEqual(pausedLife.status, 'PAUSED');
    assert.strictEqual(pausedLife.isBookable, false);
    assert.strictEqual(pausedLife.isPaused, true);

    // 5. Full capacity future section -> UPCOMING but isBookable is false
    const fullSection = {
      startDate: new Date('2026-11-20'),
      endDate: new Date('2026-12-05'),
      startTime: '06:00 AM',
      endTime: '07:00 AM',
      isActive: true,
      enrolledCount: 20,
      maxCapacity: 20,
    };
    const fullLife = getSectionLifecycle(fullSection, referenceNow);
    assert.strictEqual(fullLife.status, 'UPCOMING');
    assert.strictEqual(fullLife.isCapacityFull, true);
    assert.strictEqual(fullLife.isBookable, false);
  });

  it('should detect schedule and section conflicts when checking trainer availability', () => {
    const referenceNow = new Date('2026-11-10T10:00:00.000Z');
    const existingSectionId = new mongoose.Types.ObjectId();

    const existingSection = {
      _id: existingSectionId,
      title: 'Morning Yoga Batch',
      startDate: new Date('2026-11-15'),
      endDate: new Date('2026-11-30'),
      startTime: '06:00 AM',
      endTime: '07:00 AM',
      activeDays: ['Mon', 'Wed', 'Fri'],
      isActive: true,
    };

    // 1. Overlapping Section Conflict
    const conflictingSchedule = {
      startDate: new Date('2026-11-20'),
      endDate: new Date('2026-12-05'),
      startTime: '06:30 AM',
      endTime: '07:30 AM',
      activeDays: ['Mon', 'Fri'],
    };
    const conflictResult = checkTrainerSectionConflict(existingSection, conflictingSchedule, referenceNow);
    assert.strictEqual(conflictResult.hasConflict, true);
    assert.ok(conflictResult.reason.includes('Morning Yoga Batch'));

    // 2. Non-overlapping time slot -> No conflict
    const nonConflictingTimeSchedule = {
      startDate: new Date('2026-11-20'),
      endDate: new Date('2026-12-05'),
      startTime: '08:00 AM',
      endTime: '09:00 AM',
      activeDays: ['Mon', 'Fri'],
    };
    const noTimeConflict = checkTrainerSectionConflict(existingSection, nonConflictingTimeSchedule, referenceNow);
    assert.strictEqual(noTimeConflict.hasConflict, false);

    // 3. Non-overlapping active days -> No conflict
    const nonConflictingDaysSchedule = {
      startDate: new Date('2026-11-20'),
      endDate: new Date('2026-12-05'),
      startTime: '06:00 AM',
      endTime: '07:00 AM',
      activeDays: ['Tue', 'Thu', 'Sat'],
    };
    const noDaysConflict = checkTrainerSectionConflict(existingSection, nonConflictingDaysSchedule, referenceNow);
    assert.strictEqual(noDaysConflict.hasConflict, false);

    // 4. Exclude self when editing -> No conflict
    const editSelfSchedule = {
      ...conflictingSchedule,
      excludeSectionId: existingSectionId,
    };
    const noSelfConflict = checkTrainerSectionConflict(existingSection, editSelfSchedule, referenceNow);
    assert.strictEqual(noSelfConflict.hasConflict, false);

    // 5. Full trainer availability evaluation
    const activeTrainer = {
      name: 'John Coach',
      status: 'Active',
      schedule: {
        workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        workingTimeStart: '06:00 AM',
        workingTimeEnd: '02:00 PM',
      },
    };

    // Should be unavailable if section has conflict
    const availWithConflict = isTrainerAvailableForSchedule(
      activeTrainer,
      conflictingSchedule,
      [existingSection],
      referenceNow
    );
    assert.strictEqual(availWithConflict.isAvailable, false);

    // Should be available when times do not conflict
    const availWithoutConflict = isTrainerAvailableForSchedule(
      activeTrainer,
      nonConflictingTimeSchedule,
      [existingSection],
      referenceNow
    );
    assert.strictEqual(availWithoutConflict.isAvailable, true);

    // Should be unavailable if section is on trainer's day off (e.g. Sunday)
    const sundaySchedule = {
      startDate: new Date('2026-11-20'),
      endDate: new Date('2026-12-05'),
      startTime: '08:00 AM',
      endTime: '09:00 AM',
      activeDays: ['Sun'],
    };
    const availSunday = isTrainerAvailableForSchedule(
      activeTrainer,
      sundaySchedule,
      [existingSection],
      referenceNow
    );
    assert.strictEqual(availSunday.isAvailable, false);
    assert.ok(availSunday.reason.includes('SUN'));

    // Should be unavailable if section is outside working hours (e.g. 05:00 PM)
    const eveningSchedule = {
      startDate: new Date('2026-11-20'),
      endDate: new Date('2026-12-05'),
      startTime: '05:00 PM',
      endTime: '06:00 PM',
      activeDays: ['Mon', 'Wed'],
    };
    const availEvening = isTrainerAvailableForSchedule(
      activeTrainer,
      eveningSchedule,
      [existingSection],
      referenceNow
    );
    assert.strictEqual(availEvening.isAvailable, false);
    assert.ok(availEvening.reason.includes('outside trainer\'s working hours'));
  });
});
