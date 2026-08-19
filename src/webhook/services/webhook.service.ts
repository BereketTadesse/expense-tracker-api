import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ProcessSmsDto,
  extractSmsSender,
  extractSmsMessage,
  extractSmsTimestamp,
} from '../dto/process-sms.dto';
import { SmsParserService } from '../services/sms-parser.service';
import { Account, AccountType } from '../../accounts/entities/accounts.entity';
import { Transaction } from '../../transactions/entities/transactions.entity';
import { Currency } from '../../common/enums/currency.enum';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class WebhookService {
  constructor(
    private readonly smsParserService: SmsParserService,
    private readonly dataSource: DataSource,
  ) {}

  async processIncomingSms(processSmsDto: ProcessSmsDto, user?: User) {
    const sender = extractSmsSender(processSmsDto);
    const message = extractSmsMessage(processSmsDto);
    const txnDate = extractSmsTimestamp(processSmsDto);

    // Check for Android SMS Gateway default Test Ping button
    if (message.toLowerCase() === 'test' || sender === '1234567890') {
      return {
        success: true,
        message: 'Test ping received successfully from SMS Gateway.',
        data: {
          isTest: true,
          sender,
          message,
        },
      };
    }

    // 1. Parse SMS
    const parsedData = this.smsParserService.parseSms(sender, message);
    if (!parsedData) {
      return {
        success: false,
        message: 'SMS message did not match any recognized bank regex pattern. Skipped.',
      };
    }

    const { amount, type, description, referenceId, accountMask, extractedBalance, bankName } =
      parsedData;

    // 2. Database Transaction (Atomic)
    const result = await this.dataSource.transaction(async (manager) => {
      // Resolve user if not provided (e.g. via SMS Gateway API key / signature)
      let targetUser = user;
      if (!targetUser) {
        const existingAccount = await manager.findOne(Account, {
          where: [
            { senderHeader: sender.trim() },
            accountMask ? { accountMask } : {},
          ].filter((cond) => Object.keys(cond).length > 0),
          relations: { user: true },
        });

        if (existingAccount && existingAccount.user) {
          targetUser = existingAccount.user;
        } else {
          const users = await manager.find(User, { order: { id: 'ASC' }, take: 1 });
          targetUser = users[0] || undefined;
        }
      }

      if (!targetUser) {
        throw new BadRequestException('No registered user found in the system to assign SMS transaction.');
      }

      // Idempotency check: Duplicate reference ID check
      if (referenceId) {
        const existingTxn = await manager.findOne(Transaction, { where: { referenceId } });
        if (existingTxn) {
          throw new BadRequestException(
            `Duplicate SMS: Transaction with Reference ID '${referenceId}' has already been processed.`,
          );
        }
      }

      // Find or auto-create account
      let account = await manager.findOne(Account, {
        where: [
          { user: { id: targetUser.id }, senderHeader: sender.trim() },
          accountMask ? { user: { id: targetUser.id }, accountMask } : {},
        ].filter((cond) => Object.keys(cond).length > 0),
        lock: { mode: 'pessimistic_write' },
      });

      let isNewAccount = false;

      if (!account) {
        const newAccountName = accountMask
          ? `${bankName} (...${accountMask.slice(-4)})`
          : `${bankName} Wallet`;

        const initialBalance =
          extractedBalance !== undefined
            ? extractedBalance
            : type === 'INCOME'
            ? amount
            : -amount;

        const createdAccount = manager.create(Account, {
          name: newAccountName,
          type: bankName.toLowerCase().includes('telebirr')
            ? AccountType.MOBILE_WALLET
            : AccountType.CHECKING,
          senderHeader: sender.trim(),
          accountMask: accountMask || null,
          balance: initialBalance,
          currency: Currency.ETB,
          user: targetUser,
        });

        account = await manager.save(createdAccount);
        isNewAccount = true;
      } else {
        // Synchronize balance
        if (extractedBalance !== undefined) {
          account.balance = extractedBalance;
        } else {
          const currentBal = Number(account.balance);
          account.balance = type === 'EXPENSE' ? currentBal - amount : currentBal + amount;
        }
        account = await manager.save(account);
      }

      // Save Transaction
      const newTransaction = manager.create(Transaction, {
        amount,
        type,
        description: description || `Automated SMS from ${bankName}`,
        referenceId: referenceId || null,
        date: txnDate,
        account,
        user: targetUser,
      });

      const savedTransaction = await manager.save(newTransaction);

      return { transaction: savedTransaction, account, isNewAccount };
    });

    return {
      success: true,
      message: result.isNewAccount
        ? `New account '${result.account.name}' auto-created and transaction logged.`
        : 'SMS transaction processed and balance updated.',
      data: {
        transactionId: result.transaction.id,
        accountName: result.account.name,
        isNewAccountCreated: result.isNewAccount,
        amount,
        type,
        currentBalance: result.account.balance,
        referenceId: referenceId || null,
      },
    };
  }

  async processHeartbeat(payload?: Record<string, any>) {
    return {
      success: true,
      message: 'Heartbeat ping received successfully.',
      timestamp: new Date().toISOString(),
      details: payload || {},
    };
  }
}