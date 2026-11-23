-- AlterTable
ALTER TABLE "EventRsvp" ADD COLUMN     "reconnectNudgedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EventReconnectInterest" (
    "eventId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "EventReconnectInterest_pkey" PRIMARY KEY ("eventId","fromId","toId")
);

-- CreateIndex
CREATE INDEX "EventReconnectInterest_eventId_toId_idx" ON "EventReconnectInterest"("eventId", "toId");

-- CreateIndex
CREATE INDEX "EventReconnectInterest_expiresAt_idx" ON "EventReconnectInterest"("expiresAt");

-- AddForeignKey
ALTER TABLE "EventReconnectInterest" ADD CONSTRAINT "EventReconnectInterest_eventId_fromId_fkey" FOREIGN KEY ("eventId", "fromId") REFERENCES "EventRsvp"("eventId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventReconnectInterest" ADD CONSTRAINT "EventReconnectInterest_eventId_toId_fkey" FOREIGN KEY ("eventId", "toId") REFERENCES "EventRsvp"("eventId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
