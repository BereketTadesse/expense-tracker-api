import { Injectable, Logger } from '@nestjs/common';

export interface ParsedSmsResult {
  amount: number;
  type: 'EXPENSE' | 'INCOME';
  description: string;
  referenceId?: string;
  accountMask?: string;
  extractedBalance?: number;
  bankName: string;
}

@Injectable()
export class SmsParserService {
  private readonly logger = new Logger(SmsParserService.name);

  parseSms(sender: string, message: string): ParsedSmsResult | null {
    const cleanSender = sender.trim().toUpperCase();
    const cleanMessage = message.trim();

    // ─── Bank detection (sender OR message body fallback) ───────────────────
    // This handles cases where the sender ID is a number or not shown by the phone.
    const isCBE =
      cleanSender.includes('CBE') ||
      /banking with CBE|cbe\.com\.et/i.test(cleanMessage);

    const isTelebirr =
      cleanSender.includes('127') ||
      cleanSender.includes('TELEBIRR') ||
      /telebirr|ethio telecom/i.test(cleanMessage);

    const isBOA =
      cleanSender.includes('ABYSSINIA') ||
      cleanSender.includes('BOA') ||
      /bank of abyssinia|bankofabyssinia\.com/i.test(cleanMessage);

    const isDashen =
      cleanSender.includes('DASHEN') ||
      cleanSender.includes('DBE') ||
      /dashen bank/i.test(cleanMessage);

    // ─────────────────────────────────────────────────────────────────────────
    // 🇪🇹 1. Commercial Bank of Ethiopia (CBE)
    //
    // Format A – Mobile received:
    //   "Dear Bereket Tadesse Eshete You have received ETB 300.00 from account
    //    1**9705 (Yabsira Getaneh Zelalem) to your account 1**8723.
    //    Your current balance is ETB332.78. Thanks for Banking with CBE.
    //    https://mbreciept.cbe.com.et/v2-xxx"
    //
    // Format B – Mobile debit (with fees):
    //   "Dear Bereket Tadesse Eshete A debit transaction of ETB 300.0. has
    //    occurred on your account 1****8723. Service charge of ETB 6.14 ...
    //    Your current balance is ETB19.40. Thanks for Banking with CBE.
    //    https://mbreciept.cbe.com.et/v2-xxx"
    //
    // Format C – Branch credit / debit:
    //   "Dear Mr Bereket your Account 1****8723 has been credited with ETB 400.00.
    //    Your Current Balance is ETB 419.4. Thank you for Banking with CBE!
    //    for Reciept https://apps.cbe.com.et:100/BranchReceipt/FT262221PK6D&99948723"
    // ─────────────────────────────────────────────────────────────────────────
    if (isCBE) {
      const isDebit  = /debited|debit transaction/i.test(cleanMessage);
      const isCredit = /credited|received/i.test(cleanMessage);

      // Amount: match the FIRST transaction ETB (before any service charge mention)
      // Handles: "received ETB 300.00", "of ETB 300.0.", "credited with ETB 400.00"
      const amountMatch =
        cleanMessage.match(/(?:received|of|credited\s+with)\s+ETB\s*([\d,]+\.?\d*)/i) ||
        cleanMessage.match(/ETB\s*([\d,]+\.?\d*)/i);

      // Account mask: prefer "to your account XXXX" for received, else "your account XXXX"
      const toAccountMatch  = cleanMessage.match(/to\s+your\s+account\s+(\S+)/i);
      const anyAccountMatch = cleanMessage.match(/(?:your\s+)?[Aa]ccount\s+(\S+)/);
      const maskRaw = (toAccountMatch?.[1] ?? anyAccountMatch?.[1] ?? '').replace(/['.]/g, '');
      const accountMask = maskRaw || undefined;

      // Balance: supports "ETB332.78" (no space) and "ETB 419.4" (with space)
      const balanceMatch =
        cleanMessage.match(/current\s+balance\s+is\s+ETB\s*([\d,]+\.?\d*)/i) ||
        cleanMessage.match(/balance\s+is\s+ETB\s*([\d,]+\.?\d*)/i);

      // Reference: branch URL contains /BranchReceipt/REFCODE&...
      const refMatch =
        cleanMessage.match(/BranchReceipt\/([A-Z0-9]+)/i) ||
        cleanMessage.match(/(?:Txn|Ref|ID)[:#\s]+([A-Z0-9]+)/i);

      // Sender name for received money: "from account 1**9705 (Yabsira Getaneh Zelalem)"
      const fromNameMatch = cleanMessage.match(/\(([^)]+)\)/);
      const fromName = fromNameMatch?.[1]?.trim();

      if (amountMatch) {
        const amount = this.cleanAmount(amountMatch[1]);
        const extractedBalance = balanceMatch ? this.cleanAmount(balanceMatch[1]) : undefined;

        const description = isCredit
          ? fromName
            ? `CBE received from ${fromName}`
            : `CBE credit ${accountMask ? `(${accountMask})` : ''}`
          : `CBE debit ${accountMask ? `(${accountMask})` : ''}`;

        return {
          amount,
          type: isDebit ? 'EXPENSE' : isCredit ? 'INCOME' : 'EXPENSE',
          description,
          referenceId: refMatch?.[1] ?? undefined,
          accountMask,
          extractedBalance,
          bankName: 'CBE',
        };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 📱 2. Telebirr (Ethio Telecom)
    //
    // Transfer: "You have transferred ETB 1.00 to abenezer shimelis (2519****3345)
    //            on 20/08/2026. Your transaction number is DHK50GG8MN.
    //            The service fee is ETB 0.87 ...
    //            Your current E-Money Account balance is ETB 256.50."
    // Receive:  "You have received ETB 500.00 from ...
    //            Your current E-Money Account balance is ETB 800.00."
    // ─────────────────────────────────────────────────────────────────────────
    if (isTelebirr) {
      const isExpense = /transferred|paid/i.test(cleanMessage);
      const isIncome  = /received/i.test(cleanMessage);

      // Match the actual transfer amount (not the service fee)
      const amountMatch = cleanMessage.match(/(?:transferred|paid|received)\s+ETB\s*([\d,]+\.?\d*)/i);

      // Transaction / receipt reference
      const refMatch =
        cleanMessage.match(/transaction number is\s+([A-Z0-9]+)/i) ||
        cleanMessage.match(/Receipt No\.?\s*([A-Z0-9]+)/i) ||
        cleanMessage.match(/Ref(?:erence)?(?:\s*No\.?)?\s*[:#]?\s*([A-Z0-9]+)/i);

      // Balance (multiple phrasings)
      const balanceMatch =
        cleanMessage.match(/E-Money Account\s+balance is ETB\s*([\d,]+\.?\d*)/i) ||
        cleanMessage.match(/new balance is ETB\s*([\d,]+\.?\d*)/i) ||
        cleanMessage.match(/current balance is ETB\s*([\d,]+\.?\d*)/i) ||
        cleanMessage.match(/balance[:\s]+ETB\s*([\d,]+\.?\d*)/i);

      // Recipient name
      const recipientMatch = cleanMessage.match(
        /(?:transferred|paid)\s+ETB[\d,.\s]+to\s+([^(]+?)(?:\s*\(|\s+on\b)/i,
      );

      if (amountMatch) {
        const amount = this.cleanAmount(amountMatch[1]);
        const extractedBalance = balanceMatch ? this.cleanAmount(balanceMatch[1]) : undefined;
        const recipient = recipientMatch?.[1]?.trim() ?? 'Telebirr Transaction';

        return {
          amount,
          type: isExpense ? 'EXPENSE' : isIncome ? 'INCOME' : 'EXPENSE',
          description: isExpense
            ? `Telebirr transfer to ${recipient}`
            : `Telebirr received from ${recipient}`,
          referenceId: refMatch?.[1] ?? undefined,
          accountMask: 'telebirr',
          extractedBalance,
          bankName: 'Telebirr',
        };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 🏛️ 3. Bank of Abyssinia (BOA)
    //
    // Debit:  "Dear Bereket, your account 1*59 was debited with ETB 5.00.
    //          Available Balance: ETB 60.36.
    //          Receipt: https://cs.bankofabyssinia.com/slip/?trx=FT26231KSK1K99759"
    // Credit: "Dear Bereket, your account 1*59 was credited with ETB 300.00
    //          by Bereket Tadesse Eshete. Available Balance: ETB 363.07.
    //          Receipt: https://cs.bankofabyssinia.com/slip/?trx=FT26222CLC8J10104"
    // ─────────────────────────────────────────────────────────────────────────
    if (isBOA) {
      const isDebit  = /debited/i.test(cleanMessage);
      const isCredit = /credited/i.test(cleanMessage);

      const amountMatch = cleanMessage.match(/(?:debited|credited)\s+with\s+ETB\s*([\d,]+\.?\d*)/i);
      const maskMatch   = cleanMessage.match(/your\s+account\s+(\S+)\s+was/i);
      const balanceMatch = cleanMessage.match(/Available\s+Balance:\s*ETB\s*([\d,]+\.?\d*)/i);
      const refMatch    = cleanMessage.match(/[?&]trx=([A-Z0-9]+)/i);
      const senderMatch = cleanMessage.match(/credited\s+with\s+ETB[\d,.\s]+by\s+([^.]+)\./i);

      if (amountMatch) {
        const amount = this.cleanAmount(amountMatch[1]);
        const extractedBalance = balanceMatch ? this.cleanAmount(balanceMatch[1]) : undefined;
        const mask = maskMatch?.[1];
        const senderName = senderMatch?.[1]?.trim();

        return {
          amount,
          type: isDebit ? 'EXPENSE' : isCredit ? 'INCOME' : 'EXPENSE',
          description: isCredit && senderName
            ? `BOA credit from ${senderName}`
            : `BOA debit ${mask ? `(${mask})` : ''}`,
          referenceId: refMatch?.[1] ?? undefined,
          accountMask: mask,
          extractedBalance,
          bankName: 'Bank of Abyssinia',
        };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 🏦 4. Dashen Bank
    //
    // Debit:  "Dear Customer, your account '5032**011' is debited with ETB 500.00
    //          on 19/08/2026. Your current balance is ETB 2,084.74.
    //          Dashen Bank - Always one step ahead!"
    // Credit: "Dear Customer, your account '5032**011' is credited with ETB 500.00
    //          on 19/08/2026. Your current balance is ETB 2,584.74. Dashen Bank..."
    // ─────────────────────────────────────────────────────────────────────────
    if (isDashen) {
      const isDebit  = /debited/i.test(cleanMessage);
      const isCredit = /credited/i.test(cleanMessage);

      const amountMatch  = cleanMessage.match(/(?:debited|credited)\s+with\s+ETB\s*([\d,]+\.?\d*)/i);
      const maskMatch    = cleanMessage.match(/account\s+'?([\d*]+)'?/i);
      const balanceMatch = cleanMessage.match(/current balance is ETB\s*([\d,]+\.?\d*)/i);
      const refMatch     = cleanMessage.match(/(?:Ref|Txn|Transaction)(?:\s*No\.?|:)?\s*([A-Z0-9]+)/i);

      if (amountMatch) {
        const amount = this.cleanAmount(amountMatch[1]);
        const extractedBalance = balanceMatch ? this.cleanAmount(balanceMatch[1]) : undefined;
        const mask = maskMatch?.[1];

        return {
          amount,
          type: isDebit ? 'EXPENSE' : isCredit ? 'INCOME' : 'EXPENSE',
          description: `Dashen Bank ${isDebit ? 'debit' : 'credit'} ${mask ? `(${mask})` : ''}`,
          referenceId: refMatch?.[1] ?? undefined,
          accountMask: mask,
          extractedBalance,
          bankName: 'Dashen Bank',
        };
      }
    }

    this.logger.warn(`Unrecognized SMS format from sender '${sender}': "${message}"`);
    return null;
  }

  private cleanAmount(rawAmount: string): number {
    return parseFloat(rawAmount.replace(/,/g, ''));
  }
}