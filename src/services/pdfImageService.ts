import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const execAsync = promisify(exec);

export interface ExtractedPageImage {
  pageNumber: number;
  imagePath: string;
  imageUrl: string;
  width?: number;
  height?: number;
}

export interface ExtractedDiagramImage {
  pageNumber: number;
  imageIndex: number;
  imagePath: string;
  imageUrl: string;
  width: number;
  height: number;
  type: string;
}

export interface PageDiagramInfo {
  pageNumber: number;
  diagrams: ExtractedDiagramImage[];
}

export class PDFImageService {
  private static readonly PAGE_IMAGES_DIR = path.join(process.cwd(), 'uploads', 'page-images');
  private static readonly QUESTION_IMAGES_DIR = path.join(
    process.cwd(),
    'uploads',
    'question-images'
  );
  private static readonly DIAGRAM_IMAGES_DIR = path.join(
    process.cwd(),
    'uploads',
    'diagram-images'
  );

  // Minimum dimensions for a valid diagram (filter out icons/logos)
  private static readonly MIN_DIAGRAM_WIDTH = 100;
  private static readonly MIN_DIAGRAM_HEIGHT = 80;

  /**
   * Convert all PDF pages to images using pdftoppm (Poppler)
   * @param pdfPath Path to the PDF file
   * @param bookId Book ID for naming
   * @returns Array of extracted page images
   */
  static async convertPDFToImages(pdfPath: string, bookId: string): Promise<ExtractedPageImage[]> {
    console.log(`\n📸 Converting PDF to images: ${pdfPath}`);

    try {
      // Ensure output directory exists
      await fs.mkdir(this.PAGE_IMAGES_DIR, { recursive: true });

      // Create a unique prefix for this book's images
      const prefix = path.join(this.PAGE_IMAGES_DIR, `${bookId}-page`);

      // Use pdftoppm to convert PDF to PNG images
      // -png: Output PNG format
      // -r 150: Resolution 150 DPI (good balance between quality and file size)
      const command = `pdftoppm -png -r 150 "${pdfPath}" "${prefix}"`;

      console.log(`   🔄 Running: pdftoppm...`);
      await execAsync(command);

      // Find all generated images
      const files = await fs.readdir(this.PAGE_IMAGES_DIR);
      const pageImages: ExtractedPageImage[] = [];

      // Filter and sort page images for this book
      const bookImages = files
        .filter((f) => f.startsWith(`${bookId}-page-`) && f.endsWith('.png'))
        .sort((a, b) => {
          // Extract page numbers and sort numerically
          const numA = parseInt(a.match(/-(\d+)\.png$/)?.[1] || '0');
          const numB = parseInt(b.match(/-(\d+)\.png$/)?.[1] || '0');
          return numA - numB;
        });

      for (const filename of bookImages) {
        // Extract page number from filename (format: bookId-page-01.png)
        const pageMatch = filename.match(/-(\d+)\.png$/);
        if (pageMatch) {
          const pageNumber = parseInt(pageMatch[1]);
          const imagePath = path.join(this.PAGE_IMAGES_DIR, filename);

          pageImages.push({
            pageNumber,
            imagePath,
            imageUrl: `/uploads/page-images/${filename}`,
          });
        }
      }

      console.log(`   ✅ Converted ${pageImages.length} pages to images`);
      return pageImages;
    } catch (error: any) {
      console.error(`❌ PDF to image conversion failed:`, error.message);
      throw error;
    }
  }

  /**
   * Extract a specific region from a page image
   * Useful for extracting diagrams/figures from specific coordinates
   */
  static async extractRegion(
    sourceImagePath: string,
    bookId: string,
    questionNum: number,
    region: { x: number; y: number; width: number; height: number }
  ): Promise<string | null> {
    try {
      await fs.mkdir(this.QUESTION_IMAGES_DIR, { recursive: true });

      const hash = crypto.randomBytes(4).toString('hex');
      const outputFilename = `${bookId}-q${questionNum}-${hash}.png`;
      const outputPath = path.join(this.QUESTION_IMAGES_DIR, outputFilename);

      // Use ImageMagick's convert command to crop the region
      // If ImageMagick is not available, we'll just copy the full page
      try {
        const cropGeometry = `${region.width}x${region.height}+${region.x}+${region.y}`;
        await execAsync(`convert "${sourceImagePath}" -crop ${cropGeometry} "${outputPath}"`);
      } catch {
        // ImageMagick not available, skip region extraction
        return null;
      }

      return `/uploads/question-images/${outputFilename}`;
    } catch (error) {
      console.error(`Failed to extract region:`, error);
      return null;
    }
  }

