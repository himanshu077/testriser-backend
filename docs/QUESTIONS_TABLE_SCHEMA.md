# Questions Table Schema Documentation

## Overview

The `questions` table is the central data store for all NEET exam questions in the TestRiser platform. It supports multiple question types, integrates with the curriculum, tracks question metadata, and handles complex question formats including diagrams and structured data.

---

## Table: `questions`

### Primary Identifiers

| Column              | Type    | Constraints                 | Description                         | Purpose                                                                                                          |
| ------------------- | ------- | --------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **id**              | UUID    | PRIMARY KEY, DEFAULT random | Unique identifier for each question | Ensures each question has a globally unique identifier for referencing across the system                         |
| **question_number** | INTEGER | NOT NULL                    | Sequential number in paper (1-180)  | Maintains the original order of questions in exam papers, crucial for PYQ (Previous Year Questions) authenticity |

### Source & Context

| Column                    | Type         | Constraints                                              | Description                                     | Purpose                                                                                                     |
| ------------------------- | ------------ | -------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **paper_id**              | UUID         | FOREIGN KEY → papers.id, CASCADE DELETE                  | Reference to the exam paper                     | Links questions to specific NEET papers (e.g., NEET 2023). When paper is deleted, its questions are removed |
| **book_id**               | UUID         | FOREIGN KEY → books.id, SET NULL ON DELETE               | Reference to source book/PDF                    | Tracks which uploaded PDF book the question came from. Useful for quality control and re-extraction         |
| **curriculum_chapter_id** | UUID         | FOREIGN KEY → curriculum_chapters.id, SET NULL ON DELETE | Link to curriculum chapter                      | Maps questions to the official NEET curriculum for chapter-wise practice and analysis                       |
| **subject**               | VARCHAR(50)  | NOT NULL                                                 | Subject name (Physics/Chemistry/Botany/Zoology) | Primary categorization for filtering and subject-wise tests                                                 |
| **topic**                 | VARCHAR(255) | NOT NULL                                                 | Broad topic within subject                      | Second-level categorization (e.g., "Mechanics", "Organic Chemistry")                                        |
| **subtopic**              | VARCHAR(255) | NULLABLE                                                 | Specific subtopic                               | Granular categorization (e.g., "Newton's Laws", "Alkanes") for targeted practice                            |

### Exam Metadata

| Column        | Type         | Constraints | Description                               | Purpose                                                                                                |
| ------------- | ------------ | ----------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **exam_year** | INTEGER      | NULLABLE    | Year of exam (e.g., 2020, 2023)           | Extracted from exam markers like "[NEET (Sep.) 2020]". Used for year-wise filtering and trend analysis |
| **exam_type** | VARCHAR(100) | NULLABLE    | Type of exam (e.g., "NEET", "CBSE AIPMT") | Distinguishes between different exam formats, important for historical questions                       |

### Question Content

| Column             | Type | Constraints                        | Description                | Purpose                                                                                                                                                                                                                                                            |
| ------------------ | ---- | ---------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **question_text**  | TEXT | NOT NULL                           | Main question text         | Stores the actual question being asked. Required field as every question must have text                                                                                                                                                                            |
| **question_image** | TEXT | NULLABLE                           | URL/path to question image | For questions that include diagrams, figures, or images that are part of the question stem                                                                                                                                                                         |
| **question_type**  | ENUM | NOT NULL, DEFAULT 'single_correct' | Type of question           | Determines answer format. Values: <br>• `single_correct` - One correct answer (most common in NEET)<br>• `multiple_correct` - Multiple answers can be correct<br>• `assertion_reason` - Statement-based questions<br>• `integer_type` - Numerical answer questions |

### Answer Options

