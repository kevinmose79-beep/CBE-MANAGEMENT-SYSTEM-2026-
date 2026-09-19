import * as fs from 'fs';

let content = fs.readFileSync('src/components/ExaminationManagement.tsx', 'utf-8');

content = content.replace(
  /Examination,/,
  "Examination,\n  UpperPrimarySSCREStructure,"
);

fs.writeFileSync('src/components/ExaminationManagement.tsx', content);
console.log('patched imports');
