import type { LeaveRequest } from '../types/hr';

export type NotionCalendarPayload = {
  title: string;
  startDate: string;
  endDate: string;
  typeLabel: string;
  requesterName: string;
  approvalId: string;
  status: 'APPROVED';
  reason: string | null;
};

export type NotionCalendarResult = {
  mode: 'mock' | 'real';
  externalPageId: string;
  externalUrl: string | null;
};

function getNotionVersion() {
  return process.env.NOTION_VERSION || '2022-06-28';
}

function getNotionPropertyName(envName: string, fallback: string) {
  return process.env[envName] || fallback;
}

function getApprovedStatusName() {
  return process.env.NOTION_APPROVED_STATUS_NAME || 'Approved';
}

function buildMockResult(payload: NotionCalendarPayload): NotionCalendarResult {
  return {
    mode: 'mock',
    externalPageId: `mock_notion_${payload.approvalId}`,
    externalUrl: null,
  };
}

export async function createNotionCalendarPage(payload: NotionCalendarPayload): Promise<NotionCalendarResult> {
  const apiKey = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_APPROVAL_CALENDAR_DATABASE_ID;

  if (!apiKey || !databaseId) {
    return buildMockResult(payload);
  }

  const titleProp = getNotionPropertyName('NOTION_PROP_TITLE', 'Name');
  const dateProp = getNotionPropertyName('NOTION_PROP_DATE', 'Date');
  const statusProp = getNotionPropertyName('NOTION_PROP_STATUS', 'Status');
  const typeProp = getNotionPropertyName('NOTION_PROP_TYPE', 'Type');
  const requesterProp = getNotionPropertyName('NOTION_PROP_REQUESTER', 'Requester');
  const approvalIdProp = getNotionPropertyName('NOTION_PROP_APPROVAL_ID', 'Approval ID');

  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': getNotionVersion(),
    },
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties: {
        [titleProp]: { title: [{ text: { content: payload.title } }] },
        [dateProp]: {
          date: {
            start: payload.startDate,
            end: payload.endDate === payload.startDate ? null : payload.endDate,
          },
        },
        [statusProp]: { status: { name: getApprovedStatusName() } },
        [typeProp]: { select: { name: payload.typeLabel } },
        [requesterProp]: { rich_text: [{ text: { content: payload.requesterName } }] },
        [approvalIdProp]: { rich_text: [{ text: { content: payload.approvalId } }] },
      },
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: { content: payload.reason || 'Approved from AICC operation portal.' },
              },
            ],
          },
        },
      ],
    }),
  });

  const data = (await res.json().catch(() => ({}))) as { id?: string; url?: string; message?: string };
  if (!res.ok) {
    throw new Error(data.message || `Notion calendar sync failed (${res.status})`);
  }

  return {
    mode: 'real',
    externalPageId: data.id || '',
    externalUrl: data.url || null,
  };
}

export function buildLeaveNotionPayload(input: { leave: LeaveRequest; typeLabel: string }): NotionCalendarPayload {
  return {
    title: `${input.typeLabel} - ${input.leave.requesterName}`,
    startDate: input.leave.startDate,
    endDate: input.leave.endDate,
    typeLabel: input.typeLabel,
    requesterName: input.leave.requesterName,
    approvalId: input.leave.id,
    status: 'APPROVED',
    reason: input.leave.reason,
  };
}
