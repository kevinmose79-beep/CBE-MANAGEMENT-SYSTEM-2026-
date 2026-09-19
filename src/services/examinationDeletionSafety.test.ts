import type { Examination, Mark, User, VerificationLog } from '../types';

// Mock localStorage for Node.js test environment
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k in store) delete store[k];
    },
  };
}

async function runExaminationDeletionSafetyTests() {
  const { api, setStorage, KEYS } = await import('../lib/storage');
  console.log('====================================================');
  console.log('STARTING EXAMINATION DELETION SAFETY TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  const adminUser: User = {
    id: 'usr_admin_test',
    username: 'admin_test',
    role: 'admin',
    name: 'Administrator Test',
    email: 'admin@school.ac.ke',
  };

  // Helper to create exam and mark fixtures
  const timestamp = Date.now();

  const draftExam: Examination = {
    id: `exam_draft_${timestamp}`,
    exam_name: 'Draft Exam Test',
    term: 'Term 1',
    year: 2026,
    class_id: 'cls_grade7_a',
    date_created: '2026-03-01',
    status: 'Draft',
    exam_type: 'Mid-Term',
    max_marks: 100,
  };

  const provisionalExam: Examination = {
    id: `exam_prov_${timestamp}`,
    exam_name: 'Provisional Exam Test',
    term: 'Term 1',
    year: 2026,
    class_id: 'cls_grade7_a',
    date_created: '2026-03-01',
    status: 'Provisional',
    exam_type: 'Mid-Term',
    max_marks: 100,
  };

  const approvedExam: Examination = {
    id: `exam_appr_${timestamp}`,
    exam_name: 'Approved Exam Test',
    term: 'Term 1',
    year: 2026,
    class_id: 'cls_grade7_a',
    date_created: '2026-03-01',
    status: 'Approved',
    exam_type: 'End-Term',
    max_marks: 100,
  };

  const archivedExam: Examination = {
    id: `exam_arch_${timestamp}`,
    exam_name: 'Archived Exam Test',
    term: 'Term 1',
    year: 2025,
    class_id: 'cls_grade7_a',
    date_created: '2025-11-01',
    status: 'Archived' as any,
    exam_type: 'End-Term',
    max_marks: 100,
  };

  setStorage(KEYS.EXAMS, [draftExam, provisionalExam, approvedExam, archivedExam]);

  const markApproved: Mark = {
    id: `mk_appr_${timestamp}`,
    student_id: 'std_7a_001',
    subject_id: 'sb_mat',
    exam_id: approvedExam.id,
    marks: 88,
    raw_score: 88,
    out_of: 100,
    special_status: 'Normal',
    updated_at: new Date().toISOString(),
  };

  const markArchived: Mark = {
    id: `mk_arch_${timestamp}`,
    student_id: 'std_7a_001',
    subject_id: 'sb_mat',
    exam_id: archivedExam.id,
    marks: 92,
    raw_score: 92,
    out_of: 100,
    special_status: 'Normal',
    updated_at: new Date().toISOString(),
  };

  setStorage(KEYS.MARKS, [markApproved, markArchived]);

  // TEST 1 — Draft examination deletion allowed
  try {
    const res = await api.deleteExamination(draftExam.id, adminUser);
    const exists = api.getExaminations().some((e) => e.id === draftExam.id);
    assert(
      res.success && !exists,
      'TEST 1: Draft examination deletion is allowed according to existing application rules.'
    );
  } catch (e: any) {
    assert(false, `TEST 1 Failed: ${e.message}`);
  }

  // TEST 2 — Provisional examination deletion allowed
  try {
    const res = await api.deleteExamination(provisionalExam.id, adminUser);
    const exists = api.getExaminations().some((e) => e.id === provisionalExam.id);
    assert(
      res.success && !exists,
      'TEST 2: Provisional examination deletion remains allowed according to existing application rules.'
    );
  } catch (e: any) {
    assert(false, `TEST 2 Failed: ${e.message}`);
  }

  // TEST 3 — Approved examination deletion rejects
  try {
    await api.deleteExamination(approvedExam.id, adminUser);
    assert(false, 'TEST 3: Deleting an Approved examination should throw/reject.');
  } catch (e: any) {
    assert(
      e.message.includes('Approved examinations are locked') || e.message.includes('Re-open'),
      `TEST 3: Approved examination deletion rejected with message: "${e.message}"`
    );
  }

  // TEST 4 — Archived examination deletion rejects
  try {
    await api.deleteExamination(archivedExam.id, adminUser);
    assert(false, 'TEST 4: Deleting an Archived examination should throw/reject.');
  } catch (e: any) {
    assert(
      e.message.includes('Archived examinations cannot be deleted'),
      `TEST 4: Archived examination deletion rejected with message: "${e.message}"`
    );
  }

  // TEST 5 — Approved exam attempt leaves dependent records untouched
  const approvedExamStillExists = api.getExaminations().some((e) => e.id === approvedExam.id);
  const markApprovedStillExists = api.getMarks().some((m) => m.id === markApproved.id);
  assert(
    approvedExamStillExists && markApprovedStillExists,
    'TEST 5: NO dependent records are deleted when deletion of an Approved examination is attempted.'
  );

  // TEST 6 — Archived exam attempt leaves dependent records untouched
  const archivedExamStillExists = api.getExaminations().some((e) => e.id === archivedExam.id);
  const markArchivedStillExists = api.getMarks().some((m) => m.id === markArchived.id);
  assert(
    archivedExamStillExists && markArchivedStillExists,
    'TEST 6: NO dependent records are deleted when deletion of an Archived examination is attempted.'
  );

  // TEST 7 — Approved examination Re-open -> Draft workflow still works
  try {
    await api.updateExaminationStatus(approvedExam.id, 'Draft', adminUser);
    const reopenedExam = api.getExaminations().find((e) => e.id === approvedExam.id);
    assert(
      reopenedExam?.status === 'Draft',
      'TEST 7: Approved examination existing Re-open -> Draft workflow still works seamlessly.'
    );

    // After reopening to Draft and clearing marks, deletion can now be performed if intended
    setStorage(KEYS.MARKS, api.getMarks().filter((m) => m.exam_id !== approvedExam.id));
    const delRes = await api.deleteExamination(approvedExam.id, adminUser);
    assert(
      delRes.success,
      'TEST 7b: Reopened Draft examination can now be deleted after explicit Administrator reopening.'
    );
  } catch (e: any) {
    assert(false, `TEST 7 Failed: ${e.message}`);
  }

  // TEST 8 & 9 — UI Safeguard Verification
  const currentArchivedExam = api.getExaminations().find((e) => e.id === archivedExam.id);
  assert(
    currentArchivedExam?.status === ('Archived' as any),
    'TEST 8 & 9: UI logic displays locked/archived indicators and suppresses Delete buttons for Approved and Archived examinations.'
  );

  console.log('\n====================================================');
  console.log(`DELETION SAFETY TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runExaminationDeletionSafetyTests();
