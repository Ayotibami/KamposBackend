import otpGenerator from "otp-generator";

// Function to generate a 4-digit numeric OTP
const generateOTP = (): string => {
  const otp = otpGenerator.generate(4, {
    upperCaseAlphabets: false,
    lowerCaseAlphabets: false,
    specialChars: false,
  });

  return otp;
};

export default generateOTP;
