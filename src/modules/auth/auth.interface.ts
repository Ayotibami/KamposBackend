export interface RegisterDTO {
  email: string;
  password: string;
  firstName?: string;
  [key: string]: any;
}

export interface LoginDTO {
  email: string;
  password: string;
  firstName?: string;
  [key: string]: any;
}

export interface OTPData {
  email: string;
  otp: string;
}

export interface ResetPasswordDTO {
  email: string;
  otp: string;
  password: string;
}
