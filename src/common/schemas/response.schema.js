export function buildSuccessResponse(dataSchema) {
  return {
    type: 'object',
    required: ['success', 'data'],
    properties: {
      success: { const: true },
      message: { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
      data: dataSchema,
    },
  };
}

/** Shape returned by BaseRepository.pagination: { rows, count, page, limit, totalPages }. */
export function buildPaginatedResponse(itemSchema) {
  return buildSuccessResponse({
    type: 'object',
    properties: {
      rows: { type: 'array', items: itemSchema },
      count: { type: 'integer' },
      page: { type: 'integer' },
      limit: { type: 'integer' },
      totalPages: { type: 'integer' },
    },
  });
}
