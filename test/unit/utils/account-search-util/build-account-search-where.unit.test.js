import { describe, it, expect } from '@jest/globals';
import { Op } from 'sequelize';
import { buildAccountSearchWhere } from '#utils/account-search.util';

describe('AccountSearchUtil.buildAccountSearchWhere', () => {
  it('returns an empty where when no filters are given', () => {
    expect(buildAccountSearchWhere()).toEqual({});
    expect(buildAccountSearchWhere({})).toEqual({});
  });

  it('builds a case-insensitive substring match for name', () => {
    expect(buildAccountSearchWhere({ name: 'ali' })).toEqual({ name: { [Op.iLike]: '%ali%' } });
  });

  it('builds a case-insensitive substring match for email', () => {
    expect(buildAccountSearchWhere({ email: 'example.com' })).toEqual({ email: { [Op.iLike]: '%example.com%' } });
  });

  it('builds an exact match for is_active, including when it is explicitly false', () => {
    expect(buildAccountSearchWhere({ is_active: true })).toEqual({ is_active: true });
    expect(buildAccountSearchWhere({ is_active: false })).toEqual({ is_active: false });
  });

  it('combines all three filters together', () => {
    expect(buildAccountSearchWhere({ name: 'ali', email: 'example.com', is_active: true })).toEqual({
      name: { [Op.iLike]: '%ali%' },
      email: { [Op.iLike]: '%example.com%' },
      is_active: true,
    });
  });

  it('omits name/email when given an empty string, rather than matching "%%" against everything', () => {
    expect(buildAccountSearchWhere({ name: '', email: '' })).toEqual({});
  });
});
