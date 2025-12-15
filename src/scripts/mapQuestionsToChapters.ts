import { chapterMappingService } from '../services/chapterMappingService';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  threshold: 0.85, // Minimum similarity score for auto-mapping (0-1)
  subjectCode: process.argv[2], // Optional subject filter from command line
  dryRun: process.argv.includes('--dry-run'), // Preview mode
};

// ============================================================================
// MAIN FUNCTION
// ============================================================================

async function mapQuestions() {
  console.log('🚀 Question to Chapter Mapping Tool');
  console.log('═'.repeat(60));
  console.log(`Configuration:`);
  console.log(`  Threshold:     ${CONFIG.threshold}`);
  console.log(`  Subject:       ${CONFIG.subjectCode || 'All'}`);
  console.log(`  Dry Run:       ${CONFIG.dryRun ? 'Yes (preview only)' : 'No'}`);
  console.log('═'.repeat(60) + '\n');

  try {
    // Step 1: Auto-map questions with high confidence
    console.log('📍 STEP 1: Auto-mapping questions with high similarity...\n');
    const mappingResult = await chapterMappingService.autoMapQuestions(
      CONFIG.threshold,
      CONFIG.subjectCode,
      CONFIG.dryRun
    );

    if (CONFIG.dryRun) {
      console.log('⚠️  DRY RUN MODE - No changes were made to the database\n');
      console.log('To apply these changes, run without --dry-run flag\n');
    } else {
      // Step 2: Update chapter statistics
      console.log('📍 STEP 2: Updating chapter statistics...\n');
      await chapterMappingService.updateChapterStatistics();

      // Step 3: Generate mapping report
      console.log('📍 STEP 3: Generating final report...\n');
      await chapterMappingService.generateMappingReport();
    }

    // Step 4: Show uncertain mappings if any
    if (mappingResult.uncertain > 0) {
      console.log('\n📍 STEP 4: Checking uncertain mappings...\n');
      const uncertainMappings = await chapterMappingService.getUncertainMappings(
        0.5,
        CONFIG.threshold,
        20 // Show top 20
      );

      if (uncertainMappings.length > 0) {
        console.log('⚠️  UNCERTAIN MAPPINGS (Manual Review Needed)');
        console.log('═'.repeat(60));
        uncertainMappings.slice(0, 10).forEach((mapping, index) => {
          console.log(`\n${index + 1}. Question Topic: "${mapping.topic}"`);
          console.log(`   Subject: ${mapping.subject}`);
          console.log(`   Suggested Chapters:`);
          mapping.suggestedChapters.forEach((ch) => {
            console.log(
              `     - ${ch.name} (Grade ${ch.gradeLevel}) [Score: ${(ch.score * 100).toFixed(1)}%]`
            );
          });
        });
        console.log('\n' + '═'.repeat(60));
        console.log(`\nShowing 10 of ${uncertainMappings.length} uncertain mappings`);
        console.log('Use the admin panel to review and manually map these questions\n');
      }
    }

    // Final summary
    console.log('\n✅ Mapping process completed successfully!\n');

    if (!CONFIG.dryRun) {
      console.log('Next steps:');
      console.log('1. Review uncertain mappings in the admin panel');
      console.log('2. Manually map remaining unmapped questions');
      console.log('3. Run chapter statistics update periodically\n');
    }
  } catch (error) {
    console.error('\n❌ Mapping process failed:', error);
    throw error;
  }
}

// ============================================================================
// RUN
// ============================================================================

mapQuestions()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

// Run in dry-run mode (preview):
// npm run map:questions -- --dry-run

// Map all questions:
// npm run map:questions

// Map only physics questions:
// npm run map:questions physics

// Map physics questions in dry-run mode:
// npm run map:questions physics --dry-run
