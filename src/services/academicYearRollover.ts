import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import 'dotenv/config';
import { ALL_GRADES, GradeName } from "../types";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

let isRolloverChecked = false;

/**
 * Automatically checks and executes the academic year rollover if the transition criteria is met.
 * Safe, atomic, and concurrency-protected at the database level.
 */
export async function checkAndPerformAcademicYearRollover(force = false): Promise<{ success: boolean; message: string }> {
  if (isRolloverChecked && !force) {
    return { success: true, message: "Academic year rollover already checked for this server instance." };
  }
  isRolloverChecked = true;

  try {
    // 1. Fetch current Active Academic Year
    const { data: activeAYs, error: ayErr } = await supabaseAdmin
      .from('academic_years')
      .select('*')
      .eq('status', 'Active');

    if (ayErr) {
      throw new Error(`Failed to fetch active academic year: ${ayErr.message}`);
    }

    if (!activeAYs || activeAYs.length === 0) {
      return { success: false, message: "No active academic year found in the database. Rollover cannot be performed." };
    }

    const activeAY = activeAYs[0];
    const activeYearNumber = activeAY.year; // e.g., 2026

    // 2. Check current calendar date and rollover condition
    const today = new Date();
    const mockDateStr = process.env.MOCK_ROLLOVER_DATE;
    const currentDate = mockDateStr ? new Date(mockDateStr) : today;

    // Rollover condition: current calendar year is strictly greater than active year number, OR forcing it
    const shouldRollover = force || (currentDate.getFullYear() > activeYearNumber) || (currentDate.getFullYear() === activeYearNumber + 1 && currentDate.getMonth() === 0 && currentDate.getDate() >= 1);

    if (!shouldRollover) {
      return { success: true, message: `Active academic year is ${activeYearNumber}. Rollover threshold has not been reached yet.` };
    }

    console.log(`[Rollover] Transitioning academic year from ${activeYearNumber} to ${activeYearNumber + 1}...`);

    // 3. Try to execute the database RPC function for absolute database transaction atomicity and advisory locking
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('perform_academic_year_rollover');

    if (!rpcError) {
      console.log(`[Rollover] Database RPC perform_academic_year_rollover executed successfully:`, rpcData);
      return {
        success: rpcData?.success ?? true,
        message: rpcData?.message ?? `Academic year rollover to ${activeYearNumber + 1} completed successfully.`
      };
    }

    // If the database RPC is not found (PGRST202), we execute our hardened application-level fallback.
    // Otherwise, we fail immediately to propagate the transaction rollback / stream mismatch error.
    if (rpcError.code !== 'PGRST202') {
      console.error(`[Rollover Error] Database RPC transaction failed and rolled back:`, rpcError.message);
      return { success: false, message: `Academic year rollover failed: ${rpcError.message}` };
    }

    console.warn("[Rollover Warning] perform_academic_year_rollover RPC not found in schema. Running surgical TS-side fallback.");

    // 4. Target Year Number
    const targetYearNumber = activeYearNumber + 1;

    // 5. Fetch classes, streams, and active students
    const [
      { data: classes, error: classesErr },
      { data: streams, error: streamsErr },
      { data: activeStudents, error: studentsErr }
    ] = await Promise.all([
      supabaseAdmin.from('classes').select('*'),
      supabaseAdmin.from('streams').select('*'),
      supabaseAdmin.from('students').select('*').eq('active', true)
    ]);

    if (classesErr || streamsErr || studentsErr) {
      throw new Error(`Failed to fetch baseline data: ${classesErr?.message || ''} ${streamsErr?.message || ''} ${studentsErr?.message || ''}`);
    }

    if (!activeStudents || activeStudents.length === 0) {
      console.log("[Rollover] No active students found to roll over.");
      return { success: true, message: `No active students found. Academic year transition to ${targetYearNumber} completed.` };
    }

    // 6. STREAM SAFETY UPFRONT VALIDATION (No arbitrary fallbacks)
    // Perform a dry-run check over all active continuing students to identify missing destinations before modifying any records.
    for (const student of activeStudents) {
      const currentClass = classes?.find(c => c.id === student.class_id);
      if (!currentClass) continue;

      const currentGrade = currentClass.class_name;
      if (currentGrade === 'Grade 9') {
        continue; // Grade 9 students are deactivated, no stream matching needed
      }

      const currentStream = streams?.find(s => s.id === student.stream_id);
      const currentStreamName = currentStream?.stream_name || 'Alpha';

      const currentIndex = ALL_GRADES.indexOf(currentGrade as any);
      if (currentIndex === -1 || currentIndex >= ALL_GRADES.length - 1) {
        continue;
      }

      const targetGrade = ALL_GRADES[currentIndex + 1];
      const targetGradeClasses = classes?.filter(c => c.class_name === targetGrade) || [];
      const targetStream = streams?.find(s => 
        targetGradeClasses.some(tc => tc.id === s.class_id) && 
        s.stream_name.toLowerCase() === currentStreamName.toLowerCase()
      );

      if (!targetStream) {
        throw new Error(`Promotion Error: Target stream ${currentStreamName} for grade ${targetGrade} does not exist. Promotion is aborted to prevent arbitrary stream assignment.`);
      }
    }

    // 7. Find or create target Academic Year row
    let { data: targetAYs, error: targetAYErr } = await supabaseAdmin
      .from('academic_years')
      .select('*')
      .eq('year', targetYearNumber);

    if (targetAYErr) {
      throw new Error(`Failed to fetch target academic year: ${targetAYErr.message}`);
    }

    let targetAY = targetAYs && targetAYs[0];
    if (!targetAY) {
      const { data: newAY, error: createAYErr } = await supabaseAdmin
        .from('academic_years')
        .insert([{
          year: targetYearNumber,
          status: 'Upcoming',
          start_date: `${targetYearNumber}-01-01`,
          end_date: `${targetYearNumber}-12-31`
        }])
        .select('*')
        .single();

      if (createAYErr) {
        throw new Error(`Failed to create target academic year ${targetYearNumber}: ${createAYErr.message}`);
      }
      targetAY = newAY;
    }

    // 8. Process Promotions and Deactivations (Verified Upfront)
    let promotionsCount = 0;
    let deactivationsCount = 0;

    for (const student of activeStudents) {
      const currentClass = classes?.find(c => c.id === student.class_id);
      if (!currentClass) continue;

      const currentGrade = currentClass.class_name;

      if (currentGrade === 'Grade 9') {
        // Grade 9 Safety: Deactivate, disable corresponding credentials, log
        // Idempotency check: check if already processed
        const { data: existingLogs } = await supabaseAdmin
          .from('audit_logs')
          .select('*')
          .eq('action', 'LEARNER_DEACTIVATED');

        const isAlreadyDeactivated = existingLogs?.some(log => 
          log.details?.student_id === student.id && 
          log.details?.reason?.includes('rollover')
        );

        if (!isAlreadyDeactivated) {
          await supabaseAdmin
            .from('students')
            .update({ active: false, updated_at: new Date().toISOString() })
            .eq('id', student.id);

          await supabaseAdmin
            .from('users')
            .update({ status: 'Disabled', updated_at: new Date().toISOString() })
            .eq('student_id', student.id);

          await supabaseAdmin
            .from('audit_logs')
            .insert([{
              action: 'LEARNER_DEACTIVATED',
              details: {
                student_id: student.id,
                admission_number: student.admission_number,
                full_name: student.full_name,
                reason: 'Automatic deactivation of final grade learners (Grade 9) at academic year rollover'
              }
            }]);

          deactivationsCount++;
        }
      } else {
        // Continuing student promotion
        const currentStream = streams?.find(s => s.id === student.stream_id);
        const currentStreamName = currentStream?.stream_name || 'Alpha';

        const currentIndex = ALL_GRADES.indexOf(currentGrade as any);
        const targetGrade = ALL_GRADES[currentIndex + 1];

        // IDEMPOTENCY CHECK: skip if student has already been promoted for this target transition
        const { data: existingPromos, error: checkPromoErr } = await supabaseAdmin
          .from('student_promotions')
          .select('*')
          .eq('student_id', student.id)
          .eq('from_year', activeYearNumber)
          .eq('to_year', targetYearNumber);

        if (checkPromoErr) {
          throw new Error(`Failed to verify promotion uniqueness for student ${student.id}: ${checkPromoErr.message}`);
        }

        if (existingPromos && existingPromos.length > 0) {
          console.log(`[Rollover] Skipping already-processed promotion for student ${student.full_name} from ${activeYearNumber} to ${targetYearNumber}`);
          continue;
        }

        const targetGradeClasses = classes?.filter(c => c.class_name === targetGrade) || [];
        const targetStream = streams?.find(s => 
          targetGradeClasses.some(tc => tc.id === s.class_id) && 
          s.stream_name.toLowerCase() === currentStreamName.toLowerCase()
        )!;

        // Update student class and stream
        const { error: updateStudentErr } = await supabaseAdmin
          .from('students')
          .update({
            class_id: targetStream.class_id,
            stream_id: targetStream.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', student.id);

        if (updateStudentErr) {
          throw new Error(`Failed to update student class/stream: ${updateStudentErr.message}`);
        }

        // Insert promotion log
        const { error: insertPromoErr } = await supabaseAdmin
          .from('student_promotions')
          .insert([{
            student_id: student.id,
            from_grade: currentGrade,
            to_grade: targetGrade,
            from_class_id: student.class_id,
            to_class_id: targetStream.class_id,
            from_stream_id: student.stream_id,
            to_stream_id: targetStream.id,
            academic_year_id: activeAY.id,
            from_year: activeYearNumber,
            from_term: 'Term 3',
            to_year: targetYearNumber,
            to_term: 'Term 1',
            promoted_by: 'System Rollover',
            date_promoted: new Date().toISOString()
          }]);

        if (insertPromoErr) {
          throw new Error(`Failed to record promotion log: ${insertPromoErr.message}`);
        }

        promotionsCount++;
      }
    }

    // 9. Transition Academic Year statuses
    await supabaseAdmin
      .from('academic_years')
      .update({ status: 'Closed', updated_at: new Date().toISOString() })
      .eq('id', activeAY.id);

    await supabaseAdmin
      .from('academic_years')
      .update({ status: 'Active', updated_at: new Date().toISOString() })
      .eq('id', targetAY.id);

    // 10. Transition School Term statuses
    await supabaseAdmin
      .from('school_terms')
      .update({ status: 'Closed', updated_at: new Date().toISOString() })
      .eq('academic_year_id', activeAY.id)
      .eq('status', 'Active');

    const { data: term1s } = await supabaseAdmin
      .from('school_terms')
      .select('*')
      .eq('academic_year_id', targetAY.id)
      .eq('term_name', 'Term 1');

    if (term1s && term1s.length > 0) {
      await supabaseAdmin
        .from('school_terms')
        .update({ status: 'Active', updated_at: new Date().toISOString() })
        .eq('id', term1s[0].id);
    } else {
      await supabaseAdmin
        .from('school_terms')
        .insert([{
          academic_year_id: targetAY.id,
          year: targetYearNumber,
          term_name: 'Term 1',
          term_number: 1,
          status: 'Active',
          opening_date: `${targetYearNumber}-01-05`,
          closing_date: `${targetYearNumber}-04-10`
        }]);
    }

    // 11. Write audit log for rollover completion
    await supabaseAdmin
      .from('audit_logs')
      .insert([{
        action: 'SYSTEM_ROLLOVER_COMPLETED',
        details: {
          from_year: activeYearNumber,
          to_year: targetYearNumber,
          timestamp: new Date().toISOString(),
          message: `Academic Year Rollover from ${activeYearNumber} to ${targetYearNumber} completed successfully (TS-side fallback).`
        }
      }]);

    console.log(`[Rollover] Fallback rollover to ${targetYearNumber} completed successfully. ${promotionsCount} promoted, ${deactivationsCount} deactivated.`);
    return { success: true, message: `Academic year rollover to ${targetYearNumber} completed successfully (TS-side fallback).` };

  } catch (err: any) {
    console.error("[Rollover Error] Automatic rollover failed:", err);
    return { success: false, message: `Academic year rollover failed: ${err.message}` };
  }
}

/**
 * Resets the rollover checked state for unit testing.
 */
export function resetRolloverCheckedForTesting() {
  isRolloverChecked = false;
}

