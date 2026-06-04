import { describe, expect, it } from 'vitest';
import { GLOBAL_EMERGENCY_NUMBERS, isGlobalEmergencyNumber } from './emergency-constants.js';

describe('GLOBAL_EMERGENCY_NUMBERS', () => {
  it('contains 911', () => expect(GLOBAL_EMERGENCY_NUMBERS.has('911')).toBe(true));
  it('contains 999', () => expect(GLOBAL_EMERGENCY_NUMBERS.has('999')).toBe(true));
  it('contains 112', () => expect(GLOBAL_EMERGENCY_NUMBERS.has('112')).toBe(true));
  it('contains 000', () => expect(GLOBAL_EMERGENCY_NUMBERS.has('000')).toBe(true));
  it('contains 110', () => expect(GLOBAL_EMERGENCY_NUMBERS.has('110')).toBe(true));
  it('contains 118', () => expect(GLOBAL_EMERGENCY_NUMBERS.has('118')).toBe(true));
  it('contains 119', () => expect(GLOBAL_EMERGENCY_NUMBERS.has('119')).toBe(true));
  it('does not contain a normal number', () => expect(GLOBAL_EMERGENCY_NUMBERS.has('555')).toBe(false));
  it('does not contain empty string', () => expect(GLOBAL_EMERGENCY_NUMBERS.has('')).toBe(false));
});

describe('isGlobalEmergencyNumber', () => {
  it('returns true for 911', () => expect(isGlobalEmergencyNumber('911')).toBe(true));
  it('returns true for E.164 +1911 (strips leading +)', () => expect(isGlobalEmergencyNumber('+911')).toBe(true));
  it('returns true for 112', () => expect(isGlobalEmergencyNumber('112')).toBe(true));
  it('returns true for 999', () => expect(isGlobalEmergencyNumber('999')).toBe(true));
  it('returns false for a normal number', () => expect(isGlobalEmergencyNumber('12125551234')).toBe(false));
  it('returns false for empty string', () => expect(isGlobalEmergencyNumber('')).toBe(false));
});
