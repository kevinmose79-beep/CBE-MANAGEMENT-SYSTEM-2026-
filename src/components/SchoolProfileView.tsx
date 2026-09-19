import React, { useState, useEffect } from 'react';
import { Building2, CheckCircle2, Save } from 'lucide-react';
import { School } from '../types';

export const KENYAN_COUNTIES = [
  'Baringo',
  'Bomet',
  'Bungoma',
  'Busia',
  'Elgeyo Marakwet',
  'Embu',
  'Garissa',
  'Homa Bay',
  'Isiolo',
  'Kajiado',
  'Kakamega',
  'Kericho',
  'Kiambu',
  'Kilifi',
  'Kirinyaga',
  'Kisii',
  'Kisumu',
  'Kitui',
  'Kwale',
  'Laikipia',
  'Lamu',
  'Machakos',
  'Makueni',
  'Mandera',
  'Marsabit',
  'Meru',
  'Migori',
  'Mombasa',
  'Murang\'a',
  'Nairobi',
  'Nakuru',
  'Nandi',
  'Narok',
  'Nyamira',
  'Nyandarua',
  'Nyeri',
  'Samburu',
  'Siaya',
  'Taita Taveta',
  'Tana River',
  'Tharaka Nithi',
  'Trans Nzoia',
  'Turkana',
  'Uasin Gishu',
  'Vihiga',
  'Wajir',
  'West Pokot',
];

interface SchoolProfileViewProps {
  school: School;
  onSaveSchool: (updatedSchool: School) => void;
  readOnly?: boolean;
}

export const SchoolProfileView: React.FC<SchoolProfileViewProps> = ({
  school,
  onSaveSchool,
  readOnly = false,
}) => {
  const [formData, setFormData] = useState({
    school_name: school?.school_name || '',
    motto: school?.motto || '',
    county: school?.county || '',
    postal_code: school?.postal_code || school?.address || '',
    email: school?.email || '',
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setFormData({
      school_name: school?.school_name || '',
      motto: school?.motto || '',
      county: school?.county || '',
      postal_code: school?.postal_code || school?.address || '',
      email: school?.email || '',
    });
  }, [school]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanPostal = formData.postal_code.trim();

    // Retain strictly the 5 supported fields
    const updated: School = {
      id: school?.id || '00000000-0000-0000-0000-000000000001',
      school_name: formData.school_name.trim(),
      motto: formData.motto.trim(),
      county: formData.county.trim(),
      postal_code: cleanPostal,
      address: cleanPostal, // Synchronize address field for backward compatibility with existing report templates
      email: formData.email.trim(),
    };

    onSaveSchool(updated);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 4000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Form Container */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Container Header */}
        <div className="bg-[#F8FAFC] dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 sm:py-4">
          <div className="flex items-start space-x-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#E8F5EF] dark:bg-emerald-950/60 text-[#075E42] dark:text-emerald-400 flex items-center justify-center shrink-0 border border-[#087F5B]/20 dark:border-emerald-800/60 mt-0.5">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-snug">
                School Information &amp; Official Branding
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">
                Configure the basic school information used throughout the assessment system and official reports.
              </p>
            </div>
          </div>
        </div>

        {/* Success Alert Banner */}
        {savedSuccess && (
          <div className="mx-5 sm:mx-6 mt-4 p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 flex items-center space-x-2.5 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm font-medium animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>School information saved successfully!</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {/* School Name* (Full Width) */}
            <div className="md:col-span-2">
              <label htmlFor="school_name" className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                School Name<span className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                id="school_name"
                type="text"
                required
                disabled={readOnly}
                placeholder="Enter official school name"
                value={formData.school_name}
                onChange={(e) => setFormData({ ...formData, school_name: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm font-medium border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#075E42] focus:border-[#075E42] focus:outline-none transition bg-white dark:bg-slate-800 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            {/* School Motto (Full Width) */}
            <div className="md:col-span-2">
              <label htmlFor="motto" className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                School Motto
              </label>
              <input
                id="motto"
                type="text"
                disabled={readOnly}
                placeholder="Enter school motto"
                value={formData.motto}
                onChange={(e) => setFormData({ ...formData, motto: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#075E42] focus:border-[#075E42] focus:outline-none transition bg-white dark:bg-slate-800 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            {/* County* */}
            <div>
              <label htmlFor="county" className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                County<span className="text-red-500 ml-0.5">*</span>
              </label>
              <select
                id="county"
                required
                disabled={readOnly}
                value={formData.county}
                onChange={(e) => setFormData({ ...formData, county: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#075E42] focus:border-[#075E42] focus:outline-none transition disabled:bg-slate-100 dark:disabled:bg-slate-800/50 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800"
              >
                <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Select County ▼</option>
                {KENYAN_COUNTIES.map((county) => (
                  <option key={county} value={county} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                    {county}
                  </option>
                ))}
              </select>
            </div>

            {/* Postal Code */}
            <div>
              <label htmlFor="postal_code" className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                Postal Code
              </label>
              <input
                id="postal_code"
                type="text"
                disabled={readOnly}
                placeholder="e.g. 00100"
                value={formData.postal_code}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#075E42] focus:border-[#075E42] focus:outline-none transition bg-white dark:bg-slate-800 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            {/* Email Address (Full Width or 2-col) */}
            <div className="md:col-span-2">
              <label htmlFor="email" className="block text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                disabled={readOnly}
                placeholder="e.g. info@school.ac.ke"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-[#075E42] focus:border-[#075E42] focus:outline-none transition bg-white dark:bg-slate-800 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Form Actions / Save Button */}
          {!readOnly && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-3 bg-[#075E42] hover:bg-[#054531] active:bg-[#033022] text-white font-bold text-sm rounded-lg shadow-xs transition flex items-center justify-center space-x-2 cursor-pointer focus:ring-2 focus:ring-[#075E42] focus:ring-offset-2 dark:focus:ring-offset-slate-900 min-h-[44px]"
              >
                <Save className="w-4 h-4" />
                <span>Save School Information</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
