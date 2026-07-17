import { describe, it, expect } from '@jest/globals';
import { varcharField } from '#common-schemas/field.schema';

describe('FieldSchema.varcharField', () => {
  it('defaults to an optional VARCHAR(255) string with no minLength/format', () => {
    expect(varcharField()).toEqual({ type: 'string', maxLength: 255 });
  });

  it('adds minLength: 1 when nonEmpty is true', () => {
    expect(varcharField({ nonEmpty: true })).toEqual({ type: 'string', maxLength: 255, minLength: 1 });
  });

  it('adds the given AJV format', () => {
    expect(varcharField({ format: 'email' })).toEqual({ type: 'string', maxLength: 255, format: 'email' });
  });

  it('combines nonEmpty and format', () => {
    expect(varcharField({ nonEmpty: true, format: 'email' })).toEqual({
      type: 'string',
      maxLength: 255,
      minLength: 1,
      format: 'email',
    });
  });
});
