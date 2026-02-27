-- CreateTable
CREATE TABLE "Book" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "level" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "themeName" TEXT NOT NULL,
    "totalWords" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Word" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wordId" INTEGER NOT NULL,
    "bookLevel" TEXT NOT NULL,
    "themeName" TEXT NOT NULL,
    "wordName" TEXT NOT NULL,
    "correctDesc" TEXT NOT NULL,
    "wordDesc" TEXT NOT NULL,
    "kanaReading" TEXT,
    "isKanaOnly" BOOLEAN NOT NULL,
    "exampleJa" TEXT,
    "exampleZh" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Progress" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wordId" INTEGER NOT NULL,
    "stage" INTEGER NOT NULL DEFAULT 0,
    "nextReviewAt" DATETIME,
    "lastReviewedAt" DATETIME,
    "wrongTestCount" INTEGER NOT NULL DEFAULT 0,
    "mastered" BOOLEAN NOT NULL DEFAULT false,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Progress_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word" ("wordId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Book_level_fileName_key" ON "Book"("level", "fileName");

-- CreateIndex
CREATE UNIQUE INDEX "Word_wordId_key" ON "Word"("wordId");

-- CreateIndex
CREATE UNIQUE INDEX "Progress_wordId_key" ON "Progress"("wordId");
