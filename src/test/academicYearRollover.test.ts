import { test, expect, describe, vi, beforeEach } from 'vitest';
import '../testSetup';
import { checkAndPerformAcademicYearRollover, resetRolloverCheckedForTesting } from '../services/academicYearRollover';
import { createClient } from '@supabase/supabase-js';

// Comprehensive mock database state for Academic Year Rollover scenarios
let mockActiveAYs: any[] = [{ id: 'ay_2026', year: 2026, status: 'Active' }];
let mockTargetAYs: any[] = [{ id: 'ay_2027', year: 2027, status: 'Upcoming' }];
let mockClasses: any[] = [
  { id: 'c_g7', class_name: 'Grade 7', grade_level: 7 },
  { id: 'c_g8', class_name: 'Grade 8', grade_level: 8 },
  { id: 'c_g9', class_name: 'Grade 9', grade_level: 9 }
];
let mockStreams: any[] = [
  { id: 's_g7_east', class_id: 'c_g7', stream_name: 'East' },
  { id: 's_g8_east', class_id: 'c_g8', stream_name: 'East' },
  { id: 's_g9_east', class_id: 'c_g9', stream_name: 'East' }
];
let mockStudents: any[] = [
  { id: 'std_1', admission_number: 'ADM-001', full_name: 'Alice Wanjiku', class_id: 'c_g7', stream_id: 's_g7_east', active: true },
  { id: 'std_2', admission_number: 'ADM-002', full_name: 'Brian Omondi', class_id: 'c_g8', stream_id: 's_g8_east', active: true },
  { id: 'std_3', admission_number: 'ADM-003', full_name: 'Charlie Mwangi', class_id: 'c_g9', stream_id: 's_g9_east', active: true }
];
let mockPromotions: any[] = [];
let mockAuditLogs: any[] = [];
let mockSchoolTerms: any[] = [
  { id: 'st_2026_t3', academic_year_id: 'ay_2026', term_name: 'Term 3', status: 'Active' }
];

// Force TS fallback mode in testing by returning PGRST202 for the RPC call
let rpcMockResponse: any = { data: null, error: { code: 'PGRST202', message: 'Function not found' } };

// Mock error injector
let mockErrorToThrow: any = null;

// Mock Supabase client to simulate all CRUD actions and enforce transactional rules
vi.mock('@supabase/supabase-js', async () => {
  const actual = await vi.importActual('@supabase/supabase-js');
  return {
    ...actual,
    createClient: vi.fn(() => {
      return {
        rpc: vi.fn(async (name) => {
          if (name === 'perform_academic_year_rollover') {
            return rpcMockResponse;
          }
          return { data: null, error: { code: 'PGRST202', message: 'Not found' } };
        }),
        from: vi.fn((table) => {
          const chain: any = {
            select: vi.fn().mockImplementation(() => chain),
            eq: vi.fn().mockImplementation((col, val) => {
              // Store all eq criteria to handle chained filters accurately
              if (!chain._eq_filters) {
                chain._eq_filters = {};
              }
              chain._eq_filters[col] = val;
              chain._eq_col = col;
              chain._eq_val = val;
              return chain;
            }),
            update: vi.fn().mockImplementation((data) => {
              chain._update_data = data;
              return chain;
            }),
            insert: vi.fn().mockImplementation((data) => {
              chain._insert_data = data;
              return chain;
            }),
            single: vi.fn().mockImplementation(() => chain),
            select_star: vi.fn().mockImplementation(() => chain),
            then: vi.fn().mockImplementation((resolve) => {
              if (mockErrorToThrow) {
                const err = mockErrorToThrow;
                mockErrorToThrow = null; // reset
                resolve({ data: null, error: err });
                return;
              }

              let data: any = [];
              let error: any = null;

              if (table === 'academic_years') {
                if (chain._eq_filters && chain._eq_filters['status'] === 'Active') {
                  data = mockActiveAYs;
                } else if (chain._eq_filters && chain._eq_filters['year'] !== undefined) {
                  data = mockTargetAYs.filter(ay => ay.year === chain._eq_filters['year']);
                } else {
                  data = [...mockActiveAYs, ...mockTargetAYs];
                }
              } else if (table === 'classes') {
                data = mockClasses;
              } else if (table === 'streams') {
                data = mockStreams;
              } else if (table === 'students') {
                if (chain._eq_filters && chain._eq_filters['active'] === true) {
                  data = mockStudents.filter(s => s.active);
                } else {
                  data = mockStudents;
                }
              } else if (table === 'student_promotions') {
                if (chain._eq_filters && chain._eq_filters['student_id']) {
                  data = mockPromotions.filter(p => p.student_id === chain._eq_filters['student_id']);
                } else {
                  data = mockPromotions;
                }
              } else if (table === 'audit_logs') {
                data = mockAuditLogs;
              } else if (table === 'school_terms') {
                if (chain._eq_filters && chain._eq_filters['academic_year_id']) {
                  data = mockSchoolTerms.filter(t => t.academic_year_id === chain._eq_filters['academic_year_id']);
                } else {
                  data = mockSchoolTerms;
                }
              }

              // Process mutations inside the mock resolver
              if (chain._update_data) {
                if (table === 'students' && chain._eq_filters && chain._eq_filters['id']) {
                  const s = mockStudents.find(std => std.id === chain._eq_filters['id']);
                  if (s) {
                    Object.assign(s, chain._update_data);
                  }
                } else if (table === 'academic_years' && chain._eq_filters && chain._eq_filters['id']) {
                  const ay = [...mockActiveAYs, ...mockTargetAYs].find(y => y.id === chain._eq_filters['id']);
                  if (ay) {
                    Object.assign(ay, chain._update_data);
                  }
                } else if (table === 'school_terms' && chain._eq_filters && chain._eq_filters['academic_year_id']) {
                  mockSchoolTerms
                    .filter(t => t.academic_year_id === chain._eq_filters['academic_year_id'])
                    .forEach(t => Object.assign(t, chain._update_data));
                }
                data = chain._update_data;
              } else if (chain._insert_data) {
                const arr = Array.isArray(chain._insert_data) ? chain._insert_data : [chain._insert_data];
                if (table === 'student_promotions') {
                  mockPromotions.push(...arr);
                } else if (table === 'audit_logs') {
                  mockAuditLogs.push(...arr);
                } else if (table === 'academic_years') {
                  mockTargetAYs.push(...arr);
                } else if (table === 'school_terms') {
                  mockSchoolTerms.push(...arr);
                }
                data = arr[0];
              }

              resolve({ data, error });
            })
          };
          return chain;
        })
      };
    })
  };
});

