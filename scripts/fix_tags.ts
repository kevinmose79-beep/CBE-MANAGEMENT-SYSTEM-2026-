import * as fs from 'fs';

let content = fs.readFileSync('src/components/ExaminationManagement.tsx', 'utf-8');

// The extra div is around line 490:
//              </div>
//              </div>
//              {(educationLevel === 'Upper Primary' || educationLevel === 'All Levels') && (
// Let's replace the double closing div
content = content.replace(
  /<\/div>\n(\s*)<\/div>\n(\s*)\{\(educationLevel === 'Upper Primary'/g,
  "</div>\n$2{(educationLevel === 'Upper Primary'"
);

// The same problem might exist in editSelector. Let's check edit mode around updateError.
content = content.replace(
  /<\/div>\n(\s*)<\/div>\n(\s*)\{\(editEducationLevel === 'Upper Primary'/g,
  "</div>\n$2{(editEducationLevel === 'Upper Primary'"
);

fs.writeFileSync('src/components/ExaminationManagement.tsx', content);
console.log('fixed tags');
