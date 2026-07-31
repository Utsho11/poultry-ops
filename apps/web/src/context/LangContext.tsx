import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'bn';

interface LangContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    appTitle: 'PoultryOps',
    tagline: 'Multi-Tenant Farm Management SaaS',
    dashboard: 'Dashboard',
    batches: 'Batches',
    dailyLog: 'Daily Worker Log',
    expensesHealth: 'Expenses & Health',
    reports: 'Reports & Analytics',
    teamSettings: 'Team & Reminders',
    logout: 'Logout',
    welcomeBack: 'Welcome back',
    activeBirds: 'Active Birds',
    dailyEggCount: 'Daily Eggs',
    mortalityRate: 'Mortality Rate',
    fcr: 'Feed Conversion Ratio (FCR)',
    monthlyExpenses: 'Monthly Expenses',
    addBatch: '+ New Batch',
    newLog: '+ Submit Daily Log',
    addExpense: '+ Add Expense',
    addHealthRecord: '+ Health Check / Vaccine',
    saveLog: 'Save Daily Log',
    selectBatch: 'Select Batch',
    date: 'Date',
    eggCount: 'Egg Count',
    brokenEggs: 'Broken Eggs',
    deadBirds: 'Dead Birds',
    feedKg: 'Feed (kg)',
    waterLiters: 'Water (Liters)',
    notes: 'Notes / Remarks',
    recentLogs: 'Recent Worker Logs',
    exportReport: 'Export Report',
    language: 'Language',
    roleOwner: 'Owner',
    roleManager: 'Manager',
    roleWorker: 'Worker'
  },
  bn: {
    appTitle: 'পল্ট্রিঅপস',
    tagline: 'মাল্টি-টেন্যান্ট খামার ব্যবস্থাপনা সফটওয়্যার',
    dashboard: 'ড্যাশবোর্ড',
    batches: 'ব্যাচসমূহ',
    dailyLog: 'দৈনিক লেবার লগ',
    expensesHealth: 'খরচ ও স্বাস্থ্যসেবা',
    reports: 'রিপোর্ট ও বিশ্লেষণ',
    teamSettings: 'টিম ও রিমাইন্ডার',
    logout: 'লগআউট',
    welcomeBack: 'স্বাগতম',
    activeBirds: 'জীবিত মুরগির সংখ্যা',
    dailyEggCount: 'দৈনিক ডিমের সংখ্যা',
    mortalityRate: 'মৃত্যুহার (Mortality)',
    fcr: 'এফসিআর (FCR)',
    monthlyExpenses: 'মাসিক মোট খরচ',
    addBatch: '+ নতুন ব্যাচ',
    newLog: '+ দৈনিক লগ দিন',
    addExpense: '+ নতুন খরচ যোগ করুন',
    addHealthRecord: '+ টিকা / চিকিৎসা যোগ করুন',
    saveLog: 'লগ সংরক্ষণ করুন',
    selectBatch: 'ব্যাচ সিলেক্ট করুন',
    date: 'তারিখ',
    eggCount: 'সংগৃহীত ডিম',
    brokenEggs: 'ভাঙা ডিম',
    deadBirds: 'মৃত মুরগি',
    feedKg: 'খাবার (কেজি)',
    waterLiters: 'পানি (লিটার)',
    notes: 'মন্তব্য',
    recentLogs: 'সাম্প্রতিক খামার লগ',
    exportReport: 'রিপোর্ট ডাউনলোড',
    language: 'ভাষা',
    roleOwner: 'মালিক (Owner)',
    roleManager: 'ম্যানেজার',
    roleWorker: 'শ্রমিক (Worker)'
  }
};

const LangContext = createContext<LangContextType | undefined>(undefined);

export const LangProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('poultry_ops_lang') as Language) || 'en';
  });

  useEffect(() => {
    localStorage.setItem('poultry_ops_lang', lang);
  }, [lang]);

  const t = (key: string): string => {
    return translations[lang][key] || key;
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
};

export const useLang = () => {
  const context = useContext(LangContext);
  if (!context) throw new Error('useLang must be used within LangProvider');
  return context;
};
