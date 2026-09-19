import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

function getCbePerformanceLevel(score: number): { level: string; label: string } {
  if (score >= 80) return { level: "EE", label: "Exceeding Expectations" };
  if (score >= 60) return { level: "ME", label: "Meeting Expectations" };
  if (score >= 40) return { level: "AE", label: "Approaching Expectations" };
  return { level: "BE", label: "Below Expectations" };
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(url, key);

async function smokeTest() {
  console.log("================================================================================");
  console.log("PHASE 11: PRODUCTION READINESS SMOKE TEST");
  console.log("================================================================================");

  // 1. Fetch available class, stream, subject, exam
  const { data: classes } = await supabase.from("classes").select("*").limit(1);
  const { data: streams } = await supabase.from("streams").select("*").limit(1);
  const { data: subjects } = await supabase.from("subjects").select("*").limit(3);
  const { data: exams } = await supabase.from("examinations").select("*").limit(1);

  if (!classes || classes.length === 0 || !streams || streams.length === 0 || !exams || exams.length === 0) {
    throw new Error("Missing academic foundation data (classes, streams, exams) in Supabase!");
  }

  const testClass = classes[0];
  const testStream = streams[0];
  const testExam = exams[0];

  console.log(`Using Class: ${testClass.class_name} (${testClass.id})`);
  console.log(`Using Stream: ${testStream.stream_name} (${testStream.id})`);
  console.log(`Using Exam: ${testExam.exam_name} (${testExam.id})`);

  // Clean up any previous test learner
  await supabase.from("students").delete().eq("admission_number", "ADM-2026-001");

  // 2. Create one genuine production learner
  const smokeAdm = "ADM-2026-001";
  const smokeStudent = {
    admission_number: smokeAdm,
    full_name: "Wanjiku Njoroge",
    gender: "F",
    class_id: testClass.id,
    stream_id: testStream.id,
    active: true,
  };

  console.log("\n1. Enrolling genuine production smoke learner into Supabase...");
  const { data: insertedStudent, error: insertErr } = await supabase
    .from("students")
    .insert(smokeStudent)
    .select()
    .single();

  if (insertErr || !insertedStudent) {
    throw new Error("Failed to insert production learner: " + insertErr?.message);
  }
  console.log(`  [PASSED] Learner created with UUID: ${insertedStudent.id}`);

  // 3. Enter marks for this learner
  console.log("\n2. Entering assessment marks for production learner...");
  const testMarks = (subjects || []).slice(0, 2).map((sub, idx) => ({
    student_id: insertedStudent.id,
    subject_id: sub.id,
    exam_id: testExam.id,
    marks: 75 + idx * 5, // 75, 80
    remarks: JSON.stringify({
      raw_score: 75 + idx * 5,
      out_of: 100,
      special_status: "Normal",
      irregularity_reason: null
    })
  }));

  const { data: insertedMarks, error: marksErr } = await supabase
    .from("marks")
    .insert(testMarks)
    .select();

  if (marksErr || !insertedMarks || insertedMarks.length !== testMarks.length) {
    throw new Error("Failed to insert marks: " + marksErr?.message);
  }
  console.log(`  [PASSED] Successfully inserted ${insertedMarks.length} marks.`);

  // 4. Retrieve marks and compute performance
  console.log("\n3. Testing Assessment Retrieval & Grading Engine...");
  const { data: fetchedMarks, error: fetchMarksErr } = await supabase
    .from("marks")
    .select("*")
    .eq("student_id", insertedStudent.id);

  if (fetchMarksErr || !fetchedMarks || fetchedMarks.length !== 2) {
    throw new Error("Marks retrieval failed!");
  }

  const avgScore = fetchedMarks.reduce((acc, m) => acc + Number(m.marks), 0) / fetchedMarks.length;
  console.log(`  Calculated Average Score: ${avgScore}%`);
  const levelObj = getCbePerformanceLevel(avgScore);
  console.log(`  CBE Performance Level: ${levelObj.level} (${levelObj.label})`);
  console.log("  [PASSED] Assessment retrieval & grading engine computed successfully.");

  // 5. Clean up the smoke test learner so the production database is 100% clean
  console.log("\n4. Cleaning up smoke test learner to restore absolute zero baseline...");
  const { error: delSmokeMarksErr } = await supabase.from("marks").delete().eq("student_id", insertedStudent.id);
  if (delSmokeMarksErr) throw new Error("Smoke marks cleanup failed: " + delSmokeMarksErr.message);

  const { error: delSmokeStdErr } = await supabase.from("students").delete().eq("id", insertedStudent.id);
  if (delSmokeStdErr) throw new Error("Smoke student cleanup failed: " + delSmokeStdErr.message);

  const { count: finalCount } = await supabase.from("students").select("id", { count: "exact", head: true });
  console.log(`  Final student count in Supabase: ${finalCount}`);
  if (finalCount !== 0) throw new Error("Database not at 0 students after smoke cleanup!");

  console.log("  [PASSED] Smoke test completed successfully and database verified at 0 students.");
}

smokeTest().catch(err => {
  console.error("SMOKE TEST FAILED:", err);
  process.exit(1);
});
