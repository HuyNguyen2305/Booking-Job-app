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
