const axios = require('axios');

const BASE_URL = 'http://localhost:8080/api/v1';

async function testAuthEndpoints() {
    console.log('🧪 Testing Authentication Endpoints\n');

    const testEmail = `test${Date.now()}@kampos.com`;
    const testPassword = 'Test123!@#';

    try {
        // 1. Test Register/Send OTP
        console.log('1️⃣ Testing Register (Send OTP)...');
        const registerRes = await axios.post(`${BASE_URL}/auth/register/send-otp`, {
            email: testEmail
        });
        console.log('✅ Register OTP sent:', registerRes.data);

        // 2. Test Login (Send OTP)
        console.log('\n2️⃣ Testing Login (Send OTP)...');
        const loginOtpRes = await axios.post(`${BASE_URL}/auth/login/send-otp`, {
            email: testEmail
        });
        console.log('✅ Login OTP sent:', loginOtpRes.data);

        // 3. Test Forgot Password
        console.log('\n3️⃣ Testing Forgot Password...');
        const forgotRes = await axios.post(`${BASE_URL}/auth/forgot-password`, {
            email: testEmail
        });
        console.log('✅ Forgot Password OTP sent:', forgotRes.data);

        console.log('\n✅ All authentication endpoints are working!');
        console.log('\nℹ️  Note: OTP verification requires actual OTP codes from email/console.');
        console.log(`   Test email: ${testEmail}`);

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
        process.exit(1);
    }
}

testAuthEndpoints();
