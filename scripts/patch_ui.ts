import * as fs from 'fs';

let content = fs.readFileSync('src/components/ExaminationManagement.tsx', 'utf-8');

// Insert after Target Class / Grade in Create Modal
const createSelector = `
              </div>
              {(educationLevel === 'Upper Primary' || educationLevel === 'All Levels') && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">SS & CRE Assessment Structure (Upper Primary)</label>
                  <select
                    value={ssCreStructure || ''}
                    onChange={(e) => setSsCreStructure(e.target.value as UpperPrimarySSCREStructure | '')}
                    className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none cursor-pointer"
                  >
                    <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-slate-500">Select structure...</option>
                    <option value="A" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Structure A (SST: 30, CRE: 20, Combined: 50)</option>
                    <option value="B" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Structure B (SST: 10, CRE: 10, Combined: 20)</option>
                    <option value="C" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Structure C (SST: 20, CRE: 30, Combined: 50)</option>
                  </select>
                </div>
              )}
`;

content = content.replace(
  /<\/select>\n(\s*)<\/div>\n(\s*)<\/div>\n(\s*)\{createError && \(/,
  "</select>\n$1</div>" + createSelector + "$2</div>\n$3{createError && ("
);

// Add to Edit Modal
const editSelector = `
                </div>
                {(editEducationLevel === 'Upper Primary' || editEducationLevel === 'All Levels') && (
                  <div className="pt-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      SS & CRE Assessment Structure (Upper Primary)
                    </label>
                    <select
                      value={editSsCreStructure || ''}
                      onChange={(e) => setEditSsCreStructure(e.target.value as UpperPrimarySSCREStructure | '')}
                      className="w-full text-xs font-semibold px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-slate-500">Select structure...</option>
                      <option value="A" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Structure A (SST: 30, CRE: 20, Combined: 50)</option>
                      <option value="B" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Structure B (SST: 10, CRE: 10, Combined: 20)</option>
                      <option value="C" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Structure C (SST: 20, CRE: 30, Combined: 50)</option>
                    </select>
                  </div>
                )}
`;

content = content.replace(
  /<\/select>\n(\s*)<\/div>\n(\s*)<\/div>\n(\s*)\{updateError && \(/,
  "</select>\n$1</div>" + editSelector + "$2</div>\n$3{updateError && ("
);

fs.writeFileSync('src/components/ExaminationManagement.tsx', content);
console.log('patched ui');
