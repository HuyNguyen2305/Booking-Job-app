import { buildSuccessResponse } from '#common-schemas/response.schema';

const holidaySchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    holiday_date: { type: 'string', format: 'date' },
    name: { type: 'string' },
    recurring_annual: { type: 'boolean' },
  },
};

export const createHolidaySchema = {
  tags: ['Holidays'],
  summary: 'Create a company holiday',
  description:
    'recurring_annual=true matches the same month/day every year (e.g. Jan 1); false matches the exact holiday_date only.',
  body: {
    type: 'object',
    required: ['holiday_date', 'name'],
    properties: {
      holiday_date: { type: 'string', format: 'date' },
      name: { type: 'string', minLength: 1 },
      recurring_annual: { type: 'boolean', default: false },
    },
  },
  response: {
    201: buildSuccessResponse(holidaySchema),
  },
};

export const listHolidaysSchema = {
  tags: ['Holidays'],
  summary: 'List all company holidays',
  response: {
    200: buildSuccessResponse({ type: 'array', items: holidaySchema }),
  },
};

export const deleteHolidaySchema = {
  tags: ['Holidays'],
  summary: 'Delete a company holiday',
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
  response: {
    200: buildSuccessResponse(holidaySchema),
  },
};
