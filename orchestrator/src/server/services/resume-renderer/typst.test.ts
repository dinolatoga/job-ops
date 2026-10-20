import { spawnSync } from "node:child_process";
import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { TYPST_THEME_VALUES, type TypstTheme } from "@shared/types";
import { afterEach, describe, expect, it } from "vitest";
import { readPdfPageSizes, readPdfPageText } from "./test-utils";
import type { ResumeRenderDocument } from "./types";
import {
  buildTypstDocument,
  convertDocFieldsToTypst,
  getTypstBinary,
  getTypstTemplatePath,
  readTypstTemplate,
  readTypstTheme,
  readTypstThemeManifest,
  renderTypstPdf,
  resolveTypstThemeFontPaths,
  type TypstThemeTokens,
} from "./typst";

const nativeThemes = new Set(["classic", "compact", "modern-inter"]);

const baseDocument: ResumeRenderDocument = {
  name: "Jane Doe",
  headline: "Senior Software Engineer",
  location: "London, UK",
  picture: null,
  contactItems: [
    { text: "jane@example.com", url: "mailto:jane@example.com" },
    { text: "Portfolio", url: "https://jane.dev" },
  ],
  profileItems: [],
  customFieldItems: [],
  summary: "Builds resilient platform systems.",
  experience: [
    {
      title: "Acme",
      subtitle: "Platform Engineer | Remote",
      date: "2023 -- Present",
      bullets: ["Improved API reliability", "Reduced operator toil"],
      url: "https://acme.example.com",
      linkLabel: "Acme",
    },
  ],
  education: [],
  projects: [],
  skillGroups: [
    {
      name: "Backend",
      keywords: ["TypeScript", "Node.js", "PostgreSQL"],
    },
  ],
  languages: [],
  interests: [],
  awards: [],
  certifications: [],
  publications: [],
  volunteer: [],
  references: [],
};

async function createTempDir(): Promise<string> {
  return await mkdtemp(join(tmpdir(), "job-ops-typst-render-test-"));
}

function typstAvailable(): boolean {
  const binary = process.env.TYPST_BIN?.trim() || "typst";
  const result = spawnSync(binary, ["--version"], { stdio: "ignore" });
  return result.status === 0;
}

async function readNativeThemeTokens(
  theme: TypstTheme,
): Promise<TypstThemeTokens> {
  const loadedTheme = await readTypstTheme(theme);
  if (!loadedTheme.tokens) {
    throw new Error(`Expected ${theme} to be a native Typst theme`);
  }
  return loadedTheme.tokens;
}