| Column             | Type | Constraints | Description                 | Purpose                                                                         |
| ------------------ | ---- | ----------- | --------------------------- | ------------------------------------------------------------------------------- |
| **option_a**       | TEXT | NULLABLE    | Option A text               | First answer choice. Nullable for integer-type questions                        |
| **option_b**       | TEXT | NULLABLE    | Option B text               | Second answer choice                                                            |
| **option_c**       | TEXT | NULLABLE    | Option C text               | Third answer choice                                                             |
| **option_d**       | TEXT | NULLABLE    | Option D text               | Fourth answer choice                                                            |
| **option_a_image** | TEXT | NULLABLE    | URL/path for Option A image | When options contain diagrams, chemical structures, or mathematical expressions |
| **option_b_image** | TEXT | NULLABLE    | URL/path for Option B image | Visual representation for Option B                                              |
| **option_c_image** | TEXT | NULLABLE    | URL/path for Option C image | Visual representation for Option C                                              |
| **option_d_image** | TEXT | NULLABLE    | URL/path for Option D image | Visual representation for Option D                                              |

**Why separate image columns for options?**

- NEET often has options with molecular structures, circuit diagrams, or graphs
- Allows flexibility - an option can have text, image, or both
- Simplifies rendering logic in the frontend

### Correct Answer & Explanation

| Column                | Type | Constraints | Description                      | Purpose                                                                                                                                                                                            |
| --------------------- | ---- | ----------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **correct_answer**    | TEXT | NOT NULL    | The correct answer(s)            | Stores answer in flexible format:<br>• Single correct: "A", "B", "C", or "D"<br>• Multiple correct: "AB", "ACD", etc.<br>• Integer type: "1234" (numerical answer)<br>Required for auto-evaluation |
| **explanation**       | TEXT | NULLABLE    | Detailed solution explanation    | Helps students understand the concept and solution approach. Crucial for learning                                                                                                                  |
| **explanation_image** | TEXT | NULLABLE    | URL/path for explanation diagram | For visual explanations, derivations, or step-by-step diagrams                                                                                                                                     |

### Scoring & Difficulty

| Column             | Type         | Constraints                | Description                     | Purpose                                                                                         |
| ------------------ | ------------ | -------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------- |
| **marks_positive** | DECIMAL(4,2) | NOT NULL, DEFAULT 4.00     | Marks for correct answer        | NEET standard is +4, but allows flexibility for custom tests                                    |
| **marks_negative** | DECIMAL(4,2) | NOT NULL, DEFAULT 1.00     | Marks deducted for wrong answer | NEET standard is -1 for negative marking                                                        |
| **difficulty**     | ENUM         | NOT NULL, DEFAULT 'medium' | Question difficulty level       | Values: `easy`, `medium`, `hard`<br>Used for adaptive testing and balanced mock test generation |

### Visibility & Status

| Column        | Type    | Constraints            | Description                | Purpose                                                                                                                                                                              |
| ------------- | ------- | ---------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **is_active** | BOOLEAN | NOT NULL, DEFAULT true | Toggle question visibility | Allows admins to hide/show questions without deletion. Useful for:<br>• Hiding duplicate questions<br>• Removing incorrect questions temporarily<br>• A/B testing different versions |

### Diagram & Structured Data

| Column                  | Type    | Constraints   | Description                      | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------- | ------- | ------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **has_diagram**         | BOOLEAN | DEFAULT false | Indicates presence of diagram    | Quick flag for questions with visual elements. Used for filtering and UI rendering                                                                                                                                                                                                                                                                                                                                                                                 |
| **diagram_description** | TEXT    | NULLABLE      | AI-generated diagram description | Stores context about the diagram (e.g., "P-V diagram showing thermodynamic cycle", "Circuit with resistors in series"). Useful for:<br>• Accessibility (screen readers)<br>• Search functionality<br>• AI-based question matching                                                                                                                                                                                                                                  |
| **structured_data**     | TEXT    | NULLABLE      | JSON string for complex data     | Stores structured content like:<br>• Match-the-following tables<br>• Truth tables<br>• Data tables<br>• Multi-column layouts<br><br>**Example JSON:**<br>`json<br>{<br>  "type": "match_list",<br>  "columns": {<br>    "A": ["Item 1", "Item 2"],<br>    "B": ["Match 1", "Match 2"]<br>  }<br>}<br>`<br><br>**Why JSON?**<br>• Flexible schema for different question formats<br>• Easy to parse and render dynamically<br>• Preserves structure from source PDF |

