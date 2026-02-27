import { PrismaClient, type BookLevel } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const SOURCE_ROOT = "D:\\桌面\\tango-anki\\Japanese-Chinese-thesaurus\\source";
const LEVELS = ["n1", "n2", "n3", "n5n4"] as const;

type LevelName = (typeof LEVELS)[number];

type SourceItem = {
  wordId: number;
  wordName: string;
  correctDesc: string;
  wordDesc: string;
  wordThemeName: string;
  exampleSentence?: string | null;
  exampleTranslate?: string | null;
};

type SourcePayload = {
  data?: SourceItem[];
};

type LevelSummary = {
  filesImported: number;
  inserted: number;
  updated: number;
};

const CJK_REGEX = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff々〆ヵヶ]/u;
const KANA_REGEX = /^[ぁ-んァ-ヶー]+$/u;

function normalizeForCompare(input: string): string {
  return input.trim().normalize("NFKC").replace(/[\s\u3000]+/g, "");
}

function extractKanaReading(wordDesc: string): string | null {
  const match = wordDesc.match(/（([^（）]+)）/u);
  const raw = (match?.[1] ?? "").trim();
  if (!raw) return null;

  const normalized = normalizeForCompare(raw);
  if (!normalized) return null;
  if (!KANA_REGEX.test(normalized)) return null;
  return normalized;
}

function isKanaOnly(wordName: string): boolean {
  return !CJK_REGEX.test(wordName);
}

function normalizeItems(raw: unknown, filePath: string): SourceItem[] {
  if (Array.isArray(raw)) {
    return raw as SourceItem[];
  }

  if (raw && typeof raw === "object" && "data" in raw) {
    const payload = raw as SourcePayload;
    if (Array.isArray(payload.data)) {
      return payload.data;
    }
  }

  throw new Error(`Unexpected JSON shape in ${filePath}`);
}

async function importFile(
  prisma: PrismaClient,
  level: LevelName,
  filePath: string,
  fileName: string,
): Promise<{ inserted: number; updated: number }> {
  const rawText = await readFile(filePath, "utf8");
  const parsed = JSON.parse(rawText) as unknown;
  const items = normalizeItems(parsed, filePath);
  const validItems = items.filter((item) => Number.isInteger(item.wordId));

  const existing = await prisma.word.findMany({
    where: { wordId: { in: validItems.map((item) => item.wordId) } },
    select: { wordId: true },
  });
  const existingIds = new Set(existing.map((row) => row.wordId));

  let inserted = 0;
  let updated = 0;
  let themeName = "";

  for (const item of validItems) {
    const currentTheme = (item.wordThemeName ?? "").trim();
    if (!themeName && currentTheme) {
      themeName = currentTheme;
    }

    const kanaReading = extractKanaReading(item.wordDesc ?? "");
    const cDesc = item.correctDesc ?? "";
    const wDesc = item.wordDesc ?? "";
    const wName = item.wordName ?? "";

    await prisma.word.upsert({
      where: { wordId: item.wordId },
      update: {
        bookLevel: level as BookLevel,
        themeName: currentTheme,
        wordName: wName,
        correctDesc: cDesc,
        wordDesc: wDesc,
        kanaReading,
        isKanaOnly: isKanaOnly(wName),
        exampleJa: item.exampleSentence ?? null,
        exampleZh: item.exampleTranslate ?? null,
      },
      create: {
        wordId: item.wordId,
        bookLevel: level as BookLevel,
        themeName: currentTheme,
        wordName: wName,
        correctDesc: cDesc,
        wordDesc: wDesc,
        kanaReading,
        isKanaOnly: isKanaOnly(wName),
        exampleJa: item.exampleSentence ?? null,
        exampleZh: item.exampleTranslate ?? null,
      },
    });

    if (existingIds.has(item.wordId)) {
      updated += 1;
    } else {
      inserted += 1;
    }
  }

  await prisma.book.upsert({
    where: {
      level_fileName: {
        level: level as BookLevel,
        fileName,
      },
    },
    update: {
      themeName,
      totalWords: validItems.length,
    },
    create: {
      level: level as BookLevel,
      fileName,
      themeName,
      totalWords: validItems.length,
    },
  });

  return { inserted, updated };
}

async function run(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const adapter = new PrismaLibSql({ url: databaseUrl });
  const prisma = new PrismaClient({ adapter });
  const summaries = new Map<LevelName, LevelSummary>();

  for (const level of LEVELS) {
    summaries.set(level, { filesImported: 0, inserted: 0, updated: 0 });
  }

  try {
    for (const level of LEVELS) {
      const levelDir = path.join(SOURCE_ROOT, level);
      const fileNames = (await readdir(levelDir))
        .filter((name) => name.toLowerCase().endsWith(".json"))
        .sort((a, b) => {
          const aNum = Number.parseInt(path.basename(a, ".json"), 10);
          const bNum = Number.parseInt(path.basename(b, ".json"), 10);
          if (Number.isNaN(aNum) || Number.isNaN(bNum)) {
            return a.localeCompare(b, "en");
          }
          return aNum - bNum;
        });

      for (const fileName of fileNames) {
        const filePath = path.join(levelDir, fileName);
        const result = await importFile(prisma, level, filePath, fileName);
        const current = summaries.get(level);
        if (!current) {
          continue;
        }

        current.filesImported += 1;
        current.inserted += result.inserted;
        current.updated += result.updated;
      }
    }

    for (const level of LEVELS) {
      const summary = summaries.get(level);
      if (!summary) {
        continue;
      }

      console.log(
        `[${level}] files imported: ${summary.filesImported}, words inserted: ${summary.inserted}, words updated: ${summary.updated}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
