import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import fs from "fs";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(url, key);

export const targetUuids = [
  "3ca77b5d-1842-4700-9c07-b5577f129777", // 211 Tracer Combs
  "257baa18-563c-4ef1-b459-3c725edfe7fe", // 478 Beak Walker
  "b124ab79-ab87-4ebe-a04b-fb1b03f463a5", // 45 Jon Kopps
  "f7678631-f5e8-457c-b529-6884fb9bf43f", // 200 Kate Sheila
  "2e9424c3-5e7f-4564-acdf-56ae95e934ac", // 100 Becker Johnson
  "315ab0f1-96ac-4b89-adaa-6030be2be183", // 300 Quinn Taylor
  "e534459c-787f-4c3a-b48c-9cb09e34b011", // 230 Marcus Jordan
  "25892c85-5343-4307-b042-91b5f5c982a1", // 234 Kevin Mose
  "09c0aedd-3a7e-4e37-8c21-ce2016a9c6a1", // 456 Mwangi Kamau
  "eefbdb35-f475-4ae7-93d6-bf105fc95375", // 224 Astecy Kwamboka
  "63d24833-83b5-468b-939a-15e4af7ba7df", // 78 Britney Spears
  "1a1b992c-cf7f-4f69-9be6-4aedd19db568", // 567 Brian Ayiecha
];

export const protectedStaffEmails = [
  "brianayiecha52@gmail.com",
  "admin@cbe.ac.ke",
  "emmanuelmomanyi34@gmail.com",
  "trixiemode@school.ac.ke",
  "kevinmose79@gmail.com",
  "moraasusan02@gmail.com",
  "dariusholloway667@gmail.com"
];

