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

    // 🇪🇹 1. Commercial Bank of Ethiopia (CBE)
    // Pattern: "Dear Customer your Account 1********3866 has been debited with ETB 500.00 on 12/08/2026. Your Current Balance is ETB 28,036.28."
    if (cleanSender.includes('CBE')) {
      const isDebit = /debited/i.test(cleanMessage);
      const isCredit = /credited/i.test(cleanMessage);

      const amountMatch = cleanMessage.match(/ETB\s*([\d,]+\.?\d*)/i);
      const maskMatch = cleanMessage.match(/Account\s*([1*]+\d{4})/i);
      const balanceMatch = cleanMessage.match(/Current Balance is ETB\s*([\d,]+\.?\d*)/i);
      const refMatch = cleanMessage.match(/(?:Txn|Ref|ID):\s*([A-Z0-9]+)/i);

      if (amountMatch) {
        const amount = this.cleanAmount(amountMatch[1]);
        const extractedBalance = balanceMatch ? this.cleanAmount(balanceMatch[1]) : undefined;
        const fullMask = maskMatch ? maskMatch[1] : undefined;
        const accountMask = fullMask ? fullMask.slice(-4) : undefined;

        return {
          amount,
          type: isDebit ? 'EXPENSE' : isCredit ? 'INCOME' : 'EXPENSE',
          description: `CBE Transaction ${accountMask ? `(...${accountMask})` : ''}`,
          referenceId: refMatch ? refMatch[1] : undefined,
          accountMask,
          extractedBalance,
          bankName: 'CBE',
        };
      }
    }

    // 📱 2. Telebirr (Ethio Telecom)
    // Real SMS formats:
    // Transfer: "You have transferred ETB 1.00 to abenezer shimelis (2519****3345) on 20/08/2026.
    //            Your transaction number is DHK50GG8MN. The service fee is ETB 0.87 ...
    //            Your current E-Money Account balance is ETB 256.50."
    // Receive:  "You have received ETB 500.00 from ... Your current E-Money Account balance is ETB 800.00."
    if (cleanSender.includes('127') || cleanSender.includes('TELEBIRR')) {
      const isExpense = /transferred|paid/i.test(cleanMessage);
      const isIncome = /received/i.test(cleanMessage);

      // Match the first ETB amount (the actual transfer amount, before any fee mentions)
      const amountMatch = cleanMessage.match(/(?:transferred|paid|received)\s+ETB\s*([\d,]+\.?\d*)/i);

      // Match transaction/receipt number (supports both formats)
      const refMatch =
        cleanMessage.match(/transaction number is\s+([A-Z0-9]+)/i) ||
        cleanMessage.match(/Receipt No\.?\s*([A-Z0-9]+)/i) ||
        cleanMessage.match(/Ref(?:erence)?(?:\s*No\.?)?\s*[:#]?\s*([A-Z0-9]+)/i);

      // Match current balance (supports multiple telebirr balance phrasings)
      const balanceMatch =
        cleanMessage.match(/E-Money Account\s+balance is ETB\s*([\d,]+\.?\d*)/i) ||
        cleanMessage.match(/new balance is ETB\s*([\d,]+\.?\d*)/i) ||
        cleanMessage.match(/current balance is ETB\s*([\d,]+\.?\d*)/i) ||
        cleanMessage.match(/balance[:\s]+ETB\s*([\d,]+\.?\d*)/i);

      // Match recipient name
      const recipientMatch = cleanMessage.match(/(?:transferred|paid)\s+ETB[\d,.\s]+to\s+([^(]+?)(?:\s*\(|\s+on\b)/i);

      if (amountMatch) {
        const amount = this.cleanAmount(amountMatch[1]);
        const extractedBalance = balanceMatch ? this.cleanAmount(balanceMatch[1]) : undefined;
        const recipient = recipientMatch ? recipientMatch[1].trim() : 'Telebirr Transaction';

        return {
          amount,
          type: isExpense ? 'EXPENSE' : isIncome ? 'INCOME' : 'EXPENSE',
          description: isExpense ? `Telebirr transfer to ${recipient}` : `Telebirr received from ${recipient}`,
          referenceId: refMatch ? refMatch[1] : undefined,
          accountMask: 'telebirr',
          extractedBalance,
          bankName: 'Telebirr',
        };
      }
    }


    // 🏛️ 3. Bank of Abyssinia (BOA)
    // Pattern: "Dear customer, your account 12****89 has been debited with ETB 1,200.00. Ref: BOA9912. Balance: ETB 14,000.00"
    if (cleanSender.includes('ABYSSINIA') || cleanSender.includes('BOA')) {
      const isDebit = /debited/i.test(cleanMessage);
      const amountMatch = cleanMessage.match(/ETB\s*([\d,]+\.?\d*)/i);
      const maskMatch = cleanMessage.match(/account\s*(\d+\*+\d+|\d+)/i);
      const refMatch = cleanMessage.match(/Ref:\s*([A-Z0-9]+)/i);
      const balanceMatch = cleanMessage.match(/Balance:\s*ETB\s*([\d,]+\.?\d*)/i);

      if (amountMatch) {
        const amount = this.cleanAmount(amountMatch[1]);
        const extractedBalance = balanceMatch ? this.cleanAmount(balanceMatch[1]) : undefined;
        const mask = maskMatch ? maskMatch[1].slice(-4) : undefined;

        return {
          amount,
          type: isDebit ? 'EXPENSE' : 'INCOME',
          description: `BOA Transaction ${mask ? `(...${mask})` : ''}`,
          referenceId: refMatch ? refMatch[1] : undefined,
          accountMask: mask,
          extractedBalance,
          bankName: 'Bank of Abyssinia',
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