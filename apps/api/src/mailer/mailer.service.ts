import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

export type SendEmailParams = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

@Injectable()
export class MailerService {
  private transporter: nodemailer.Transporter | null = null;
  private from: string | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const portRaw = this.config.get<string>('SMTP_PORT');
    const port = portRaw ? parseInt(portRaw, 10) : undefined;
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const from = this.config.get<string>('SMTP_FROM');

    if (host && port && from) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: user && pass ? { user, pass } : undefined,
      });
      this.from = from;
    }
  }

  isEnabled(): boolean {
    return this.transporter !== null && this.from !== null;
  }

  async sendEmail(params: SendEmailParams): Promise<void> {
    if (!this.transporter || !this.from) return;
    await this.transporter.sendMail({
      from: this.from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
  }
}