### Timestamps

| Column         | Type      | Constraints             | Description                 | Purpose                                                       |
| -------------- | --------- | ----------------------- | --------------------------- | ------------------------------------------------------------- |
| **created_at** | TIMESTAMP | NOT NULL, DEFAULT NOW() | Record creation timestamp   | Audit trail, enables chronological sorting                    |
| **updated_at** | TIMESTAMP | NOT NULL, DEFAULT NOW() | Last modification timestamp | Tracks when question was last edited. Auto-updates on changes |

---

## Design Decisions & Rationale

### 1. **Why separate text and image columns for each option?**

**Decision:** Each option (A, B, C, D) has both `option_x` and `option_x_image` columns.

**Rationale:**

- NEET questions frequently mix text and images in options
- Example: Chemistry questions with molecular structures, Physics with circuit diagrams
- Allows three rendering modes:
  1. Text only (most common)
  2. Image only (structural formulas)
  3. Text + Image (labeled diagrams)
- Simplifies frontend rendering logic
- Alternative considered: Single JSON column → Rejected for query complexity

### 2. **Why flexible `correct_answer` as TEXT instead of ENUM?**

**Decision:** Store answer as TEXT field rather than structured columns.

**Rationale:**

- Supports multiple question types in one column:
  - Single correct: "A"
  - Multiple correct: "ABC"
  - Integer type: "1234"
- Simpler schema than separate columns per type
- Easy to validate and compare during evaluation
- Future-proof for new question types

### 3. **Why both `bookId` and `paperId` foreign keys?**

**Decision:** Questions can belong to either a book OR a paper (or both).

**Rationale:**

- **bookId**: Tracks source PDF upload for quality control and re-extraction
- **paperId**: Groups questions into official NEET papers for year-wise tests
- **Both nullable**: Allows flexibility:
  - Questions manually added → both NULL
  - Extracted from book → bookId set, paperId NULL initially
  - Later assigned to paper → paperId also set
- SET NULL on delete: Preserves questions even if source book/paper is removed

### 4. **Why `structured_data` as JSON TEXT instead of separate tables?**

**Decision:** Store complex structures (match lists, tables) as JSON in a TEXT column.

**Rationale:**

- Questions have varied structured content:
  - Match-the-following (2-4 columns)
  - Truth tables (variable rows/columns)
  - Data interpretation tables
  - Multi-part questions
- Creating separate tables for each type → Schema explosion
- JSON provides:
  - Flexibility for new formats
  - Easy to extend without migrations
  - Simple to version (whole structure in one place)
- **Tradeoff**: Can't query internal JSON structure easily → Acceptable as we filter by question metadata, not internal structure

### 5. **Why `difficulty` field when we can calculate from student performance?**

**Decision:** Store difficulty as an explicit field.

**Rationale:**

- Allows immediate filtering for balanced test generation
- Admin can manually set difficulty based on curriculum importance
- Seed data needs difficulty before any student attempts
- Can be updated based on analytics later
- Quick queries: "Get 20 easy questions from Mechanics"

### 6. **Why `exam_year` and `exam_type` separate from paper relationship?**

**Decision:** Denormalize exam metadata even though `paperId` links to papers table.

**Rationale:**

- Questions can exist without papers (from books, manual entry)
- Extracted from question text markers: "[NEET (Sep.) 2020]"
- Enables year-wise filtering without JOIN
- Paper may not exist yet when question is extracted
- Historical consistency: Preserves original exam context

### 7. **Why `curriculum_chapter_id` in addition to `subject`/`topic`/`subtopic`?**

**Decision:** Both free-text categorization AND structured curriculum mapping.

**Rationale:**

- **Free-text fields** (subject/topic/subtopic):
  - Extracted from PDF (may not match curriculum exactly)
  - Flexible, allows variations
  - Immediate categorization without curriculum setup
