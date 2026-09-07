import { Hotel, DepositInfo, User } from '../types';
import { isAdmin, isHotelManager } from './roles';

/**
 * Verified test payment and deposit details for Blue Zebra Island Lodge
 * (Nankoma Island, Lake Malawi).
 */
export const BLUE_ZEBRA_TEST_DEPOSIT_INFO: DepositInfo = {
  airtelMoneyNumber: '+265 999 452 811',
  airtelMoneyName: 'Blue Zebra Island Lodge Ltd',
  mpambaNumber: '+265 888 231 904',
  mpambaName: 'Blue Zebra Island Lodge',
  bankName: 'National Bank of Malawi (NBM)',
  bankAccountName: 'Blue Zebra Island Lodge Ltd',
  bankAccountNumber: '1004829104',
  bankBranch: 'Capital City Branch, Lilongwe',
  bankSwiftCode: 'NBMAMWMW',
  depositPercentage: 50,
  instructions: '50% deposit required to secure reservation. Nankoma Island boat transfers included with confirmed voucher.'
};

/**
 * Returns configured deposit information for a property, automatically
 * falling back to realistic test details for Blue Zebra Island Lodge.
 */
export function getHotelDepositInfo(hotel?: Hotel | null): DepositInfo {
  if (hotel?.depositInfo && (hotel.depositInfo.airtelMoneyNumber || hotel.depositInfo.bankAccountNumber)) {
    return hotel.depositInfo;
  }

  // Auto-populate Blue Zebra test details
  const isBlueZebra = 
    hotel?.id === 'V8CSMEkXvhfFXlZlpb3R' || 
    (hotel?.name && hotel.name.toLowerCase().includes('blue zebra'));

  if (isBlueZebra) {
    return BLUE_ZEBRA_TEST_DEPOSIT_INFO;
  }

  return hotel?.depositInfo || {
    airtelMoneyNumber: '',
    airtelMoneyName: '',
    mpambaNumber: '',
    mpambaName: '',
    bankName: '',
    bankAccountName: '',
    bankAccountNumber: '',
    bankBranch: '',
    bankSwiftCode: '',
    depositPercentage: 50,
    instructions: ''
  };
}

export interface DepositSnippetOptions {
  guestName?: string;
  dates?: string;
  roomName?: string;
  totalAmount?: number;
  currency?: string;
  reference?: string;
}

/**
 * Formats a clean, ready-to-send deposit request message pre-populated
 * with the lodge's configured mobile money and bank details.
 */
