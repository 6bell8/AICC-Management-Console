export const DEFAULT_DYNNODE_SAMPLE_CTX = `{
  "id": "sample-001",
  "name": "봉춘",
  "active": true,
  "count": 2,
  "items": [
    {
      "id": "item-001",
      "name": "상담 요청",
      "amount": 120000,
      "active": true
    },
    {
      "id": "item-002",
      "name": "콜백 예약",
      "amount": 80000,
      "active": false
    }
  ],
  "data": {
    "value": "example"
  }
}
`;

export function getDynnodeSampleCtx(value: unknown) {
  if (value == null) return DEFAULT_DYNNODE_SAMPLE_CTX;

  if (typeof value === 'string') {
    if (!value.trim()) return DEFAULT_DYNNODE_SAMPLE_CTX;

    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length === 0) {
        return DEFAULT_DYNNODE_SAMPLE_CTX;
      }
    } catch {
      return value;
    }

    return value;
  }

  if (typeof value === 'object') {
    if (!Array.isArray(value) && Object.keys(value).length === 0) return DEFAULT_DYNNODE_SAMPLE_CTX;
    return JSON.stringify(value, null, 2);
  }

  return DEFAULT_DYNNODE_SAMPLE_CTX;
}