  /**
   * Associate page images with questions based on page number mapping
   * For PYQ papers, questions are roughly distributed across pages
   */
  static mapImagesToQuestions(
    pageImages: ExtractedPageImage[],
    totalQuestions: number,
    startPage: number = 2, // Usually first page is instructions
    questionsPerPage: number = 4 // Approximate questions per page
  ): Map<number, string> {
    const questionImageMap = new Map<number, string>();

    // Skip instruction pages (usually page 1)
    const contentPages = pageImages.filter((p) => p.pageNumber >= startPage);

    // For each question, estimate which page it's on
    for (let qNum = 1; qNum <= totalQuestions; qNum++) {
      // Calculate estimated page index
      const pageIndex = Math.floor((qNum - 1) / questionsPerPage);

      if (pageIndex < contentPages.length) {
        questionImageMap.set(qNum, contentPages[pageIndex].imageUrl);
      }
    }

    return questionImageMap;
  }

  /**
   * Get the page image for a specific question number
   * Used for questions with diagrams/figures
   */
  static getPageImageForQuestion(
    pageImages: ExtractedPageImage[],
    questionNumber: number,
    totalQuestions: number,
    totalPages: number
  ): string | null {
    // Skip first page (instructions)
    const contentStartPage = 2;
    const contentPages = totalPages - 1; // Excluding instructions page

    // Estimate which page this question is on
    const questionsPerPage = totalQuestions / contentPages;
    const estimatedPageIndex = Math.floor((questionNumber - 1) / questionsPerPage);
    const targetPage = contentStartPage + estimatedPageIndex;

    const pageImage = pageImages.find((p) => p.pageNumber === targetPage);
    return pageImage?.imageUrl || null;
  }

  /**
   * Clean up temporary page images for a book
   */
  static async cleanupBookImages(bookId: string): Promise<void> {
    try {
      const files = await fs.readdir(this.PAGE_IMAGES_DIR);
      const bookFiles = files.filter((f) => f.startsWith(`${bookId}-`));

      for (const file of bookFiles) {
        await fs.unlink(path.join(this.PAGE_IMAGES_DIR, file));
      }

      console.log(`🧹 Cleaned up ${bookFiles.length} temporary images for book ${bookId}`);
    } catch (error) {
      console.error(`Failed to cleanup images:`, error);
    }
  }

