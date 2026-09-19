import * as fs from 'fs';

let content = fs.readFileSync('src/lib/storage.ts', 'utf-8');

content = content.replace(
  /return { class_id: resolvedClassId,\s+ss_cre_structure: updatedExam\.ss_cre_structure, stream_id: resolvedStreamId };/,
  "return { class_id: resolvedClassId, stream_id: resolvedStreamId };"
);

content = content.replace(
  /class_id: resolvedClassId,\n(\s*)updated_at: new Date\(\)\.toISOString\(\),/,
  "class_id: resolvedClassId,\n$1ss_cre_structure: updatedExam.ss_cre_structure,\n$1updated_at: new Date().toISOString(),"
);

fs.writeFileSync('src/lib/storage.ts', content);
