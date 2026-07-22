export default () => ({
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  providers: {
    primary: process.env.PRIMARY_PROVIDER || 'smtp',
    fallback: process.env.FALLBACK_PROVIDER || '',
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY || '',
      ratePerMin: parseInt(process.env.SENDGRID_RATE_PER_MIN || '600', 10),
    },
    ses: {
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      ratePerSec: parseInt(process.env.SES_RATE_PER_SEC || '14', 10),
    },
    smtp: {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '1025', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  },
  defaultFrom: process.env.DEFAULT_FROM || 'no-reply@example.com',
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
});