  /**
   * Extract embedded diagram images from PDF using pdfimages
   * This extracts actual diagram images embedded in the PDF, not screenshots
   * @param pdfPath Path to the PDF file
   * @param bookId Book ID for naming
   * @returns Map of page number to array of diagram images on that page
   */
  static async extractEmbeddedDiagrams(
    pdfPath: string,
    bookId: string
  ): Promise<Map<number, ExtractedDiagramImage[]>> {
    console.log(`\n📊 Extracting embedded diagrams from PDF...`);
    const diagramsByPage = new Map<number, ExtractedDiagramImage[]>();
    const tempDir = path.join(this.DIAGRAM_IMAGES_DIR, `temp-${bookId}`);

    try {
      // Check if PDF file exists
      try {
        await fs.access(pdfPath);
      } catch {
        throw new Error(
          `PDF file not found at path: ${pdfPath}. The file may have been deleted or moved.`
        );
      }

      // Ensure output directory exists
      await fs.mkdir(this.DIAGRAM_IMAGES_DIR, { recursive: true });

      // Create a temp directory for this extraction
      await fs.mkdir(tempDir, { recursive: true });

      // First, get the list of images with their page numbers and dimensions
      const { stdout: imageList } = await execAsync(`pdfimages -list "${pdfPath}" 2>/dev/null`);

      // Parse the image list to understand what's in the PDF
      const imageInfo = this.parseImageList(imageList);
      console.log(`   📋 Found ${imageInfo.length} embedded images in PDF`);

      // Detect watermark patterns (same dimensions appearing on many pages)
      const watermarkSignatures = this.detectWatermarks(imageInfo);
      if (watermarkSignatures.size > 0) {
        console.log(`   🚫 Detected ${watermarkSignatures.size} watermark pattern(s) to filter`);
      }

      // Extract images using pdfimages (PNG format)
      const prefix = path.join(tempDir, 'img');
      await execAsync(`pdfimages -png "${pdfPath}" "${prefix}"`);

      // Read extracted images and organize by page
      const extractedFiles = await fs.readdir(tempDir);
      const pngFiles = extractedFiles
        .filter((f) => f.endsWith('.png'))
        .sort((a, b) => {
          const numA = parseInt(a.match(/img-(\d+)/)?.[1] || '0');
          const numB = parseInt(b.match(/img-(\d+)/)?.[1] || '0');
          return numA - numB;
        });

      // Match extracted files with image info
      let validDiagramCount = 0;
      let skippedWatermark = 0;
      let skippedSmall = 0;
      let processedWithWhiteBg = 0;

      for (let i = 0; i < pngFiles.length && i < imageInfo.length; i++) {
        const filename = pngFiles[i];
        const info = imageInfo[i];

        // Skip small images (logos, icons)
        if (info.width < this.MIN_DIAGRAM_WIDTH || info.height < this.MIN_DIAGRAM_HEIGHT) {
          skippedSmall++;
          continue;
        }

        // Skip watermarks (repeated patterns across pages)
        const signature = `${info.width}x${info.height}`;
        if (watermarkSignatures.has(signature)) {
          skippedWatermark++;
          continue;
        }

        // Generate unique filename and move to permanent location
        const hash = crypto.randomBytes(4).toString('hex');
        const newFilename = `${bookId}-p${info.page}-${hash}.png`;
        const sourcePath = path.join(tempDir, filename);
        const destPath = path.join(this.DIAGRAM_IMAGES_DIR, newFilename);

        try {
          // Check if image needs background processing (grayscale, smask, or has transparency)
          const needsWhiteBg = info.type === 'smask' || info.color === 'gray';

          if (needsWhiteBg) {
            // Use ImageMagick to add white background and invert if needed
            // This fixes black bg with gray content issue
            try {
              // Add white background, flatten transparency, and ensure good contrast
              await execAsync(
                `magick "${sourcePath}" -background white -alpha remove -alpha off "${destPath}"`
              );
              processedWithWhiteBg++;
            } catch {
              // Fallback: try with convert command (older ImageMagick)
              try {
                await execAsync(
                  `convert "${sourcePath}" -background white -alpha remove -alpha off "${destPath}"`
                );
                processedWithWhiteBg++;
              } catch {
                // If ImageMagick fails, just copy the file
                await fs.copyFile(sourcePath, destPath);
              }
            }
          } else {
            // Regular image - just copy
            await fs.copyFile(sourcePath, destPath);
          }

          const diagram: ExtractedDiagramImage = {
            pageNumber: info.page,
            imageIndex: validDiagramCount,
            imagePath: destPath,
            imageUrl: `/uploads/diagram-images/${newFilename}`,
            width: info.width,
            height: info.height,
            type: info.type,
          };

          if (!diagramsByPage.has(info.page)) {
            diagramsByPage.set(info.page, []);
          }
          diagramsByPage.get(info.page)!.push(diagram);
          validDiagramCount++;
        } catch {
          // Skip if file processing fails
        }
      }

      console.log(`   📊 Processing summary:`);
      console.log(`      - Processed ${processedWithWhiteBg} images with white background fix`);
      console.log(`      - Skipped ${skippedWatermark} watermarks`);
      console.log(`      - Skipped ${skippedSmall} small images`);
      console.log(
        `   ✅ Extracted ${validDiagramCount} valid diagram images across ${diagramsByPage.size} pages`
      );
      return diagramsByPage;
    } catch (error: any) {
      console.error(`❌ Failed to extract embedded diagrams:`, error.message);
      return diagramsByPage;
    } finally {
      // Clean up temp directory - ALWAYS runs even if there's an error
      try {
        const files = await fs.readdir(tempDir).catch(() => []);
        for (const file of files) {
          await fs.unlink(path.join(tempDir, file)).catch(() => {});
        }
        await fs.rmdir(tempDir).catch(() => {});
        console.log(`   🧹 Cleaned up temp directory: ${tempDir}`);
      } catch {
        console.warn(`   ⚠️  Failed to cleanup temp directory: ${tempDir}`);
      }
    }
  }

  /**
   * Parse the output of pdfimages -list command
   * Format: page num type width height color comp bpc enc interp object ID x-ppi y-ppi size ratio
   */
  private static parseImageList(
    listOutput: string
  ): { page: number; width: number; height: number; type: string; color: string }[] {
    const images: { page: number; width: number; height: number; type: string; color: string }[] =
      [];
    const lines = listOutput.split('\n');

    for (const line of lines) {
      // Skip header lines
      if (line.includes('page') || line.includes('---') || !line.trim()) continue;

      // Parse line: page num type width height color ...
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 6) {
        const page = parseInt(parts[0]);
        const type = parts[2];
        const width = parseInt(parts[3]);
        const height = parseInt(parts[4]);
        const color = parts[5]; // 'rgb', 'gray', 'cmyk', etc.

        if (!isNaN(page) && !isNaN(width) && !isNaN(height)) {
          images.push({ page, width, height, type, color });
        }
      }
    }

