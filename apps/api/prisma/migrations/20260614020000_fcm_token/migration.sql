-- The user's latest Android (FCM) device token for native full-screen calls.
ALTER TABLE "users" ADD COLUMN "fcmToken" TEXT;
