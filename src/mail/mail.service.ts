import { Injectable,Logger } from '@nestjs/common';
import {ConfigService} from "@nestjs/config";
import {Resend} from "resend";

@Injectable()
export class MailService {
    private readonly resend:Resend;
    private readonly logger = new Logger(MailService.name);
    private readonly from: string;
    constructor(private configService : ConfigService){
        const apiKey = this.configService.get<string>('mail.apiKey');
        const from = this.configService.get<string>('mail.from');

        if (!apiKey || !from){
            this.logger.warn("Mail config incomplete")
        }
        else{
            this.resend = new Resend(apiKey);
            this.from = from;
            this.logger.log("Mail configured successfully", from)
        }
    }
    // Add inside MailService in src/mail/mail.service.ts
    async sendWelcomeEmail(to: string, fullName: string) {
    if (!this.resend) return;

    try {
      const data = await this.resend.emails.send({
        from: `Expense Tracker <${this.from}>`,
        to,
        subject: 'Welcome to Expense Tracker! 🎉',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2>Welcome aboard, ${fullName}!</h2>
            <p>We're thrilled to have you! Your account is ready, and we've already auto-seeded your profile with default categories like <b>Groceries, Rent, Salary, and Utilities</b> so you can start tracking immediately.</p>
            <br/>
            <p>Happy tracking,<br/>The Expense Tracker Team</p>
          </div>
        `,
      });

      this.logger.log(`Welcome email successfully sent to ${to} (ID: ${data.data?.id})`);
      return data;
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${to}`, error);
    }
  }
    async sendPasswordResetEmail(to: string, token: string) {
    if (!this.resend) return;

    // In production, this link points to your React/Mobile frontend
    const resetUrl = `http://localhost:3000/reset-password?token=${token}`;

    try {
        await this.resend.emails.send({
        from: `Expense Tracker <${this.from}>`,
        to,
        subject: 'Reset Your Expense Tracker Password 🔐',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2>Password Reset Request</h2>
            <p>You requested a password reset. Click the button below to set a new password:</p>
            <p style="margin: 20px 0;">
                <a href="${resetUrl}" style="background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
            </p>
            <p>Or copy this token directly: <b>${token}</b></p>
            <p style="color: #777; font-size: 12px;">This link will expire in 15 minutes. If you did not request this, please ignore this email.</p>
            </div>
        `,
        });
        this.logger.log(`Password reset email sent to ${to}`);
    } catch (error) {
        this.logger.error(`Failed to send password reset email to ${to}`, error);
    }
    }
    async sendBudgetAlert(to:string,categoryName:string,budgetAmount:number,percentage:number){
        try {
            const { data, error } = await this.resend.emails.send({
                from: `Expense Tracker <${this.from}>`,
                to : to,
                subject : "Budget Alert",
                html : `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2>Budget Alert for ${categoryName}</h2>
                    <p>You've spent ${percentage}% of your ${budgetAmount} budget for the ${categoryName} category.</p>
                    <br/>
                    <p>Happy tracking,<br/>The Expense Tracker Team</p>
                </div>
                `,
            });

            if (error) {
                this.logger.error("Failed to send budget alert email to %s: %o", to, error);
                return null;
            }

            this.logger.log('Budget alert email sent successfully : %s : %o', to, {});
            return data;
        } catch (error) {
            this.logger.error("Failed to send budget alert email : %s : %o", to, error);
        }
    }


}
