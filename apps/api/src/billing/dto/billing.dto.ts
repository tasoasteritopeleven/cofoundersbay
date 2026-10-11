import { IsEmail, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';

export class AllocateSeatDto {
  @IsUUID()
  userId!: string;
}

export class BillingContactDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsOptional() @IsString() @MaxLength(50)
  phone?: string;

  @IsOptional() @IsString() @MaxLength(200)
  company?: string;

  @IsOptional() @IsString() @MaxLength(250)
  addressLine1?: string;

  @IsOptional() @IsString() @MaxLength(250)
  addressLine2?: string;

  @IsOptional() @IsString() @MaxLength(120)
  city?: string;

  @IsOptional() @IsString() @MaxLength(120)
  state?: string;

  @IsOptional() @IsString() @MaxLength(32)
  postalCode?: string;

  @IsOptional() @IsString() @Length(2, 2)
  country?: string;

  @IsOptional() @IsString() @MaxLength(64)
  vatId?: string;

  @IsOptional() @IsString() @MaxLength(64)
  taxId?: string;

  @IsOptional() @IsString() @MaxLength(200)
  legalName?: string;
}
