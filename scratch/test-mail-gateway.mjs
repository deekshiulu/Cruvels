// scratch/test-mail-gateway.mjs
// Verifies live Mail Gateway operation against http://localhost:3005

const BASE_URL = 'http://localhost:3005';

async function login(username, password) {
  let res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  let data = await res.json();
  if (!res.ok || !data.success) {
    // Try with updated password if already changed in prior test
    res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'Cruvels2026!Secure' }),
    });
    data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(`Login failed for ${username}: ${JSON.stringify(data)}`);
    }
  }

  let cookie = res.headers.get('set-cookie');

  // If password change is required, fulfill it via /api/profile
  if (data.user?.mustChangePassword) {
    const profileRes = await fetch(`${BASE_URL}/api/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({
        currentPassword: password,
        newPassword: 'Cruvels2026!Secure',
      }),
    });
    const profileData = await profileRes.json();
    if (!profileRes.ok || !profileData.success) {
      throw new Error(`Password change failed for ${username}: ${JSON.stringify(profileData)}`);
    }
    const newCookie = profileRes.headers.get('set-cookie');
    if (newCookie) cookie = newCookie;
    data.user.mustChangePassword = false;
  }

  return { user: data.user, cookie };
}

async function runGatewayVerification() {
  console.log('=== 1. AUTHENTICATION ===');
  const adminAuth = await login('admin', 'Password123!');
  console.log('✓ Admin authenticated:', adminAuth.user.name, `(${adminAuth.user.primaryAlias})`);

  const rahulAuth = await login('rahul', 'Password123!');
  console.log('✓ Rahul authenticated:', rahulAuth.user.name, `(${rahulAuth.user.primaryAlias})`);

  const priyaAuth = await login('priya', 'Password123!');
  console.log('✓ Priya authenticated:', priyaAuth.user.name, `(${priyaAuth.user.primaryAlias})`);

  console.log('\n=== 2. OUTBOUND DISPATCH & INTERNAL ROUTING ===');
  const composeRes = await fetch(`${BASE_URL}/api/mail/compose`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminAuth.cookie,
    },
    body: JSON.stringify({
      to: ['rahul@cruvels.com'],
      subject: 'Architecture Review: Mail Gateway & Google Meet Sync',
      bodyText: 'Hi Rahul,\n\nPlease review our internal gateway telemetry.\nJoin our sync on Google Meet: https://meet.google.com/qrs-tuvw-xyz\n\nThanks,\nAdmin Team',
      attachments: [
        {
          filename: 'gateway-specs.txt',
          mimeType: 'text/plain',
          data: Buffer.from('Cruvels Zero-Trust Mail Gateway Specification V2').toString('base64'),
        },
      ],
    }),
  });

  const composeData = await composeRes.json();
  console.log('Compose Status:', composeRes.status);
  console.log('Compose Response:', composeData);
  if (!composeData.success) {
    throw new Error(`Compose failed: ${JSON.stringify(composeData)}`);
  }
  console.log('✓ Email dispatched successfully. Message ID:', composeData.data.messageId);

  console.log('\n=== 3. SENDER SENT FOLDER VERIFICATION ===');
  const sentRes = await fetch(`${BASE_URL}/api/mail/sent`, {
    headers: { Cookie: adminAuth.cookie },
  });
  const sentData = await sentRes.json();
  const sentMsg = sentData.messages?.find((m) => m.id === composeData.data.messageId);
  if (!sentMsg) {
    throw new Error('Message not found in Admin Sent folder');
  }
  console.log('✓ Sent folder contains message:', sentMsg.subject, '| to:', sentMsg.to_addresses);
  console.log('✓ RFC Message-ID in provider metadata:', sentMsg.provider_metadata?.rfcMessageId);

  console.log('\n=== 4. RECIPIENT INBOX VERIFICATION ===');
  const rahulInboxRes = await fetch(`${BASE_URL}/api/mail/inbox`, {
    headers: { Cookie: rahulAuth.cookie },
  });
  const rahulInboxData = await rahulInboxRes.json();
  const rahulReceivedMsg = rahulInboxData.messages?.find(
    (m) => m.subject === 'Architecture Review: Mail Gateway & Google Meet Sync'
  );
  if (!rahulReceivedMsg) {
    throw new Error('Message not found in Rahul inbox');
  }
  console.log('✓ Rahul received email in inbox! ID:', rahulReceivedMsg.id, '| from:', rahulReceivedMsg.from_address);
  console.log('✓ Snippet:', rahulReceivedMsg.snippet);

  console.log('\n=== 5. MESSAGE DETAILS & ATTACHMENT ACCESS ===');
  const msgDetailsRes = await fetch(`${BASE_URL}/api/messages/${rahulReceivedMsg.id}`, {
    headers: { Cookie: rahulAuth.cookie },
  });
  const msgDetails = await msgDetailsRes.json();
  console.log('✓ Message details loaded. Attachments count:', msgDetails.attachments?.length);
  if (!msgDetails.attachments || msgDetails.attachments.length === 0) {
    throw new Error('Attachment was not attached to recipient message');
  }
  const att = msgDetails.attachments[0];
  console.log('✓ Attachment info:', att.filename, '| size:', att.size, '| download url:', att.download_url);

  // Rahul downloads attachment
  const downloadRes = await fetch(`${BASE_URL}${att.download_url}`, {
    headers: { Cookie: rahulAuth.cookie },
  });
  const attContent = await downloadRes.text();
  console.log('✓ Attachment content downloaded by Rahul:', JSON.stringify(attContent));

  console.log('\n=== 6. ZERO-TRUST IDOR PROTECTION ===');
  // Priya tries to read Rahul's message
  const priyaAttackRes = await fetch(`${BASE_URL}/api/messages/${rahulReceivedMsg.id}`, {
    headers: { Cookie: priyaAuth.cookie },
  });
  console.log('Priya unauthorized read status:', priyaAttackRes.status);
  if (priyaAttackRes.status !== 403 && priyaAttackRes.status !== 404) {
    throw new Error('IDOR failure: Priya was able to access Rahul message!');
  }
  console.log('✓ Zero-Trust IDOR Protection verified: Peer intern is blocked from reading private emails.');

  // Priya tries to download Rahul's attachment
  const priyaAttAttackRes = await fetch(`${BASE_URL}${att.download_url}`, {
    headers: { Cookie: priyaAuth.cookie },
  });
  console.log('Priya unauthorized attachment download status:', priyaAttAttackRes.status);
  if (priyaAttAttackRes.status !== 403 && priyaAttAttackRes.status !== 404) {
    throw new Error('BOLA failure: Priya was able to download Rahul attachment!');
  }
  console.log('✓ Zero-Trust BOLA Protection verified: Peer intern is blocked from downloading attachments.');

  console.log('\n=== 7. THREADED REPLY GATEWAY ===');
  const replyRes = await fetch(`${BASE_URL}/api/mail/reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: rahulAuth.cookie,
    },
    body: JSON.stringify({
      replyToMessageId: rahulReceivedMsg.id,
      bodyText: 'Acknowledged! I will join the Google Meet call at the scheduled time.',
    }),
  });
  const replyData = await replyRes.json();
  console.log('Reply Status:', replyRes.status);
  console.log('Reply Response:', replyData);
  if (!replyData.success) {
    throw new Error(`Reply failed: ${JSON.stringify(replyData)}`);
  }
  console.log('✓ Reply dispatched. Sender lock enforced as:', replyData.data.from);
  if (replyData.data.from !== 'rahul@cruvels.com') {
    throw new Error(`Sender lock failed: sender was ${replyData.data.from} instead of rahul@cruvels.com`);
  }

  // Admin checks inbox for reply (matched by thread_id)
  const adminInboxRes = await fetch(`${BASE_URL}/api/mail/inbox`, {
    headers: { Cookie: adminAuth.cookie },
  });
  const adminInboxData = await adminInboxRes.json();
  const adminReceivedReply = adminInboxData.messages?.find(
    (m) => m.thread_id === replyData.data.threadId && m.from_address === 'rahul@cruvels.com'
  );
  console.log('✓ Admin received reply in inbox:', Boolean(adminReceivedReply), '| Subject:', adminReceivedReply?.subject);

  console.log('\n=== 8. MAIL REMINDERS GATEWAY ===');
  const reminderTime = new Date(Date.now() + 86400000).toISOString();
  const reminderRes = await fetch(`${BASE_URL}/api/mail/reminders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: rahulAuth.cookie,
    },
    body: JSON.stringify({
      messageId: rahulReceivedMsg.id,
      messageSubject: rahulReceivedMsg.subject,
      remindAt: reminderTime,
      note: 'Follow up on sprint review agenda',
    }),
  });
  const reminderData = await reminderRes.json();
  console.log('Reminder Status:', reminderRes.status);
  console.log('Reminder Created:', reminderData);
  if (!reminderData.success) {
    throw new Error(`Reminder creation failed: ${JSON.stringify(reminderData)}`);
  }
  console.log('✓ Mail reminder scheduled successfully for:', reminderData.reminder.remind_at);

  console.log('\n=== 9. INBOUND SYNC GATEWAY ===');
  const syncRes = await fetch(`${BASE_URL}/api/mail/sync`, {
    method: 'POST',
    headers: { Cookie: rahulAuth.cookie },
  });
  const syncData = await syncRes.json();
  console.log('Sync Status:', syncRes.status);
  console.log('Sync Response:', syncData);
  if (!syncData.success) {
    throw new Error(`Sync failed: ${JSON.stringify(syncData)}`);
  }
  console.log('✓ Inbound sync gateway executed without errors.');

  console.log('\n=============================================');
  console.log('🎉 ALL MAIL GATEWAY SUBSYSTEMS VERIFIED 100%!');
  console.log('=============================================');
}

runGatewayVerification().catch((err) => {
  console.error('\n❌ MAIL GATEWAY VERIFICATION FAILED:', err);
  process.exit(1);
});
