import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { api, setStorage, KEYS } from '../lib/storage';
import { isMidTermAdmission, isIntakePeriodFuture, isIntakePeriodCurrent, Student, ClassStream, Mark, User } from '../types';

describe('Phase 6D.8.3 — Mid-Term Learner Admission Intelligence & Lifecycle', () => {
  const mockClass: ClassStream = {
    id: 'class-uuid-grade-7-blue',
    stream_id: 'stream-uuid-grade-7-blue',
    class_name: 'Grade 7',
    stream: 'Blue',
    education_level: 'Junior School',
  };

  const activeAY = {
    id: 'ay-2026',
    year: 2026,
    is_active: true,
  };

  const activeTerm = {
    id: 'term-1-2026',
    academic_year_id: 'ay-2026',
    term_name: 'Term 1' as const,
    start_date: '2026-01-06',
    end_date: '2026-04-03',
    is_active: true,
  };

  beforeEach(() => {
    setStorage(KEYS.CLASSES, [mockClass]);
    setStorage(KEYS.STUDENTS, []);
    setStorage(KEYS.USERS, []);
    setStorage(KEYS.MARKS, []);
    setStorage(KEYS.ACADEMIC_YEARS, [activeAY]);
    setStorage(KEYS.SCHOOL_TERMS, [activeTerm]);

    const createBuilder = () => {
      const b: any = {
        eq: () => b,
        ilike: () => b,
        or: () => b,
        order: () => b,
        limit: () => Promise.resolve({ data: [], error: null }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        single: () => Promise.resolve({ data: null, error: null }),
        then: (onFulfilled: any) => Promise.resolve({ data: [], error: null }).then(onFulfilled),
      };
      return b;
    };

    (globalThis as any).__TEST_SUPABASE_CLIENT__ = {
      from: (table: string) => ({
        insert: (payloads: any[]) => ({
          select: () => Promise.resolve({
            data: payloads.map((p, idx) => ({
              id: p.id || `std-${idx + 1}`,
              admission_number: p.admission_number,
              full_name: p.full_name,
              gender: p.gender,
              class_id: p.class_id,
              stream_id: p.stream_id,
              dob: p.dob,
              active: p.active,
            })),
            error: null,
          }),
        }),
        update: (payload: any) => ({
          eq: () => ({
            select: () => Promise.resolve({ data: [payload], error: null }),
          }),
        }),
        select: () => createBuilder(),
        delete: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }),
    };
  });

  afterEach(() => {
    delete (globalThis as any).__TEST_SUPABASE_CLIENT__;
  });

  it('Test A: Normal Beginning-of-Term Admission — active immediately, isMidTerm is false', async () => {
    const normalAdmissionDate = '2026-01-06';
    const isMidTerm = isMidTermAdmission(
      2026,
      'Term 1',
      normalAdmissionDate,
      activeAY.year,
      activeTerm.term_name,
      activeTerm.start_date
    );
    expect(isMidTerm).toBe(false);

    const normalStudent: Student = {
      id: 'student-normal-001',
      admission_number: 'ADM-2026-001',
      full_name: 'Alice Wambui',
      first_name: 'Alice',
      last_name: 'Wambui',
      gender: 'F',
      grade: 'Grade 7',
      class_id: mockClass.id,
      stream_id: mockClass.stream_id,
      intake_year: 2026,
      intake_term: 'Term 1',
      admission_date: normalAdmissionDate,
      enrolment_status: 'active',
      active: true,
    };

    const saved = await api.addStudent(normalStudent);
    expect(saved.active).toBe(true);
    expect(saved.enrolment_status).toBe('active');
    expect(saved.admission_date).toBe(normalAdmissionDate);
  });

  it('Test B: Mid-Term Admission — active immediately, isMidTerm is true, effective from admission_date', async () => {
    const midTermDate = '2026-02-15'; // After Term 1 start_date (2026-01-06)
    const isMidTerm = isMidTermAdmission(
      2026,
      'Term 1',
      midTermDate,
      activeAY.year,
      activeTerm.term_name,
      activeTerm.start_date
    );
    expect(isMidTerm).toBe(true);

    const midTermStudent: Student = {
      id: 'student-midterm-002',
      admission_number: 'ADM-2026-050',
      full_name: 'David Kiprono',
      first_name: 'David',
      last_name: 'Kiprono',
      gender: 'M',
      grade: 'Grade 7',
      class_id: mockClass.id,
      stream_id: mockClass.stream_id,
      intake_year: 2026,
      intake_term: 'Term 1',
      admission_date: midTermDate,
      enrolment_status: 'active',
      active: true,
    };

    const saved = await api.addStudent(midTermStudent);
    expect(saved.active).toBe(true);
    expect(saved.enrolment_status).toBe('active');
    expect(saved.admission_date).toBe(midTermDate);

    // Verify stored student in storage
    const allStudents = api.getStudents();
    const found = allStudents.find((s) => s.id === saved.id || s.admission_number === 'ADM-2026-050');
    expect(found).toBeDefined();
    expect(found?.admission_date).toBe(midTermDate);
    expect(found?.enrolment_status).toBe('active');
  });

  it('Test C: Future Intake Admission — enrolment_status is future, active is false, isMidTerm is false', async () => {
    const futureDate = '2026-05-04'; // Term 2 2026
    const isFuture = isIntakePeriodFuture(2026, 'Term 2', activeAY.year, activeTerm.term_name);
    expect(isFuture).toBe(true);

    const isMidTerm = isMidTermAdmission(
      2026,
      'Term 2',
      futureDate,
      activeAY.year,
      activeTerm.term_name,
      activeTerm.start_date
    );
    expect(isMidTerm).toBe(false);

    const futureStudent: Student = {
      id: 'student-future-003',
      admission_number: 'ADM-2026-100',
      full_name: 'Grace Muthoni',
      gender: 'F',
      class_id: mockClass.id,
      stream_id: mockClass.stream_id,
      intake_year: 2026,
      intake_term: 'Term 2',
      enrolment_status: 'future',
      active: false,
    };

    const saved = await api.addStudent(futureStudent);
    expect(saved.active).toBe(false);
    expect(saved.enrolment_status).toBe('future');
  });

  it('Test D: Historical Data Protection — No artificial marks or retrospective records created', async () => {
    const midTermStudent: Student = {
      id: 'student-midterm-004',
      admission_number: 'ADM-2026-055',
      full_name: 'Kevin Omondi',
      gender: 'M',
      class_id: mockClass.id,
      stream_id: mockClass.stream_id,
      intake_year: 2026,
      intake_term: 'Term 1',
      admission_date: '2026-03-01',
      enrolment_status: 'active',
      active: true,
    };

    await api.addStudent(midTermStudent);

    // Verify marks table has no manufactured records for this learner
    const allMarks = api.getMarks();
    const studentMarks = allMarks.filter((m) => m.student_id === midTermStudent.id);
    expect(studentMarks.length).toBe(0);
  });

  it('Test E: Single Source of Truth & Identity Preservation', async () => {
    const midTermStudent: Student = {
      id: 'student-midterm-005',
      admission_number: 'ADM-2026-077',
      full_name: 'Zahra Hassan',
      first_name: 'Zahra',
      last_name: 'Hassan',
      gender: 'F',
      grade: 'Grade 7',
      class_id: mockClass.id,
      stream_id: mockClass.stream_id,
      intake_year: 2026,
      intake_term: 'Term 1',
      admission_date: '2026-02-20',
      enrolment_status: 'active',
      active: true,
    };

    await api.addStudent(midTermStudent);

    // Update learner without modifying identity
    const updated = await api.updateStudent({
      ...midTermStudent,
      second_name: 'Amina',
    });

    expect(updated.id).toBe(midTermStudent.id);
    expect(updated.admission_number).toBe('ADM-2026-077');
    expect(updated.class_id).toBe(mockClass.id);
    expect(updated.stream_id).toBe(mockClass.stream_id);
    expect(updated.admission_date).toBe('2026-02-20');
  });

  it('Test F: Batch CSV Registration — Correctly preserves admission_date and status', async () => {
    const batch: Student[] = [
      {
        id: 'std-batch-001',
        admission_number: 'ADM-2026-081',
        full_name: 'Brian Koech',
        gender: 'M',
        class_id: mockClass.id,
        stream_id: mockClass.stream_id,
        intake_year: 2026,
        intake_term: 'Term 1',
        admission_date: '2026-02-10',
        enrolment_status: 'active',
        active: true,
      },
      {
        id: 'std-batch-002',
        admission_number: 'ADM-2026-082',
        full_name: 'Cynthia Atieno',
        gender: 'F',
        class_id: mockClass.id,
        stream_id: mockClass.stream_id,
        intake_year: 2026,
        intake_term: 'Term 1',
        admission_date: '2026-01-06',
        enrolment_status: 'active',
        active: true,
      },
    ];

    const result = await api.batchAddStudents(batch);
    expect(result.length).toBe(2);

    const midTermInBatch = result.find((s) => s.admission_number === 'ADM-2026-081');
    expect(midTermInBatch?.admission_date).toBe('2026-02-10');
    expect(midTermInBatch?.active).toBe(true);

    const normalInBatch = result.find((s) => s.admission_number === 'ADM-2026-082');
    expect(normalInBatch?.admission_date).toBe('2026-01-06');
    expect(normalInBatch?.active).toBe(true);
  });

  it('Test G: Role Isolation & Roster Visibility for Mid-Term Learners', async () => {
    const midTermStudent: Student = {
      id: 'student-midterm-006',
      admission_number: 'ADM-2026-090',
      full_name: 'Samuel Mwangi',
      gender: 'M',
      grade: 'Grade 7',
      class_id: mockClass.id,
      stream_id: mockClass.stream_id,
      intake_year: 2026,
      intake_term: 'Term 1',
      admission_date: '2026-02-25',
      enrolment_status: 'active',
      active: true,
    };

    const futureStudent: Student = {
      id: 'student-future-007',
      admission_number: 'ADM-2026-091',
      full_name: 'Mercy Cherono',
      gender: 'F',
      grade: 'Grade 7',
      class_id: mockClass.id,
      stream_id: mockClass.stream_id,
      intake_year: 2026,
      intake_term: 'Term 2',
      enrolment_status: 'future',
      active: false,
    };

    setStorage(KEYS.STUDENTS, [midTermStudent, futureStudent]);

    const allStudents = api.getStudents();
    const activeRoster = allStudents.filter(
      (s) => s.active !== false && s.enrolment_status !== 'future' && s.enrolment_status !== 'inactive'
    );

    expect(activeRoster.length).toBe(1);
    expect(activeRoster[0].id).toBe(midTermStudent.id);
    expect(activeRoster[0].admission_number).toBe('ADM-2026-090');
  });
});