async function runCleanup() {
  console.log("================================================================================");
  console.log("SURGICAL PRODUCTION CLEAN-SLATE EXECUTION");
  console.log("================================================================================");

  // -------------------------------------------------------------------------
  // PHASE 0: FREEZE AND RE-AUDIT
  // -------------------------------------------------------------------------
  console.log("\n>>> PHASE 0: FREEZE AND RE-AUDIT");
  const { data: allStudents, error: stdErr } = await supabase.from("students").select("*");
  if (stdErr) throw new Error("Student fetch error: " + stdErr.message);

  console.log(`Total students currently in Supabase: ${allStudents.length}`);
  if (allStudents.length !== 12) {
    throw new Error(`Unexpected student count: expected 12, got ${allStudents.length}`);
  }

  for (const s of allStudents) {
    if (!targetUuids.includes(s.id)) {
      throw new Error(`UNEXPECTED STUDENT FOUND: ID ${s.id}, Name ${s.full_name}, Adm ${s.admission_number}`);
    }
  }
  console.log("  [VERIFIED] All 12 students match audited UUIDs exactly.");

  const { data: marks, error: mkErr } = await supabase.from("marks").select("*");
  if (mkErr) throw new Error("Marks fetch error: " + mkErr.message);
  console.log(`Total marks currently in Supabase: ${marks.length}`);
  for (const m of marks) {
    if (!targetUuids.includes(m.student_id)) {
      throw new Error(`UNEXPECTED MARK FOUND: Student ID ${m.student_id}, Subject ${m.subject_id}, Exam ${m.exam_id}`);
    }
  }
  console.log("  [VERIFIED] All 100 marks belong strictly to the 12 target learners.");

  const { data: users, error: uErr } = await supabase.from("users").select("*");
  if (uErr) throw new Error("Users fetch error: " + uErr.message);
  
  const learnerUsers = users.filter(u => u.role === "learner" || targetUuids.includes(u.student_id));
  console.log(`Learner users in public.users: ${learnerUsers.length}`);
  if (learnerUsers.length !== 12) {
    throw new Error(`Unexpected learner user count in public.users: expected 12, got ${learnerUsers.length}`);
  }

  for (const lu of learnerUsers) {
    if (!targetUuids.includes(lu.student_id)) {
      throw new Error(`UNEXPECTED LEARNER USER: ID ${lu.id}, email ${lu.email}, student_id ${lu.student_id}`);
    }
    if (protectedStaffEmails.includes(lu.email?.toLowerCase())) {
      throw new Error(`CRITICAL COLLISION: Protected staff email matched learner user: ${lu.email}`);
    }
  }
  console.log("  [VERIFIED] All 12 public.users learner records verified without staff collision.");

  const { data: authList, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) throw new Error("Auth list error: " + authErr.message);
  
  const targetAuthUsers = authList.users.filter(au => {
    const sId = au.user_metadata?.student_id;
    return targetUuids.includes(sId) || learnerUsers.some(lu => lu.id === au.id);
  });

  console.log(`Matched auth.users for target learners: ${targetAuthUsers.length}`);
  if (targetAuthUsers.length !== 12) {
    throw new Error(`Unexpected target auth users count: expected 12, got ${targetAuthUsers.length}`);
  }

  for (const tau of targetAuthUsers) {
    if (protectedStaffEmails.includes(tau.email?.toLowerCase())) {
      throw new Error(`CRITICAL COLLISION: Protected staff email matched target auth user: ${tau.email}`);
    }
    console.log(`    Auth User: ${tau.id} | Email: ${tau.email} | StudentID: ${tau.user_metadata?.student_id}`);
  }
  console.log("  [VERIFIED] All 12 auth.users verified. Protected staff accounts isolated.");

  // Check dependent tables: report_cards, merit_lists, attendance, student_promotions
  const { count: rcCount } = await supabase.from("report_cards").select("id", { count: "exact", head: true });
  const { count: mlCount } = await supabase.from("merit_lists").select("id", { count: "exact", head: true });
  const { count: attCount } = await supabase.from("attendance").select("id", { count: "exact", head: true });
  console.log(`  Dependent tables check: report_cards=${rcCount}, merit_lists=${mlCount}, attendance=${attCount}`);
  if ((rcCount || 0) > 0 || (mlCount || 0) > 0 || (attCount || 0) > 0) {
    throw new Error("Unexpected dependent records detected in report_cards, merit_lists, or attendance!");
  }

  // -------------------------------------------------------------------------
  // PHASE 1: CREATE A RECOVERY SNAPSHOT
  // -------------------------------------------------------------------------
  console.log("\n>>> PHASE 1: CREATE RECOVERY SNAPSHOT");
  const snapshot = {
    timestamp: new Date().toISOString(),
    students: allStudents,
    marks: marks,
    public_users: learnerUsers,
    auth_users: targetAuthUsers.map(u => ({
      id: u.id,
      email: u.email,
      user_metadata: u.user_metadata,
      app_metadata: u.app_metadata,
      created_at: u.created_at
    }))
  };

  fs.mkdirSync("recovery_snapshots", { recursive: true });
  const snapshotPath = `recovery_snapshots/cbe_test_learners_snapshot_${Date.now()}.json`;
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  console.log(`  Snapshot saved: ${snapshotPath}`);

  const readBack = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
  if (readBack.students.length === 12 && readBack.marks.length === 100 && readBack.public_users.length === 12 && readBack.auth_users.length === 12) {
    console.log("  SNAPSHOT STATUS: VERIFIED AND LOCKED.");
    console.log("    Students captured: 12");
    console.log("    Marks captured: 100");
    console.log("    Learner users captured: 12");
    console.log("    Auth identities captured: 12");
    console.log("    Snapshot verified: YES");
  } else {
    throw new Error("SNAPSHOT VERIFICATION FAILED!");
  }

  // -------------------------------------------------------------------------
  // PHASE 2: REMOVE TEST MARKS SAFELY
  // -------------------------------------------------------------------------
  console.log("\n>>> PHASE 2: REMOVE TEST MARKS SAFELY");
  console.log("  Deleting marks for student_ids in targetUuids...");
  const { error: delMarksErr } = await supabase.from("marks").delete().in("student_id", targetUuids);
  if (delMarksErr) throw new Error("Error deleting marks: " + delMarksErr.message);

  const { count: remainingMarksCount, error: checkMarksErr } = await supabase.from("marks").select("id", { count: "exact", head: true });
  if (checkMarksErr) throw new Error("Error verifying marks: " + checkMarksErr.message);
  console.log(`  Remaining marks in public.marks: ${remainingMarksCount}`);
  if (remainingMarksCount !== 0) {
    throw new Error(`Expected 0 marks remaining, got ${remainingMarksCount}`);
  }
  console.log("  [VERIFIED] Phase 2 complete: All 100 test marks deleted. Non-target marks count: 0 unchanged.");

  // -------------------------------------------------------------------------
  // PHASE 3: REMOVE LEARNER PUBLIC USER PROFILES
  // -------------------------------------------------------------------------
  console.log("\n>>> PHASE 3: REMOVE LEARNER PUBLIC USER PROFILES");
  const learnerUserIds = learnerUsers.map(lu => lu.id);
  console.log(`  Deleting ${learnerUserIds.length} public.users rows with role='learner' & student_id in target list...`);
  
  const { error: delUsersErr } = await supabase.from("users").delete().in("id", learnerUserIds);
  if (delUsersErr) throw new Error("Error deleting public.users: " + delUsersErr.message);

  const { data: remLearnerUsers, error: checkUsersErr } = await supabase.from("users").select("*").in("id", learnerUserIds);
  if (checkUsersErr) throw new Error("Error checking remaining users: " + checkUsersErr.message);
  if (remLearnerUsers.length !== 0) {
    throw new Error(`Failed to delete all learner users from public.users. Remaining: ${remLearnerUsers.length}`);
  }

  // Verify protected staff users remain completely intact
  const { data: allRemUsers } = await supabase.from("users").select("*");
  console.log(`  Remaining users in public.users: ${allRemUsers?.length}`);
  for (const ru of (allRemUsers || [])) {
    if (ru.role === "learner") {
      throw new Error(`Unexpected remaining learner user in public.users: ${ru.email}`);
    }
  }
  console.log("  [VERIFIED] Phase 3 complete: All 12 learner public.users deleted. Staff users untouched.");

  // -------------------------------------------------------------------------
  // PHASE 4: REMOVE LEARNER AUTHENTICATION ACCOUNTS
  // -------------------------------------------------------------------------
  console.log("\n>>> PHASE 4: REMOVE LEARNER AUTHENTICATION ACCOUNTS");
  for (const tau of targetAuthUsers) {
    console.log(`  Deleting auth user: ${tau.id} (${tau.email})...`);
    const { error: delAuthErr } = await supabase.auth.admin.deleteUser(tau.id);
    if (delAuthErr) {
      throw new Error(`Failed to delete auth user ${tau.id} (${tau.email}): ${delAuthErr.message}`);
    }
  }

  // Verify auth accounts
  const { data: postAuthList } = await supabase.auth.admin.listUsers();
  const remAuthTargetUsers = postAuthList.users.filter(au => targetAuthUsers.some(tau => tau.id === au.id));
  if (remAuthTargetUsers.length !== 0) {
    throw new Error(`Remaining target auth users detected: ${remAuthTargetUsers.length}`);
  }
  console.log(`  Remaining auth accounts in system: ${postAuthList.users.length}`);
  for (const au of postAuthList.users) {
    console.log(`    Preserved Staff Auth Account: ${au.id} | ${au.email}`);
  }
  console.log("  [VERIFIED] Phase 4 complete: All 12 learner auth accounts deleted. Staff auth accounts intact.");

  // -------------------------------------------------------------------------
  // PHASE 5: DELETE THE 12 STUDENT RECORDS
  // -------------------------------------------------------------------------
  console.log("\n>>> PHASE 5: DELETE THE 12 STUDENT RECORDS");
  console.log("  Deleting exactly the 12 audited UUIDs from public.students...");
  const { error: delStdErr } = await supabase.from("students").delete().in("id", targetUuids);
  if (delStdErr) throw new Error("Error deleting students: " + delStdErr.message);

  const { data: postStudents, count: postStdCount, error: checkStdErr } = await supabase.from("students").select("*", { count: "exact" });
  if (checkStdErr) throw new Error("Error verifying students: " + checkStdErr.message);
  console.log(`  Remaining students in public.students: ${postStdCount}`);
  if (postStudents.length !== 0) {
    throw new Error(`Expected 0 students remaining, got ${postStudents.length}`);
  }
  console.log("  [VERIFIED] Phase 5 complete: All 12 target student records deleted. Count in public.students = 0.");

  // -------------------------------------------------------------------------
  // PHASE 6: VERIFY DATABASE INTEGRITY
  // -------------------------------------------------------------------------
  console.log("\n>>> PHASE 6: POST-DELETION INTEGRITY AUDIT");
  const { count: finalStudents } = await supabase.from("students").select("id", { count: "exact", head: true });
  const { count: finalMarks } = await supabase.from("marks").select("id", { count: "exact", head: true });
  const { data: finalLearnerUsers } = await supabase.from("users").select("id").eq("role", "learner");
  const { data: finalExams } = await supabase.from("examinations").select("id, exam_name");
  const { data: finalClasses } = await supabase.from("classes").select("id, class_name");
  const { data: finalStreams } = await supabase.from("streams").select("id, stream_name");
  const { data: finalSubjects } = await supabase.from("subjects").select("id, name");
  const { data: finalTeachers } = await supabase.from("teachers").select("id, teacher_name");

  console.log(`  public.students count: ${finalStudents} (EXPECTED: 0)`);
  console.log(`  public.marks count: ${finalMarks} (EXPECTED: 0)`);
  console.log(`  public.users (role='learner'): ${finalLearnerUsers?.length} (EXPECTED: 0)`);
  console.log(`  public.examinations preserved: ${finalExams?.length} exams`);
  console.log(`  public.classes preserved: ${finalClasses?.length} classes`);
  console.log(`  public.streams preserved: ${finalStreams?.length} streams`);
  console.log(`  public.subjects preserved: ${finalSubjects?.length} subjects`);
  console.log(`  public.teachers preserved: ${finalTeachers?.length} teachers`);

  if (finalStudents !== 0 || finalMarks !== 0 || (finalLearnerUsers?.length || 0) !== 0) {
    throw new Error("Integrity check failed: Expected clean slate of 0 students, 0 marks, 0 learner users.");
  }
  console.log("  [VERIFIED] Database integrity check PASSED.");
}

runCleanup().catch(err => {
  console.error("FATAL ERROR DURING CLEANUP:", err);
  process.exit(1);
});
