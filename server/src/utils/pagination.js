const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;

const getPagination = (query = {}) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const requestedLimit = Number.parseInt(query.limit, 10) || DEFAULT_LIMIT;
  const limit = Math.min(Math.max(requestedLimit, 1), MAX_LIMIT);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const getSort = (query = {}, fallback = { createdAt: -1 }) => {
  if (!query.sortBy) return fallback;
  const direction = query.order === 'asc' ? 1 : -1;
  return { [String(query.sortBy)]: direction };
};

const paginatedResponse = (items, total, { page, limit }) => ({
  items,
  pagination: {
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  },
});

module.exports = { getPagination, getSort, paginatedResponse, DEFAULT_LIMIT, MAX_LIMIT };
