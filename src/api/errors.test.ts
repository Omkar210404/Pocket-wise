import { describe, expect, it } from 'vitest';

import { ApiError, errorMessage, fieldErrors } from './errors';

const validation = new ApiError(422, 'validation_error', 'Request validation failed', [
  { field: 'body.amount', message: 'Input should be greater than 0' },
  { field: 'body.category_id', message: 'Category not found' },
  { field: 'body.amount', message: 'A second message for the same field' },
]);

describe('fieldErrors', () => {
  it('keys validation details by the field name, without the body. or query. prefix', () => {
    expect(fieldErrors(validation)).toEqual({
      amount: 'Input should be greater than 0',
      category_id: 'Category not found',
    });
  });

  it('is empty for errors that are not about a field', () => {
    expect(fieldErrors(new ApiError(409, 'conflict', 'Already exists'))).toEqual({});
    expect(fieldErrors(new Error('boom'))).toEqual({});
  });
});

describe('errorMessage', () => {
  it('uses the API message when there are no details', () => {
    expect(errorMessage(new ApiError(404, 'not_found', 'Expense not found'))).toBe(
      'Expense not found',
    );
  });

  it('spells out validation details instead of "Request validation failed"', () => {
    expect(
      errorMessage(
        new ApiError(422, 'validation_error', 'Request validation failed', [
          { field: 'query.date_from', message: 'date_from must not be after date_to' },
        ]),
      ),
    ).toBe('date from: date_from must not be after date_to');
  });

  it('falls back to a generic sentence for unknown values', () => {
    expect(errorMessage(null)).toBe('Something went wrong. Try again.');
  });
});
