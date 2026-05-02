const nodemailer = require("nodemailer");

const sendOtpEmail = async (email, otp) => {
  try {
    // Email credentials නැත්නම් OTP එක console එකේ print වෙනවා
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log(`OTP for ${email}: ${otp}`);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Shopping Cart App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify your email",
      html: `
        <h2>Email Verification</h2>
        <p>Your OTP code is:</p>
        <h1>${otp}</h1>
        <p>This OTP will expire in 10 minutes.</p>
      `,
    });

    console.log(`OTP email sent to ${email}`);
  } catch (error) {
    console.error("Email send error:", error.message);
    throw error;
  }
};

module.exports = {
  sendOtpEmail,
};