describe("typst resume renderer", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map(async (dir) => {
        await rm(dir, { recursive: true, force: true });
      }),
    );
  });

  it("exposes the bundled Typst template", async () => {
    expect(getTypstTemplatePath().replace(/\\/g, "/")).toContain(
      "typst-themes/classic/main.typ",
    );
    const template = await readTypstTemplate();
    expect(template).toContain("#set page");
    expect(template).toContain("__BODY__");
  });

  it("loads every generated Typst theme manifest", async () => {
    for (const theme of TYPST_THEME_VALUES) {
      const manifest = await readTypstThemeManifest(theme);
      expect(manifest.id).toBe(theme);
      expect(manifest.entrypoint).toBe("main.typ");
      expect(["native", "adapted"]).toContain(manifest.kind);
      if (nativeThemes.has(theme)) {
        expect(manifest.tokens).toBeDefined();
      } else {
        expect(manifest.tokens).toBeUndefined();
      }
      expect(getTypstTemplatePath(theme).replace(/\\/g, "/")).toContain(
        `typst-themes/${theme}/main.typ`,
      );
    }
  });

  it("uses the TYPST_BIN override when present", () => {
    const previous = process.env.TYPST_BIN;
    process.env.TYPST_BIN = "/tmp/custom-typst";
    expect(getTypstBinary()).toBe("/tmp/custom-typst");
    if (previous === undefined) {
      delete process.env.TYPST_BIN;
    } else {
      process.env.TYPST_BIN = previous;
    }
  });

  it("renders the classic theme tokens and English section titles", async () => {
    const tokens = await readNativeThemeTokens("classic");
    const typst = buildTypstDocument(
      {
        ...baseDocument,
        sectionTitles: undefined,
      },
      "__PAGE_MARGIN__\n__BODY_SIZE__\n__NAME__\n__BODY__",
      tokens,
    );

    expect(typst).toContain("(x: 0.65in, y: 0.58in)");
    expect(typst).toContain("10pt");
    expect(typst).toContain("Jane Doe");
    expect(typst).toContain("= Summary");
    expect(typst).toContain("= Experience");
    expect(typst).toContain("= Technical Skills");
  });

  it("renders compact theme tokens and localized section titles", async () => {
    const tokens = await readNativeThemeTokens("compact");
    const typst = buildTypstDocument(
      {
        ...baseDocument,
        education: [
          {
            title: "University",
            subtitle: "MSc",
            date: "2020",
            bullets: ["Studied distributed systems"],
          },
        ],
        projects: [
          {
            title: "Platform",
            subtitle: "TypeScript",
            date: "2024",
            bullets: ["Built deployment tooling"],
          },
        ],
        sectionTitles: {
          profiles: "Perfiles",
          summary: "Resumen",
          customFields: "Campos personalizados",
          experience: "Experiencia",
          education: "Educación",
          projects: "Proyectos",
          skills: "Habilidades técnicas",
          languages: "Idiomas",
          interests: "Intereses",
          awards: "Premios",
          certifications: "Certificaciones",
          publications: "Publicaciones",
          volunteer: "Voluntariado",
          references: "Referencias",
        },
      },
      "__PAGE_MARGIN__\n__BODY_SIZE__\n__NAME__\n__BODY__",
      tokens,
    );

    expect(typst).toContain("(x: 0.48in, y: 0.45in)");
    expect(typst).toContain("9pt");
    expect(typst).toContain("= Resumen");
    expect(typst).toContain("= Experiencia");
    expect(typst).toContain("= Habilidades técnicas");
  });

  it("respects custom core section ordering", async () => {
    const tokens = await readNativeThemeTokens("classic");
    const typst = buildTypstDocument(
      {
        ...baseDocument,
        education: [
          {
            title: "University",
            subtitle: "MSc",
            date: "2020",
            bullets: ["Studied distributed systems"],
          },
        ],
        projects: [
          {
            title: "Platform",
            subtitle: "TypeScript",
            date: "2024",
            bullets: ["Built deployment tooling"],
          },
        ],
        sectionOrder: ["skills", "projects", "experience", "education"],
      },
      "__BODY__",
      tokens,
    );

    expect(typst.indexOf("= Technical Skills")).toBeLessThan(
      typst.indexOf("= Projects"),
    );
    expect(typst.indexOf("= Projects")).toBeLessThan(
      typst.indexOf("= Experience"),
    );
  });

  it("exposes a stable resume data path for package-backed themes", async () => {
    const tokens = await readNativeThemeTokens("classic");
    const typst = buildTypstDocument(
      baseDocument,
      "#let resume = json(__RESUME_DATA_PATH__)\n__NAME__",
      tokens,
    );

    expect(typst).toContain('#let resume = json("resume-data.json")');
  });

  it("leaves the paper size to the render call in every theme template", async () => {
    for (const theme of TYPST_THEME_VALUES) {
      const template = await readTypstTemplate(theme);

      expect(template, theme).toContain("paper: __PAGE_PAPER__");
      expect(template, theme).not.toMatch(/paper:\s*"/);
    }
  });

  it("renders the requested paper size using Typst's paper names", async () => {
    const tokens = await readNativeThemeTokens("classic");
    const template = "#set page(paper: __PAGE_PAPER__)";

    expect(buildTypstDocument(baseDocument, template, tokens, "letter")).toBe(
      '#set page(paper: "us-letter")',
    );
    expect(buildTypstDocument(baseDocument, template, tokens, "a4")).toBe(
      '#set page(paper: "a4")',
    );
  });

  it("keeps rendering A4 when the paper size is left to the renderer", async () => {
    const tokens = await readNativeThemeTokens("classic");
    const template = "#set page(paper: __PAGE_PAPER__)";

    expect(buildTypstDocument(baseDocument, template, tokens, "auto")).toBe(
      '#set page(paper: "a4")',
    );
    expect(buildTypstDocument(baseDocument, template, tokens)).toBe(
      '#set page(paper: "a4")',
    );
  });

  it("keeps links in the clean-print-cv adapter", async () => {
    const template = await readTypstTemplate("clean-print-cv");

    expect(template).toContain("link-or-text");
    expect(template).toContain("profile-label-matching(is-linkedin-profile)");
    expect(template).toContain("profile-label-matching(is-github-profile)");
    expect(template).toContain("linked-entry-label(entry");
    expect(template).toContain('link(text-of-item(entry, "url"))');
  });

  it("renders award-style sections as Typst bullet lists in clean-print-cv", async () => {
    const template = await readTypstTemplate("clean-print-cv");

    expect(template).toContain("#let bullet-trailing(entry)");
    expect(template).toContain('text-of(section-titles.at("awards"');
    expect(template).toContain("trailing: bullet-trailing(entry)");
  });

  it("renders the newly supported native sections and picture block", async () => {
    const tokens = await readNativeThemeTokens("classic");
    const typst = buildTypstDocument(
      {
        ...baseDocument,
        picture: {
          url: "https://jane.dev/photo.png",
          assetId: null,
          renderPath: "/tmp/resume-picture.png",
          hidden: false,
          size: 88,
          rotation: 0,
          aspectRatio: 1,
          borderRadius: 0,
          borderColor: "",
          borderWidth: 0,
          shadowColor: "",
          shadowWidth: 0,
        },
        profileItems: [
          {
            network: "LinkedIn",
            username: "janedoe",
            url: "https://linkedin.com/in/janedoe",
          },
        ],
        customFieldItems: [
          {
            title: "Availability",
            text: "Open to relocation",
            url: null,
          },
        ],
        languages: [{ language: "English", fluency: "Native", level: 5 }],
        interests: [{ name: "Climbing", keywords: ["Bouldering"] }],
        awards: [
          {
            title: "Engineer of the Year",
            subtitle: "Acme",
            date: "2024",
            bullets: ["Recognized for platform leadership"],
          },
        ],
        certifications: [
          {
            title: "AWS Solutions Architect",
            subtitle: "Amazon",
            date: "2023",
            bullets: ["Professional level"],
          },
        ],
        publications: [
          {
            title: "Scaling JobOps",
            subtitle: "InfoQ",
            date: "2022",
            bullets: ["Published architecture write-up"],
          },
        ],
        volunteer: [
          {
            title: "STEM Mentor",
            subtitle: "Code Club",
            date: "2021 -- Present",
            bullets: ["Mentor students weekly"],
          },
        ],
        references: [
          {
            title: "Alex Manager",
            subtitle: "Director | +44 1234 567890",
            bullets: ["Reference available on request"],
          },
        ],
      },
      "__PICTURE_BLOCK__\n__NAME__\n__HEADLINE_BLOCK__\n__LOCATION_BLOCK__\n__CONTACT_BLOCK__\n__BODY__",
      tokens,
    );

    expect(typst).toContain('#image("/tmp/resume-picture.png"');
    expect(typst).toContain("London, UK");
    expect(typst).toContain("= Profiles");
    expect(typst).toContain("= Custom Fields");
    expect(typst).toContain("*Availability:* Open to relocation");
    expect(typst).toContain("= Languages");
    expect(typst).toContain("= Interests");
    expect(typst).toContain("= Awards");
    expect(typst).toContain("= Certifications");
    expect(typst).toContain("= Publications");
    expect(typst).toContain("= Volunteer");
    expect(typst).toContain("= References");
  });

  it("escapes Typst markup characters in resume content", async () => {
    const tokens = await readNativeThemeTokens("classic");
    const typst = buildTypstDocument(
      {
        ...baseDocument,
        name: "Jane #1 [Platform]",
        summary: "Uses #hashes, *stars*, and [brackets].",
      },
      "__NAME__\n__BODY__",
      tokens,
    );

    expect(typst).toContain("Jane \\#1 \\[Platform\\]");
    expect(typst).toContain("\\#hashes, \\*stars\\*, and \\[brackets\\]");
  });

  it("compiles HTML formatting tags into Typst macros and escapes special characters", async () => {
    const tokens = await readNativeThemeTokens("classic");
    const typst = buildTypstDocument(
      {
        ...baseDocument,
        summary:
          "<strong>Bold summary</strong> & <em>Italic summary</em> with # and * sign.",
        experience: [
          {
            title: "Acme",
            subtitle: "<b>Senior</b> Platform Engineer",
            date: "2023",
            bullets: [
              "Managed <i>critical</i> systems.",
              "Handled $50k budgets.",
            ],
          },
        ],
      },
      "__BODY__",
      tokens,
    );

    expect(typst).toContain(
      "#strong[Bold summary] & #emph[Italic summary] with \\# and \\* sign.",
    );
    expect(typst).toContain("#strong[Senior] Platform Engineer");
    expect(typst).toContain("Managed #emph[critical] systems.");
    expect(typst).toContain("Handled \\$50k budgets.");
  });

  it("converts HTML formatting tags to Typst markup formatting in convertDocFieldsToTypst", () => {
    const converted = convertDocFieldsToTypst({
      ...baseDocument,
      summary: "<strong>Bold</strong> and <em>Italic</em> and normal.",
      experience: [
        {
          title: "Acme",
          subtitle: "Platform Engineer",
          date: "2023",
          bullets: [
            "Managed <i>critical</i> systems.",
            "Handled $50k budgets.",
          ],
        },
      ],
    });

    expect(converted.summary).toBe(
      "#strong[Bold] and #emph[Italic] and normal.",
    );
    expect(converted.experience[0]?.bullets).toEqual([
      "Managed #emph[critical] systems.",
      "Handled \\$50k budgets.",
    ]);
  });

  it("fails with a helpful error when typst is unavailable", async () => {
    const previous = process.env.TYPST_BIN;
    process.env.TYPST_BIN = "/definitely/missing/typst";
    const tempDir = await createTempDir();
    tempDirs.push(tempDir);
    const outputPath = join(tempDir, "resume.pdf");

    await expect(
      renderTypstPdf({
        document: baseDocument,
        outputPath,
        jobId: "job-missing-typst",
      }),
    ).rejects.toThrow(/Typst binary not found/i);

    if (previous === undefined) {
      delete process.env.TYPST_BIN;
    } else {
      process.env.TYPST_BIN = previous;
    }
  });

  it.skipIf(!typstAvailable())(
    "renders a PDF when typst is installed",
    async () => {
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);
      const outputPath = join(tempDir, "resume.pdf");

      await renderTypstPdf({
        document: baseDocument,
        outputPath,
        jobId: "job-render-success",
        typstTheme: "compact",
      });

      const stats = spawnSync("sh", ["-lc", `test -s "${outputPath}"`], {
        stdio: "ignore",
      });
      expect(stats.status).toBe(0);
    },
  );

  it.skipIf(!typstAvailable())(
    "renders the clean-print-cv theme when typst is installed",
    async () => {
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);
      const outputPath = join(tempDir, "clean-print-cv.pdf");

      await renderTypstPdf({
        document: {
          ...baseDocument,
          profileItems: [
            {
              network: "LinkedIn",
              username: "janedoe",
              url: "https://linkedin.com/in/janedoe",
            },
          ],
          languages: [{ language: "English", fluency: "Native", level: 5 }],
          certifications: [
            {
              title: "AWS Solutions Architect",
              subtitle: "Amazon",
              date: "2023",
              bullets: ["Professional level"],
            },
          ],
        },
        outputPath,
        jobId: "job-render-clean-print-cv",
        typstTheme: "clean-print-cv",
      });

      const stats = spawnSync("sh", ["-lc", `test -s "${outputPath}"`], {
        stdio: "ignore",
      });
      expect(stats.status).toBe(0);
    },
  );

  it.skipIf(!typstAvailable())(
    "renders US Letter pages in every theme when requested",
    async () => {
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      for (const typstTheme of TYPST_THEME_VALUES) {
        const outputPath = join(tempDir, `${typstTheme}-letter.pdf`);
        await renderTypstPdf({
          document: baseDocument,
          outputPath,
          jobId: `job-render-letter-${typstTheme}`,
          typstTheme,
          paperSize: "letter",
        });

        expect(await readPdfPageSizes(outputPath), typstTheme).toEqual([
          { width: 612, height: 792 },
        ]);
      }
    },
  );

  it.skipIf(!typstAvailable())(
    "renders A4 pages in every theme by default",
    async () => {
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);

      for (const typstTheme of TYPST_THEME_VALUES) {
        const outputPath = join(tempDir, `${typstTheme}-default.pdf`);
        await renderTypstPdf({
          document: baseDocument,
          outputPath,
          jobId: `job-render-default-${typstTheme}`,
          typstTheme,
        });

        expect(await readPdfPageSizes(outputPath), typstTheme).toEqual([
          { width: 595, height: 842 },
        ]);
      }
    },
  );

  describe("theme font paths", () => {
    async function createThemeDir(): Promise<string> {
      const root = await createTempDir();
      tempDirs.push(root);
      const themeDir = join(root, "theme");
      await mkdir(join(themeDir, "fonts"), { recursive: true });
      await mkdir(join(root, "outside"), { recursive: true });
      await writeFile(join(themeDir, "main.typ"), "", "utf8");
      return themeDir;
    }

    it("bundles Inter and its OFL license with the modern-inter theme", async () => {
      const manifest = await readTypstThemeManifest("modern-inter");
      expect(manifest.kind).toBe("native");
      expect(manifest.fontPaths).toEqual(["fonts"]);

      const { fontPaths } = await readTypstTheme("modern-inter");
      expect(fontPaths).toHaveLength(1);
      expect(fontPaths[0]?.replace(/\\/g, "/")).toMatch(
        /typst-themes\/modern-inter\/fonts$/,
      );
      const files = await readdir(fontPaths[0] as string);
      expect(files).toEqual(
        expect.arrayContaining([
          "Inter-Regular.ttf",
          "Inter-Italic.ttf",
          "Inter-Medium.ttf",
          "Inter-SemiBold.ttf",
          "Inter-Bold.ttf",
          "Inter-BoldItalic.ttf",
          "OFL.txt",
        ]),
      );
      const license = await readFile(join(fontPaths[0] as string, "OFL.txt"));
      expect(license.toString("utf8")).toContain(
        "SIL Open Font License, Version 1.1",
      );
    });

    it("keeps themes without fontPaths free of extra font directories", async () => {
      for (const theme of ["classic", "compact", "clean-print-cv"] as const) {
        const manifest = await readTypstThemeManifest(theme);
        expect(manifest.fontPaths, theme).toBeUndefined();
        expect((await readTypstTheme(theme)).fontPaths, theme).toEqual([]);
      }
    });

    it("resolves font directories inside the theme directory", async () => {
      const themeDir = await createThemeDir();
      const [resolved] = await resolveTypstThemeFontPaths(themeDir, ["fonts"]);
      expect(basename(resolved as string)).toBe("fonts");
    });

    it.each([
      "../outside",
      "fonts/../../outside",
      "/etc",
      "C:\\Windows\\Fonts",
      "",
    ])("rejects font path %j that escapes the theme directory", async (fontPath) => {
      const themeDir = await createThemeDir();
      await expect(
        resolveTypstThemeFontPaths(themeDir, [fontPath]),
      ).rejects.toThrow(/fontPaths/);
    });

    it("rejects symlinked font directories that point outside the theme", async () => {
      const themeDir = await createThemeDir();
      await symlink(join(themeDir, "..", "outside"), join(themeDir, "linked"));
      await expect(
        resolveTypstThemeFontPaths(themeDir, ["linked"]),
      ).rejects.toThrow(/must stay inside its theme directory/);
    });

    it("rejects missing font directories and plain files", async () => {
      const themeDir = await createThemeDir();
      await expect(
        resolveTypstThemeFontPaths(themeDir, ["missing"]),
      ).rejects.toThrow(/does not exist/);
      await expect(
        resolveTypstThemeFontPaths(themeDir, ["main.typ"]),
      ).rejects.toThrow(/must be a directory/);
    });

    it("passes theme font directories to the Typst CLI", async () => {
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);
      const argsPath = join(tempDir, "typst-args.txt");
      const fakeTypst = join(tempDir, "fake-typst.sh");
      await writeFile(
        fakeTypst,
        [
          "#!/bin/sh",
          `printf '%s\\n' "$@" > "${argsPath}"`,
          "for last; do :; done",
          'printf "%%PDF-1.7\\n" > "$last"',
        ].join("\n"),
        "utf8",
      );
      await chmod(fakeTypst, 0o755);

      const previous = process.env.TYPST_BIN;
      process.env.TYPST_BIN = fakeTypst;
      try {
        for (const typstTheme of ["modern-inter", "classic"] as const) {
          await renderTypstPdf({
            document: baseDocument,
            outputPath: join(tempDir, `${typstTheme}.pdf`),
            jobId: `job-font-args-${typstTheme}`,
            typstTheme,
          });
          const args = (await readFile(argsPath, "utf8")).trim().split("\n");
          const { fontPaths } = await readTypstTheme(typstTheme);

          expect(args[0], typstTheme).toBe("compile");
          expect(args.slice(1, -2), typstTheme).toEqual(
            fontPaths.flatMap((fontPath) => ["--font-path", fontPath]),
          );
          expect(args.at(-2), typstTheme).toMatch(/resume\.typ$/);
          expect(args.at(-1), typstTheme).toMatch(/resume\.pdf$/);
        }
      } finally {
        if (previous === undefined) {
          delete process.env.TYPST_BIN;
        } else {
          process.env.TYPST_BIN = previous;
        }
      }
    });
  });

  it("fills every placeholder in native theme templates", async () => {
    for (const theme of TYPST_THEME_VALUES) {
      if (!nativeThemes.has(theme)) continue;
      const { template, tokens } = await readTypstTheme(theme);
      const typst = buildTypstDocument(
        baseDocument,
        template,
        tokens as TypstThemeTokens,
      );
      expect(typst, theme).not.toMatch(/__[A-Z_]+__/);
    }
  });

  it("styles the modern-inter header from resume data with theme tokens", async () => {
    const { template, tokens } = await readTypstTheme("modern-inter");
    const typst = buildTypstDocument(
      baseDocument,
      template,
      tokens as TypstThemeTokens,
    );

    expect(typst).toContain('#let data = json("resume-data.json")');
    expect(typst).toContain('font: "Inter"');
    expect(typst).toContain(`size: ${tokens?.headlineSize}`);
    expect(typst).toContain(`size: ${tokens?.contactSize}`);
    expect(typst).toContain("Jane Doe");
    expect(typst).not.toContain("#image(");
    expect(typst).not.toContain("fonts.googleapis.com");
  });

  it("keeps modern-inter leading and section rhythm comfortable for readers", async () => {
    const { template, tokens } = await readTypstTheme("modern-inter");
    const em = (value: string | undefined) =>
      Number.parseFloat(value?.replace(/em$/, "") ?? "NaN");
    const leading = em(tokens?.parLeading);
    const itemGap = em(
      template.match(/#set list\([\s\S]*?\n\s+spacing: ([\d.]+em),/)?.[1],
    );

    expect(tokens?.bodySize).toBe("10.5pt");
    expect(leading).toBeGreaterThanOrEqual(0.7);
    expect(leading).toBeLessThanOrEqual(0.8);
    // Bullet items must sit at least as far apart as wrapped lines.
    expect(itemGap).toBeGreaterThanOrEqual(leading);

    // Section boundaries need clearly more space above a heading than the
    // heading-to-entry gap below it (Typst uses the larger adjacent spacing).
    const pt = (value: string | undefined) =>
      Number.parseFloat(value?.replace(/pt$/, "") ?? "NaN");
    const entryGap = pt(template.match(/#let entry-gap = ([\d.]+pt)/)?.[1]);
    const sectionTop = pt(tokens?.sectionTop);
    const sectionBottom = pt(tokens?.sectionBottom);
    expect(sectionBottom).toBeLessThan(sectionTop);
    expect(sectionTop).toBeGreaterThanOrEqual(
      1.5 * Math.max(entryGap, sectionBottom),
    );
  });

  it.skipIf(!typstAvailable())(
    "renders modern-inter with the bundled Inter fonts and selectable text",
    async () => {
      const tempDir = await createTempDir();
      tempDirs.push(tempDir);
      const outputPath = join(tempDir, "modern-inter.pdf");

      await renderTypstPdf({
        document: {
          ...baseDocument,
          projects: [
            {
              title: "Undated Project",
              bullets: ["Shipped with <em>care</em>."],
            },
          ],
        },
        outputPath,
        jobId: "job-render-modern-inter",
        typstTheme: "modern-inter",
      });

      const pdf = (await readFile(outputPath)).toString("latin1");
      expect(pdf).toMatch(/\/BaseFont \/[A-Z]{6}\+Inter-Regular/);
      expect(pdf).toMatch(/\/BaseFont \/[A-Z]{6}\+Inter-SemiBold/);
      expect(pdf).toMatch(/\/URI \(mailto:jane@example\.com\)/);

      const [text] = await readPdfPageText(outputPath);
      expect(text).toContain("Jane Doe");
      expect(text).toContain("Senior Software Engineer");
      expect(text).toContain("London, UK");
      expect(text).toContain("jane@example.com");
      expect(text).toContain("Platform Engineer | Remote");
      expect(text).toContain("2023 \u2013 Present");
      expect(text).toContain("Undated Project");
      expect(text).not.toContain("[]");
    },
  );
});
