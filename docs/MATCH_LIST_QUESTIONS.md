# Match-List Questions Implementation Guide

## Overview

Match-list questions are a special type of NEET question where students must match items from two columns (List-I and List-II). This document explains how match-list questions are:

1. Extracted from PDFs using GPT-4 Vision
2. Stored in the database with structured data
3. Displayed in table format on the frontend

## Example Question

**Question 19 from NEET 2024:**

> Match the List-I with List-II.
>
> | List-I (Spectral Lines of Hydrogen) | List-II (Wavelengths nm) |
> | ----------------------------------- | ------------------------ |
> | (A) n₂ = 3 to n₁ = 2                | I. 410.2                 |
> | (B) n₂ = 4 to n₁ = 2                | II. 434.1                |
> | (C) n₂ = 5 to n₁ = 2                | III. 656.3               |
> | (D) n₂ = 6 to n₁ = 2                | IV. 486.1                |
>
> Choose the correct answer from the options given below:
>
> 1. A-IV, B-III, C-I, D-II
> 2. A-I, B-II, C-III, D-IV
> 3. A-II, B-I, C-IV, D-III ✓ (Correct)
> 4. A-III, B-IV, C-II, D-I

## Database Schema

### Questions Table Fields

Match-list questions use these specific fields:

```sql
-- Core fields (same for all question types)
questionNumber INTEGER NOT NULL,
questionText TEXT NOT NULL,  -- "Match the List-I with List-II."
questionType question_type NOT NULL,  -- 'match_list'

-- Options contain the matching combinations
optionA TEXT,  -- "A-IV, B-III, C-I, D-II"
optionB TEXT,  -- "A-I, B-II, C-III, D-IV"
optionC TEXT,  -- "A-II, B-I, C-IV, D-III"
optionD TEXT,  -- "A-III, B-IV, C-II, D-I"

correctAnswer TEXT NOT NULL,  -- "3" (option 3 is correct)

-- Special field for table data
structuredData TEXT,  -- JSON string containing list data
```

### Structured Data Format

The `structuredData` field stores a JSON object with this structure:

```json
{
  "listATitle": "List-I (Spectral Lines of Hydrogen for transitions from)",
  "listBTitle": "List-II (Wavelengths (nm))",
  "listA": [
    { "key": "A", "value": "n₂ = 3 to n₁ = 2" },
    { "key": "B", "value": "n₂ = 4 to n₁ = 2" },
    { "key": "C", "value": "n₂ = 5 to n₁ = 2" },
    { "key": "D", "value": "n₂ = 6 to n₁ = 2" }
  ],
  "listB": [
    { "key": "I", "value": "410.2" },
    { "key": "II", "value": "434.1" },
    { "key": "III", "value": "656.3" },
    { "key": "IV", "value": "486.1" }
  ]
}
```

## GPT-4 Vision Extraction

### Updated Prompt

The extraction service (`visionExtractionService.ts`) includes special instructions for match-list questions:

```typescript
**SPECIAL: For MATCH-LIST questions:**
- questionType MUST be "match_list"
- structuredData MUST contain a JSON object with this EXACT format:
{
  "listATitle": "List-I (description from PDF)",
  "listBTitle": "List-II (description from PDF)",
  "listA": [
    {"key": "A", "value": "text for item A"},
    {"key": "B", "value": "text for item B"},
    {"key": "C", "value": "text for item C"},
    {"key": "D", "value": "text for item D"}
  ],
  "listB": [
    {"key": "I", "value": "text for item I"},
    {"key": "II", "value": "text for item II"},
    {"key": "III", "value": "text for item III"},
    {"key": "IV", "value": "text for item IV"}
  ]
}
- Extract the table data carefully preserving all mathematical notation
- optionA, optionB, optionC, optionD should contain the matching combinations
```

### How GPT-4 Vision Processes It

1. **Detects the table structure** - Recognizes the two-column layout
2. **Extracts column headers** - Identifies "List-I" and "List-II" titles
3. **Parses table rows** - Extracts each row with keys (A, B, C, D) and (I, II, III, IV)
4. **Preserves formatting** - Maintains subscripts (n₂, n₁), superscripts, mathematical symbols
5. **Extracts matching options** - Captures the four answer combinations below the table

## Frontend Display

### Component Structure

**File:** `frontend/src/components/questions/MatchListDisplay.tsx`

```tsx
import { MatchListDisplay, parseMatchListData } from './MatchListDisplay';

// In your question component:
{
  question.questionType === 'match_list' && question.structuredData && (
    <MatchListDisplay data={parseMatchListData(question.structuredData)} />
  );
}
```

### Rendered HTML

The component renders a responsive table:

