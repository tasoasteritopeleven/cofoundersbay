'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeClient } = require('./isolated-backend-checks.cjs');

/**
 * What docs §111 added, against the real HTTP stack and a real database:
 * ownership, refusals, what is stored, and what must not leak. Each check
 * reads the row or the file, not only the response.
 */
async function runProductChecks({ base, db, results, password, privateDir, uploadsDir }) {
  const check = (name, condition) => {
    assert.ok(condition, name);
    results.push({ check: name, passed: true });
  };
  // Sixty requests a minute is the API's limit for one address.
  const client = () => makeClient(base, 1100);
  const anonymous = client();
  const alice = client();
  const bob = client();
  const carol = client();
  const a = await alice.request('POST', '/auth/register', { email: 'alice@product.example', password, role: 'founder' });
  const b = await bob.request('POST', '/auth/register', { email: 'bob@product.example', password, role: 'founder' });
  const c = await carol.request('POST', '/auth/register', { email: 'carol@product.example', password, role: 'founder' });
  assert.deepEqual([a.status, b.status, c.status], [201, 201, 201], `product_accounts ${JSON.stringify(a.raw).slice(0, 160)}`);
  check('product_accounts', true);
  const aid = a.data.user.id;
  const bid = b.data.user.id;
  for (const [id, displayName] of [[aid, 'Alice'], [bid, 'Bob']]) {
    await db.profile.create({ data: { userId: id, displayName } });
  }

  // ── Saving a notification ───────────────────────────────────────────────
  const kept = await db.notification.create({ data: { userId: aid, type: 'system', title: 'Keep me' } });
  await db.notification.create({ data: { userId: aid, type: 'system', title: 'Clear me' } });
  // A write without a session stops at the CSRF check, before any route.
  check('save_refused_without_a_session', [401, 403].includes((await anonymous.request('PATCH', `/notifications/${kept.id}/saved`, { saved: true })).status));
  check('save_needs_csrf', (await alice.request('PATCH', `/notifications/${kept.id}/saved`, { saved: true }, false)).status === 403);
  check('save_is_a_boolean', (await alice.request('PATCH', `/notifications/${kept.id}/saved`, { saved: 'yes' })).status === 400);
  check('save_refuses_another_members', (await bob.request('PATCH', `/notifications/${kept.id}/saved`, { saved: true })).status === 404);
  const saved = await alice.request('PATCH', `/notifications/${kept.id}/saved`, { saved: true });
  check('save_stored', saved.status === 200 && (await db.notification.findUnique({ where: { id: kept.id } })).savedAt !== null);
  const savedList = await alice.request('GET', '/notifications?saved=true');
  check('saved_view_lists_it', savedList.status === 200 && savedList.data.notifications.length === 1 && savedList.data.notifications[0].id === kept.id);
  await alice.request('DELETE', '/notifications');
  check('delete_all_keeps_saved', await db.notification.count({ where: { userId: aid } }) === 1);

  // ── The reports queue ───────────────────────────────────────────────────
  await db.report.create({ data: { type: 'spam', reason: 'Sends the same link to everyone', reporterId: aid, reportedId: bid } });
  check('reports_refuse_a_founder', (await alice.request('GET', '/admin/reports')).status === 403);
  const admin = client();
  const adminRow = await db.user.findFirst({ where: { role: 'admin' }, select: { id: true } });
  if (adminRow) {
    // The fixture's password stayed in the identity checks; this run sets its own.
    const argon2 = require('node:module').createRequire(path.join(__dirname, '..', 'apps/api/package.json'))('argon2');
    await db.user.update({ where: { id: adminRow.id }, data: { passwordHash: await argon2.hash(password) } });
    const logged = await admin.request('POST', '/auth/login', { email: 'admin@isolated.example', password });
    check('reports_admin_session', logged.status === 201);
    const reports = await admin.request('GET', '/admin/reports?type=spam&limit=5&offset=0');
    check('reports_filter_and_total', reports.status === 200 && reports.data.total === 1 && reports.data.reports[0].reported.name === 'Bob');
    check('reports_none_of_another_type', (await admin.request('GET', '/admin/reports?type=fake')).data.total === 0);
    check('reports_unknown_status_is_400', (await admin.request('GET', '/admin/reports?status=archived')).status === 400);
  }

  // ── 👍 / 👎 ─────────────────────────────────────────────────────────────
  check('rate_refused_without_a_session', [401, 403].includes((await anonymous.request('PUT', '/ai/answers/msg-1/feedback', { helpful: true })).status));
  check('rate_stored', (await alice.request('PUT', '/ai/answers/msg-1/feedback', { helpful: false, reason: 'unclear', source: 'builtin' })).status === 200);
  check('rate_changes_not_doubles', (await alice.request('PUT', '/ai/answers/msg-1/feedback', { helpful: false, reason: 'wrong', source: 'builtin' })).status === 200 && await db.assistantAnswerFeedback.count() === 1);
  check('rate_reason_from_the_list', (await alice.request('PUT', '/ai/answers/msg-1/feedback', { helpful: false, reason: 'it was rude' })).status === 400);
  check('rate_id_carries_no_text', (await alice.request('PUT', `/ai/answers/${encodeURIComponent('what I asked about salaries')}/feedback`, { helpful: true })).status === 400);
  await bob.request('PUT', '/ai/answers/msg-1/feedback', { helpful: true });
  const report = await anonymous.request('GET', '/public/transparency');
  check('transparency_counts_it', report.status === 200 && report.data.assistantFeedback.notHelpful === 1 && report.data.assistantFeedback.helpful === 1 && report.data.assistantFeedback.byReason.wrong === 1);
  check('rate_clears', (await bob.request('DELETE', '/ai/answers/msg-1/feedback')).status === 200 && await db.assistantAnswerFeedback.count() === 1);

  // ── Fundraising ─────────────────────────────────────────────────────────
  check('fundraising_needs_a_session', (await anonymous.request('GET', '/fundraising')).status === 401);
  const blank = await alice.request('GET', '/fundraising');
  check('fundraising_starts_empty', blank.status === 200 && blank.data.round === null && blank.data.leads.length === 0);
  const withLead = await alice.request('POST', '/fundraising/leads', { investorName: 'Ada Angel', status: 'contacted', checkSizeText: '€25K–€150K' });
  check('first_contact_opens_a_round', withLead.status === 201 && withLead.data.round.name === 'My round' && withLead.data.leads.length === 1);
  const leadId = withLead.data.leads[0].id;
  const roundId = withLead.data.round.id;
  const edited = await alice.request('PATCH', `/fundraising/rounds/${roundId}`, { name: 'Seed', targetAmount: 750000, closingDate: '2027-03-01' });
  check('round_edit', edited.status === 200 && edited.data.round.name === 'Seed' && edited.data.round.targetAmount === 750000);
  const committed = await alice.request('PATCH', `/fundraising/leads/${leadId}`, { status: 'committed', committedAmount: 250000 });
  check('raised_is_what_committed_adds_up_to', committed.data.round.raisedAmount === 250000 && committed.data.round.investors === 1);
  check('lead_moves_set_last_contact', committed.data.leads[0].lastContactAt !== null);
  check('another_members_round_is_404', (await bob.request('PATCH', `/fundraising/rounds/${roundId}`, { name: 'Mine now' })).status === 404);
  check('another_members_lead_is_404', (await bob.request('PATCH', `/fundraising/leads/${leadId}`, { notes: 'x' })).status === 404);
  check('another_members_state_is_empty', (await bob.request('GET', '/fundraising')).data.round === null);
  check('round_refuses_a_negative_target', (await alice.request('PATCH', `/fundraising/rounds/${roundId}`, { targetAmount: -1 })).status === 400);

  // ── The data room ───────────────────────────────────────────────────────
  const pdf = Buffer.from('%PDF-1.7\nsecret numbers\n%%EOF\n');
  const upload = await alice.upload('/fundraising/documents', 'deck.pdf', 'application/pdf', pdf, { category: 'pitch' });
  check('upload_stored', upload.status === 201 && upload.data.documents.length === 1 && upload.data.documents[0].hasFile === true);
  const docId = upload.data.documents[0].id;
  const row = await db.dataRoomDocument.findUnique({ where: { id: docId } });
  check('key_never_reaches_the_client', !JSON.stringify(upload.data).includes(row.fileUrl));
  check('file_is_in_private_storage', fs.existsSync(path.join(privateDir, row.fileUrl)));
  check('file_is_not_under_public_uploads', !fs.existsSync(path.join(uploadsDir, row.fileUrl)));
  const origin = base.replace(/\/api$/, '');
  check('no_public_route_to_it', (await fetch(`${origin}/uploads/${row.fileUrl}`, { signal: AbortSignal.timeout(10000) })).status === 404);
  check('script_upload_refused', (await alice.upload('/fundraising/documents', 'x.html', 'text/html', Buffer.from('<script>alert(1)</script>'), {})).status === 400);
  const owned = await alice.raw(`/fundraising/documents/${docId}/file`);
  check('owner_downloads_the_bytes', owned.status === 200 && Buffer.from(await owned.arrayBuffer()).equals(pdf));
  check('download_is_an_attachment', (owned.headers.get('content-disposition') ?? '').startsWith('attachment'));
  check('download_is_sandboxed', (owned.headers.get('content-security-policy') ?? '').includes('sandbox'));
  check('stranger_cannot_download', (await bob.raw(`/fundraising/documents/${docId}/file`)).status === 404);
  check('visitor_cannot_download', (await anonymous.raw(`/fundraising/documents/${docId}/file`)).status === 401);
  check('owner_is_not_logged', await db.dataRoomAccessLog.count() === 0);
  // Sharing, through the routes the page uses.
  check('share_refuses_another_members_file', (await bob.request('POST', '/fundraising/documents/sharing', { documentIds: [docId], shared: true })).status === 404);
  const shared = await alice.request('POST', '/fundraising/documents/sharing', { documentIds: [docId], shared: true });
  check('share_marks_the_document', shared.status === 201 && shared.data.documents[0].sharedWithLeads === true && shared.data.documents[0].status === 'shared');
  check('shared_is_not_public', (await bob.raw(`/fundraising/documents/${docId}/file`)).status === 404);
  check('an_unlinked_member_sees_no_room', (await bob.request('GET', '/fundraising/shared')).data.rooms.length === 0);
  const found = await alice.request('GET', '/fundraising/investors/search?q=bo');
  check('search_finds_the_member', found.status === 200 && found.data.members.some((m) => m.id === bid));
  check('search_never_finds_yourself', !(await alice.request('GET', '/fundraising/investors/search?q=ali')).data.members.some((m) => m.id === aid));
  check('search_needs_two_letters', (await alice.request('GET', '/fundraising/investors/search?q=b')).status === 400);
  check('a_lead_cannot_link_yourself', (await alice.request('PATCH', `/fundraising/leads/${leadId}`, { platformUserId: aid })).status === 400);
  check('link_needs_a_real_id', (await alice.request('PATCH', `/fundraising/leads/${leadId}`, { platformUserId: 'nobody' })).status === 400);
  const linked = await alice.request('PATCH', `/fundraising/leads/${leadId}`, { platformUserId: bid });
  check('link_names_the_account', linked.status === 200 && linked.data.leads.some((l) => l.linkedAccount?.id === bid));
  check('the_investor_is_told', await db.notification.count({ where: { userId: bid, type: 'fundraising_update', link: '/data-room' } }) === 1);
  const room = await bob.request('GET', '/fundraising/shared');
  check('their_room_lists_the_file', room.status === 200 && room.data.rooms.length === 1 && room.data.rooms[0].owner.displayName === 'Alice' && room.data.rooms[0].documents[0].id === docId);
  check('their_room_hides_the_key', !JSON.stringify(room.data).includes(row.fileUrl));
  check('linked_investor_downloads', (await bob.raw(`/fundraising/documents/${docId}/file`)).status === 200);
  check('their_opening_is_logged', await db.dataRoomAccessLog.count({ where: { accessorId: bid, documentId: docId } }) === 1 && (await db.dataRoomDocument.findUnique({ where: { id: docId } })).viewCount === 1);
  const seen = await alice.request('GET', '/fundraising');
  check('the_owner_sees_who_opened_it', seen.data.documents[0].openedBy.includes('Bob') && Boolean(seen.data.documents[0].lastOpenedAt));
  await alice.request('POST', '/fundraising/documents/sharing', { documentIds: [docId], shared: false });
  check('unsharing_ends_access', (await bob.raw(`/fundraising/documents/${docId}/file`)).status === 404);
  await alice.request('POST', '/fundraising/documents/sharing', { documentIds: [docId], shared: true });
  check('resharing_restores_access', (await bob.raw(`/fundraising/documents/${docId}/file`)).status === 200);
  await alice.request('PATCH', `/fundraising/leads/${leadId}`, { platformUserId: null });
  check('unlinking_ends_access', (await bob.raw(`/fundraising/documents/${docId}/file`)).status === 404 && (await bob.request('GET', '/fundraising/shared')).data.rooms.length === 0);
  await alice.request('PATCH', `/fundraising/leads/${leadId}`, { platformUserId: bid });
  // ── What docs §114 added ─────────────────────────────
  const holders = [{ id: 'h1', name: 'Alice', kind: 'founder', shares: 900 }, { id: 'h2', name: 'Pool', kind: 'pool', shares: 100 }];
  const capped = await alice.request('PATCH', `/fundraising/rounds/${roundId}`, { capTable: holders });
  check('cap_table_stored', capped.status === 200 && capped.data.round.capTable.length === 2 && (await db.fundraisingRound.findUnique({ where: { id: roundId } })).capTable.length === 2);
  check('cap_table_refuses_a_bad_holder', (await alice.request('PATCH', `/fundraising/rounds/${roundId}`, { capTable: [{ ...holders[0], shares: -1 }] })).status === 400);
  check('cap_table_refuses_another_member', (await bob.request('PATCH', `/fundraising/rounds/${roundId}`, { capTable: holders })).status === 404);
  const emailed = await alice.request('POST', '/fundraising/leads', { investorName: 'Eve Investor', investorEmail: 'eve@fund.example' });
  check('investor_email_stored', emailed.status === 201 && emailed.data.leads.some((l) => l.investorEmail === 'eve@fund.example'));
  check('investor_email_refuses_a_bad_address', (await alice.request('POST', '/fundraising/leads', { investorName: 'Eve', investorEmail: 'nope' })).status === 400);

  check('link_needs_a_session', [401, 403].includes((await anonymous.request('POST', '/fundraising/links', { days: 7 })).status));
  check('link_needs_a_shared_file', (await bob.request('POST', '/fundraising/links', { days: 7 })).status === 400);
  check('link_lasts_thirty_days_at_most', (await alice.request('POST', '/fundraising/links', { days: 31 })).status === 400);
  const made = await alice.request('POST', '/fundraising/links', { label: 'For Eve', days: 7 });
  check('link_made', made.status === 201 && made.data.token.length > 40);
  const token = made.data.token;
  const linkId = made.data.link.id;
  const linkRow = await db.dataRoomLink.findUnique({ where: { id: linkId } });
  check('link_keeps_only_a_hash', linkRow.tokenHash.length === 64 && !JSON.stringify(linkRow).includes(token));
  const opened = await anonymous.request('GET', `/public/data-room/${token}`);
  check('link_opens_without_an_account', opened.status === 200 && opened.data.founderName === 'Alice' && opened.data.documents.some((d) => d.id === docId));
  check('link_hides_the_key', !JSON.stringify(opened.data).includes(row.fileUrl));
  const views = (await db.dataRoomDocument.findUnique({ where: { id: docId } })).viewCount;
  check('link_downloads', (await anonymous.raw(`/public/data-room/${token}/documents/${docId}/file`)).status === 200);
  check('link_counts_the_opening', (await db.dataRoomLink.findUnique({ where: { id: linkId } })).openCount === 1 && (await db.dataRoomDocument.findUnique({ where: { id: docId } })).viewCount === views + 1);
  check('a_wrong_link_is_404', (await anonymous.request('GET', '/public/data-room/not-a-token')).status === 404);
  await alice.request('POST', '/fundraising/documents/sharing', { documentIds: [docId], shared: false });
  check('unsharing_takes_it_from_the_link', (await anonymous.raw(`/public/data-room/${token}/documents/${docId}/file`)).status === 404);
  await alice.request('POST', '/fundraising/documents/sharing', { documentIds: [docId], shared: true });
  check('another_member_cannot_revoke', (await bob.request('DELETE', `/fundraising/links/${linkId}`)).status === 404);
  const revoked = await alice.request('DELETE', `/fundraising/links/${linkId}`);
  check('revoke_keeps_the_record', revoked.status === 200 && revoked.data.find((l) => l.id === linkId).revokedAt !== null);
  check('a_revoked_link_is_404', (await anonymous.request('GET', `/public/data-room/${token}`)).status === 404);
  check('a_revoked_link_gives_no_file', (await anonymous.raw(`/public/data-room/${token}/documents/${docId}/file`)).status === 404);
  const short = await alice.request('POST', '/fundraising/links', { days: 1 });
  await db.dataRoomLink.update({ where: { id: short.data.link.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  check('an_ended_link_is_404', (await anonymous.request('GET', `/public/data-room/${short.data.token}`)).status === 404);

  const steps = [{ id: 's1', text: 'One', done: true }, { id: 's2', text: 'Two', done: false }];
  const stepped = await alice.request('POST', '/milestones', { title: 'Ship the beta', checklist: steps });
  check('milestone_takes_steps', stepped.status === 201 && stepped.data.progress === 50 && stepped.data.checklist.length === 2);
  const msId = stepped.data.id;
  const ticked = await alice.request('PATCH', `/milestones/${msId}`, { checklist: steps.map((step) => ({ ...step, done: true })) });
  check('milestone_ticks_set_progress', ticked.status === 200 && ticked.data.progress === 100 && (await db.milestone.findUnique({ where: { id: msId } })).progress === 100);
  check('milestone_refuses_bad_steps', (await alice.request('PATCH', `/milestones/${msId}`, { checklist: 'nope' })).status === 400);
  check('milestone_steps_refuse_a_stranger', [403, 404].includes((await bob.request('PATCH', `/milestones/${msId}`, { checklist: [] })).status));

  check('stranger_cannot_delete', (await bob.request('DELETE', `/fundraising/documents/${docId}`)).status === 404);
  check('delete_removes_the_row', (await alice.request('DELETE', `/fundraising/documents/${docId}`)).status === 200 && await db.dataRoomDocument.count() === 0);
  check('delete_removes_the_file', !fs.existsSync(path.join(privateDir, row.fileUrl)));

  // ── Proposals ───────────────────────────────────────────────────────────
  const posted = await alice.request('POST', '/opportunities', { title: 'CTO wanted', type: 'cofounder' });
  check('listing_posted', posted.status === 201);
  const listingId = posted.data.opportunity.id;
  const scope = 'I would build the first version with you.';
  check('proposal_on_own_listing_refused', (await alice.request('POST', `/opportunities/${listingId}/proposals`, { scope })).status === 400);
  check('proposal_needs_substance', (await bob.request('POST', `/opportunities/${listingId}/proposals`, { scope: 'hi' })).status === 400);
  const sent = await bob.request('POST', `/opportunities/${listingId}/proposals`, { scope, timeframe: '3 months' });
  check('proposal_sent', sent.status === 201 && sent.data.proposal.status === 'pending');
  const proposalId = sent.data.proposal.id;
  check('proposal_once_per_listing', (await bob.request('POST', `/opportunities/${listingId}/proposals`, { scope })).status === 409);
  check('owner_is_told', await db.notification.count({ where: { userId: aid, link: '/opportunities?tab=proposals' } }) === 1);
  const incoming = await alice.request('GET', '/opportunities/proposals/incoming');
  check('owner_sees_it', incoming.status === 200 && incoming.data.proposals.length === 1 && incoming.data.proposals[0].from.displayName === 'Bob');
  check('stranger_sees_nothing', (await carol.request('GET', '/opportunities/proposals/incoming')).data.proposals.length === 0);
  check('sender_cannot_accept', (await bob.request('PATCH', `/opportunities/proposals/${proposalId}`, { status: 'accepted' })).status === 403);
  check('stranger_cannot_answer', (await carol.request('PATCH', `/opportunities/proposals/${proposalId}`, { status: 'accepted' })).status === 404);
  check('owner_accepts', (await alice.request('PATCH', `/opportunities/proposals/${proposalId}`, { status: 'accepted' })).status === 200);
  check('an_answer_stands', (await alice.request('PATCH', `/opportunities/proposals/${proposalId}`, { status: 'declined' })).status === 409);
  check('sender_is_told', await db.notification.count({ where: { userId: bid, link: '/opportunities?tab=applications' } }) === 1);
  await db.userBlock.create({ data: { blockerId: aid, blockedId: c.data.user.id } });
  check('a_block_stops_a_proposal', (await carol.request('POST', `/opportunities/${listingId}/proposals`, { scope })).status === 403);
  const list = await anonymous.request('GET', '/opportunities');
  check('listing_names_its_author', list.status === 200 && list.data.opportunities.some((o) => o.createdBy.id === aid));

  // ── The portfolio ───────────────────────────────────────────────────────
  const added = await alice.request('POST', '/me/portfolio', { title: 'Harbor', url: 'https://harbor.example', type: 'project' });
  check('portfolio_item_added', added.status === 201 && added.data.items.length === 1);
  const itemId = added.data.items[0].id;
  check('portfolio_refuses_script_links', (await alice.request('POST', '/me/portfolio', { title: 'x', url: 'javascript:alert(1)' })).status === 400);
  check('another_member_cannot_change_it', (await bob.request('PATCH', `/me/portfolio/${itemId}`, { title: 'Mine' })).status === 404);
  check('another_member_cannot_remove_it', (await bob.request('DELETE', `/me/portfolio/${itemId}`)).status === 404);
  check('visitors_read_a_public_portfolio', (await anonymous.request('GET', `/profiles/${aid}/portfolio`)).data.items?.length === 1);
  await db.profile.update({ where: { userId: aid }, data: { visibilityRules: { profile: 'members' } } });
  check('members_only_hides_it_from_visitors', (await anonymous.request('GET', `/profiles/${aid}/portfolio`)).status === 404);
  check('members_still_read_it', (await bob.request('GET', `/profiles/${aid}/portfolio`)).data.items?.length === 1);

  // ── Rich text on its way in ─────────────────────────────────────────────
  const board = await alice.request('POST', '/research/boards', { title: 'Market notes' });
  check('board_created', board.status === 201);
  const boardId = board.data.board?.id ?? board.data.id;
  const node = await alice.request('POST', `/research/boards/${boardId}/nodes`, { type: 'note', content: '<p style="color:#b91c1c">ok</p><script>alert(1)</script><img src="x" onerror="alert(1)">' });
  check('note_created', node.status === 201);
  const stored = await db.researchNode.findFirst({ where: { boardId } });
  check('note_stored_without_scripts', stored.content.includes('<p style="color:#b91c1c">ok</p>') && !/script|onerror/i.test(stored.content));

  // ── Deleting an account ────────────────────────────────────────────────
  const dave = client();
  const d = await dave.request('POST', '/auth/register', { email: 'dave@product.example', password, role: 'founder' });
  assert.equal(d.status, 201, `deletion_account ${JSON.stringify(d.raw).slice(0, 200)}`);
  const did = d.data.user.id;
  await db.profile.create({ data: { userId: did, displayName: 'Dave' } });
  await dave.upload('/fundraising/documents', 'dave.pdf', 'application/pdf', pdf, { category: 'pitch' });
  const daveFile = (await db.dataRoomDocument.findFirst({ where: { uploadedById: did } })).fileUrl;
  const sharedGroup = await dave.request('POST', '/groups', { name: 'Founders together', slug: 'founders-together' });
  const aloneGroup = await dave.request('POST', '/groups', { name: 'Only me here', slug: 'only-me-here' });
  assert.ok([200, 201].includes(sharedGroup.status), `deletion_group ${JSON.stringify(sharedGroup.raw).slice(0, 200)}`);
  const sharedId = sharedGroup.data.id ?? sharedGroup.data.group?.id;
  const aloneId = aloneGroup.data.id ?? aloneGroup.data.group?.id;
  await bob.request('POST', `/groups/${sharedId}/join`);
  const post = await dave.request('POST', `/groups/${sharedId}/posts`, { content: 'Hello from Dave' });
  const bobPost = await bob.request('POST', `/groups/${sharedId}/posts`, { content: 'Hello from Bob' });
  check('deletion_setup_posts', [200, 201].includes(post.status) && [200, 201].includes(bobPost.status));
  const preview = await dave.request('GET', '/account/deletion');
  check('deletion_preview_counts', preview.status === 200 && preview.data.counts.dataRoomFiles === 1 && preview.data.counts.groupsHandedOver === 1 && preview.data.counts.groupsRemoved === 1 && preview.data.confirmWith === 'password');
  check('deletion_needs_a_session', [401, 403].includes((await anonymous.request('POST', '/account/delete', { password })).status));
  check('deletion_needs_csrf', (await dave.request('POST', '/account/delete', { password }, false)).status === 403);
  check('deletion_refuses_a_wrong_password', (await dave.request('POST', '/account/delete', { password: 'not-the-password' })).status === 403 && await db.user.count({ where: { id: did } }) === 1);
  const org = await db.organization.create({ data: { createdById: did, type: 'accelerator', name: 'Dave Labs', slug: 'dave-labs' } });
  const membership = await db.organizationMembership.create({ data: { organizationId: org.id, userId: bid } });
  const blocked = await dave.request('POST', '/account/delete', { password });
  check('an_organization_with_members_blocks_it', blocked.status === 409 && await db.user.count({ where: { id: did } }) === 1 && await db.organization.count({ where: { id: org.id } }) === 1);
  check('the_preview_names_the_organization', (await dave.request('GET', '/account/deletion')).data.blockers.some((b) => b.organizations?.includes('Dave Labs')));
  await db.organizationMembership.delete({ where: { id: membership.id } });
  const staleCookies = new Map(dave.cookies);
  const gone = await dave.request('POST', '/account/delete', { password });
  check('deletion_succeeds', gone.status === 200 && gone.data.deleted === true);
  check('the_account_row_is_gone', await db.user.count({ where: { id: did } }) === 0 && await db.profile.count({ where: { userId: did } }) === 0);
  check('their_round_and_documents_are_gone', await db.fundraisingRound.count({ where: { ownerId: did } }) === 0 && await db.dataRoomDocument.count({ where: { uploadedById: did } }) === 0);
  check('the_private_file_is_gone', !fs.existsSync(path.join(privateDir, daveFile)));
  check('the_organization_went_with_its_only_member', await db.organization.count({ where: { id: org.id } }) === 0);
  const handed = await db.group.findUnique({ where: { id: sharedId } });
  check('the_group_passed_to_its_next_member', handed?.createdById === bid);
  check('the_next_member_owns_it', (await db.groupMember.findFirst({ where: { groupId: sharedId, userId: bid } })).role === 'owner');
  check('the_empty_group_went_with_them', await db.group.count({ where: { id: aloneId } }) === 0);
  check('their_posts_went_their_others_stayed', await db.groupPost.count({ where: { groupId: sharedId, authorId: did } }) === 0 && await db.groupPost.count({ where: { groupId: sharedId, authorId: bid } }) === 1);
  dave.cookies.clear();
  for (const [key, value] of staleCookies) dave.cookies.set(key, value);
  check('the_old_session_is_refused', (await dave.request('GET', '/auth/me')).status === 401);
  check('the_password_no_longer_signs_in', (await client().request('POST', '/auth/login', { email: 'dave@product.example', password })).status === 401);

  const cid = c.data.user.id;
  const event = await db.event.create({ data: {
    creatorId: aid, title: 'Reconnect test', startAt: new Date(Date.now() - 7_200_000), endAt: new Date(Date.now() - 3_600_000),
    rsvps: { create: [{ userId: bid, status: 'going' }, { userId: cid, status: 'interested' }] },
  } });
  const eventPath = `/events/${event.id}`;
  const matchLink = `${eventPath}#reconnect`;
  const interest = (actor, target, interested) => actor.request('PUT', `${eventPath}/reconnect/${target}`, { interested });
  const attend = (actor, userId, attended) => actor.request('PUT', `${eventPath}/attendance`, { userId, attended });
  const matches = () => db.notification.count({ where: { link: matchLink, meta: { path: ['eventReconnect'], equals: 'match' } } });
  check('reconnect_roster_requires_session', (await anonymous.request('GET', `${eventPath}/attendance`)).status === 401);
  check('reconnect_only_organizer_can_read_roster', (await bob.request('GET', `${eventPath}/attendance`)).status === 403);
  check('reconnect_cannot_self_confirm', (await attend(bob, bid, true)).status === 403);
  const bulk = await alice.request('PUT', `${eventPath}/attendance`, { allGoing: true });
  check('reconnect_bulk_marks_only_going', bulk.status === 200 && bulk.data.changed === 1 && await db.eventRsvp.count({ where: { eventId: event.id, userId: cid, checkedInAt: null } }) === 1);
  check('reconnect_rsvp_is_not_attendance', (await carol.request('GET', `${eventPath}/reconnect`)).data.state === 'not_confirmed');
  check('reconnect_unconfirmed_target_is_refused', (await interest(bob, cid, true)).status === 403);
  check('reconnect_manual_attendance', (await attend(alice, cid, true)).status === 200);
  check('reconnect_selection_is_private', (await interest(bob, cid, true)).data.mutual === false && await matches() === 0);
  const otherView = await carol.request('GET', `${eventPath}/reconnect`);
  check('reconnect_no_inbound_selection_leak', otherView.data.rows.some((row) => row.userId === bid && !row.interested && !row.mutual));
  check('reconnect_mutual_notifies_both', (await interest(carol, bid, true)).data.mutual === true && await matches() === 2);
  check('reconnect_repeat_does_not_renotify', (await interest(bob, cid, true)).data.mutual === true && await matches() === 2);
  check('reconnect_does_not_create_connection', await db.connectionRequest.count({ where: { OR: [{ requesterId: bid, receiverId: cid }, { requesterId: cid, receiverId: bid }] } }) === 0);
  check('reconnect_withdraw_revokes_both', (await interest(bob, cid, false)).status === 200 && await matches() === 0 && await db.eventReconnectInterest.count({ where: { eventId: event.id } }) === 0);
  check('reconnect_second_round', (await interest(bob, cid, true)).status === 200);
  await db.eventReconnectInterest.updateMany({ where: { eventId: event.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await db.event.update({ where: { id: event.id }, data: { endAt: new Date(Date.now() - 15 * 86_400_000) } });
  const closed = await bob.request('GET', `${eventPath}/reconnect`);
  check('reconnect_expired_unmatched_is_deleted', closed.data.state === 'closed' && closed.data.rows.length === 0 && await db.eventReconnectInterest.count({ where: { eventId: event.id } }) === 0);
  check('reconnect_deadlines_are_enforced', (await interest(bob, cid, true)).status === 409 && (await attend(alice, cid, false)).status === 409);
  await db.event.update({ where: { id: event.id }, data: { endAt: event.endAt } });
  await interest(bob, cid, true);
  await interest(carol, bid, true);
  const blockedReconnect = await carol.request('POST', `/connections/block/${bid}`);
  check('reconnect_block_removes_matches_and_notices', blockedReconnect.status === 201 && await matches() === 0 && await db.eventReconnectInterest.count({ where: { eventId: event.id } }) === 0);
  await db.eventReconnectInterest.create({ data: { eventId: event.id, fromId: cid, toId: bid, expiresAt: new Date(Date.now() + 60_000) } });
  check('reconnect_blocked_pairs_are_hidden_both_ways', (await bob.request('GET', `${eventPath}/reconnect`)).data.rows.length === 0 && (await carol.request('GET', `${eventPath}/reconnect`)).data.rows.length === 0);
  check('reconnect_block_prevents_matching_prior_interest', (await interest(bob, cid, true)).status === 403 && (await interest(carol, bid, true)).status === 403 && await matches() === 0);
}

module.exports = { runProductChecks };