- **curriculum_chapter_id**:
  - Links to official NEET syllabus structure
  - Enables precise chapter-wise practice
  - Mapped after extraction (admin review)
  - Null initially, filled during curation
- **Best of both worlds**: Quick extraction + precise curriculum alignment

### 8. **Why `is_active` instead of soft delete?**

**Decision:** Use boolean flag for visibility rather than deleted_at timestamp.

**Rationale:**

- Questions referenced in student_answers, mock_test_questions
- Deleting would break referential integrity or require cascade deletes
- Admin may want to temporarily hide questions (duplicates, errors)
- Easy to toggle: No complex queries with IS NULL checks
- Can filter in application layer: WHERE is_active = true
- Preserves complete historical data for analytics

---

## Common Query Patterns

### Get questions for a specific chapter

```sql
SELECT * FROM questions
WHERE curriculum_chapter_id = 'chapter-uuid'
  AND is_active = true
ORDER BY difficulty, question_number;
```

### Get all Physics questions from NEET 2023

```sql
SELECT * FROM questions
WHERE subject = 'physics'
  AND exam_year = 2023
  AND exam_type = 'NEET'
  AND is_active = true;
```

### Find questions with diagrams

```sql
SELECT * FROM questions
WHERE has_diagram = true
  AND is_active = true;
```

### Get questions by topic for practice

```sql
SELECT * FROM questions
WHERE subject = 'chemistry'
  AND topic = 'Organic Chemistry'
  AND is_active = true
ORDER BY difficulty, RANDOM()
LIMIT 20;
```

---

## Related Tables

### **papers**

- Year-wise NEET exam papers
- Questions belong to papers via `paper_id`

### **books**

- Uploaded PDF sources
- Questions extracted from books via `book_id`

### **curriculum_chapters**

- Official NEET syllabus structure
- Questions mapped to chapters via `curriculum_chapter_id`

### **mock_test_questions**

- Many-to-many relationship
- Links questions to custom mock tests

### **student_answers**

- Records student responses
- References questions via `question_id`

### **question_practice**

- Tracks question-wise practice attempts
- References questions via `question_id`

---

## Future Enhancements

### Potential additions being considered:

1. **Tags/Keywords** (Many-to-many)
   - More flexible categorization than topic/subtopic
   - Enable multi-dimensional filtering

2. **Question Version History**
   - Track edits and corrections
   - Revert to previous versions

3. **Source Confidence Score**
   - OCR/AI extraction confidence (0-1)
   - Flag low-confidence questions for manual review

4. **Answer Statistics**
   - Denormalized fields: attempt_count, correct_rate
   - Updated via triggers or batch jobs

5. **Similar Questions**
   - Array of similar question IDs
   - Populated by AI similarity matching

---

## Best Practices

### When adding new questions:

1. **Required fields**: Ensure question_text, subject, topic, question_type, correct_answer are set
2. **Images**: Store URLs/paths, not binary data. Use CDN for better performance
3. **Diagrams**: Set has_diagram=true and provide diagram_description for accessibility
4. **Structured data**: Validate JSON structure before saving
5. **Difficulty**: Set based on curriculum level or historical data
6. **Curriculum mapping**: Link to curriculum_chapter_id during curation phase

### When querying:

1. **Always filter by is_active=true** unless explicitly showing inactive questions
2. **Use indexes**: Primary queries use (subject, topic), (curriculum_chapter_id), (exam_year)
3. **Eager load images**: If rendering questions, fetch all image URLs in one query
4. **Pagination**: Use offset/limit for large result sets (180+ questions per paper)

---

## Maintenance

### Regular maintenance tasks:

- **Duplicate detection**: Find questions with identical question_text + options
- **Orphan cleanup**: Questions with NULL bookId AND paperId (review source)
- **Image validation**: Check that all image URLs/paths are accessible
- **Curriculum coverage**: Ensure even distribution across chapters
- **Analytics update**: Refresh difficulty based on student performance

---

_Last Updated: December 11, 2025_
_Version: 1.0_
