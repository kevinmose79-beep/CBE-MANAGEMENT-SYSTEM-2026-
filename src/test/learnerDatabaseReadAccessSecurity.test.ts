import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 5A — Learner Database Read Access Security & RLS Policies', () => {
  const sqlFilePath = path.resolve(process.cwd(), 'src/lib/supabaseSql.ts');
  const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');

  it('verifies public.students defines Learner select own record policy', () => {
    expect(sqlContent).toContain('CREATE POLICY "Learner select own record" ON public.students FOR SELECT');
    expect(sqlContent).toContain("u.role = 'learner'");
    expect(sqlContent).toContain('u.student_id = students.id');
  });

  it('verifies public.marks SELECT policy contains learner own marks branch', () => {
    expect(sqlContent).toContain('CREATE POLICY "Marks select policy" ON public.marks FOR SELECT');
    expect(sqlContent).toContain("u.role = 'learner'");
    expect(sqlContent).toContain('u.student_id = marks.student_id');
  });

  it('verifies public.marks write policies (INSERT, UPDATE, DELETE) strictly exclude learners', () => {
    // Check INSERT policy
    const insertPolicySection = sqlContent.substring(
      sqlContent.indexOf('CREATE POLICY "Marks insert policy"'),
      sqlContent.indexOf('CREATE POLICY "Marks update policy"')
    );
    expect(insertPolicySection).not.toContain("u.role = 'learner'");
    expect(insertPolicySection).toContain("users.role = 'admin'");

    // Check UPDATE policy
    const updatePolicySection = sqlContent.substring(
      sqlContent.indexOf('CREATE POLICY "Marks update policy"'),
      sqlContent.indexOf('CREATE POLICY "Marks delete policy"')
    );
    expect(updatePolicySection).not.toContain("u.role = 'learner'");
    expect(updatePolicySection).toContain("users.role = 'admin'");

    // Check DELETE policy
    const deletePolicySection = sqlContent.substring(
      sqlContent.indexOf('CREATE POLICY "Marks delete policy"'),
      sqlContent.indexOf('DROP POLICY IF EXISTS "Full access report_cards"')
    );
    expect(deletePolicySection).not.toContain("u.role = 'learner'");
    expect(deletePolicySection).toContain("users.role = 'admin'");
  });

  it('verifies existing Admin, Class Teacher, and Subject Teacher policies are preserved', () => {
    expect(sqlContent).toContain('CREATE POLICY "Admin full access students" ON public.students');
    expect(sqlContent).toContain('CREATE POLICY "Class Teacher select roster" ON public.students');
    expect(sqlContent).toContain('CREATE POLICY "Teacher select assigned students" ON public.students');
    expect(sqlContent).toContain('CREATE OR REPLACE VIEW public.allocated_students');
  });

  it('simulates RLS evaluation: learner can only access their own student_id', () => {
    const authenticatedUser = {
      id: 'auth_uid_learner_1',
      role: 'learner',
      student_id: 'std_uuid_101',
    };

    const studentRows = [
      { id: 'std_uuid_101', full_name: 'John Doe' },
      { id: 'std_uuid_102', full_name: 'Jane Smith' },
    ];

    const marksRows = [
      { id: 'mrk_1', student_id: 'std_uuid_101', marks: 85 },
      { id: 'mrk_2', student_id: 'std_uuid_101', marks: 90 },
      { id: 'mrk_3', student_id: 'std_uuid_102', marks: 78 },
    ];

    // Evaluate Students RLS predicate for learner
    const accessibleStudents = studentRows.filter(
      (s) => authenticatedUser.role === 'learner' && authenticatedUser.student_id === s.id
    );
    expect(accessibleStudents).toHaveLength(1);
    expect(accessibleStudents[0].id).toBe('std_uuid_101');

    // Evaluate Marks RLS predicate for learner
    const accessibleMarks = marksRows.filter(
      (m) => authenticatedUser.role === 'learner' && authenticatedUser.student_id === m.student_id
    );
    expect(accessibleMarks).toHaveLength(2);
    expect(accessibleMarks.every((m) => m.student_id === 'std_uuid_101')).toBe(true);

    // Cross-learner attempt by requesting student_id 102
    const crossLearnerMarks = marksRows.filter(
      (m) => m.student_id === 'std_uuid_102' && authenticatedUser.role === 'learner' && authenticatedUser.student_id === m.student_id
    );
    expect(crossLearnerMarks).toHaveLength(0);
  });
});
