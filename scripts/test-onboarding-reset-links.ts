/**
 * Welcome / password-reset emails send a set-your-password link, never a password.
 * SMTP, account provisioning and the Admin SDK are injected as stubs, so this runs
 * offline:  npx tsx scripts/test-onboarding-reset-links.ts
 */
import {
  sendOnboardingWelcomeEmail,
  sendSmtpPasswordResetEmail,
  buildWelcomeEmail,
  resolveBaseUrl,
  type OnboardingDeps,
} from '../server/onboardingEmail';

let failures = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) console.log(`ok   ${label}`);
  else { failures++; console.error(`FAIL ${label}${detail ? `\n     ${detail}` : ''}`); }
}

const ALLOWED_HOSTS = (h: string) => h === 'ulendomalawi.com' || h.endsWith('.ulendomalawi.com') || h === 'localhost' || h === '127.0.0.1';
const PASSWORD_PATTERNS = [/temporary password/i, /Ulendo-\d{4}[0-9A-F]+!/, /password\s*:\s*(?!https?:\/\/|<)\S{6,}/i];

interface Sent { to: string; subject: string; html: string; text?: string }

function makeDeps(opts: { createdNew: boolean; adminSdk: boolean }) {
  const sent: Sent[] = [];
  const continueUrls: string[] = [];
  const deps: Partial<OnboardingDeps> = {
    sendEmail: async (o) => { sent.push(o); return { success: true, messageId: 'stub-1' }; },
    provisionAccount: async (email) => ({ email, uid: 'uid-stub', createdNew: opts.createdNew }),
    generateResetLink: async (email, continueUrl) => {
      continueUrls.push(continueUrl);
      if (!opts.adminSdk) return null;
      // Same shape the Admin SDK returns: Firebase action handler + continueUrl.
      return `https://travel-malawi.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=STUBCODE&apiKey=k&continueUrl=${encodeURIComponent(continueUrl)}&lang=en`;
    },
    findHotelByEmail: async () => ({ id: 'hotel-123', ownerName: 'Test Owner' }),
  };
  return { deps, sent, continueUrls };
}

function continueHost(text: string): string | null {
  const m = text.match(/https:\/\/travel-malawi\.firebaseapp\.com\/__\/auth\/action\?[^\s]+/);
  if (!m) return null;
  const cont = new URL(m[0]).searchParams.get('continueUrl');
  return cont ? new URL(cont).hostname : null;
}

function noPassword(label: string, mail: Sent) {
  const body = `${mail.subject}\n${mail.text || ''}\n${mail.html}`;
  const hit = PASSWORD_PATTERNS.find(p => p.test(body));
  check(`${label}: contains no password`, !hit, hit ? `matched ${hit}` : '');
}

const welcome = {
  hotelId: 'hotel-123',
  propertyName: 'Test Lakeside Lodge',
  ownerEmail: 'owner@example.com',
  managerEmail: 'manager@example.com',
  ownerName: 'Test Owner',
  location: 'Cape Maclear',
};

async function main() {
  console.log('\n— Onboarding reset-link emails —\n');

  // 1. New account on an allowlisted origin
  {
    const { deps, sent, continueUrls } = makeDeps({ createdNew: true, adminSdk: true });
    const res = await sendOnboardingWelcomeEmail({ ...welcome, origin: 'https://www.ulendomalawi.com' }, deps);
    check('welcome: owner + manager both emailed', res.success && sent.length === 2, JSON.stringify(res));
    for (const mail of sent) {
      const host = continueHost(mail.text || '');
      check(`welcome→${mail.to}: has reset link`, host !== null);
      check(`welcome→${mail.to}: continueUrl on allowlisted host (${host})`, !!host && ALLOWED_HOSTS(host));
      check(`welcome→${mail.to}: html has the (escaped) reset link`, mail.html.includes('oobCode=STUBCODE&amp;'));
      noPassword(`welcome→${mail.to}`, mail);
    }
    check('welcome: continueUrl uses the request origin', continueUrls.every(u => u.startsWith('https://www.ulendomalawi.com/dashboard/hotel/hotel-123')), continueUrls.join(', '));
  }

  // 2. Forged / non-allowlisted origin falls back to the platform domain
  {
    const { deps, sent, continueUrls } = makeDeps({ createdNew: false, adminSdk: true });
    await sendOnboardingWelcomeEmail({ ...welcome, managerEmail: undefined, origin: 'https://evil-phish.example' }, deps);
    check('forged origin: resolveBaseUrl falls back', resolveBaseUrl('https://evil-phish.example', 'ulendomalawi.com') === 'https://ulendomalawi.com');
    check('forged origin: continueUrl on https://ulendomalawi.com', continueUrls.length === 1 && continueUrls[0].startsWith('https://ulendomalawi.com/'), continueUrls.join(', '));
    const mail = sent[0];
    check('forged origin: no evil host anywhere in email', !!mail && !`${mail.text}${mail.html}`.includes('evil-phish'));
    check('forged origin: continueUrl host allowlisted', !!mail && continueHost(mail.text || '') === 'ulendomalawi.com');
    if (mail) noPassword('existing account welcome', mail);
  }

  // 3. Admin SDK unavailable → in-app Forgot Password link, still no password
  {
    const { deps, sent } = makeDeps({ createdNew: true, adminSdk: false });
    await sendOnboardingWelcomeEmail({ ...welcome, managerEmail: undefined, origin: 'http://localhost:3000' }, deps);
    const mail = sent[0];
    check('no Admin SDK: links to in-app reset on localhost', !!mail && (mail.text || '').includes('http://localhost:3000/?auth=reset&email=owner%40example.com'));
    if (mail) noPassword('no Admin SDK welcome', mail);
  }

  // 4. Forgot-password email
  {
    const { deps, sent, continueUrls } = makeDeps({ createdNew: false, adminSdk: true });
    const res = await sendSmtpPasswordResetEmail('Owner@Example.com', 'https://attacker.example', deps);
    const mail = sent[0];
    check('reset: sent', res.emailSent && !!mail);
    check('reset: continueUrl falls back to platform domain', continueUrls[0]?.startsWith('https://ulendomalawi.com/dashboard/hotel/hotel-123'), continueUrls.join(', '));
    check('reset: reset link on allowlisted host', !!mail && continueHost(mail.text || '') === 'ulendomalawi.com');
    if (mail) noPassword('reset', mail);
  }

  // 5. Pure builder never emits a password even for brand-new accounts
  {
    const mail = buildWelcomeEmail({
      recipientEmail: 'a@example.com', recipientName: 'A', roleLabel: 'Owner', hotelId: 'host-onboarding',
      propertyName: 'P', location: 'Malawi', baseUrl: 'https://ulendomalawi.com', domain: 'ulendomalawi.com',
      resetLink: 'https://travel-malawi.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=X&continueUrl=https%3A%2F%2Fulendomalawi.com%2Fdashboard',
      createdNew: true,
    });
    noPassword('builder', { to: 'a@example.com', ...mail });
    check('builder: placeholder hotel links to /dashboard', mail.text.includes('https://ulendomalawi.com/dashboard?auth=signin') && !mail.text.includes('/hotel/host-onboarding'));
  }

  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
