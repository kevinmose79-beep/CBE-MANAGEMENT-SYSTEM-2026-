import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
  Cell,
} from 'recharts';
import {
  Examination,
  Student,
  ClassStream,
  Subject,
  Mark,
  Grade,
  EducationLevel,
} from '../types';
import {
  ExaminationComparisonData,
  DeviationItem,
  calculateMultiExamSubjectTrends,
} from '../services/schoolAnalyticsEngine';
import { ChartWrapper } from './ChartWrapper';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  LineChart as LineChartIcon,
  Layers,
  ArrowRightLeft,
  Filter,
  CheckCircle2,
  Sparkles,
  Info,
} from 'lucide-react';

interface SubjectPerformanceTrendsGraphProps {
  comparison: ExaminationComparisonData | null;
  allExams: Examination[];
  students: Student[];
  classes: ClassStream[];
  subjects: Subject[];
  marks: Mark[];
  grades: Grade[];
  selectedLevel: EducationLevel;
  selectedClass?: string;
}

type ChartType = 'grouped-bar' | 'trend-line' | 'net-change';
type MetricType = 'percentage' | 'points';

export const SubjectPerformanceTrendsGraph: React.FC<SubjectPerformanceTrendsGraphProps> = ({
  comparison,
  allExams,
  students,
  classes,
  subjects,
  marks,
  grades,
  selectedLevel,
  selectedClass = 'all',
}) => {
  const [chartType, setChartType] = useState<ChartType>('grouped-bar');
  const [metricType, setMetricType] = useState<MetricType>('percentage');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [showBenchmark, setShowBenchmark] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'comparison' | 'longitudinal'>('comparison');

  // Compute multi-exam longitudinal trends
  const multiTrends = useMemo(() => {
    return calculateMultiExamSubjectTrends(
      allExams,
      students,
      classes,
      subjects,
      marks,
      grades,
      selectedLevel,
      selectedClass
    );
  }, [allExams, students, classes, subjects, marks, grades, selectedLevel, selectedClass]);

  // Process data for two-exam comparison charts
  const comparisonChartData = useMemo(() => {
    if (!comparison || !comparison.subject_deviations) return [];

    return comparison.subject_deviations.map((d: DeviationItem) => {
      const isPoints = metricType === 'points';
      const currentVal = isPoints ? d.current_points : Math.round(d.current_mean * 100) / 100;
      const prevVal = isPoints ? d.previous_points : Math.round(d.previous_mean * 100) / 100;
      const diffVal = isPoints ? d.diff_points : Math.round(d.diff_mean * 100) / 100;

      return {
        id: d.id,
        name: d.name,
        category: d.category,
        current_mean: currentVal,
        previous_mean: prevVal,
        diff_mean: diffVal,
        percentage_change: d.percentage_change,
        current_level: d.current_level,
        previous_level: d.previous_level,
        trend: d.trend,
      };
    });
  }, [comparison, metricType]);

  // Filtered comparison data
  const filteredComparisonData = useMemo(() => {
    if (selectedSubjectFilter === 'all') return comparisonChartData;
    return comparisonChartData.filter((d) => d.name === selectedSubjectFilter);
  }, [comparisonChartData, selectedSubjectFilter]);

  // Summary KPI stats for comparison
  const stats = useMemo(() => {
    if (!comparison || !comparison.subject_deviations) {
      return { improved: 0, declined: 0, steady: 0, topGainer: null, topDecliner: null };
    }

    const items = comparison.subject_deviations;
    let improved = 0;
    let declined = 0;
    let steady = 0;
    let topGainer: DeviationItem | null = null;
    let topDecliner: DeviationItem | null = null;

    items.forEach((item) => {
      if (item.diff_mean > 0.05) {
        improved++;
        if (!topGainer || item.diff_mean > topGainer.diff_mean) {
          topGainer = item;
        }
      } else if (item.diff_mean < -0.05) {
        declined++;
        if (!topDecliner || item.diff_mean < topDecliner.diff_mean) {
          topDecliner = item;
        }
      } else {
        steady++;
      }
    });

    return { improved, declined, steady, topGainer, topDecliner };
  }, [comparison]);

  // Trajectory comparison line points (2 milestones: Prev Exam -> Current Exam)
  const trajectoryLineData = useMemo(() => {
    if (!comparison || !filteredComparisonData.length) return [];

    const prevLabel = `${comparison.examB.term} (${comparison.examB.exam_name})`;
    const currLabel = `${comparison.examA.term} (${comparison.examA.exam_name})`;

    const prevPoint: any = { milestone: prevLabel, exam_name: comparison.examB.exam_name };
    const currPoint: any = { milestone: currLabel, exam_name: comparison.examA.exam_name };

    filteredComparisonData.forEach((subj) => {
      prevPoint[subj.name] = subj.previous_mean;
      currPoint[subj.name] = subj.current_mean;
    });

    return [prevPoint, currPoint];
  }, [comparison, filteredComparisonData]);

  // Subject palette mapping
  const subjectColorMap = useMemo(() => {
    const map = new Map<string, string>();
    multiTrends.subjects.forEach((s) => {
      map.set(s.subject_name, s.color);
    });
    return map;
  }, [multiTrends.subjects]);

  // If no comparison data is available
  const hasComparisonData = Boolean(comparison && comparison.subject_deviations && comparison.subject_deviations.length > 0);
  const hasLongitudinalData = multiTrends.points.length > 1;

  // Custom Tooltip for Two-Exam Comparison
  const CustomComparisonTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataItem = payload[0].payload;
      const isPoints = metricType === 'points';
      const unit = isPoints ? ' pts' : '%';

      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-200 p-3.5 rounded-xl shadow-xl text-xs min-w-[280px] max-w-xs space-y-2 z-50 pointer-events-none">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 gap-2">
            <span className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{dataItem.name || label}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
              dataItem.diff_mean > 0
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60'
                : dataItem.diff_mean < 0
                ? 'bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60'
                : 'bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700'
            }`}>
              {dataItem.trend || (dataItem.diff_mean > 0 ? '▲ Improved' : dataItem.diff_mean < 0 ? '▼ Declined' : '▬ Stable')}
            </span>
          </div>

          <div className="space-y-2 pt-1">
            {/* Exam A (Target / Current) */}
            <div className="space-y-1">
              <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shrink-0"></span>
                <span className="truncate max-w-[240px]" title={comparison?.examA.exam_name}>
                  {comparison?.examA.exam_name} ({comparison?.examA.term})
                </span>
              </div>
              <div className="flex items-center justify-between pl-4 text-[11px]">
                <span className="text-slate-400 dark:text-slate-500">Average:</span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                  {dataItem.current_mean?.toFixed(2)}{unit} {dataItem.current_level ? `(${dataItem.current_level})` : ''}
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100 dark:border-slate-800/80 my-1" />

            {/* Exam B (Comparison / Previous) */}
            <div className="space-y-1">
              <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 shrink-0"></span>
                <span className="truncate max-w-[240px]" title={comparison?.examB.exam_name}>
                  {comparison?.examB.exam_name} ({comparison?.examB.term})
                </span>
              </div>
              <div className="flex items-center justify-between pl-4 text-[11px]">
                <span className="text-slate-400 dark:text-slate-500">Average:</span>
                <span className="font-extrabold text-blue-600 dark:text-blue-400">
                  {dataItem.previous_mean?.toFixed(2)}{unit} {dataItem.previous_level ? `(${dataItem.previous_level})` : ''}
                </span>
              </div>
            </div>

            {/* Net Deviation Row */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-2 flex justify-between items-center font-bold">
              <span className="text-slate-500 dark:text-slate-400">Net Deviation:</span>
              <span className={`text-xs ${
                dataItem.diff_mean > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : dataItem.diff_mean < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-600 dark:text-slate-400'
              }`}>
                {dataItem.diff_mean > 0 ? '+' : ''}{dataItem.diff_mean?.toFixed(2)}{unit} ({dataItem.percentage_change > 0 ? '+' : ''}{dataItem.percentage_change?.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip for Longitudinal Line Trends
  const CustomLongitudinalTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-200 p-3.5 rounded-xl shadow-xl text-xs min-w-[200px] max-w-sm space-y-2 z-50 pointer-events-none">
          <div className="font-bold text-slate-800 dark:text-slate-100 text-sm border-b border-slate-100 dark:border-slate-800 pb-1.5">
            {label}
          </div>
          <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
            {payload.map((entry: any) => (
              <div key={entry.name} className="flex justify-between items-center space-x-3">
                <span className="flex items-center space-x-1.5 truncate text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: entry.color }}></span>
                  <span className="truncate">{entry.name}:</span>
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-100 text-xs flex-shrink-0">
                  {typeof entry.value === 'number' ? `${entry.value.toFixed(2)}%` : entry.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div id="subject-performance-trends-container" className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-6">
      {/* Header Bar */}
      <div className="p-5 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 rounded-lg">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Subject Performance Trends & Comparative Analysis
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Visual tracking of learning area average scores and competency progressions across terms & assessments.
            </p>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle (Head-to-Head vs Multi-Term) */}
            {hasLongitudinalData && (
              <div className="flex items-center bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-semibold">
                <button
                  onClick={() => setViewMode('comparison')}
                  className={`px-2.5 py-1 rounded-md transition-colors flex items-center space-x-1.5 ${
                    viewMode === 'comparison'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Exam Comparison</span>
                </button>
                <button
                  onClick={() => setViewMode('longitudinal')}
                  className={`px-2.5 py-1 rounded-md transition-colors flex items-center space-x-1.5 ${
                    viewMode === 'longitudinal'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <LineChartIcon className="w-3.5 h-3.5" />
                  <span>Multi-Term Trend ({multiTrends.examCount})</span>
                </button>
              </div>
            )}

            {/* Chart Type Toggle (For Comparison View) */}
            {viewMode === 'comparison' && (
              <div className="flex items-center bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-semibold">
                <button
                  title="Grouped Side-by-Side Bar Chart"
                  onClick={() => setChartType('grouped-bar')}
                  className={`px-2.5 py-1 rounded-md transition-colors flex items-center space-x-1 ${
                    chartType === 'grouped-bar'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Grouped Bars</span>
                </button>
                <button
                  title="Progression Trajectory Line Chart"
                  onClick={() => setChartType('trend-line')}
                  className={`px-2.5 py-1 rounded-md transition-colors flex items-center space-x-1 ${
                    chartType === 'trend-line'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <LineChartIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Trajectory</span>
                </button>
                <button
                  title="Net Deviation % Gain/Drop"
                  onClick={() => setChartType('net-change')}
                  className={`px-2.5 py-1 rounded-md transition-colors flex items-center space-x-1 ${
                    chartType === 'net-change'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Net Gain/Drop</span>
                </button>
              </div>
            )}

            {/* Metric Toggle (Percentage vs Points) */}
            <div className="flex items-center bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setMetricType('percentage')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  metricType === 'percentage'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Mean %
              </button>
              <button
                onClick={() => setMetricType('points')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  metricType === 'points'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Points
              </button>
            </div>

            {/* Subject Spotlight Selector */}
            <div className="relative">
              <select
                aria-label="Filter by Learning Area"
                value={selectedSubjectFilter}
                onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold px-2.5 py-1.5 pr-7 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
              >
                <option value="all">All Learning Areas ({comparison?.subject_deviations.length || multiTrends.subjects.length})</option>
                {multiTrends.subjects.map((s) => (
                  <option key={s.subject_id} value={s.subject_name}>
                    {s.subject_name} ({s.subject_code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Quick KPI Badges Strip (When in Comparison Mode) */}
        {viewMode === 'comparison' && hasComparisonData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
            <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-xl border border-emerald-100 dark:border-emerald-900/60 flex items-center space-x-2.5">
              <div className="p-2 bg-emerald-600 text-white rounded-lg">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 dark:text-emerald-400">
                  Gaining Subjects
                </div>
                <div className="text-sm font-extrabold text-emerald-900 dark:text-emerald-200">
                  {stats.improved} {stats.improved === 1 ? 'Subject' : 'Subjects'}
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-rose-50/70 dark:bg-rose-950/40 rounded-xl border border-rose-100 dark:border-rose-900/60 flex items-center space-x-2.5">
              <div className="p-2 bg-rose-600 text-white rounded-lg">
                <TrendingDown className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-rose-700 dark:text-rose-400">
                  Declining Subjects
                </div>
                <div className="text-sm font-extrabold text-rose-900 dark:text-rose-200">
                  {stats.declined} {stats.declined === 1 ? 'Subject' : 'Subjects'}
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center space-x-2.5">
              <div className="p-2 bg-slate-500 text-white rounded-lg">
                <Minus className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-600 dark:text-slate-400">
                  Stable Subjects
                </div>
                <div className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                  {stats.steady} {stats.steady === 1 ? 'Subject' : 'Subjects'}
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-blue-50/70 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/60 flex items-center space-x-2.5">
              <div className="p-2 bg-blue-600 text-white rounded-lg">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="truncate">
                <div className="text-[10px] uppercase font-bold tracking-wider text-blue-700 dark:text-blue-400">
                  Top Gainer
                </div>
                <div className="text-xs font-bold text-blue-900 dark:text-blue-200 truncate">
                  {stats.topGainer ? `${stats.topGainer.name} (+${stats.topGainer.diff_mean.toFixed(1)}%)` : 'None'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chart Canvas Body */}
      <div className="p-5">
        {viewMode === 'comparison' ? (
          hasComparisonData ? (
            <ChartWrapper
              hasData={filteredComparisonData.length > 0}
              className="w-full h-80 min-h-[320px]"
              emptyTitle="No Subject Deviation Data"
              emptySubtext="Ensure both selected examinations have approved assessment scores."
            >
              {chartType === 'grouped-bar' && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={filteredComparisonData}
                    margin={{ top: 20, right: 25, left: 0, bottom: 65 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
                    <XAxis
                      dataKey="name"
                      angle={-30}
                      textAnchor="end"
                      interval={0}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      height={65}
                    />
                    <YAxis
                      domain={metricType === 'points' ? [0, 8] : [0, 100]}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      unit={metricType === 'points' ? ' pts' : '%'}
                    />
                    <Tooltip content={<CustomComparisonTooltip />} />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      wrapperStyle={{ fontSize: 12, paddingBottom: 10 }}
                    />
                    {showBenchmark && metricType === 'percentage' && (
                      <ReferenceLine
                        y={50}
                        stroke="#10b981"
                        strokeDasharray="4 4"
                        label={{
                          value: 'ME Benchmark (50%)',
                          position: 'top',
                          fill: '#059669',
                          fontSize: 10,
                          fontWeight: 'bold',
                        }}
                      />
                    )}
                    <Bar
                      dataKey="current_mean"
                      name={`${comparison?.examA.exam_name} (${comparison?.examA.term}) [Target]`}
                      fill="#059669"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="previous_mean"
                      name={`${comparison?.examB.exam_name} (${comparison?.examB.term}) [Comparison]`}
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}

              {chartType === 'trend-line' && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trajectoryLineData}
                    margin={{ top: 25, right: 35, left: 10, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
                    <XAxis
                      dataKey="milestone"
                      tick={{ fontSize: 12, fontWeight: 'bold', fill: '#475569' }}
                      padding={{ left: 40, right: 40 }}
                    />
                    <YAxis
                      domain={metricType === 'points' ? [0, 8] : [0, 100]}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      unit={metricType === 'points' ? ' pts' : '%'}
                    />
                    <Tooltip content={<CustomLongitudinalTooltip />} />
                    <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12 }} />
                    {showBenchmark && metricType === 'percentage' && (
                      <ReferenceLine
                        y={50}
                        stroke="#10b981"
                        strokeDasharray="4 4"
                        label={{ value: 'ME 50%', position: 'insideRight', fill: '#059669', fontSize: 10 }}
                      />
                    )}
                    {filteredComparisonData.map((subj, idx) => {
                      const color = subjectColorMap.get(subj.name) || '#059669';
                      return (
                        <Line
                          key={subj.name}
                          type="monotone"
                          dataKey={subj.name}
                          name={subj.name}
                          stroke={color}
                          strokeWidth={2.5}
                          activeDot={{ r: 7 }}
                          dot={{ r: 5, fill: color }}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              )}

              {chartType === 'net-change' && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={filteredComparisonData}
                    margin={{ top: 20, right: 25, left: 0, bottom: 65 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
                    <XAxis
                      dataKey="name"
                      angle={-30}
                      textAnchor="end"
                      interval={0}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      height={65}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      unit={metricType === 'points' ? ' pts' : '%'}
                    />
                    <Tooltip content={<CustomComparisonTooltip />} />
                    <ReferenceLine y={0} stroke="#64748b" strokeWidth={1.5} />
                    <Bar dataKey="diff_mean" name="Net Score Difference" radius={[4, 4, 0, 0]}>
                      {filteredComparisonData.map((entry) => (
                        <Cell
                          key={`cell-${entry.id}`}
                          fill={entry.diff_mean >= 0 ? '#10b981' : '#f43f5e'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartWrapper>
          ) : (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700/60">
              <ArrowRightLeft className="w-10 h-10 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Select Two Assessments to Compare Subject Trends
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Choose a Target Assessment and a Comparison Assessment using the dropdown selectors above to view subject average scores and deviation trends.
              </p>
            </div>
          )
        ) : (
          /* Multi-Term Longitudinal Trend Line Chart */
          <ChartWrapper
            hasData={multiTrends.points.length > 0}
            className="w-full h-80 min-h-[320px]"
            emptyTitle="Insufficient Historical Assessment Data"
            emptySubtext="At least two completed examinations are needed to chart chronological subject performance trends."
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={multiTrends.points}
                margin={{ top: 20, right: 35, left: 10, bottom: 50 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
                <XAxis
                  dataKey="milestone"
                  angle={-20}
                  textAnchor="end"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  height={50}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  unit="%"
                />
                <Tooltip content={<CustomLongitudinalTooltip />} />
                <Legend verticalAlign="top" height={40} wrapperStyle={{ fontSize: 11, paddingBottom: 10 }} />
                {showBenchmark && (
                  <ReferenceLine
                    y={50}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    label={{ value: 'ME 50%', position: 'insideRight', fill: '#059669', fontSize: 10 }}
                  />
                )}
                {multiTrends.subjects
                  .filter((s) => selectedSubjectFilter === 'all' || s.subject_name === selectedSubjectFilter)
                  .map((s) => (
                    <Line
                      key={s.subject_id}
                      type="monotone"
                      dataKey={s.subject_name}
                      name={s.subject_name}
                      stroke={s.color}
                      strokeWidth={selectedSubjectFilter === s.subject_name ? 3.5 : 2}
                      activeDot={{ r: 7 }}
                      dot={{ r: 4, fill: s.color }}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartWrapper>
        )}
      </div>

      {/* Chart Footer with Insight Note */}
      <div className="px-5 py-3 bg-slate-50/60 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
        <div className="flex items-center space-x-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span>
            {viewMode === 'comparison'
              ? `Comparing ${comparison?.examA.exam_name || 'Target'} against ${comparison?.examB.exam_name || 'Comparison'}. Averages reflect evaluated student marks in ${selectedLevel}.`
              : `Tracking ${multiTrends.subjects.length} learning areas across ${multiTrends.examCount} recorded assessment milestones.`}
          </span>
        </div>
        <div className="flex items-center space-x-3 text-[11px] font-medium">
          <button
            onClick={() => setShowBenchmark(!showBenchmark)}
            className="text-emerald-700 dark:text-emerald-400 hover:underline flex items-center space-x-1"
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>{showBenchmark ? 'Hide 50% Benchmark' : 'Show 50% Benchmark'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
