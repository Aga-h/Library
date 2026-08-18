-- Idempotency key for expense logging.
--
-- The mobile logger queues expenses offline and retries them. Without a unique key a
-- retried POST inserts a second row — verified happening in practice when a page
-- navigation and the browser's `online` event both trigger a sync at once, and again
-- when a response is lost after the server has already committed.
--
-- Nullable because rows created before this have no key, and Postgres allows any number
-- of NULLs in a unique index.
--
-- Idempotent: safe to run more than once.

BEGIN;

ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "clientId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Expense_clientId_key" ON "Expense"("clientId");

COMMIT;
