-- AlterTable
ALTER TABLE "LeetcodeSync" ADD COLUMN     "autoSync" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cookieInvalidAt" TIMESTAMP(3),
ADD COLUMN     "csrfToken" TEXT,
ADD COLUMN     "fullSyncAt" TIMESTAMP(3),
ADD COLUMN     "fullSyncSolved" INTEGER,
ADD COLUMN     "lastMarked" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sessionCookie" TEXT;

-- AlterTable
ALTER TABLE "Problem" ADD COLUMN     "taxonomySource" TEXT NOT NULL DEFAULT 'derived';

-- CreateIndex
CREATE INDEX "Problem_taxonomySource_idx" ON "Problem"("taxonomySource");
