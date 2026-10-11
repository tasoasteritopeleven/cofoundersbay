import io
p = 'apps/web/src/lib/api.ts'
s = io.open(p, encoding='utf-8').read()

anchor = """export async function getMyPrograms(): Promise<{ programs: ProgramItem[] }> {
  return apiRequest(`/api/programs/my-programs`);
}"""
add = anchor + """

/** The tenant-admin view: every program of the caller's organisation,
 *  including drafts. `GET /programs/organization/:orgId` returns a bare array. */
export async function listOrganizationPrograms(
  organizationId: string,
  params?: { status?: string; programType?: string },
): Promise<ProgramItem[]> {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.programType) q.set('programType', params.programType);
  return apiRequest(`/api/programs/organization/${organizationId}${q.toString() ? `?${q}` : ''}`, undefined, { retryOn401: false });
}

export async function createProgram(
  organizationId: string,
  body: {
    name: string;
    slug: string;
    description?: string;
    programType: string;
    startDate?: string;
    endDate?: string;
    capacity?: number;
  },
): Promise<ProgramItem> {
  return apiRequest(`/api/programs/organization/${organizationId}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}"""
assert s.count(anchor) == 1; s = s.replace(anchor, add)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('api ok')
