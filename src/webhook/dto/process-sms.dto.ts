
import { IsNotEmpty, IsString, IsOptional, ValidateIf } from 'class-validator';

export class ProcessSmsDto {
  // Support Android SMS Gateway default 'from' or custom 'sender'
  @ValidateIf((o) => !o.sender)
  @IsNotEmpty({ message: 'Either "from" or "sender" is required' })
  @IsString()
  from?: string;

  @ValidateIf((o) => !o.from)
  @IsNotEmpty({ message: 'Either "sender" or "from" is required' })
  @IsString()
  sender?: string;

  // Support Android SMS Gateway default 'text' or custom 'message'
  @ValidateIf((o) => !o.message)
  @IsNotEmpty({ message: 'Either "text" or "message" is required' })
  @IsString()
  text?: string;

  @ValidateIf((o) => !o.text)
  @IsNotEmpty({ message: 'Either "message" or "text" is required' })
  @IsString()
  message?: string;

  @IsOptional()
  sentStamp?: number | string;

  @IsOptional()
  receivedStamp?: number | string;

  @IsOptional()
  @IsString()
  sim?: string;

  @IsOptional()
  @IsString()
  timestamp?: string;

  @IsOptional()
  version?: string;

  @IsOptional()
  battery?: number | string;

  @IsOptional()
  power?: string;

  @IsOptional()
  network?: string;
}

export function extractSmsSender(dto: ProcessSmsDto): string {
  return (dto.from || dto.sender || '').trim();
}

export function extractSmsMessage(dto: ProcessSmsDto): string {
  return (dto.text || dto.message || '').trim();
}

export function extractSmsTimestamp(dto: ProcessSmsDto): Date {
  const raw = dto.sentStamp ?? dto.receivedStamp ?? dto.timestamp;
  if (raw !== undefined && raw !== null && raw !== '') {
    if (typeof raw === 'number') {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return d;
    }
    if (typeof raw === 'string') {
      const num = Number(raw);
      if (!isNaN(num) && raw.trim() !== '') {
        const d = new Date(num);
        if (!isNaN(d.getTime())) return d;
      }
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return new Date();
}
