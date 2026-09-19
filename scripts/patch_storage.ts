import * as fs from 'fs';

let content = fs.readFileSync('src/lib/storage.ts', 'utf-8');

// addExamination payload
content = content.replace(
  /class_id: resolvedClassId \|\| null,/,
  "class_id: resolvedClassId || null,\n        ss_cre_structure: finalExam.ss_cre_structure || null,"
);

// updateExamination updatedExamRecord
content = content.replace(
  /class_id: resolvedClassId,/,
  "class_id: resolvedClassId,\n      ss_cre_structure: updatedExam.ss_cre_structure,"
);

// updateExamination payload
content = content.replace(
  /class_id: resolvedClassId \|\| null,(\s+)updated_at: updatedExamRecord\.updated_at,/,
  "class_id: resolvedClassId || null,$1ss_cre_structure: updatedExamRecord.ss_cre_structure || null,$1updated_at: updatedExamRecord.updated_at,"
);

// getExaminationStats fallback
content = content.replace(
  /approved_classes: data\.approved_classes \|\| \[\],/,
  "approved_classes: data.approved_classes || [],\n          ss_cre_structure: data.ss_cre_structure || undefined,"
);

fs.writeFileSync('src/lib/storage.ts', content);
console.log('patched storage.ts');