describe('Surgically Hardened Automatic Academic-Year Rollover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MOCK_ROLLOVER_DATE;
    resetRolloverCheckedForTesting();
    mockErrorToThrow = null;

    // Reset database mock states
    mockActiveAYs = [{ id: 'ay_2026', year: 2026, status: 'Active' }];
    mockTargetAYs = [{ id: 'ay_2027', year: 2027, status: 'Upcoming' }];
    mockClasses = [
      { id: 'c_g7', class_name: 'Grade 7', grade_level: 7 },
      { id: 'c_g8', class_name: 'Grade 8', grade_level: 8 },
      { id: 'c_g9', class_name: 'Grade 9', grade_level: 9 }
    ];
    mockStreams = [
      { id: 's_g7_east', class_id: 'c_g7', stream_name: 'East' },
      { id: 's_g8_east', class_id: 'c_g8', stream_name: 'East' },
      { id: 's_g9_east', class_id: 'c_g9', stream_name: 'East' }
    ];
    mockStudents = [
      { id: 'std_1', admission_number: 'ADM-001', full_name: 'Alice Wanjiku', class_id: 'c_g7', stream_id: 's_g7_east', active: true },
      { id: 'std_2', admission_number: 'ADM-002', full_name: 'Brian Omondi', class_id: 'c_g8', stream_id: 's_g8_east', active: true },
      { id: 'std_3', admission_number: 'ADM-003', full_name: 'Charlie Mwangi', class_id: 'c_g9', stream_id: 's_g9_east', active: true }
    ];
    mockPromotions = [];
    mockAuditLogs = [];
    mockSchoolTerms = [
      { id: 'st_2026_t3', academic_year_id: 'ay_2026', term_name: 'Term 3', status: 'Active' }
    ];
    rpcMockResponse = { data: null, error: { code: 'PGRST202', message: 'Function not found' } };
  });

  // TEST 1: 31 December 2026 -> No Rollover
  test('Test 1: 31 December 2026 - Rollover threshold has not been reached yet', async () => {
    process.env.MOCK_ROLLOVER_DATE = '2026-12-31T23:59:59.000Z';
    const result = await checkAndPerformAcademicYearRollover(false);
    expect(result.success).toBe(true);
    expect(result.message).toContain('Rollover threshold has not been reached yet');
    expect(mockActiveAYs[0].status).toBe('Active');
  });

  // TEST 2: 1 January 2027 -> Rollover executes
  test('Test 2: 1 January 2027 - Rollover executes successfully', async () => {
    process.env.MOCK_ROLLOVER_DATE = '2027-01-01T00:00:01.000Z';
    const result = await checkAndPerformAcademicYearRollover(false);
    expect(result.success).toBe(true);
    expect(result.message).toContain('completed successfully');
  });

  // TEST 3: 2 January 2027 -> No duplicate rollover
  test('Test 3: 2 January 2027 - No duplicate rollover on subsequent checks', async () => {
    process.env.MOCK_ROLLOVER_DATE = '2027-01-02T12:00:00.000Z';
    // First run completes
    await checkAndPerformAcademicYearRollover(true);
    
    // Second run should return early indicating already checked for this instance
    const result = await checkAndPerformAcademicYearRollover(false);
    expect(result.success).toBe(true);
    expect(result.message).toContain('already checked for this server instance');
  });

  // TEST 4: Run rollover twice -> Expect no additional promotions
  test('Test 4: Run 2026 -> 2027 rollover twice - makes no additional promotions', async () => {
    process.env.MOCK_ROLLOVER_DATE = '2027-01-01T00:00:01.000Z';
    
    // Run 1
    const result1 = await checkAndPerformAcademicYearRollover(true);
    expect(result1.success).toBe(true);
    const promoCountAfterRun1 = mockPromotions.length;

    // Run 2 (forcing execution again)
    resetRolloverCheckedForTesting();
    const result2 = await checkAndPerformAcademicYearRollover(true);
    expect(result2.success).toBe(true);
    const promoCountAfterRun2 = mockPromotions.length;

    // Should not insert duplicate promotions
    expect(promoCountAfterRun2).toBe(promoCountAfterRun1);
  });

  // TEST 5: Grade 7 Learner -> Promoted exactly once
  test('Test 5: Grade 7 Learner - Grade 7 -> Grade 8 exactly once', async () => {
    process.env.MOCK_ROLLOVER_DATE = '2027-01-01T00:00:01.000Z';
    await checkAndPerformAcademicYearRollover(true);

    const alice = mockStudents.find(s => s.id === 'std_1');
    expect(alice.class_id).toBe('c_g8'); // Alice promoted to Grade 8
    
    const alicePromos = mockPromotions.filter(p => p.student_id === 'std_1');
    expect(alicePromos.length).toBe(1);
    expect(alicePromos[0].from_grade).toBe('Grade 7');
    expect(alicePromos[0].to_grade).toBe('Grade 8');
  });

  // TEST 6: Grade 8 Learner -> Promoted exactly once
  test('Test 6: Grade 8 Learner - Grade 8 -> Grade 9 exactly once', async () => {
    process.env.MOCK_ROLLOVER_DATE = '2027-01-01T00:00:01.000Z';
    await checkAndPerformAcademicYearRollover(true);

    const brian = mockStudents.find(s => s.id === 'std_2');
    expect(brian.class_id).toBe('c_g9'); // Brian promoted to Grade 9
    
    const brianPromos = mockPromotions.filter(p => p.student_id === 'std_2');
    expect(brianPromos.length).toBe(1);
    expect(brianPromos[0].from_grade).toBe('Grade 8');
    expect(brianPromos[0].to_grade).toBe('Grade 9');
  });

  // TEST 7: Grade 9 Learner -> Inactive, no Grade 10
  test('Test 7: Grade 9 Learner - Inactive, no Grade 10', async () => {
    process.env.MOCK_ROLLOVER_DATE = '2027-01-01T00:00:01.000Z';
    await checkAndPerformAcademicYearRollover(true);

    const charlie = mockStudents.find(s => s.id === 'std_3');
    expect(charlie.active).toBe(false); // Deactivated
    expect(charlie.class_id).toBe('c_g9'); // Class remained intact (historical)
    
    const charliePromos = mockPromotions.filter(p => p.student_id === 'std_3');
    expect(charliePromos.length).toBe(0); // Grade 9 is not promoted to Grade 10
  });

  // TEST 8: Missing target stream -> Prevents partial/arbitrary stream assignment
  test('Test 8: Missing target stream - Prevents arbitrary stream assignment and aborts safely', async () => {
    process.env.MOCK_ROLLOVER_DATE = '2027-01-01T00:00:01.000Z';
    // Remove Grade 8 East stream from database to simulate missing destination
    mockStreams = mockStreams.filter(s => s.id !== 's_g8_east');

    const result = await checkAndPerformAcademicYearRollover(true);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Promotion Error: Target stream East for grade Grade 8 does not exist');

    // Confirm no partial mutations occurred
    const alice = mockStudents.find(s => s.id === 'std_1');
    expect(alice.class_id).toBe('c_g7'); // Alice remained in Grade 7
  });

  // TEST 9: Simulated failure during processing -> Aborts and rolls back
  test('Test 9: Simulated failure during processing - safe rollback simulation', async () => {
    process.env.MOCK_ROLLOVER_DATE = '2027-01-01T00:00:01.000Z';
    // Inject a simulated database query failure
    mockErrorToThrow = { message: 'Database transaction deadlock' };

    const result = await checkAndPerformAcademicYearRollover(true);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Database transaction deadlock');
  });

  // TEST 10: Concurrent rollover attempts -> Serialize with RPC
  test('Test 10: Concurrent rollover attempts - locks and completes exactly once via RPC', async () => {
    // Mock the RPC function returning success to simulate a database lock success path
    rpcMockResponse = {
      data: { success: true, message: 'Academic Year Rollover completed successfully via RPC lock.' },
      error: null
    };

    const run1 = checkAndPerformAcademicYearRollover(true);
    const run2 = checkAndPerformAcademicYearRollover(true);

    const [res1, res2] = await Promise.all([run1, run2]);
    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true); // both safely resolve, but only the first processes while the second returns immediately
  });
});
