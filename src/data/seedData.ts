import {
  School,
  User,
  Teacher,
  ClassStream,
  Student,
  Subject,
  Examination,
  Mark,
  Grade,
  AcademicYear,
  SchoolTerm,
} from '../types';

export const initialAcademicYears: AcademicYear[] = [
  { id: 'ay_2025', year: 2025, status: 'Archived', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-12-31T00:00:00Z' },
  { id: 'ay_2026', year: 2026, status: 'Active', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-05-06T00:00:00Z' },
  { id: 'ay_2027', year: 2027, status: 'Upcoming', created_at: '2026-05-01T00:00:00Z', updated_at: '2026-05-01T00:00:00Z' },
];

export const initialTerms: SchoolTerm[] = [
  { id: 't_2025_1', academic_year_id: 'ay_2025', year: 2025, term_name: 'Term 1', opening_date: '2025-01-08', closing_date: '2025-04-11', status: 'Archived' },
  { id: 't_2025_2', academic_year_id: 'ay_2025', year: 2025, term_name: 'Term 2', opening_date: '2025-05-05', closing_date: '2025-08-08', status: 'Archived' },
  { id: 't_2025_3', academic_year_id: 'ay_2025', year: 2025, term_name: 'Term 3', opening_date: '2025-09-01', closing_date: '2025-11-21', status: 'Archived' },
  { id: 't_2026_1', academic_year_id: 'ay_2026', year: 2026, term_name: 'Term 1', opening_date: '2026-01-06', closing_date: '2026-04-02', mid_term_opening_date: '2026-02-25', mid_term_closing_date: '2026-03-01', status: 'Closed' },
  { id: 't_2026_2', academic_year_id: 'ay_2026', year: 2026, term_name: 'Term 2', opening_date: '2026-04-27', closing_date: '2026-07-31', mid_term_opening_date: '2026-06-24', mid_term_closing_date: '2026-06-28', status: 'Active' },
  { id: 't_2026_3', academic_year_id: 'ay_2026', year: 2026, term_name: 'Term 3', opening_date: '2026-08-24', closing_date: '2026-10-23', status: 'Upcoming' },
];

export const initialSchool: School = {
  id: '00000000-0000-0000-0000-000000000001',
  school_name: 'CBE Management System',
  motto: 'Strive for Excellence',
  county: 'Kenya',
  postal_code: 'P.O. Box 100-00100',
  address: 'Kenya',
  email: 'info@school.ac.ke',
};

export const initialGrades: Grade[] = [
  {
    id: 'gr_ee1',
    grade_code: 'EE1',
    performance_level: 'EE',
    minimum_score: 90,
    maximum_score: 100,
    points: 8,
    remarks: 'Outstanding Performance',
    descriptor: 'Exceeding Expectations',
    grade: 'EE1',
    minimum_marks: 90,
    maximum_marks: 100,
  },
  {
    id: 'gr_ee2',
    grade_code: 'EE2',
    performance_level: 'EE',
    minimum_score: 75,
    maximum_score: 89,
    points: 7,
    remarks: 'Excellent Performance',
    descriptor: 'Exceeding Expectations',
    grade: 'EE2',
    minimum_marks: 75,
    maximum_marks: 89,
  },
  {
    id: 'gr_me1',
    grade_code: 'ME1',
    performance_level: 'ME',
    minimum_score: 58,
    maximum_score: 74,
    points: 6,
    remarks: 'Good Performance',
    descriptor: 'Meeting Expectations',
    grade: 'ME1',
    minimum_marks: 58,
    maximum_marks: 74,
  },
  {
    id: 'gr_me2',
    grade_code: 'ME2',
    performance_level: 'ME',
    minimum_score: 41,
    maximum_score: 57,
    points: 5,
    remarks: 'Satisfactory Performance',
    descriptor: 'Meeting Expectations',
    grade: 'ME2',
    minimum_marks: 41,
    maximum_marks: 57,
  },
  {
    id: 'gr_ae1',
    grade_code: 'AE1',
    performance_level: 'AE',
    minimum_score: 31,
    maximum_score: 40,
    points: 4,
    remarks: 'Developing Competency',
    descriptor: 'Approaching Expectations',
    grade: 'AE1',
    minimum_marks: 31,
    maximum_marks: 40,
  },
  {
    id: 'gr_ae2',
    grade_code: 'AE2',
    performance_level: 'AE',
    minimum_score: 21,
    maximum_score: 30,
    points: 3,
    remarks: 'Needs More Practice',
    descriptor: 'Approaching Expectations',
    grade: 'AE2',
    minimum_marks: 21,
    maximum_marks: 30,
  },
  {
    id: 'gr_be1',
    grade_code: 'BE1',
    performance_level: 'BE',
    minimum_score: 11,
    maximum_score: 20,
    points: 2,
    remarks: 'Requires Intervention',
    descriptor: 'Below Expectations',
    grade: 'BE1',
    minimum_marks: 11,
    maximum_marks: 20,
  },
  {
    id: 'gr_be2',
    grade_code: 'BE2',
    performance_level: 'BE',
    minimum_score: 0,
    maximum_score: 10,
    points: 1,
    remarks: 'Immediate Support Required',
    descriptor: 'Below Expectations',
    grade: 'BE2',
    minimum_marks: 0,
    maximum_marks: 10,
  },
];

export const initialSubjects: Subject[] = [
  // --- PRE-PRIMARY (PP1 & PP2) ---
  { id: 'sb_pp_lang', subject_name: 'Language Activities', subject_code: 'PP-LANG', category: 'Activity', department: 'Pre-Primary', education_level: 'Pre-Primary', applicable_grades: ['PP1', 'PP2'], status: 'Active' },
  { id: 'sb_pp_math', subject_name: 'Mathematical Activities', subject_code: 'PP-MATH', category: 'Activity', department: 'Pre-Primary', education_level: 'Pre-Primary', applicable_grades: ['PP1', 'PP2'], status: 'Active' },
  { id: 'sb_pp_env', subject_name: 'Environmental Activities', subject_code: 'PP-ENV', category: 'Activity', department: 'Pre-Primary', education_level: 'Pre-Primary', applicable_grades: ['PP1', 'PP2'], status: 'Active' },
  { id: 'sb_pp_psy', subject_name: 'Psychomotor & Creative Activities', subject_code: 'PP-PCA', category: 'Activity', department: 'Pre-Primary', education_level: 'Pre-Primary', applicable_grades: ['PP1', 'PP2'], status: 'Active' },
  { id: 'sb_pp_re', subject_name: 'Christian Religious Education Activities', subject_code: 'PP-CRE', category: 'Activity', department: 'Pre-Primary', education_level: 'Pre-Primary', applicable_grades: ['PP1', 'PP2'], status: 'Active' },

  // --- LOWER PRIMARY (Grade 1 - 3) ---
  { id: 'sb_lp_eng', subject_name: 'English', subject_code: 'ENG', category: 'Core', department: 'Languages', education_level: 'Lower Primary', applicable_grades: ['Grade 1', 'Grade 2', 'Grade 3'], status: 'Active' },
  { id: 'sb_lp_kis', subject_name: 'Kiswahili', subject_code: 'KIS', category: 'Core', department: 'Languages', education_level: 'Lower Primary', applicable_grades: ['Grade 1', 'Grade 2', 'Grade 3'], status: 'Active' },
  { id: 'sb_lp_ila', subject_name: 'Integrated Learning Area', subject_code: 'ILA', category: 'Core', department: 'Core', education_level: 'Lower Primary', applicable_grades: ['Grade 1', 'Grade 2', 'Grade 3'], status: 'Active' },

  // --- UPPER PRIMARY (Grade 4 - 6) ---
  { id: 'sb_up_eng', subject_name: 'English', subject_code: 'ENG', category: 'Core', department: 'Languages', education_level: 'Upper Primary', applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'], status: 'Active' },
  { id: 'sb_up_comp', subject_name: 'English Composition', subject_code: 'COMP', category: 'Core', department: 'Languages', education_level: 'Upper Primary', applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'], status: 'Active' },
  { id: 'sb_up_kis', subject_name: 'Kiswahili', subject_code: 'KIS', category: 'Core', department: 'Languages', education_level: 'Upper Primary', applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'], status: 'Active' },
  { id: 'sb_up_insha', subject_name: 'Kiswahili Insha', subject_code: 'INSHA', category: 'Core', department: 'Languages', education_level: 'Upper Primary', applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'], status: 'Active' },
  { id: 'sb_up_mat', subject_name: 'Mathematics', subject_code: 'MATH', category: 'Core', department: 'STEM', education_level: 'Upper Primary', applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'], status: 'Active' },
  { id: 'sb_sci', subject_name: 'Integrated Science', subject_code: 'INT-SCI', category: 'Core', department: 'STEM', education_level: 'Grade 4–9', applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'], status: 'Active' },
  { id: 'sb_up_cas', subject_name: 'Creative Arts and Sports', subject_code: 'CAS', category: 'Core', department: 'Technical & Arts', education_level: 'Upper Primary', applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'], status: 'Active' },
  { id: 'sb_up_ss_cre', subject_name: 'Social Studies&CRE', subject_code: 'SS&CRE', category: 'Core', department: 'Humanities', education_level: 'Upper Primary', applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6'], status: 'Active' },

  // --- JUNIOR SCHOOL (Grade 7 - 9) & CROSS-PHASE (Grade 4 - 9) ---
  { id: 'sb_eng', subject_name: 'English', subject_code: 'ENG', category: 'Core', department: 'Languages', education_level: 'Junior School', applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'], status: 'Active' },
  { id: 'sb_kis', subject_name: 'Kiswahili', subject_code: 'KIS', category: 'Core', department: 'Languages', education_level: 'Junior School', applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'], status: 'Active' },
  { id: 'sb_mat', subject_name: 'Mathematics', subject_code: 'MATH', category: 'Core', department: 'STEM', education_level: 'Junior School', applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'], status: 'Active' },
  { id: 'sb_cas', subject_name: 'Creative Arts and Sports', subject_code: 'CAS', category: 'Core', department: 'Technical & Arts', education_level: 'Junior School', applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'], status: 'Active' },
  { id: 'sb_sst', subject_name: 'Social Studies', subject_code: 'SST', category: 'Core', department: 'Humanities', education_level: 'Grade 4–9', applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'], status: 'Active' },
  { id: 'sb_cre', subject_name: 'Christian Religious Education', subject_code: 'CRE', category: 'Core', department: 'Humanities', education_level: 'Grade 4–9', applicable_grades: ['Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'], status: 'Active' },
  { id: 'sb_agn', subject_name: 'Agriculture', subject_code: 'AGN', category: 'Core', department: 'Applied Sciences', education_level: 'Junior School', applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'], status: 'Active' },
  { id: 'sb_pts', subject_name: 'Pre-Technical Studies', subject_code: 'PRE-TECH', category: 'Core', department: 'Technical & Arts', education_level: 'Junior School', applicable_grades: ['Grade 7', 'Grade 8', 'Grade 9'], status: 'Active' },
];

export function isStandardSubject(sb: Subject | string | null | undefined): boolean {
  if (!sb) return false;
  const idStr = typeof sb === 'string' ? sb : sb.id;
  const codeStr = (typeof sb === 'string' ? '' : sb.subject_code || '').toUpperCase().trim();
  const nameStr = (typeof sb === 'string' ? '' : sb.subject_name || '').toLowerCase().trim();

  if (typeof sb !== 'string') {
    if ((sb as any).is_system === true || (sb as any).is_custom === false) {
      return true;
    }
  }

  return initialSubjects.some((isb) => {
    if (isb.id === idStr) return true;
    if (codeStr && isb.subject_code.toUpperCase().trim() === codeStr) return true;
    if (nameStr && isb.subject_name.toLowerCase().trim() === nameStr) return true;
    return false;
  });
}

export const initialClasses: ClassStream[] = [
  // Pre-Primary
  { id: 'cls_pp1_b', class_name: 'PP1', stream: 'Blue', capacity: 30, education_level: 'Pre-Primary', status: 'Active', allocated_subject_ids: ['sb_pp_lang', 'sb_pp_math', 'sb_pp_env', 'sb_pp_psy', 'sb_pp_re'] },
  { id: 'cls_pp2_b', class_name: 'PP2', stream: 'Blue', capacity: 30, education_level: 'Pre-Primary', status: 'Active', allocated_subject_ids: ['sb_pp_lang', 'sb_pp_math', 'sb_pp_env', 'sb_pp_psy', 'sb_pp_re'] },
  
  // Lower Primary
  { id: 'cls_g1_b', class_name: 'Grade 1', stream: 'Blue', capacity: 35, education_level: 'Lower Primary', status: 'Active', allocated_subject_ids: ['sb_lp_eng', 'sb_lp_kis', 'sb_lp_ila'] },
  { id: 'cls_g2_b', class_name: 'Grade 2', stream: 'Blue', capacity: 35, education_level: 'Lower Primary', status: 'Active', allocated_subject_ids: ['sb_lp_eng', 'sb_lp_kis', 'sb_lp_ila'] },
  { id: 'cls_g3_b', class_name: 'Grade 3', stream: 'Blue', capacity: 35, education_level: 'Lower Primary', status: 'Active', allocated_subject_ids: ['sb_lp_eng', 'sb_lp_kis', 'sb_lp_ila'] },
  
  // Upper Primary
  { id: 'cls_g4_b', class_name: 'Grade 4', stream: 'Blue', capacity: 40, education_level: 'Upper Primary', status: 'Active', allocated_subject_ids: ['sb_up_eng', 'sb_up_comp', 'sb_up_kis', 'sb_up_insha', 'sb_up_mat', 'sb_sci', 'sb_up_cas', 'sb_up_ss_cre'] },
  { id: 'cls_g5_b', class_name: 'Grade 5', stream: 'Blue', capacity: 40, education_level: 'Upper Primary', status: 'Active', allocated_subject_ids: ['sb_up_eng', 'sb_up_comp', 'sb_up_kis', 'sb_up_insha', 'sb_up_mat', 'sb_sci', 'sb_up_cas', 'sb_up_ss_cre'] },
  { id: 'cls_g5_r', class_name: 'Grade 5', stream: 'Red', capacity: 40, education_level: 'Upper Primary', status: 'Active', allocated_subject_ids: ['sb_up_eng', 'sb_up_comp', 'sb_up_kis', 'sb_up_insha', 'sb_up_mat', 'sb_sci', 'sb_up_cas', 'sb_up_ss_cre'] },
  { id: 'cls_g6_b', class_name: 'Grade 6', stream: 'Blue', capacity: 40, education_level: 'Upper Primary', status: 'Active', allocated_subject_ids: ['sb_up_eng', 'sb_up_comp', 'sb_up_kis', 'sb_up_insha', 'sb_up_mat', 'sb_sci', 'sb_up_cas', 'sb_up_ss_cre'] },

  // Junior School
  { id: 'cls_7e', class_name: 'Grade 7', stream: 'East', capacity: 45, class_teacher_id: 'tch_01', education_level: 'Junior School', status: 'Active', allocated_subject_ids: ['sb_eng', 'sb_kis', 'sb_mat', 'sb_sci', 'sb_cas', 'sb_sst', 'sb_cre', 'sb_agn', 'sb_pts'] },
  { id: 'cls_7w', class_name: 'Grade 7', stream: 'West', capacity: 45, education_level: 'Junior School', status: 'Active', allocated_subject_ids: ['sb_eng', 'sb_kis', 'sb_mat', 'sb_sci', 'sb_cas', 'sb_sst', 'sb_cre', 'sb_agn', 'sb_pts'] },
  { id: 'cls_8e', class_name: 'Grade 8', stream: 'East', capacity: 40, class_teacher_id: 'tch_02', education_level: 'Junior School', status: 'Active', allocated_subject_ids: ['sb_eng', 'sb_kis', 'sb_mat', 'sb_sci', 'sb_cas', 'sb_sst', 'sb_cre', 'sb_agn', 'sb_pts'] },
  { id: 'cls_8w', class_name: 'Grade 8', stream: 'West', capacity: 40, education_level: 'Junior School', status: 'Active', allocated_subject_ids: ['sb_eng', 'sb_kis', 'sb_mat', 'sb_sci', 'sb_cas', 'sb_sst', 'sb_cre', 'sb_agn', 'sb_pts'] },
  { id: 'cls_9a', class_name: 'Grade 9', stream: 'Alpha', capacity: 38, education_level: 'Junior School', status: 'Active', allocated_subject_ids: ['sb_eng', 'sb_kis', 'sb_mat', 'sb_sci', 'sb_cas', 'sb_sst', 'sb_cre', 'sb_agn', 'sb_pts'] },
];

export const initialTeachers: Teacher[] = [
  {
    id: 'tch_01',
    user_id: 'usr_tch_01',
    teacher_name: 'Madam Grace Wanjiku',
    username: 'gwanjiku',
    status: 'Active',
    phone: '+254 722 111 222',
    email: 'grace.wanjiku@school.ac.ke',
    is_class_teacher: true,
    class_teacher_of_id: 'cls_7e',
    allocations: [
      { id: 'alloc_01', education_level: 'Junior School', class_id: 'cls_7e', subject_id: 'sb_eng' },
      { id: 'alloc_02', education_level: 'Junior School', class_id: 'cls_7w', subject_id: 'sb_cas' },
    ],
  },
  {
    id: 'tch_02',
    user_id: 'usr_tch_02',
    teacher_name: 'Mr. David Otieno',
    username: 'dotieno',
    status: 'Active',
    phone: '+254 733 333 444',
    email: 'david.otieno@school.ac.ke',
    is_class_teacher: true,
    class_teacher_of_id: 'cls_8e',
    allocations: [
      { id: 'alloc_03', education_level: 'Junior School', class_id: 'cls_8e', subject_id: 'sb_mat' },
      { id: 'alloc_04', education_level: 'Junior School', class_id: 'cls_8w', subject_id: 'sb_pts' },
    ],
  },
  {
    id: 'tch_03',
    user_id: 'usr_tch_03',
    teacher_name: 'Madam Faith Kiprop',
    username: 'fkiprop',
    status: 'Active',
    phone: '+254 711 555 666',
    email: 'faith.kiprop@school.ac.ke',
    is_class_teacher: false,
    allocations: [
      { id: 'alloc_05', education_level: 'Junior School', class_id: 'cls_7e', subject_id: 'sb_sci' },
      { id: 'alloc_06', education_level: 'Junior School', class_id: 'cls_9a', subject_id: 'sb_agn' },
    ],
  },
];

export const initialUsers: User[] = [
  {
    id: 'usr_admin',
    name: 'Administrator',
    email: 'admin@cbe.ac.ke',
    role: 'admin',
  },
  {
    id: 'usr_tch_01',
    name: 'Madam Grace Wanjiku (Class Teacher)',
    email: 'grace@cbe.ac.ke',
    role: 'class_teacher',
    teacher_id: 'tch_01',
  },
  {
    id: 'usr_tch_02',
    name: 'Mr. David Otieno (Subject Teacher)',
    email: 'david@cbe.ac.ke',
    role: 'subject_teacher',
    teacher_id: 'tch_02',
  },
];

export const initialStudents: Student[] = [];

export const initialExaminations: Examination[] = [
  {
    id: 'ex_01',
    exam_name: 'CAT 1 - Term 1 2026',
    term: 'Term 1',
    year: 2026,
    status: 'Approved',
    exam_type: 'CAT',
    max_marks: 100,
    start_date: '2026-02-10',
    end_date: '2026-02-14',
  },
  {
    id: 'ex_02',
    exam_name: 'MID-TERM EXAM - Term 1 2026',
    term: 'Term 1',
    year: 2026,
    status: 'Provisional',
    exam_type: 'Mid-Term',
    max_marks: 100,
    start_date: '2026-03-15',
    end_date: '2026-03-20',
  },
  {
    id: 'ex_03',
    exam_name: 'END OF TERM 1 2026 EXAMINATION',
    term: 'Term 1',
    year: 2026,
    status: 'Draft',
    exam_type: 'End-Term',
    max_marks: 100,
    start_date: '2026-04-01',
    end_date: '2026-04-10',
  },
];

export const initialMarks: Mark[] = [];