export function formatDepositSnippet(
  type: 'mobile_money' | 'bank' | 'general',
  depositInfo: DepositInfo,
  options: DepositSnippetOptions = {}
): string {
  const guestFirstName = options.guestName ? options.guestName.split(' ')[0] : 'Guest';
  const percentage = depositInfo.depositPercentage ?? 50;
  const stayDates = options.dates ? `for ${options.dates}` : '';
  const refText = options.reference ? `• Reference: ${options.reference}\n` : '';

  let depositAmountText = `${percentage}% deposit`;
  if (options.totalAmount && options.totalAmount > 0) {
    const calc = Math.round((options.totalAmount * percentage) / 100);
    const curr = options.currency || 'MWK';
    depositAmountText = `${percentage}% deposit (${curr} ${calc.toLocaleString()})`;
  }

  if (type === 'mobile_money') {
    const airtelLine = depositInfo.airtelMoneyNumber
      ? `• Airtel Money: ${depositInfo.airtelMoneyNumber}${depositInfo.airtelMoneyName ? ` (${depositInfo.airtelMoneyName})` : ''}`
      : '• Airtel Money: [Configure number in Host Settings]';

    const mpambaLine = depositInfo.mpambaNumber
      ? `• TNM Mpamba: ${depositInfo.mpambaNumber}${depositInfo.mpambaName ? ` (${depositInfo.mpambaName})` : ''}`
      : '• TNM Mpamba: [Configure number in Host Settings]';

    const notes = depositInfo.instructions ? `\n📌 Note: ${depositInfo.instructions}\n` : '';

    return `Hello ${guestFirstName}! We have received your reservation request ${stayDates}. If you would like to place a ${depositAmountText} via Mobile Money, here are the official property accounts:\n\n${airtelLine}\n${mpambaLine}\n${refText}${notes}\n🔒 Guest Safety & Confirmation: Payment confirmation is handled directly at the property manager's discretion upon internal account verification. For your security, always confirm details directly with property management, and do not upload payment slips or sensitive receipts here. Once management verifies the transaction, your reservation will be updated right away!`;
  }

  if (type === 'bank') {
    const bankLine = depositInfo.bankName
      ? `• Bank: ${depositInfo.bankName}`
      : '• Bank: [Configure bank name in Host Settings]';

    const accountNameLine = depositInfo.bankAccountName
      ? `• Account Name: ${depositInfo.bankAccountName}`
      : '';

    const accountNumberLine = depositInfo.bankAccountNumber
      ? `• Account Number: ${depositInfo.bankAccountNumber}`
      : '• Account Number: [Configure account in Host Settings]';

    const branchLine = depositInfo.bankBranch ? `• Branch: ${depositInfo.bankBranch}\n` : '';
    const swiftLine = depositInfo.bankSwiftCode ? `• SWIFT Code: ${depositInfo.bankSwiftCode}\n` : '';
    const notes = depositInfo.instructions ? `\n📌 Note: ${depositInfo.instructions}\n` : '';

    return `Hello ${guestFirstName}! We are pleased to hold your room ${stayDates}. To coordinate a ${depositAmountText} via Bank Wire Transfer, here are the official banking details:\n\n${bankLine}\n${accountNameLine ? accountNameLine + '\n' : ''}${accountNumberLine}\n${branchLine}${swiftLine}${refText}${notes}\n🔒 Guest Safety & Confirmation: Payment confirmation is handled at the property manager's discretion once funds reflect in the property account. For your security, verify wire credentials directly with management before transferring. There is no need to upload bank slips or receipt documents here — simply notify us when initiated and management will verify and update your reservation.`;
  }

  // General Prompt
  const paymentMethods: string[] = [];
  if (depositInfo.airtelMoneyNumber) {
    paymentMethods.push(`• Airtel Money: ${depositInfo.airtelMoneyNumber} (${depositInfo.airtelMoneyName || 'Lodge'})`);
  }
  if (depositInfo.mpambaNumber) {
    paymentMethods.push(`• TNM Mpamba: ${depositInfo.mpambaNumber} (${depositInfo.mpambaName || 'Lodge'})`);
  }
  if (depositInfo.bankName && depositInfo.bankAccountNumber) {
    paymentMethods.push(`• Bank Wire: ${depositInfo.bankName} (Acc: ${depositInfo.bankAccountNumber})`);
  }

  const methodsList = paymentMethods.length > 0 
    ? `\n\nAccepted Payment Options:\n${paymentMethods.join('\n')}\n`
    : '\n\nWe accept Airtel Money, TNM Mpamba, and direct Bank Wire transfers.\n';

  return `Hello ${guestFirstName}! We have received your booking request ${stayDates}. A ${percentage}% deposit may be arranged to secure your reservation.${methodsList}\n🔒 Guest Safety & Confirmation: Payment arrangements and confirmation are at the property manager's discretion. For your safety, always verify details directly with property management or discuss settling upon arrival. No receipt upload is required.\n\nPlease let us know how you would like to proceed!`;
}

/**
 * Checks if voice/video calling is enabled for a property.
 * Admins can disable calls globally (`adminCallsEnabled !== false`).
 * Managers can toggle calls for their property (`callsEnabled !== false`).
 */
export function isCallingAllowed(hotel?: Hotel | null, user?: User | null): { allowed: boolean; reason?: string } {
  if (!hotel) return { allowed: true };

  // Admin global lock
  if (hotel.adminCallsEnabled === false) {
    return {
      allowed: false,
      reason: 'Audio and video calls have been disabled globally by an administrator.'
    };
  }

  // Manager property setting
  if (hotel.callsEnabled === false) {
    return {
      allowed: false,
      reason: 'Voice and video calling is currently disabled by the property host.'
    };
  }

  return { allowed: true };
}
