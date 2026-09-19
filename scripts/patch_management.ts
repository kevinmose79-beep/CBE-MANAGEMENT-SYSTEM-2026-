import * as fs from 'fs';

let content = fs.readFileSync('src/components/ExaminationManagement.tsx', 'utf-8');

// Add states for create and edit
content = content.replace(
  /const \[maxMarks, setMaxMarks\] = useState\(100\);/,
  "const [maxMarks, setMaxMarks] = useState(100);\n  const [ssCreStructure, setSsCreStructure] = useState<UpperPrimarySSCREStructure | ''>('');"
);

content = content.replace(
  /const \[editMaxMarks, setEditMaxMarks\] = useState\(100\);/,
  "const [editMaxMarks, setEditMaxMarks] = useState(100);\n  const [editSsCreStructure, setEditSsCreStructure] = useState<UpperPrimarySSCREStructure | ''>('');"
);

// Add to newExam creation
content = content.replace(
  /max_marks: maxMarks,\n(\s*)start_date: today,/,
  "max_marks: maxMarks,\n$1ss_cre_structure: ssCreStructure ? ssCreStructure : undefined,\n$1start_date: today,"
);

// Reset in handleAddExamination
content = content.replace(
  /setMaxMarks\(100\);/,
  "setMaxMarks(100);\n      setSsCreStructure('');"
);
// Also need to reset setSsCreStructure('') on success (around line 187)
content = content.replace(
  /setSelectedClassId\('all'\);/,
  "setSelectedClassId('all');\n      setSsCreStructure('');"
);


// Set in handleOpenEdit
content = content.replace(
  /setEditMaxMarks\(exam\.max_marks \|\| 100\);/,
  "setEditMaxMarks(exam.max_marks || 100);\n    setEditSsCreStructure(exam.ss_cre_structure || '');"
);

// Add to updatedRecord
content = content.replace(
  /max_marks: numMarks,\n(\s*)education_level: resolvedLevel,/,
  "max_marks: numMarks,\n$1ss_cre_structure: editSsCreStructure ? editSsCreStructure : undefined,\n$1education_level: resolvedLevel,"
);

fs.writeFileSync('src/components/ExaminationManagement.tsx', content);
console.log('patched states');