```html
<table className="w-full border-collapse border-2 border-gray-800">
  <thead>
    <tr>
      <th>List-I (Spectral Lines of Hydrogen...)</th>
      <th>List-II (Wavelengths (nm))</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>(A) n₂ = 3 to n₁ = 2</td>
      <td>I. 410.2</td>
    </tr>
    <!-- More rows... -->
  </tbody>
</table>
```

### Styling

- **Borders:** 2px solid borders for clear cell separation
- **Hover effect:** Rows highlight on hover
- **Responsive:** Table scrolls horizontally on small screens
- **Typography:** Keys (A, B, C, etc.) are bold for easy identification

## Database Storage Example

Here's the actual SQL INSERT for Question 19:

```sql
INSERT INTO questions (
  question_number,
  question_text,
  question_type,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  structured_data,
  subject,
  topic,
  difficulty
) VALUES (
  19,
  'Match the List-I with List-II.',
  'match_list',
  'A-IV, B-III, C-I, D-II',
  'A-I, B-II, C-III, D-IV',
  'A-II, B-I, C-IV, D-III',
  'A-III, B-IV, C-II, D-I',
  '3',
  '{"listATitle":"List-I (Spectral Lines of Hydrogen for transitions from)","listBTitle":"List-II (Wavelengths (nm))","listA":[{"key":"A","value":"n₂ = 3 to n₁ = 2"},{"key":"B","value":"n₂ = 4 to n₁ = 2"},{"key":"C","value":"n₂ = 5 to n₁ = 2"},{"key":"D","value":"n₂ = 6 to n₁ = 2"}],"listB":[{"key":"I","value":"410.2"},{"key":"II","value":"434.1"},{"key":"III","value":"656.3"},{"key":"IV","value":"486.1"}]}',
  'Physics',
  'Atomic Physics',
  'medium'
);
```

## TypeScript Types

**File:** `frontend/src/types/matchList.ts`

```typescript
export interface MatchListItem {
  key: string; // "A", "B", "C", "D" or "I", "II", "III", "IV"
  value: string; // Content of the item
}

export interface MatchListData {
  listATitle: string;
  listBTitle: string;
  listA: MatchListItem[];
  listB: MatchListItem[];
}
```

## Testing

### Manual Test

1. **Upload a NEET PDF** with match-list questions via admin panel
2. **Check extraction logs** - Look for `questionType: "match_list"`
3. **Verify database** - Check that `structured_data` is properly formatted JSON
4. **View in frontend** - Confirm table displays correctly

### SQL Query to Find Match-List Questions

```sql
SELECT
  question_number,
  question_text,
  structured_data
FROM questions
WHERE question_type = 'match_list'
ORDER BY question_number;
```

### Validate Structured Data

```sql
-- Check if structured_data is valid JSON
SELECT
  question_number,
  question_text,
  CASE
    WHEN structured_data::json IS NOT NULL THEN 'Valid JSON'
    ELSE 'Invalid JSON'
  END as json_status
FROM questions
WHERE question_type = 'match_list';
```

## Common Issues and Solutions

### Issue 1: Table Not Displaying

**Symptom:** Match-list question shows but table is missing

**Solution:**

- Check if `structuredData` field is populated
- Verify JSON format matches expected structure
- Check browser console for parsing errors

### Issue 2: Incorrect Formatting

**Symptom:** Mathematical notation (subscripts, superscripts) not preserved

**Solution:**

- GPT-4 Vision should preserve Unicode characters (₂, ₁, etc.)
- Use proper HTML entities if needed
- Consider using LaTeX rendering for complex equations

### Issue 3: Misaligned Rows

**Symptom:** List-A and List-B items don't align properly

**Solution:**

- Ensure both lists have the same number of items (usually 4)
- Check that items are in correct order
- Verify table CSS is loading correctly

## Best Practices

1. **Always validate JSON** - Use `parseMatchListData()` to safely parse
2. **Handle errors gracefully** - Show error message if data is invalid
3. **Preserve formatting** - Keep subscripts, superscripts, special characters
4. **Test on mobile** - Ensure table is responsive on small screens
5. **Accessibility** - Use proper table semantics (`<thead>`, `<tbody>`, etc.)

## Future Enhancements

1. **Drag-and-drop matching** - Interactive UI for student practice
2. **Auto-grading** - Check if student's matching is correct
3. **Explanation mode** - Show correct matches with explanations
4. **Multiple matching formats** - Support for 1-to-many, many-to-many matches
5. **LaTeX support** - Render complex equations properly

## Related Files

- **Backend:**
  - `backend/src/services/visionExtractionService.ts` - Extraction logic
  - `backend/src/models/schema.ts` - Database schema

- **Frontend:**
  - `frontend/src/components/questions/MatchListDisplay.tsx` - Display component
  - `frontend/src/types/matchList.ts` - TypeScript types
  - `frontend/src/components/questions/QuestionDisplay.example.tsx` - Usage example

## Support

For questions or issues with match-list questions, contact the development team or create an issue in the project repository.