    return images;
  }

  /**
   * Detect watermark patterns - images with same dimensions appearing on many pages
   * Returns a Set of dimension signatures (e.g., "400x60") that are likely watermarks
   */
  private static detectWatermarks(
    imageInfo: { page: number; width: number; height: number; type: string; color: string }[]
  ): Set<string> {
    const watermarkSignatures = new Set<string>();

    // Count occurrences of each dimension signature
    const dimensionCounts = new Map<string, { count: number; pages: Set<number> }>();

    for (const img of imageInfo) {
      // Skip smask as they're already filtered
      if (img.type === 'smask') continue;

      const signature = `${img.width}x${img.height}`;

      if (!dimensionCounts.has(signature)) {
        dimensionCounts.set(signature, { count: 0, pages: new Set() });
      }

      const entry = dimensionCounts.get(signature)!;
      entry.count++;
      entry.pages.add(img.page);
    }

    // Images appearing on 5+ different pages with same dimensions are likely watermarks
    const WATERMARK_PAGE_THRESHOLD = 5;

    for (const [signature, data] of dimensionCounts) {
      if (data.pages.size >= WATERMARK_PAGE_THRESHOLD) {
        watermarkSignatures.add(signature);
      }
    }

    return watermarkSignatures;
  }

  /**
   * Map diagrams to questions based on page numbers
   * Estimates which questions are on which pages and assigns diagrams accordingly
   * @param diagramsByPage Map of page -> diagrams
   * @param totalQuestions Total number of questions in PDF
   * @param totalPages Total pages in PDF
   * @param startPage Page where questions start (default 2, skipping instructions)
   */
  static mapDiagramsToQuestions(
    diagramsByPage: Map<number, ExtractedDiagramImage[]>,
    totalQuestions: number,
    totalPages: number,
    startPage: number = 2
  ): Map<number, ExtractedDiagramImage> {
    const questionDiagramMap = new Map<number, ExtractedDiagramImage>();

    // Calculate questions per page
    const contentPages = totalPages - (startPage - 1);
    const questionsPerPage = Math.ceil(totalQuestions / contentPages);

    console.log(`   📐 Mapping diagrams: ${questionsPerPage} questions/page estimated`);

    // Track which diagram we've used per page
    const usedDiagramsPerPage = new Map<number, number>();

    // For each page with diagrams
    for (const [pageNum, diagrams] of diagramsByPage) {
      if (diagrams.length === 0) continue;

      // Calculate which questions are likely on this page
      const pageOffset = pageNum - startPage;
      if (pageOffset < 0) continue; // Skip instruction pages

      const firstQuestionOnPage = pageOffset * questionsPerPage + 1;
      const lastQuestionOnPage = Math.min((pageOffset + 1) * questionsPerPage, totalQuestions);

      // Assign diagrams to questions on this page
      let diagramIndex = usedDiagramsPerPage.get(pageNum) || 0;

      for (
        let qNum = firstQuestionOnPage;
        qNum <= lastQuestionOnPage && diagramIndex < diagrams.length;
        qNum++
      ) {
        // Only assign if we haven't used all diagrams on this page
        if (diagramIndex < diagrams.length) {
          questionDiagramMap.set(qNum, diagrams[diagramIndex]);
          diagramIndex++;
        }
      }

      usedDiagramsPerPage.set(pageNum, diagramIndex);
    }

    console.log(`   ✅ Mapped ${questionDiagramMap.size} diagrams to questions`);
    return questionDiagramMap;
  }

  /**
   * Clean up diagram images for a specific book
   */
  static async cleanupDiagramImages(bookId: string): Promise<void> {
    try {
      const files = await fs.readdir(this.DIAGRAM_IMAGES_DIR);
      const bookFiles = files.filter((f) => f.startsWith(`${bookId}-`));

      for (const file of bookFiles) {
        await fs.unlink(path.join(this.DIAGRAM_IMAGES_DIR, file));
      }

      if (bookFiles.length > 0) {
        console.log(`🧹 Cleaned up ${bookFiles.length} diagram images for book ${bookId}`);
      }
    } catch {
      // Directory might not exist
    }
  }

  /**
   * Get total number of pages in a PDF
   */
  static async getPageCount(pdfPath: string): Promise<number> {
    try {
      // Check if PDF file exists
      try {
        await fs.access(pdfPath);
      } catch {
        throw new Error(
          `PDF file not found at path: ${pdfPath}. The file may have been deleted or moved.`
        );
      }

      const { stdout } = await execAsync(`pdfinfo "${pdfPath}" | grep Pages | awk '{print $2}'`);
      return parseInt(stdout.trim()) || 0;
    } catch (error: any) {
      // Re-throw file not found errors
      if (error.message.includes('PDF file not found')) {
        throw error;
      }

      // Fallback: use pdf-parse if pdfinfo not available
      const pdfParse = require('pdf-parse');
      const dataBuffer = await fs.readFile(pdfPath);
      const data = await pdfParse(dataBuffer);
      return data.numpages;
    }
  }
}
